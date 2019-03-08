var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var hospitalDao = new Dao(db, 'pr_hospital_info');

module.exports = hospitalDao;