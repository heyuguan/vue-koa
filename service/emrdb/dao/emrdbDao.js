var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").pat;

var myDao = new Dao(db, 'sys_database_rel');

module.exports = myDao;