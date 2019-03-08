const router = require('koa-router')();
var api = require('../../models').api;
var businessService = require('./service/businessService');
var adminService = require('../account/service/adminServcie');

router.post('/info/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await businessService.pageList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));
});

router.post('/info/add', async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    var ent = {};
    ent.create_date = new Date();
    ent.modify_date = new Date();
    ent.create_user_id = user.id;
    ent.modify_user_id = user.id;
    ent.is_delete = 0;
    ent.business_name = query.business_name;
    ent.intro = query.intro;
    ent.remark = query.remark;
    var success = await businessService.add(ent);
    ctx.json(api.result(success));
});

router.post('/info/update', async function(ctx, next) {
    var query = ctx.request.body;
    var ent = await businessService.findById(query.id);
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
    }
    ent.business_name = query.business_name;
    ent.intro = query.intro;
    ent.remark = query.remark;
    var success = await businessService.update(ent);
    ctx.json(api.result(success));
});

router.post('/user/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await businessService.userPageList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));
});

router.get('/user/searchUser', async function(ctx, next) {
    var count = ctx.query.count;
    var tag = ctx.query.tag;
    var list = await adminService.searchByTag(tag, count);
    ctx.json(api.data(list));
});

router.post('/user/add', async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    var ent = {
        is_delete: query.is_delete,
        business_id: query.business_id,
        user_id: query.user_id,
        create_user_id: user.id,
        modify_user_id: user.id,
        create_date: new Date(),
        modify_date: new Date()

    };
    businessService.addUser(ent);
    ctx.json(api.success());
});


router.post('/user/update', async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    var ent = {
        id: query.id,
        is_delete: query.is_delete,
        business_id: query.business_id,
        user_id: query.user_id,
        modify_user_id: user.id,
        modify_date: new Date()
    };
    businessService.updateUser(ent);
    ctx.json(api.success());
});


router.prefix('/business');
module.exports = router;