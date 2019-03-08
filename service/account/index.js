const router = require('koa-router')();
var adminService = require('./service/adminServcie');
var api = require('../../models').api;
var redis = require('../../models').redis;
var uuid = require('node-uuid');
var logger = require("../../models").logger;
var config = require('../../config');
const captcha = require('trek-captcha');



/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/login', async function(ctx, next) {
    var query = ctx.request.body;
    
    var key = 'captcha_' + (query.captcha_key || '');
    var captcha_value = await redis.get(key);
    
    if (!captcha_value || captcha_value != query.captcha_value) {
        ctx.json(core.api.error('验证码错误!', 501));
        return;
    } else {
        redis.del(key);
    }
     console.log(query);
    var username = query.passport;
    var password = query.password;
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
router.get('/captcha', async function(ctx, next) {
    var query = ctx.request.query;
    console.log(query);
    var key = 'captcha_' + (query.key || '');
    var size = parseInt(query.size) || 4;
    const {
        token,
        buffer
    } = await captcha({
        size: size,
        style: -1
    });
  
    redis.set(key, token, 15 * 60);
    ctx.set('Content-Type', 'image/gif');
    ctx.body = buffer;
});

router.prefix('/account');
module.exports = router;