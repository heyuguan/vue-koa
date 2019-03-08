var MongoDB = require('./mongo/MongoDB');
var MongoDao = require('./mongo/MongoDao');
var MysqlDB = require('./mysql/MysqlDB');
var MysqlDao = require('./mysql/MysqlDao');
var api = require('./apiResult');
var Redis = require('./Redis');
var errors = require('./errors');
var logger = require('./logger');
var config = require('../config');
var utils = require('./utils');
var Elasticsearch = require('./Elasticsearch');
var MQ = require('./MQ');
var md5 = require('md5');
var Fdfs = require('./Fdfs');


/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var emdata = {
    mongo: new MongoDB(),
    mysql: new MysqlDB(),
    pat: new MysqlDB(),
    diagnoseAccount:new MysqlDB(),
    platformDemo:new MysqlDB(),
    api: api,
    redis: new Redis(),
    elasticsearch: new Elasticsearch(),
    fdfs: new Fdfs(),
    errors: errors,
    logger: logger,
    MongoDB: MongoDB,
    MongoDao: MongoDao,
    MysqlDB: MysqlDB,
    MysqlDao: MysqlDao,
    Redis: Redis,
    Elasticsearch: Elasticsearch,
    MQ: MQ,
    utils: utils,
};

var dbs = [];
emdata.getDb = async function(key) {
    var db = dbs[key];
    if (!db) {
        db = new MysqlDB();
        db.debug = config.debug;
        await db.connect(config.emr[key]);
        dbs[key] = db;
    }
    return db;
}

emdata.getDbV2 = async function(dbInfo) {
    var db = dbs[dbInfo.database];

    if (!db) {
        db = new MysqlDB();

        var connect = {
            connectionLimit: 10,
            host: dbInfo.host,
            user: dbInfo.user,
            password: dbInfo.password,
            database: dbInfo.database
        }

        db.debug = config.debug;
        await db.connect(connect);
        dbs[dbInfo.database] = db;
    }
    return db;
}

emdata.getHostDb = async function(id, hospitalDb) {
    if (hospitalDb){
        var key = md5(id+hospitalDb.host+hospitalDb.user+hospitalDb.password+hospitalDb.database);
        var db = dbs[key];
        if (!db && hospitalDb) {
            db = new MysqlDB();
            db.debug = config.debug;
            await db.connect({
                connectionLimit: hospitalDb.connectionLimit,
                host: hospitalDb.host,
                user: hospitalDb.user,
                password: hospitalDb.password,
                database: hospitalDb.database
            });
            dbs[key] = db;
        }
        return db;
    }
    return null;
}

module.exports = emdata;