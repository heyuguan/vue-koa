var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

var myDao = new Dao(db, 'bi_hospital_db');

module.exports = myDao;