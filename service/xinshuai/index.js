const router = require('koa-router')();
var xinshuaiServcie = require('./service');
var api = require('../../models').api;
var json2xls = require('json2xls');
var core = require('../../models');
var logger = require('../../models').logger;
var moment = require('moment');
var httpUitl = require('../../models/httpUtil');
var config = require('../../config');
var reportCountService = require('./service/reportLogCountService');
var db = require("../../models").platformDemo;
var Dao = require("../../models/mysql/MysqlDao");
var mongoDao = require("../../models/mongo/MongoDao");
var mongodb = require("../../models").mongo;
var fs = require('fs');
const send = require('koa-send');
var config = require('../../config');
const path = require('path');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/config/pageList', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/pageList';
        var paegList = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(paegList);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await xinshuaiServcie.pageList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));


});

router.post('/config/info', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/info';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }

    var id = ctx.request.body.id;
    var info = await xinshuaiServcie.findById(id);
    ctx.json(api.data(info));
});

router.post('/config/lookForList', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/lookForList';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await xinshuaiServcie.lookForList(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));


});

router.post('/config/add', async function (ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/add';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }

    var query = ctx.request.body;
    var user = ctx.state.user;
    if (!query || !query.hospital_id || !query.hospital_db_id) {
        ctx.json(api.error("参数错误！"));
        return;
    }
    var result = await xinshuaiServcie.find({ hospital_id: query.hospital_id, hospital_db_id: query.hospital_db_id, is_delete: 0 });
    if (result && result._id) {
        ctx.json(api.error("该数据已存在！"));
        return;
    }

    var ent = {};
    ent.create_date = new Date();
    ent.modify_date = new Date();
    ent.create_user_id = user.id;
    ent.modify_user_id = user.id;
    ent.is_delete = 0;
    ent.name = query.name;
    ent.hospital_id = query.hospital_id + '';
    ent.deptNames = query.deptNames;
    ent.deptNameLike = query.deptNameLike;
    ent.history_ids = query.history_ids;
    ent.diagnosis_types = query.diagnosis_types;
    ent.intro = query.intro;
    ent.system_name = query.system_name;
    ent.spider_user = query.spider_user;
    ent.exam_items = query.exam_items;
    ent.parse_user = query.parse_user;
    ent.start_date = query.start_date;
    ent.end_date = query.end_date;
    ent.db = query.db;
    ent.hfc_hospital_id = query.hfc_hospital_id;
    ent.hospital_db_id = query.hospital_db_id;
    ent.database = query.database;
    ent.remark = query.remark;
    var success = await xinshuaiServcie.add(ent);
    ctx.json(api.result(success));
});

router.post('/config/update', async function (ctx, next) {
    if (config.is_use_service) {
        ctx.request.body.user = ctx.state.user;
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/update';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }

    var query = ctx.request.body;
    var ent = await xinshuaiServcie.findById(query._id);
    var user = ctx.state.user;
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
        return;
    }
    query.modify_date = new Date();
    query.modify_user_id = user.id;
    var success = await xinshuaiServcie.update(query);
    ctx.json(api.result(success));
});

router.post('/config/asyncData', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/asyncData';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }
logger.info("##-->>111");
    var query = ctx.request.body;
    var ent = await xinshuaiServcie.findById(query._id);
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
        return;
    }
    //logger.warn(ent);
    xinshuaiServcie.asyncData(ent);
    ctx.json(api.success());


});

router.post('/config/downLoad', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/downLoad';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        if (retult && retult.success) {
            var xls = json2xls(retult.data.data);
            let data = new Buffer(xls, 'binary');
            var file_name = retult.data.file_name;
            ctx.set('Content-Type', 'application/vnd.openxmlformats');
            ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
            ctx.body = data;
        } else {
            ctx.json(retult);
        }
        return;
    }

    var _id = ctx.request.body._id || {};
    var ent = await xinshuaiServcie.findById(_id);
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
        return;
    }
    var name = ent.name;
    var json = await xinshuaiServcie.downLoad(_id);
    var xls = json2xls(json);
    let data = new Buffer(xls, 'binary');
    var file_name = name + '_' + moment().format('YYYYMMDDHHmmss');
    ctx.set('Content-Type', 'application/vnd.openxmlformats');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    ctx.body = data;


});
//生成数据
router.post('/config/savaData', async function (ctx, next) {
    logger.info("##-->>11111111117777");
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/xinshuai/config/savaData';
        var retults = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retults);
        return;
    }
    logger.info("##-->>111111111144444");
    var query = ctx.request.body;
    var ent = await xinshuaiServcie.findById(query._id);
    if (!ent) {
        ctx.json(api.error("数据不存在！"));
        return;
    }
    logger.info("##-->>1111111111");
    await xinshuaiServcie.outData(ent, query._id);


    // var out = query.out;
    // if (out == '1') {
    //       var result=[];//将匹配的数据生成excel
    //        for(var i in json){
    //           var temp=  json[i];
    //           if(temp.是否匹配=='是'){
    //               result.push(temp);
    //           }
    //        }

    //     var xls = json2xls(result);
    //     let data = new Buffer(xls, 'binary');
    //     var file_name = ent.name + '_' + moment().format('YYYYMMDDHHmmss');
    //     ctx.set('Content-Type', 'application/vnd.openxmlformats');
    //     ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    //     ctx.body = data;
    // } else {
    //     var html = '<title>' + ent.name + '</title>';
    //     html += '<style>*{font-size:12px;} \r td {border:1px solid #ccc;}</style>';

    //     html += '<table>';
    //     if (json.length > 0) {
    //         html += '<tr>';
    //         for (var k in json[0]) {
    //             html += '<td>' + k + '</td>';
    //         }
    //         html += '</tr>';
    //     }
    //     for (var i in json) {
    //         html += '<tr>';
    //         for (var k in json[i]) {
    //             var str = json[i][k];
    //             var show = (str && str.length > 20) ? str.substring(0, 17) + '...' : str;
    //             html += '<td title=\"' + str + '\">' + show + '</td>';
    //         }
    //         html += '</tr>';
    //     }
    //     html += '</table>';
    //     ctx.body = html;
    // }
    return ctx.json(api.success());


});

router.post('/hospitalDb/list', async function (ctx, next) {
    var url = config.apiIp + config.serviceId.biService + '/hospitalDb/list';
    var paegList = await httpUitl.post(url, ctx.request.body, null);
    ctx.json(paegList);
});

router.post('/reportLogCount',async function(ctx, next){
    var paramsObj = ctx.request.body;
    var params = paramsObj.hospitalId; 
    var size = 0;
    await reportCountService.insert(params);
    try{
        if (params) { // 单家医院统计
            var hospitalId = params || '';
            await reportCountService.getCountByHospitalId(hospitalId);
            var data = {
                flag : 2,
                hospitalId : params,
                reason: '',
                updateDate : new Date(),
            };
            await reportCountService.update(data); 
        } else {
            var result = reportCountService.count();
        }
    }catch(e){
        logger.error(e);
        var data = {
            flag : 3,
            hospitalId : params,
            reason: JSON.stringify(e),
            updateDate : new Date(),
        };
        await reportCountService.update(data); 
    }

    ctx.json(api.success());
});

router.post('/reportLog/list', async function (ctx, next) {
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};

    var paegList = await reportCountService.list(pageIndex, pageSize, query);
    ctx.json(api.data(paegList));

});

router.post('/reportLog/download',async function(ctx,next){
    var query = ctx.request.body.query || {};
    var file = await reportCountService.downLoad(query);
    logger.info("file-------:"+JSON.stringify(file));
    ctx.attachment(file.fileName);
    await send(ctx, file.fileName, { root: file.output_path });
});

router.post('/reportLog/flag',async function(ctx,next){
    var info = await reportCountService.getFlag();
    return ctx.json(api.data(info));
});

router.prefix('/xinshuai');
module.exports = router;