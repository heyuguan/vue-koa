var crypto = require('crypto');
var businessInfoDao = require('../dao/businessInfoDao');
var businessUserDao = require('../dao/businessUserDao');
var logger = require("../../../models").logger;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var businessService = {
    pageList: async function(pageIndex, pageSize, query) {
        var where = "is_delete=?";
        var params = [query.is_delete || 0];
        if (query.business_name) {
            where += " and business_name like ?";
            params.push('%' + query.business_name + '%');
        }
        return await businessInfoDao.pageList(pageIndex, pageSize, where, params);
    },
    add: async function(data) {
        return await businessInfoDao.insert(data);
    },
    update: async function(data) {
        return await businessInfoDao.update(data);
    },
    findById: async function(id) {
        return await businessInfoDao.findById(id);
    },
    findByUserId: async function(user_id) {
        return await businessInfoDao.businessInfoByUserId(user_id);
    },
    userPageList: async function(pageIndex, pageSize, query) {
        // var where = '1=1';
        // var params = [];
        // if (query.is_delete !== undefined) {
        //     where += ' is_delete = ?';
        //     params.push(query.is_delete);
        // }
        return await businessUserDao.pageList(pageIndex, pageSize, query);
    },
    addUser: async function(data) {
        await businessUserDao.insert(data);
    },
    updateUser: async function(data) {
        await businessUserDao.update(data);
    }
};


module.exports = businessService;