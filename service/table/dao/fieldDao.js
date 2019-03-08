var Dao = require("../../../models").MongoDao;
var db = require("../../../models").mongo;

/**
 * lft
 */
var fieldDao = new Dao(db, 'emr_db_field');

module.exports = fieldDao;