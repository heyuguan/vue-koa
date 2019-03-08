var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;

var d = new Dao(db, 'xinshuai_data_config');

module.exports = d;