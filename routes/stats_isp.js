// eslint-disable-next-line import/no-unresolved
const express = require('express');
// eslint-disable-next-line import/no-unresolved
const config = require('config');


const GROUP_FIELDS = ['hour', 'day'];
const SORT_FIELDS = ['count', 'max', 'min', 'average', 'total'];
const SORT_PREFIX = 'sort_';

class DummyCollection {
    constructor() {
        this.dummyData = {};
    }

    aggregate() {
        // TODO
        return this.dummyData
    }
};

class DummyMongodb {
    constructor() {
        this.dummyCollection = new DummyCollection();
    }

    collection() {
        return this.dummyCollection;
    }
};

const proc = async (req, res, next) => {
    const { body: args } = req;

    const { isp } = args;
    const group = GROUP_FIELDS.find(e => e === (args.group ? args.group.toLowerCase() : ''));
    const limit = args.limit && args.limit > 0 && args.limit <= config.get('db.limit.max') ?
        args.limit : config.get('db.limit.default');
    let sort = { [`${SORT_PREFIX}count`]: -1 };
    if (args.sort) {
        Object.keys(args.sort).forEach(e => {
            const field = SORT_FIELDS.find(f => f === e.toLowerCase());
            if (field) {
                sort = {
                    [`${SORT_PREFIX}${field}`]: args.sort[field] === 1 ? 1 : -1
                }
            }
        });
    }

    const pipeline = [];
    const match = [];

    try {
        if (isp) {
            match.push({
                'isp': isp
            })
        }
        if (group === 'hour') {
            match.push({
                'type': 'ISP_HOURS'
            });
            pipeline.push(
                {
                    '$match': {
                        '$and': match
                    }
                }, {
                    '$sort': {
                        'hour': 1
                    }
                }, {
                    '$group': {
                        '_id': '$isp',
                        'isp': { '$first': '$isp' },
                        [`${SORT_PREFIX}min`]: { '$min': '$min' },
                        [`${SORT_PREFIX}max`]: { '$max': '$max' },
                        [`${SORT_PREFIX}total`]: { '$sum': '$total' },
                        [`${SORT_PREFIX}count`]: { '$sum': '$count' },
                        'data': {
                            '$push': {
                                'hour': '$hour',
                                'min': '$min',
                                'max': '$max',
                                'average': '$average',
                                'total': '$total',
                                'count': '$count'
                            }
                        }
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'isp': '$isp',
                        [`${SORT_PREFIX}min`]: `$${SORT_PREFIX}min`,
                        [`${SORT_PREFIX}max`]: `$${SORT_PREFIX}max`,
                        [`${SORT_PREFIX}total`]: `$${SORT_PREFIX}total`,
                        [`${SORT_PREFIX}count`]: `$${SORT_PREFIX}count`,
                        [`${SORT_PREFIX}average`]: {
                            '$divide': [`$${SORT_PREFIX}total`, `$${SORT_PREFIX}count`]
                        },
                        'data': '$data'
                    }
                });
        } else if (group === 'day') {
            match.push({
                'type': 'ISP_DAYS'
            });
            pipeline.push(
                {
                    '$match': {
                        '$and': match
                    }
                }, {
                    '$sort': {
                        'day': 1
                    }
                }, {
                    '$group': {
                        '_id': '$isp',
                        'isp': { '$first': '$isp' },
                        [`${SORT_PREFIX}min`]: { '$min': '$min' },
                        [`${SORT_PREFIX}max`]: { '$max': '$max' },
                        [`${SORT_PREFIX}total`]: { '$sum': '$total' },
                        [`${SORT_PREFIX}count`]: { '$sum': '$count' },
                        'data': {
                            '$push': {
                                'day': '$day',
                                'min': '$min',
                                'max': '$max',
                                'average': '$average',
                                'total': '$total',
                                'count': '$count'
                            }
                        }
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'isp': '$isp',
                        [`${SORT_PREFIX}min`]: `$${SORT_PREFIX}min`,
                        [`${SORT_PREFIX}max`]: `$${SORT_PREFIX}max`,
                        [`${SORT_PREFIX}total`]: `$${SORT_PREFIX}total`,
                        [`${SORT_PREFIX}count`]: `$${SORT_PREFIX}count`,
                        [`${SORT_PREFIX}average`]: {
                            '$divide': [`$${SORT_PREFIX}total`, `$${SORT_PREFIX}count`]
                        },
                        'data': '$data'
                    }
                });
        } else {
            match.push({
                'type': 'ISP'
            });
            pipeline.push(
                {
                    '$match': {
                        '$and': match
                    }
                }, {
                    '$group': {
                        '_id': '$isp',
                        'isp': { '$first': '$isp' },
                        [`${SORT_PREFIX}min`]: { '$min': '$min' },
                        [`${SORT_PREFIX}max`]: { '$max': '$max' },
                        [`${SORT_PREFIX}total`]: { '$sum': '$total' },
                        [`${SORT_PREFIX}count`]: { '$sum': '$count' },
                        'data': {
                            '$push': {
                                'min': '$min',
                                'max': '$max',
                                'average': '$average',
                                'total': '$total',
                                'count': '$count'
                            }
                        }
                    }
                }, {
                    '$project': {
                        '_id': 0,
                        'isp': '$isp',
                        [`${SORT_PREFIX}min`]: `$${SORT_PREFIX}min`,
                        [`${SORT_PREFIX}max`]: `$${SORT_PREFIX}max`,
                        [`${SORT_PREFIX}total`]: `$${SORT_PREFIX}total`,
                        [`${SORT_PREFIX}count`]: `$${SORT_PREFIX}count`,
                        [`${SORT_PREFIX}average`]: {
                            '$divide': [`$${SORT_PREFIX}total`, `$${SORT_PREFIX}count`]
                        },
                        'data': '$data'
                    }
                });
        }
        pipeline.push(
            {
                '$sort': sort
            }, {
                '$limit': limit
            }, {
                '$project': {
                    [`${SORT_PREFIX}min`]: 0,
                    [`${SORT_PREFIX}max`]: 0,
                    [`${SORT_PREFIX}total`]: 0,
                    [`${SORT_PREFIX}count`]: 0,
                    [`${SORT_PREFIX}average`]: 0
                }
            });
    } catch (e) {
        next({
            message: `Bad Request ${e}`,
            status: 400
        }, req, res, next);
        return;
    }

    let mongodb = req.app.get('mongodb');
    if (!mongodb) {
        mongodb = new DummyMongodb;
    }

    let collection;
    try {
        collection = await mongodb.collection(config.get('db.stats_collection'));;
    } catch (e) {
        next({
            message: 'Internal Server Error',
            status: 500
        }, req, res, next);
    }

    try {
        const docs = await collection.aggregate(pipeline).toArray();
        if (!docs)
            throw new Error('find failed');
        res.json(docs).status(200);
    } catch (e) {
        next({
            message: 'Internal Server Error',
            status: 500
        }, req, res, next);
    }
}

const router = express.Router();

router.get('/', async (req, res, next) => proc(req, res, next));

router.post('/', async (req, res, next) => proc(req, res, next));

// eslint-disable-next-line no-unused-vars
router.get('/', (err, req, res, next) => res.status(err.status).send(err.message));

// eslint-disable-next-line no-unused-vars
router.post('/', (err, req, res, next) => res.status(err.status).send(err.message));

module.exports = router;

