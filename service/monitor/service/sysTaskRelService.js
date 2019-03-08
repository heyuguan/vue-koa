var sysTaskRelDao = require('../dao/sysTaskRelDao')
var config = require('../../../config');
var MysqlDB = require('../../../models/mysql/MysqlDB');

var sysTaskRelService = {
    list: async function(pageIndex, pageSize, query) {
        var where = "true";
        var params = [];
        if (query.name) {
            where = "hospital_name like ?";
            params.push('%' + query.name + '%');
        }

        var pagelist = await sysTaskRelDao.pageList(pageIndex, pageSize, where, params);
        return pagelist;
    },
    update: async function(data) {
        var result = await sysTaskRelDao.update(data);
        return result;
    },
    insert: async function(data) {
        var result = await sysTaskRelDao.insert(data);
        return result;
    }
};

module.exports = sysTaskRelService;