var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").pat;

var d = new Dao(db, 'sys_task_rel');

module.exports = d;