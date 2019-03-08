var Dao = require("../../../models").MongoDao;
var db = require("../../../models").mongo;

/**
 * lft
 */
var tableDao = new Dao(db, 'emr_db_table');

module.exports = tableDao;