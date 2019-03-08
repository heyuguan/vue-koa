const router = require('koa-router')();
var api = require('../../models').api;
var statisticsService = require('./service/statisticsService');
var clearService = require('./service/clearService');
// var standardizeService = require('./service/standardizeService');
var json2xls = require('json2xls');
var moment = require('moment');
var xl = require('excel4node');
var core = require('../../models');
var httpUitl = require('../../models/httpUtil');
var config = require('../../config');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/asyncTask', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/statistics/asyncTask';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    statisticsService.updateDbInfo();
    //await statisticsService.countAllHospital();sh 
    ctx.json(api.success("开始同步，稍后刷新查看！"));
});

router.post('/asyncHospital/:id', async function (ctx, next) {
    var id = ctx.params.id;
    if (config.is_use_service) {
        ctx.request.body.id = ctx.params.id;
        var url = config.apiIp + config.serviceId.biService + '/statistics/asyncHospital/' + id;
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    statisticsService.countHospitalById(id);
    ctx.json(api.success("开始同步" + id + "，稍后刷新查看！"));
});

router.post('/hospitalList', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/statistics/hospitalList';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    // console.log("##-->>searchStr:" + JSON.stringify(query.searchStr));
    query.searchStr = paramsFormat(query.searchStr);
    var result = await statisticsService.hospitalList(pageIndex, pageSize, query, query.searchStr);
    ctx.json(api.data(result));
});
function paramsFormat(param) {
    if (param) {
        if (param.constructor === Object) {
            for (var key in param) {
                var value = param[key];
                if (key == "$regex") {
                    param[key] = new RegExp(value);
                } else {
                    param[key] = paramsFormat(value);
                }
            }
        } else if (param.constructor === Array) {
            if (param && param.length > 0) {
                for (var index in param) {
                    var _param = param[index];
                    var _param2 = paramsFormat(_param);
                    param[index] = _param2;
                }
            }
        }
    }
    return param;
}

router.post('/clearLogs', async function (ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var id = ctx.request.body.id;
    var query = ctx.request.body.query || {};

    var result = await clearService.clearLogs(id, pageIndex, pageSize, query);
    ctx.json(api.data(result));
});

router.post('/hospitalInfo', async function (ctx, next) {
    var id = ctx.request.body.id;
    var result = await statisticsService.dbInfoById(id);
    ctx.json(api.data(result));
});

router.post('/standardizeData', async function (ctx, next) {
    var url = config.apiIp + config.serviceId.standardService + '/standardize/standardizeData';
    var retult = await httpUitl.post(url, ctx.request.body, null);
    ctx.json(api.success());
    // var id = ctx.request.body.id;
    // standardizeService.standardizeData(id);
    // ctx.json(api.success());
});

router.post('/clearHospital', async function (ctx, next) {
    var id = ctx.request.body.id;
    clearService.clearHospital(id);
    ctx.json(api.success());
});

router.post('/replaceHospital', async function (ctx, next) {
    var id = ctx.request.body.id;
    clearService.replaceHospital(id);
    ctx.json(api.success());
});

router.post('/restoreHospital', async function (ctx, next) {
    var id = ctx.request.body.id;
    clearService.restoreHospital(id);
    ctx.json(api.success());
});

router.post('/hospitalDataInfo/update', async function (ctx, next) {
    var query = ctx.request.body;
    var ent = await statisticsService.findById(query._id);

    if (!ent) {
        ctx.json(api.error("数据不存在！"));
        return;
    }
    ent.db = query.db;
    ent.hospital_id = query.hospital_id;
    ent.name = query.name;
    ent.version = query.version;
    ent.replaceConfig = query.replaceConfig;
    var success = await statisticsService.update(ent);
    ctx.json(api.result(success));
});
router.post('/hospitalAll', async function (ctx, next) {
    // var query = ctx.request.body.query || {};
    var result = await statisticsService.hospitalAll();
    var wb = new xl.Workbook();
    for (var key in result) {
        var ws = wb.addWorksheet(key);
        if (result[key].length > 0) {
            var keys = [];
            var r = 1;
            var m = 1;
            for (var _key in result[key][0]) {
                core.logger.info(_key);
                keys.push(_key);
                ws.cell(r, m).string(_key);
                m++;
            }
            for (var index in result[key]) {
                r++;
                var m = 1;
                for (var _index in keys) {
                    if (result[key][index][keys[_index]]) {
                        ws.cell(r, m).string(result[key][index][keys[_index]] + "");
                    } else {
                        ws.cell(r, m).string("");
                    }
                    m++;
                }
            }
        }
    }
    var buffer = await statisticsService.out(wb);
    let data = new Buffer(buffer, 'binary');

    // var xls = json2xls(result.resultsIp);
    // let data = new Buffer(xls, 'binary');
    var file_name = '医院住院数据按科室统计_' + moment().format('YYYYMMDDHHmmss');
    ctx.set('Content-Type', 'application/vnd.openxmlformats');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    ctx.body = data;
});

router.prefix('/statistics');
module.exports = router;