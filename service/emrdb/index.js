const router = require('koa-router')();
var api = require('../../models').api;
var myService = require('./service/emrdbService');
var httpUitl = require('../../models/httpUtil');
var config = require('../../config');

router.post('/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await myService.pageList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));
});

router.post('/add', async function(ctx, next) {
    var query = ctx.request.body;
    // var user = ctx.state.user;
    if (!query || !query.hospital_id || !query.database_name ||!query.database_type ){
        ctx.json(api.error("参数错误"));
        return;
    }
    var ent = {};
    ent.create_datetime = new Date();
    ent.modify_datetime = new Date();
    ent.hospital_id = query.hospital_id;
    ent.database_name = query.database_name;
    ent.database_type = query.database_type;
    ent.database_status = "1";
    ent.database_remark = query.database_remark;
    var success = await myService.add(ent);
    ctx.json(api.result(success));
});

router.post('/update', async function(ctx, next) {
    var query = ctx.request.body;
    if (!query || !query.id){
        ctx.json(api.error("参数错误"));
        return;
    }
    var ent = await myService.findById(query.id);
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
    }
    ent.modify_datetime = new Date();
    ent.hospital_id = query.hospital_id;
    ent.database_name = query.database_name;
    ent.database_type = query.database_type;
    ent.database_status = query.database_status;
    ent.database_remark = query.database_remark;
    var success = await myService.update(ent);
    ctx.json(api.result(success));
});
router.post('/hospital/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await myService.pageListHospital(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));
});

router.post('/dbconfig/list', async function(ctx, next) {
    var url = config.apiIp + config.serviceId.biService + '/dbConfig/list';
    var paegList = await httpUitl.post(url, ctx.request.body, null);
    ctx.json(paegList);
});

router.prefix('/emrdb');
module.exports = router;