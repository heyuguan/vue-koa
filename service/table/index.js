const router = require('koa-router')();
var crypto = require('crypto');
var uuid = require('node-uuid');
var api = require('../../models').api;
var tableService = require('./service/tableService');

router.post('/table/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await tableService.tablePageList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));
});

router.post('/table/list', async function(ctx, next) {
    var query = ctx.request.body.query || {};
    var list = await tableService.tableList(query);
    ctx.json(api.data(list));
});

router.post('/table/save', async function(ctx, next) {
    var ent = ctx.request.body;

    var result;
    var success;

    if (ent.parent_id) {
        var parentEnt = await tableService.findTableById(ent.parent_id);
        if (!parentEnt) {
            cts.json(api.error("父级数据不存在！"));
        }
    }

    if (ent._id) {
        var tempEnt = await tableService.findTableById(ent._id);
        if (!tempEnt) {
            ctx.json(api.error("数据不存在！"));
            return;
        }
        tempEnt.updater = ctx.state.user.id;
        tempEnt.update_date = new Date();
        tempEnt.title = ent.title;
        tempEnt.table_name = ent.table_name;
        tempEnt.parent_id = ent.parent_id;
        tempEnt.data_id_key = ent.data_id_key;
        success = await tableService.updateTable(tempEnt);
        result = tempEnt;
    } else {
        ent.creater = ctx.state.user.id;
        ent.create_date = new Date();
        //ent.id = utils.autoId();
        success = await tableService.saveTable(ent);
        result = ent;
    }
    ctx.json(api.data(result));
});

router.post('/field/pageList', async function(ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var pageList = await tableService.fieldPageList(pageIndex, pageSize, query);
    ctx.json(api.data(pageList));
});

router.post('/field/save', async function(ctx, next) {
    var ent = ctx.request.body;

    ent.display_order = ent.display_order || 0;
    ent.is_show = ent.is_show || 1;
    ent.is_search = ent.is_search || 0;
    ent.is_sort = ent.is_sort || 0;

    ent.ent_types = ent.ent_types || 0;
    ent.ent_status = ent.ent_status || 0;


    var success;
    if (ent._id) {
        var tempEnt = await tableService.findFieldById(ent._id);
        if (!tempEnt) {
            ctx.json(api.error("数据不存在！"));
        }
        ent.updater = ctx.state.user.id;
        ent.update_date = new Date();
        ent.creater = tempEnt.creater;
        ent.create_date = tempEnt.create_date;
        success = await tableService.updateField(ent);
    } else {
        ent.creater = ctx.state.user.id;
        ent.create_date = new Date();
        //ent._id = utils.autoId();
        success = await tableService.saveField(ent);
    }
    ctx.json(api.result(success));
});

router.post('/table/delete', async function(ctx, next) {
    var entId = ctx.request.body._id;
    var entTable = await tableService.findTableById(entId);
    if (!entTable) {
        ctx.json(api.error("数据不存在！"));
    }
    var success = await tableService.deleteTable(entId);
    ctx.json(api.result(success));
});

router.post('/field/delete', async function(ctx, next) {
    var entId = ctx.request.body.id;
    var entField = await tableService.findFieldById(entId);
    if (!entField) {
        ctx.json(api.error("数据不存在！:" + entId));
        return;
    }
    var success = await tableService.deleteField(entField);
    ctx.json(api.result(success));
});


router.prefix('/table');
module.exports = router;