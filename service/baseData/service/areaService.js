var cityDao = require('../dao/cityDao');
var provinceDao = require('../dao/provinceDao');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var areaService = {};
areaService.provinceList = async function(query) {
    var where = "";
    var params = [];
    if (query.province_name) {
        where += " province_name like ? ";
        params.push('%' + query.province_name + '%');
    }
    return await provinceDao.list(where, params);
}

areaService.cityList = async function(query) {
    var where = "";
    var params = [];
    if (query.province_id) {
        where += " province_id = ? ";
        params.push(query.province_id);
    }

    return await cityDao.list(where, params);
}

module.exports = areaService;