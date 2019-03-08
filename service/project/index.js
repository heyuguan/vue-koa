const router = require('koa-router')();
var api = require('../../models').api;
var service = require('./service/projectService');


/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/list', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var pagelist = await service.projectPagelist(pageIndex, pageSize, query);
    ctx.json(api.data(pagelist));
});


router.prefix('/project');
module.exports = router;