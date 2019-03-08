const router = require('koa-router')();
var core = require('../../models');
var api = require('../../models').api;
var logger = require('../../models').logger;
var httpUitl = require('../../models/httpUtil');
var config = require('../../config');

var searchService = require('./service/searchService');

router.post('/push', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/search/push';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body || {};
    var info_id = query.info_id;
    var table_id = query.table_id;
    searchService.push(info_id, table_id);
    ctx.json(api.success());
});


router.post('/query', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/search/query';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body || {};
    var info_id = query.info_id;
    var table_id = query.table_id;
    var keyword = query.keyword;
    var pageIndex = parseInt(query.pageIndex) || 1;
    var pageSize = 10;
    try {
        var result = await searchService.query(info_id, table_id, keyword, pageIndex, pageSize);
        ctx.json(api.data(result));
    } catch (e) {
        core.logger.error(e);
        ctx.json(api.error('查询失败，请重新同步数据!'));
    }
});

router.prefix('/search');
module.exports = router;