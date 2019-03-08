const router = require('koa-router')();
var api = require('../../models').api;
var emdata = require('../../models');
var logger = require("../../models").logger;
var utils = emdata.utils;
var _ = require('lodash');
const send = require('koa-send');
var config = require('../../config');
const path = require('path');
var myService = require('./service/taskService2');
var tableService = require('../table/service/tableService');
var statisticsService = require('../statistics/service/statisticsService');
// var xl = require('excel4node');
var Dao = require("../../models/mongo/MongoDao");
var db = require("../../models").mongo;
var dataInfoDBName = "task_data_";
var fs = require('fs');
var httpUitl = require('../../models/httpUtil');

// 获取列表
router.post('/list', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/task/list';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    //check user
    // var user = ctx.state.user;
    // query.user_id = user.id;
    query.ent_status = query.ent_status || 0;
    var pageList = await myService.PageList(pageIndex, pageSize, query);
    if (pageList.items) {
        var items = [];
        for (var i = 0; i < pageList.items.length; i++) {
            var item = pageList.items[i];
            if (item.status == "2") {
                var _myDao = new Dao(db, dataInfoDBName + "ip_medical_history_info");
                var dataList = await _myDao.pageList(1, 1, { task_id: item.id });
                logger.info(JSON.stringify(dataList));
                item.index = dataList.total;
                if (dataList.total == 0) {
                    var _myDao2 = new Dao(db, dataInfoDBName + "op_medical_history_info");
                    var dataList2 = await _myDao2.pageList(1, 1, { task_id: item.id });
                    logger.info(JSON.stringify(dataList2));
                    item.index = dataList2.total;
                }
            }
            items.push(item);
        }
        pageList.items = items;
    }
    ctx.json(api.data(pageList));


});

// 新建
router.post('/add', async function (ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/task/add';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body.query;
    var user = ctx.state.user;

    var info_id = query.info_id;
    var tableId = query.tableId;
    var page = query.page || 1;
    var pageSize = query.pageSize || 500;
    logger.info("##-->>/task/add.参数:" + JSON.stringify(query));
    var info = await statisticsService.dbInfoById(info_id);
    var entTable = await tableService.findTableById(tableId);
    if (!entTable) {
        ctx.json(api.error("数据未找到:" + tableId));
        return;
    }
    var hospital_id = info.hospital_id;
    if (!hospital_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var hospital_name = info.name;
    var search = "";
    if (query.search) {
        search = JSON.stringify(query.search);
    }
    var condition = "";
    if (query.condition) {
        condition = JSON.stringify(query.condition);
    }

    var _po = {
        hospital_id: hospital_id,
        search: search,
        info_id: info_id,
        tableId: tableId,
        ent_status: "0",
        condition: condition,
        page: page,
        pageSize: pageSize
    };
    var _result = await myService.find(_po);
    logger.info(JSON.stringify(_result));
    if (_result && _result.id) {
        ctx.json(api.error("任务已存在！"));
        return;
    }
    var po = {
        id: utils.autoId() + '',
        creater: user.id,
        updater: user.id,
        create_date: new Date(),
        update_date: new Date(),
        status: "2",// 任务状态:0-未执行;1-查询成功;2-查询中;-1-执行失败;3-正在导出;4-导出成功;5-已清表;
        ent_status: "0", // 数据状态 0正常1删除
        progress: "0%",
        hospital_id: hospital_id,
        hospital_name: hospital_name,
        search: search,
        file: "",
        info_id: info_id,
        tableId: tableId,
        execute_data: new Date(),
        stop_cause: "",
        dataTotal: 0, // 数据总数
        is_stop: "0", // 是否停止提取:0-执行;1-停止;
        index: 0, // 当前索引
        condition: condition, // 结果删选
        page: page,
        pageSize: pageSize
    };
    // 检验数据总数
    // var total_data = await myService.push_before(po);
    // if (total_data && total_data > 1000) {
    //     ctx.json(api.error("超出任务最大数(1000)，请修改检索条件后再次添加任务！"));
    //     return;
    // }
    var m = await myService.push(po, page, pageSize);
    if (m == 0) {
        ctx.json(api.error("没有数据可以导出！"));
        return;
    }
    po.dataTotal = m;
    var data = await myService.add(po);
    // var total_data = await myService.push_before(po);
    // if (total_data && total_data > 1000) {
    //     ctx.json(api.success("超出任务最大数(1000)，只导出当前页1000条数据！"));
    //     return;
    // }
    ctx.json(api.data({ data: data, id: po.id }));
});

// 更新
router.post('/update', async function (ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/task/update';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var result = await myService.findById(query);
    if (!result.id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    var update = {
        id: query.id,
        updater: user.id,
        update_date: new Date(),
    }
    if (query.ent_status) {
        update.ent_status = query.ent_status;
    }
    if (query.is_stop) {
        update.is_stop = query.is_stop;
    }
    var data = await myService.update(update);
    ctx.json(emdata.api.data(data));
});

// 彻底删除
router.post('/delete', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/task/delete';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var result = await myService.findById(query);
    if (!result.id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    if (result.ent_status !== '1') {
        ctx.json(api.error("操作错误！"));
        return;
    }
    await myService.deleteTask(result, '1');
    ctx.json(api.success("操作成功"));
});

router.post("/outData", async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/task/outData';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        logger.info("##-->>task.outData:" + JSON.stringify(retult));
        if (retult && retult.success) {
            ctx.attachment(retult.data.file);
            await send(ctx, retult.data.file, { root: retult.data.root });
        } else {
            ctx.json(retult);
        }
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var result = await myService.findById(query);
    if (!result.id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    var output_path = config.output_path + "/exportdata";
    var file_path = path.join(output_path, result.file);
    if (!fs.existsSync(file_path)) {
        ctx.json(api.error("文件不存在！"));
        return;
    }
    ctx.attachment(result.file);
    await send(ctx, result.file, { root: output_path });
});

module.exports = router;