// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const config = require("config");

const GROUP_FIELDS = [
  "hour",
  "day",
  "service",
  "country",
  "subdivision",
  "isp",
];
const SORT_FIELDS = ["count", "max", "min", "average", "total"];

class DummyCollection {
  constructor() {
    this.dummyData = {};
  }

  aggregate() {
    // TODO
    return this.dummyData;
  }
}

class DummyMongodb {
  constructor() {
    this.dummyCollection = new DummyCollection();
  }

  collection() {
    return this.dummyCollection;
  }
}

const proc = async (req, res, next) => {
  const { body: args } = req;

  const group = GROUP_FIELDS.find(
    (e) => e === (args.group ? args.group.toLowerCase() : "")
  );
  const { country } = args;
  const limit =
    args.limit && args.limit > 0 && args.limit <= config.get("db.limit.max")
      ? args.limit
      : config.get("db.limit.default");
  let sort = [];
  if (args.sort) {
    Object.keys(args.sort).forEach((e) => {
      const field = SORT_FIELDS.find((f) => f === e.toLowerCase());
      if (field) {
        sort.push([field, args.sort[field] === 1 ? 1 : -1]);
      }
    });
  }

  let query;
  try {
    if (group === "hour") {
      query = {
        $and: [
          {
            type: "ALL_HOURS",
          },
        ],
      };
      sort = [["hour", 1]];
    } else if (group === "day") {
      query = {
        $and: [
          {
            type: "ALL_DAYS",
          },
        ],
      };
      sort = [["day", 1]];
    } else if (group === "service") {
      query = {
        $and: [
          {
            type: "SERVICE",
          },
        ],
      };
    } else if (group === "country") {
      query = {
        $and: [
          {
            type: "COUNTRY",
          },
        ],
      };
    } else if (group === "subdivision") {
      if (!country) throw new Error("subdivision must specific country");
      query = {
        $and: [
          {
            type: "SUBDIVISION",
          },
        ],
      };
    } else if (group === "isp") {
      query = {
        $and: [
          {
            type: "ISP",
          },
        ],
      };
    } else {
      query = {
        $and: [
          {
            type: "ALL",
          },
        ],
      };
    }
  } catch (e) {
    next(
      {
        message: `Bad Request ${e}`,
        status: 400,
      },
      req,
      res,
      next
    );
    return;
  }

  const options = {
    projection: { _id: 0, type: 0 },
    limit,
    sort,
  };

  let mongodb = req.app.get("mongodb");
  if (!mongodb) {
    mongodb = new DummyMongodb();
  }

  let collection;
  try {
    collection = await mongodb.collection(config.get("db.stats_collection"));
  } catch (e) {
    next(
      {
        message: "Internal Server Error",
        status: 500,
      },
      req,
      res,
      next
    );
  }

  try {
    const docs = await collection.find(query, options).toArray();
    if (!docs) throw new Error("find failed");
    res.json(docs).status(200);
  } catch (e) {
    next(
      {
        message: "Internal Server Error",
        status: 500,
      },
      req,
      res,
      next
    );
  }
};

const router = express.Router();

router.get("/", async (req, res, next) => proc(req, res, next));

router.post("/", async (req, res, next) => proc(req, res, next));

// eslint-disable-next-line no-unused-vars
router.get("/", (err, req, res, next) =>
  res.status(err.status).send(err.message)
);

// eslint-disable-next-line no-unused-vars
router.post("/", (err, req, res, next) =>
  res.status(err.status).send(err.message)
);

module.exports = router;
