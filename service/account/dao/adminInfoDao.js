var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var adminInfoDao = new Dao(db, 'pr_admin_info');
adminInfoDao.adminInfoByUserId = async function(user_id) {
    return await this.findByKV('user_id', user_id);
};

module.exports = adminInfoDao;