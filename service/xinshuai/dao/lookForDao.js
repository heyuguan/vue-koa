var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;

var d = new Dao(db, 'xinshuai_lookfor_data');

module.exports = d;