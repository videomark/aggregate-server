// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const config = require("config");

const SEND_TIMEOUT = 90 * 1000;
const CALCULATE_TIMEOUT = 60 * 60 * 1000;

const proc = async (req, res, next) => {
  const mongodb = req.app.get("mongodb");
  if (!mongodb) {
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

  try {
    const now = new Date().getTime();
    const alived = now - CALCULATE_TIMEOUT;

    const docs = await collection
      .find({
        $and: [
          {
            qoe: -1,
          },
          {
            last_send: {
              $gte: alived,
            },
          },
        ],
      })
      .toArray();
    if (!docs) throw new Error("find failed");

    let active = 0;
    let calculating = 0;

    docs.forEach((e) => {
      if (e.last_send > now - SEND_TIMEOUT) active += 1;
      else calculating += 1;
    });
    res.json({ active, calculating }).status(200);
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
