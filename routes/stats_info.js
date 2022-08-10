// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const config = require("config");

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

class DummyLocationFinder {
  constructor() {
    this.dummyData = {
      country: "--",
      subdivision: 0,
    };
  }

  find() {
    return {
      country: this.dummyData.country,
      subdivision: this.dummyData.subdivision,
    };
  }
}

class DummyISPFinder {
  constructor() {
    this.dummyData = {
      isp: "unknown",
    };
  }

  find() {
    return this.dummyData.isp;
  }
}

const proc = async (req, res, next) => {
  const { body: args } = req;

  const { session, video } = args;

  if (!session || !video) {
    res.json([]).status(200);
    return;
  }

  let mongodb = req.app.get("mongodb");
  if (!mongodb) {
    mongodb = new DummyMongodb();
  }

  let collection;
  try {
    collection = await mongodb.collection(config.get("db.sodium_collection"));
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

  let docs;
  try {
    docs = await collection
      .find({
        session_id: session,
        video_id: video,
      })
      .toArray();
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
  if (docs.length === 0) {
    res.json([]).status(200);
    return;
  }

  const [e] = docs;
  if (e.country && e.subdivision && e.isp) {
    res
      .json([
        {
          session,
          video,
          country: e.country,
          subdivision: e.subdivision,
          isp: e.isp,
        },
      ])
      .status(200);
    return;
  }

  if (!e.remote_address) {
    res.json([]).status(200);
    return;
  }

  let finder = req.app.get("finder");
  if (!finder) {
    finder = {
      location: new DummyLocationFinder(),
      isp: new DummyISPFinder(),
    };
  }

  const { country, subdivision } = await finder.location.find(e.remote_address);
  const isp = await finder.isp.find(e.remote_address);
  if (country === undefined || subdivision === undefined || isp === undefined) {
    res.json([]).status(200);
    return;
  }

  res
    .json([{ session, video, country, subdivision: String(subdivision), isp }])
    .status(200);
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
