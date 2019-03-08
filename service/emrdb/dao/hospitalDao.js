var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

var myDao = new Dao(db, 'pr_hospital_info');

module.exports = myDao;