const router = require('koa-router')();
var adminService = require('./service/adminServcie');
var api = require('../../models').api;
var redis = require('../../models').redis;
var uuid = require('node-uuid');
var logger = require("../../models").logger;
var config = require('../../config');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/login', async function(ctx, next) {
    var username = ctx.request.body.passport;
    var password = ctx.request.body.password;

    var user = await adminService.login(username, password);
    if (user == null) {
        ctx.json(api.error('用户名密码错误，登录失败！'));
        return;
    }

    if (!user.adminInfo && !user.businessInfo) {
        ctx.json(api.error('没有权限，登录失败！'));
        return;
    }

    user.user_pass = null;
    user.ticket = uuid.v4();
    user.expires_in = config.account.expire_in;
    await redis.set(user.ticket, JSON.stringify(user), user.expires_in);
    ctx.json(api.data(user));
});

router.post('/logout', async function(ctx, next) {
    if (ctx.state.user && ctx.state.user.ticket) {
        await redis.del(ctx.state.user.ticket);
    }
    ctx.json(api.success());
});

router.prefix('/account');
module.exports = router;