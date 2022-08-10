// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const config = require("config");

const SERVICE_FIELDS = ["youtube", "paravi", "tver"];
const GROUP_FIELDS = ["hour", "day"];

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
  const service = SERVICE_FIELDS.find(
    (e) => e === (args.service ? args.service.toLowerCase() : "")
  );

  const pipeline = [];
  const match = [];

  try {
    if (service) {
      match.push({
        service: service,
      });
    }

    if (group === "hour") {
      match.push({
        type: "SERVICE_HOURS",
      });
      pipeline.push({
        $match: {
          $and: match,
        },
      });
      pipeline.push({
        $sort: {
          hour: 1,
        },
      });
      pipeline.push({
        $group: {
          _id: "$service",
          service: { $first: "$service" },
          data: {
            $push: {
              hour: "$hour",
              min: "$min",
              max: "$max",
              average: "$average",
              total: "$total",
              count: "$count",
            },
          },
        },
      });
    } else if (group === "day") {
      match.push({
        type: "SERVICE_DAYS",
      });
      pipeline.push({
        $match: {
          $and: match,
        },
      });
      pipeline.push({
        $sort: {
          day: 1,
        },
      });
      pipeline.push({
        $group: {
          _id: "$service",
          service: { $first: "$service" },
          data: {
            $push: {
              day: "$day",
              min: "$min",
              max: "$max",
              average: "$average",
              total: "$total",
              count: "$count",
            },
          },
        },
      });
    } else {
      match.push({
        type: "SERVICE",
      });
      pipeline.push({
        $match: {
          $and: match,
        },
      });
      pipeline.push({
        $group: {
          _id: "$service",
          service: { $first: "$service" },
          data: {
            $push: {
              min: "$min",
              max: "$max",
              average: "$average",
              total: "$total",
              count: "$count",
            },
          },
        },
      });
    }

    pipeline.push({
      $project: {
        _id: 0,
        type: 0,
      },
    });
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
    const docs = await collection.aggregate(pipeline).toArray();
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
