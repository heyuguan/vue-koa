var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;

var d = new Dao(db, 'hospital_db_info');

module.exports = d;