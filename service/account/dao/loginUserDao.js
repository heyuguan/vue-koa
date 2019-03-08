var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var loginUserDao = new Dao(db, 'pr_login_user');

loginUserDao.userInfoByTel = async function(tel_number) {
    var where = 'tel_number = ? and user_status = 1';
    var params = [tel_number];
    return await this.find(where, params);
};

loginUserDao.userInfoById = async function(user_id) {
    return await this.findById(user_id);
};

loginUserDao.searchByTag = async function(tag, count) {
    var where = " user_status = 1 and  tel_number like ? or user_name like ?";
    var params = ['%' + tag + '%', '%' + tag + '%'];
    var conditions = {
        where: where,
        params: params,
        limit: count
    };
    return await this.db.list(this.table, conditions);
};

module.exports = loginUserDao;