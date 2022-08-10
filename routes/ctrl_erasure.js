// eslint-disable-next-line import/no-unresolved
const express = require("express");
// eslint-disable-next-line import/no-unresolved
const config = require("config");

const DEFALUT_NUM_OF_RECENTRY_RECORDE = 20;
const DEFALUT_DOCUMENT_ORDER = [["$natural", -1]];

const get = async (req, res, next) => {
  const mongodb = req.app.get("mongodb");

  let collection;
  try {
    collection = await mongodb.collection(config.get("db.erasure_collection"));
  } catch (e) {
    next(
      {
        message: `Internal Server Error`,
        status: 500,
      },
      req,
      res,
      next
    );
  }

  try {
    const ret = await collection
      .find(
        {},
        {
          limit: DEFALUT_NUM_OF_RECENTRY_RECORDE,
          sort: DEFALUT_DOCUMENT_ORDER,
        }
      )
      .toArray();
    res.json(ret).status(200);
  } catch (e) {
    next(
      {
        message: `Internal Server Error`,
        status: 500,
      },
      req,
      res,
      next
    );
  }
};

const post = async (req, res, next) => {
  const { body: args } = req;

  if (!(args instanceof Array)) {
    next(
      {
        message: `Bad Request`,
        status: 400,
      },
      req,
      res,
      next
    );
    return;
  }

  const ids = [];

  args.forEach((e) => {
    const { session, video } = e;
    if (session && video) {
      ids.push({
        id: `${session}_${video}`,
        session,
        video,
      });
    }
  });

  if (ids.length === 0) {
    next(
      {
        message: `Bad Request`,
        status: 400,
      },
      req,
      res,
      next
    );
    return;
  }

  const mongodb = req.app.get("mongodb");

  let collection;
  try {
    collection = await mongodb.collection(config.get("db.erasure_collection"));
  } catch (e) {
    next(
      {
        message: e.errmsg,
        status: 500,
      },
      req,
      res,
      next
    );
    return;
  }

  const tasks = [];

  let ok = 0;

  ids.forEach((e) => {
    tasks.push(
      (async () => {
        await collection.updateOne(
          {
            _id: e.id,
          },
          {
            $set: {
              session: e.session,
              video: e.video,
            },
          },
          {
            upsert: true,
          }
        );
        ok += 1;
      })()
    );
  });

  try {
    await Promise.all(tasks);
    res
      .json({
        result: {
          ok: 1,
          n: ok,
        },
      })
      .status(200);
  } catch (e) {
    next(
      {
        message: e.errmsg,
        status: 500,
      },
      req,
      res,
      next
    );
  }
};

const router = express.Router();

router.get("/", async (req, res, next) => get(req, res, next));

router.post("/", async (req, res, next) => post(req, res, next));

// eslint-disable-next-line no-unused-vars
router.get("/", (err, req, res, next) =>
  res.status(err.status).send(err.message)
);

// eslint-disable-next-line no-unused-vars
router.post("/", (err, req, res, next) =>
  res.status(err.status).send(err.message)
);

module.exports = router;
