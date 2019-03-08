var myDao = require('../dao/myDao');
var logger = require("../../../models").logger;
var core = require('../../../models');

var s = {
    add: async function(data) {
        return await myDao.insert(data);
    },
    update: async function(data) {
        return await myDao.update(data);
    },
    getDb: async function(id) {
        var db = await core.getHostDb(id);
        if (!db){
            var hospitaldb = await this.findById(id);
            if (hospitaldb) {
                db = await core.getHostDb(id, hospitaldb);
            }
        }
        return db;
    },
    findById: async function(id) {
        if (!id){
            return;
        }
        // return await myDao.findById(id);
        var conditions = {};
        conditions.cols = "t1.*, t3.connectionLimit, t3.host, t3.port, t3.user, t3.password, t3.database";
        conditions.table = "bi_hospital_db t1 left join bi_db_mysql_config t3 on t3.id = t1.db_id and t3.bs_flag=1";
        var where = "t1.bs_flag=? and t1.id=?";
        var params = ['1', id];
        conditions.where = where;
        conditions.params = params;
        var result = await myDao.findOneMoreTable(conditions);
        return result;
    },
    find: async function(query) {
        var where = "1=1";
        var params = [];
        if (query.hospital_id){
            where += " and `hospital_id` = ?";
            params.push(query.hospital_id);
        }
        if (query.db_id){
            where += " and `db_id` = ?";
            params.push(query.db_id);
        }
        return await myDao.find(where, params);
    },
    pageList: async function(pageIndex, pageSize, query) {
        var conditions = {};
        conditions.cols = query.cols || "t1.*, t2.name hospital_name, t3.connectionLimit, t3.host, t3.port, t3.user, t3.password, t3.database, t3.remark dbRemark, t3.type";
        conditions.table = "bi_hospital_db t1 left join pr_hospital_info t2 on t2.id=t1.hospital_id and t2.bs_flag=1 left join bi_db_mysql_config t3 on t3.id = t1.db_id and t3.bs_flag=1";
        var where = "t1.bs_flag=?";
        var params = [query.bs_flag || '1'];
        if (query.searchStr) {
            where += " and " + query.searchStr;
        }
        if (query.hospital_id){
            where += " and t1.hospital_id=?";
            params.push(query.hospital_id);
        }
        if (query.hospital_name){
            where += " and (t2.name like ? or t2.id like ?)";
            params.push("%" + query.hospital_name + "%");
            params.push("%" + query.hospital_name + "%");
        }
        if (query.type){
            where += " and t3.type=?";
            params.push(query.type);
        }
        conditions.where = where;
        conditions.params = params;
        conditions.orderBy = "t1.hospital_id asc";
        var result = await myDao.pageListMoreTable(conditions, pageIndex, pageSize);
        return result;
    }
};

module.exports = s;