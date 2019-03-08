var crypto = require('crypto');
var myDao = require('../dao/emrdbDao');
var hospitalDao = require('../dao/hospitalDao');
var logger = require("../../../models").logger;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var myService = {
    pageList: async function(pageIndex, pageSize, query) {
        var conditions = {};
        conditions.cols = query.cols || "t1.*, t2.name hospital_name";
        conditions.table = "sys_database_rel t1 left join pr_hospital_info t2 on t2.id=t1.hospital_id and t2.bs_flag=1";
        var where = "t1.database_status=?";
        var params = [query.database_status || '1'];
        if (query.searchStr) {
            where += " and " + query.searchStr;
        }
        if (query.hospital_id){
            where += " and t1.hospital_id=?";
            params.push(query.hospital_id);
        }
        if (query.hospital_name){
            where += " and t2.name like '%" + query.hospital_name + "%'";
        }
        if (query.database_name){
            where += " and t1.database_name like '%" + query.database_name + "%'";
        }
        if (query.database_type){
            where += " and t1.database_type like '%" + query.database_type + "%'";
        }
        conditions.where = where;
        conditions.params = params;
        conditions.orderBy = "t1.create_datetime desc";
        var result = await myDao.pageListMoreTable(conditions, pageIndex, pageSize);
        return result;
    },
    add: async function(data) {
        return await myDao.insert(data);
    },
    update: async function(data) {
        return await myDao.update(data);
    },
    findById: async function(id) {
        return await myDao.findById(id);
    },
    pageListHospital: async function(pageIndex, pageSize, query) {
        var where = "bs_flag=1";
        if (query.keyword){
            where += " and (id like '%"+query.keyword+"%' or name like '%"+query.keyword+"%')";
        }
        var params = [];
        return await hospitalDao.pageList(pageIndex, pageSize, where, params);
    }
};


module.exports = myService;