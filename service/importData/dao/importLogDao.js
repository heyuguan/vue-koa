var Dao = require("../../../models").MongoDao;
var db = require("../../../models").mongo;

/**
 * lft
 */
var importLogDao = new Dao(db, 'import_data_log');

module.exports = importLogDao;