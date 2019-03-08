const router = require('koa-router')();
var api = require('../../models').api;
var sysTaskRelService = require('./service/sysTaskRelService');

router.post('/sysTaskRel/list', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var result = await sysTaskRelService.list(pageIndex, pageSize, query);
    ctx.json(api.data(result));
});

router.post('/sysTaskRel/update', async function(ctx, next) {
    var data = ctx.request.body || {};
    var result = await sysTaskRelService.update(data);
    ctx.json(api.data(result));
});

router.post('/sysTaskRel/insert', async function(ctx, next) {
    var data = ctx.request.body || {};
    var result = await sysTaskRelService.insert(data);
    ctx.json(api.data(result));
});

router.prefix('/monitor');
module.exports = router;