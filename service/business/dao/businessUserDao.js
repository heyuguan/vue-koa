var Dao = require("../../../models/mysql/MysqlDao");
var db = require("../../../models").mysql;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var businessUserDao = new Dao(db, 'em_business_user_rel');
businessUserDao.pageList = async function(pageIndex, pageSize, query) {
    var limit = pageSize;
    var offect = (pageIndex - 1) * pageSize;

    var files = 'select rel.*,info.business_name,user.tel_number,user.user_name ';

    var sql = " from em_business_user_rel rel  join em_business_info info on info.id = rel.business_id";
    var params = [];
    if (query.business_name) {
        sql += " and info.business_name  like ?";
        params.push('%' + query.business_name + '%');
    }

    sql += "  join pr_login_user user on user.id = rel.user_id";
    if (query.user_name) {
        sql += " and user.user_name  like ? ";
        params.push('%' + query.user_name + '%');
    }

    if (query.tel_number) {
        sql += " and user.tel_number like ? ";
        params.push('%' + query.tel_number + '%');
    }

    sql += " where rel.is_delete = ? ";
    params.push(query.is_delete || 0);

    var count = await this.db.queryOne('select count(*) as ct ' + sql, params);
    var items = await this.db.query(files + sql + " limit " + offect + "," + limit, params);
    return {
        items: items,
        total: count.ct,
        pageIndex: pageIndex,
        pageSize: pageSize
    };
};

module.exports = businessUserDao;