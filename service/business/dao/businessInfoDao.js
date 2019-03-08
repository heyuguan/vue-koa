var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var businessInfoDao = new Dao(db, 'em_business_info');
businessInfoDao.businessInfoByUserId = async function(user_id) {
    var where = 'select b.* from em_business_info b left join em_business_user_rel el on el.business_id = b.id left join pr_login_user u on el.user_id = u.id where b.is_delete = 0 and el.is_delete = 0 and u.id = ?';
    var params = [user_id];
    return await this.db.queryOne(where, params);
};

module.exports = businessInfoDao;