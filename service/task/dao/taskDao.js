var Dao = require("../../../models").MongoDao;
var db = require("../../../models").mongo;

var d = new Dao(db, 'task_list');

module.exports = d;