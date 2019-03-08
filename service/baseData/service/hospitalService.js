var hospitalDao = require('../dao/hospitalDao');
var deptDao = require('../dao/deptDao');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var hospitalService = {};

hospitalService.hospitalPageList = async function(pageIndex, pageSize, query) {
    var where = " bs_flag=1 ";
    var params = [];
    if (query && query.name) {
        where += " and name like ? ";
        params.push('%' + query.name + '%');
    }
    if (query && query.id) {
        where += " and id = ? ";
        params.push(query.id);
    }
    return await hospitalDao.pageList(pageIndex, pageSize, where, params);
}

hospitalService.hospitalList = async function(query) {
    var where = " bs_flag=1 ";
    var params = [];
    if (query && query.name) {
        where += " and name like ? ";
        params.push('%' + query.name + '%');
    }
    return await hospitalDao.list(where, params);
}


hospitalService.findById = async function(id) {
    return await hospitalDao.findById(id);
}

hospitalService.deptList = async function(query) {
    var where = " 1=1 ";
    var params = [];
    if (query.name) {
        where += " and name like ? ";
        params.push('%' + query.name + '%');
    }
    return await deptDao.list(where, params);
}


module.exports = hospitalService;