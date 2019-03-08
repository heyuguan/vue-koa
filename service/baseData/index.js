const router = require('koa-router')();
var api = require('../../models').api;
var logger = require('../../models').logger;

var areaService = require('./service/areaService');
var hospitalService = require('./service/hospitalService');


/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/provinceList', async function(ctx, next) {
    var query = ctx.request.body || {};
    var result = await areaService.provinceList(query);
    ctx.json(api.data(result));
});

router.post('/cityList', async function(ctx, next) {
    var query = ctx.request.body || {};
    var result = await areaService.cityList(query);
    if (result.length > 100) {
        result = result.slice(0, 100);
    }
    ctx.json(api.data(result));
});

router.post('/hospitalList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var result = await hospitalService.hospitalPageList(pageIndex, pageSize, query);
    ctx.json(api.data(result));
});

router.post('/deptList', async function(ctx, next) {
    var query = ctx.request.body || {};
    var result = await hospitalService.deptList(query);
    ctx.json(api.data(result));
});
router.prefix('/baseData');
module.exports = router;