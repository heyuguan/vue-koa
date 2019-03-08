var crypto = require('crypto');
var loginUserDao = require('../dao/loginUserDao');
var adminInfoDao = require('../dao/adminInfoDao');
var businessService = require('../../business/service/businessService');
var logger = require("../../../models").logger;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var adminService = {
    login: async function(username, password) {
        var md5 = crypto.createHash('md5');
        var password_md5 = md5.update(password).digest('hex');

        var user = await loginUserDao.userInfoByTel(username);
        if (!user || !user.id) {
            logger.info("user not exist", user);
            return null;
        }

        if (user.user_pass != password_md5) {
            logger.info("password error", user.user_pass, password_md5);
            return null;
        }

        user.adminInfo = await adminInfoDao.adminInfoByUserId(user.id);
        var businessInfo = await businessService.findByUserId(user.id);
        if (businessInfo && !businessInfo.is_delete) {
            user.businessInfo = businessInfo;
        }

        return user;
    },
    userInfo: async function(user_id) {
        var user = await loginUserDao.userInfoById(user_id);
        if (!user || !user.id) {
            return null;
        }

        user.adminInfo = await adminInfoDao.adminInfoByUserId(user.id);
        user.businessInfo = await businessService.findByUserId(user.id);
        return user;
    },
    searchByTag: async function(tag, count) {
        return await loginUserDao.searchByTag(tag, count);
    }
};


module.exports = adminService;