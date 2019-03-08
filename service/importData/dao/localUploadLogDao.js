var Dao = require("../../../models").MongoDao;
var db = require("../../../models").mongo;

/**
 * lft
 */
var localUploadLogDao = new Dao(db, 'local_upload_log');

module.exports = localUploadLogDao;