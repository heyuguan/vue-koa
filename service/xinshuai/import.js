const router = require('koa-router')();
var api = require('../../models').api;
var emdata = require('../../models');
var logger = require("../../models").logger;
var utils = emdata.utils;
var _ = require('lodash');
const send = require('koa-send');
var config = require('../../config');
const path = require('path');
var fs = require('fs');
var upload_path = path.join(__dirname, '../../upload');
var myService = require('./service/importService');
var xlsx = require("node-xlsx");
var json2xls = require('json2xls');
var moment = require('moment');
var get = require('simple-get');
var md5 = require('md5');
var uuid = require('uuid');
var xinshuaiServcie = require('./service/index');
var configDao = require('./dao/configDao');
var importHFDao = require('./dao/importHFDao');
var reportService = require('./service/reportService');
var outpatientService = require('./service/outpatientService');
var uploadService = require('./service/uploadService');
var httpUitl = require('../../models/httpUtil');

// 上报
router.post('/report', async function(ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/hfImport/report';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var params = ctx.request.body;
    var size = 0; // 上报数量
    if (params instanceof Array) { // 多选
        var IDs = params || [];
        for (var i = 0; i < IDs.length; i++) {
            await reportService.push(IDs[i]);
        }
        size = params.length;
    } else { // 全选
        var info_id = params.info_id;
        var query = { 'info_id': info_id, "ent_status": 0 };
        var count = await importHFDao.count(query);
        var pageSize = 7;
        var pageCount = count / pageSize;
        if (count % pageSize > 0) {
            pageCount++;
        }
        for (var pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
            var pageList = await importHFDao.pageList(pageIndex, pageSize, query);
            for (var i = 0; i < pageList.items.length; i++) {
                await reportService.push(pageList.items[i].ID);
            }
        }
        size = count;
    }

    ctx.json(api.data(size));


});

// 获取列表
router.post('/list', async function(ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/hfImport/list';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    // if (!query.hospital_id) {
    //     query.hospital_id = ctx.request.body.hospital_id;;
    // }
    //check user
    var user = ctx.state.user;
    // query.user_id = user.id;
    query.ent_status = query.ent_status || 0;
    logger.info("##-->>" + JSON.stringify(query));
    if (!query.info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    query.info_id = query.info_id + "";
    var paegList = await myService.PageList(pageIndex, pageSize, query);
    // if (query && query.ID && query.ID === '6707L9'){
    //     myService.pageList_test();
    // }
    ctx.json(api.data(paegList));


});

// 根据ID获取
// router.post('/findById', async function(ctx, next) {
//     var query = ctx.request.body.query || {};
//     if (!query.data_source_id){
//         query.data_source_id = ctx.request.body.data_source_id;;
//     }
//     if (!query._id){
//         query._id = ctx.request.body._id;;
//     }
//     if (!query.id){
//         query.id = ctx.request.body.id;;
//     }
//     logger.info("##-->>" + JSON.stringify(query));
//     if ((!query._id && !query.id)||!query.data_source_id) {
//         ctx.json(api.error("错误的参数"));
//         return;
//     }
//     var data = await myService.findById(query);
//     ctx.json(emdata.api.data(data));
// });

// 新建
router.post('/add', async function(ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/hfImport/add';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;

    if (!query || !query.info_id || !query.ID) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var _result = await myService.find({ ID: query.ID, ent_status: 0 });
    if (_result && _result.ID) {
        ctx.json(api.error("数据已存在"));
        return;
    }
    query = myService.getData(query);
    var po = _.assign({}, query, {
        // id: utils.autoId() + '',
        creater: user.id,
        updater: user.id,
        create_date: new Date(),
        update_date: new Date(),
        ent_status: 0
    });

    var data = await myService.add(po);
    var result = {
        data: data
            // id: po.id
    }
    ctx.json(api.data(result));


});

// 更新
router.post('/update', async function(ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/hfImport/update';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;

    if (!query || (!query._id && !query.id)) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    query = myService.getData(query);
    query.update_date = new Date();
    query.updater = user.id;
    logger.info("##-->>update:" + JSON.stringify(query));
    var data = await myService.update(query);
    ctx.json(emdata.api.data(data));


});

// 删除
// router.post("/delete",async function(ctx,next){
//     var query = ctx.request.body;
//     var user = ctx.state.user;
//     if (!query||!query._id||!query.data_source_id) {
//         ctx.json(api.error("错误的参数"));
//         return;
//     }
//     var update = _.assign({}, query, {
//         update_date: new Date(),
//         updater: user.id,
//         ent_status: 1
//     });
//     var data = await myService.delete(update, query.data_source_id);
//     ctx.json(emdata.api.data(data));
// });

router.post('/upload', async function(ctx, next) {
    let file = ctx.request.body.files.file;
    var info_id = ctx.request.body.fields.info_id;
    var user = ctx.state.user;
    logger.info("##-->>info_id:", info_id);
    logger.info("##-->>file:" + JSON.stringify(file));
    if (!info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var info = await xinshuaiServcie.findById(info_id);
    if (!info || !info._id) {
        ctx.json(api.error("医院信息未找到"));
        return;
    }

    var fileData3 = fs.readFileSync(file.path);
    var fileFormat = (file.name).split(".");
    var fileEnd = fileFormat[fileFormat.length - 1];
    if (fileEnd && (fileEnd == "xlsx" || fileEnd == "xls")) {
        var list = xlsx.parse(fileData3);
        // logger.info("##-->>fileData:" + JSON.stringify(list));

        // var params = {
        //     user: ctx.state.user,
        //     data: list,
        //     fileName: file.name,
        //     info_id: info_id
        // }
        // var url = config.apiIp + config.serviceId.biService + '/hfImport/upload';
        // var retult = await httpUitl.post(url, params, null);
        // logger.info("##-->>"+JSON.stringify(retult));
        // ctx.json(retult);
        // return;

        var result = await myService.importExcel(list, user, info);
        // if (result && result.msg) {
        //     ctx.json(api.error(result.msg));
        //     return;
        // }
        var _info = {
            fileName: file.name,
            successNum: result.totalNum - result._existDates.length
        };
        if (result && result._existDates.length > 0) {
            var fileName = fileFormat[0];
            var _fileFormat = fileName.split("_");
            fileName = _fileFormat[0];
            var xls = json2xls(result._existDates);
            let data = new Buffer(xls, 'binary');
            var file_name = fileName + '_导入失败项_' + moment().format('YYYYMMDDHHmmss') + ".xlsx";
            var output_path = config.output_path;
            if (!fs.existsSync(output_path)) {
                fs.mkdirSync(output_path);
            }
            output_path = config.output_path + "/importhffailure";
            if (!fs.existsSync(output_path)) {
                fs.mkdirSync(output_path);
            }
            var filePath = output_path + '/' + file_name;
            try {
                fs.writeFileSync(filePath, data, (err) => {
                    if (err) {
                        logger.error("error:::===>", err);
                    }
                });
            } catch (e) {}
            // ctx.set('Content-Type', 'application/vnd.openxmlformats');
            // ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
            // ctx.body = data;
            // return;
            _info.failureName = file_name;
        }
        ctx.json(api.data(_info));
    } else {
        ctx.json(api.error("文件类型错误"));
        return;
    }
});
// 导入失败项下载
router.post("/downLoad", async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.failureName) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var output_path = config.output_path + "/importhffailure";
    var file_path = path.join(output_path, query.failureName);
    if (!fs.existsSync(file_path)) {
        ctx.json(api.error("文件不存在！"));
        return;
    }
    ctx.attachment(query.failureName);
    await send(ctx, query.failureName, { root: output_path });
});
// 计算门诊心衰数据;
router.post("/op/execute", async function(ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/hfImport/op/execute';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var _result = await xinshuaiServcie.findById(query.info_id);
    if (!_result && !_result._id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    await outpatientService.addTaskOP(_result, query.info_id);
    ctx.json(api.success("开始执行"));


});
// 心衰数据导出;
// router.post("/hf/downLoad", async function(ctx, next) {
//     var query = ctx.request.body;
//     var user = ctx.state.user;
//     if (!query || !query.info_id) {
//         ctx.json(api.error("错误的参数"));
//         return;
//     }
//     var _result = await xinshuaiServcie.findById(query.info_id);
//     if (!_result && !_result._id) {
//         ctx.json(api.error("数据不存在"));
//         return;
//     }
//     var json = await myService.downLoad(query.info_id);
//     var xls = json2xls(json);
//     let data = new Buffer(xls, 'binary');
//     var file_name = _result.name + '_' + moment().format('YYYYMMDDHHmmss');
//     ctx.set('Content-Type', 'application/vnd.openxmlformats');
//     ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
//     ctx.body = data;
// });
//生成确认报告的数据
router.post("/hf/countConfrimData",async function (ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var _result = await xinshuaiServcie.findById(query.info_id);
    if (!_result && !_result._id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    //修改状态表中的状态
    await myService.insertFlag(_result);
    // var json = await myService.downLoad(query.info_id,_result);
    myService.downLoad(query.info_id,_result);
    // return await myService.toFile(json,_result);
    ctx.json(api.success());

});
//确认报告数据导出
router.post("/hf/downLoad",async function(ctx,next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var file = await myService.getFile(query.info_id);
    // logger.info("file-------:"+JSON.stringify(file));
    ctx.attachment(encodeURI(file.fileName));
    await send(ctx, encodeURI(file.fileName), { root: file.output_path });
});
//查询文件的状态
router.post("/hf/fileFlag",async function(ctx,next){
    var query = ctx.request.body;
    if(!query || !query.info_id){
        ctx.json(api.error("错误的参数"));
        return;
    }
    return await myService.fileFlag(query.info_id);
});
// 心衰门诊用药数据导出;
router.post("/hf/downLoadOrder", async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.info_id) {
        ctx.json(api.error("错误的参数"));
        return;
    }
    var _result = await xinshuaiServcie.findById(query.info_id);
    if (!_result && !_result._id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    var json = await myService.downLoadOrder(query.info_id);
    var xls = json2xls(json);
    let data = new Buffer(xls, 'binary');
    var file_name = _result.name + '_' + '门诊用药' + '_' + moment().format('YYYYMMDDHHmmss');
    ctx.set('Content-Type', 'application/vnd.openxmlformats');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    ctx.body = data;
});

// 心衰报告同步到新数据库
router.post('/uploadDemodt', async function(ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/hfImport/uploadDemodt';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var paramsObj = ctx.request.body;
    var params = paramsObj.ids;
    var flag = paramsObj.flag;
    var size = 0; // 上报数量
    var info_id = paramsObj.info_id;
    var _result = await xinshuaiServcie.findById(info_id);
    if (!_result || !_result._id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    if (params instanceof Array) { // 多选
        var IDs = params || [];
        for (var i = 0; i < IDs.length; i++) {
            await uploadService.push(IDs[i], flag, _result);
        }
        size = params.length;
    } else { // 全选
        var flag = paramsObj.flag;
        var query = { 'info_id': info_id, "ent_status": 0 };
        var count = await importHFDao.count(query);
        var pageSize = 7;
        var pageCount = count / pageSize;
        if (count % pageSize > 0) {
            pageCount++;
        }
        for (var pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
            var pageList = await importHFDao.pageList(pageIndex, pageSize, query);
            for (var i = 0; i < pageList.items.length; i++) {
                await uploadService.push(pageList.items[i].ID, flag, _result);
            }
        }
        size = count;
    }

    ctx.json(api.data(size));
});
// 心衰数据全部导出;
router.post("/hf/downLoadAll", async function(ctx, next) {
    var query = ctx.request.body;
    var user = ctx.state.user;
    var json = await myService.downLoadAll();
    var xls = json2xls(json);
    let data = new Buffer(xls, 'binary');
    var file_name = '全部心衰_' + moment().format('YYYYMMDDHHmmss');
    ctx.set('Content-Type', 'application/vnd.openxmlformats');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    ctx.body = data;
});
//删除选中医院的确认报告里的全部数据
router.post("/deleteData",async function(ctx,next){
    var paramsObj = ctx.request.body;
    var info_id = paramsObj.info_id;
    var _result = await xinshuaiServcie.findById(info_id);
    if (!_result || !_result._id) {
        ctx.json(api.error("数据不存在"));
        return;
    }
    var query = { 'info_id': info_id, "ent_status": 0 };
    var data = {"ent_status" : 1 ,"updater" : ctx.state.user.id ,"update_date": new Date()};
    var count = await importHFDao.updateAll(data,query);
    ctx.json(api.data(count));
});

module.exports = router;