const router = require('koa-router')();
var crypto = require('crypto');
var uuid = require('node-uuid');
var api = require('../../models').api;
var logger = require('../../models').logger;
var tableService = require('../table/service/tableService');
var emrService = require('./service/emrService');
var statisticsService = require('../statistics/service/statisticsService');
var xl = require('excel4node');
var httpUitl = require('../../models/httpUtil');
var config = require('../../config');


router.post('/info', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/emr/info';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body.query || {};
    var info_id = query.info_id;
    if (!info_id) {
        ctx.json(api.error("参数错误"));
        return;
    }
    var tableId = query.tableId;
    var info = await statisticsService.dbInfoById(info_id);
    var entTable = await tableService.findTableById(tableId);
    if (!entTable) {
        ctx.json(api.error("数据未找到:" + tableId));
        return;
    }

    var fieldList = await tableService.findFieldListByTableId(tableId);

    var result = {
        fieldList: fieldList,
        table: entTable,
        info: info
    };
    ctx.json(api.data(result));
});

router.post('/list', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/emr/list';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var info_id = query.info_id;
    if (!info_id) {
        ctx.json(api.error("参数错误"));
        return;
    }
    var tableId = query.tableId;
    var info = await statisticsService.dbInfoById(info_id);
    var entTable = await tableService.findTableById(tableId);
    if (!entTable) {
        ctx.json(api.error("数据未找到:" + tableId));
        return;
    }

    var fieldList = await tableService.findFieldListByTableId(tableId);
    var dataList = await emrService.pageList(info, entTable, pageIndex, pageSize, query.search);

    ctx.json(api.data(dataList));
});

router.post('/side', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/emr/side';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body.query || {};
    var hospital_id = query.hospital_id;
    var table_id = query.table_id;
    var entTable = await tableService.findTableById(table_id);
    //查询 子集
    var tableChild = await tableService.tableList({ parent_id: table_id });
    var data = {
        parent: entTable,
        items: tableChild
    };
    ctx.json(api.data(data));
});

router.post('/content', async function (ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/emr/content';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body.query || {};
    var info_id = query.info_id;
    var table_id = query.table_id;
    var dataId = query.data_id;
    var info = await statisticsService.dbInfoById(info_id);
    //配置
    var entTable = await tableService.findTableById(table_id);
    var parentTable = await tableService.findTableById(entTable.parent_id);
    logger.info("##-->>emr parentTable:" + parentTable.table_name +";dataId:" + dataId);
    var parentObj = await emrService.findById(info, parentTable, dataId);
    //配置的字段
    var entField = await tableService.findFieldListByTableId(table_id);
    //通过配置的表 获取 数据 
    var vals = JSON.parse(entTable.data_id_key);

    var q = {};
    if (parentObj) {
        for (var key in vals) {
            if (parentObj.hasOwnProperty(key)){
                var val = parentObj[key];
                q[vals[key]] = val;
            }
        }
    }

    var tableChild = await tableService.tableList({ parent_id: table_id });
    var data = await emrService.findData(info, entTable, q, query.search);
    var result = {
        field: entField,
        data: data,
        current_table: entTable,
        parent_table: parentTable,
        chaild_table: tableChild,
        parent_obj: parentObj,
        info: info
    }
    ctx.json(api.data(result));


});

var o = {
    out: async function (wb) {
        return new Promise(function (resolve, reject) {
            wb.writeToBuffer().then(function (buffer) {
                return resolve(buffer);
            });
        });
    },
    outParent: function (wb, entTable, fieldList, parentObj) {
        var ws = wb.addWorksheet(entTable.title);
        for (var i = 0; i < fieldList.length; i++) {
            var field = fieldList[i];
            ws.cell(1, i + 1).string(field.title);
        }

        var r = 2;
        for (var i = 0; i < fieldList.length; i++) {
            var field = fieldList[i];
            if (parentObj.hasOwnProperty(field.field_name)) {
                var val = parentObj[field.field_name];
                if (field.data_type == 'date') {
                    ws.cell(r, i + 1).date(val);
                } else {
                    ws.cell(r, i + 1).string(val + '');
                }
            } else {
                ws.cell(r, i + 1).string('');
                logger.warn(field.title);
            }
        }
    },
    outChild: async function (wb, entTable, fieldList, objList) {
        var ws = wb.addWorksheet(entTable.title);
        for (var i = 0; i < fieldList.length; i++) {
            var field = fieldList[i];
            ws.cell(1, i + 1).string(field.title);
        }

        var r = 2;
        for (var j = 0; j < objList.length; j++) {
            var obj = objList[j];
            for (var i = 0; i < fieldList.length; i++) {
                var field = fieldList[i];
                if (obj.hasOwnProperty(field.field_name)) {
                    var val = obj[field.field_name];
                    if (field.data_type == 'date') {
                        ws.cell(r, i + 1).date(val);
                    } else {
                        ws.cell(r, i + 1).string(val + '');
                    }
                } else {
                    ws.cell(r, i + 1).string('');
                    logger.warn(field.title);
                }
            }
            r++;
        }
    },
    outChilds: async function name(wb, info, obj, parent_id) {
        var _this = this;
        var tableChilds = await tableService.tableList({ parent_id: parent_id });
        for (var i = 0; i < tableChilds.length; i++) {
            var tableChild = tableChilds[i];
            if (tableChild && (tableChild.table_name == "ip_patient_info" || !tableChild.table_name)){
                continue;
            }
            var child_table_id = tableChild._id + '';
            var fileListChld = await tableService.findFieldListByTableId(child_table_id);

            var vals = JSON.parse(tableChild.data_id_key);
            var q = {};
            for (var key in vals) {
                var val = obj[key];
                q[vals[key]] = val;
            }

            var objList = await emrService.findData(info, tableChild, q, {});
            var sub_tableChild = await tableService.tableList({ parent_id: child_table_id });
            if (sub_tableChild.length > 0) {
                var sub_tableChild = sub_tableChild[0];
                var sub_child_table_id = sub_tableChild._id + '';
                var sub_fileListChld = await tableService.findFieldListByTableId(sub_child_table_id);
                var sub_vals = JSON.parse(sub_tableChild.data_id_key);


                var sub_obj_list = [];
                for (var m in objList) {
                    var item = objList[m];
                    var sub_q = {};
                    for (var key in sub_vals) {
                        var val = item[key];
                        sub_q[sub_vals[key]] = val;
                    }
                    var sub_objList = await emrService.findData(info, sub_tableChild, sub_q, {});
                    if (sub_objList && sub_objList.length > 0) {
                        for (var j in sub_objList) {
                            var sub_item = sub_objList[j];
                            for (var k in fileListChld) {
                                var p = fileListChld[k].field_name;
                                sub_item[p] = item[p];
                            }
                            logger.warn(sub_item);
                            sub_obj_list.push(sub_item);
                        }
                    } else {
                        var sub_item = {};
                        for (var k in fileListChld) {
                            var p = fileListChld[k].field_name;
                            sub_item[p] = item[p];
                        }
                        sub_obj_list.push(sub_item);
                    }
                }
                for (var k in sub_fileListChld) {
                    fileListChld.push(sub_fileListChld[k]);
                }

                _this.outChild(wb, tableChild, fileListChld, sub_obj_list);

            } else {
                _this.outChild(wb, tableChild, fileListChld, objList);
            }
        }
    }
};

router.post('/outData', async function name(ctx, next) {
    if (config.is_use_service) {
        var url = config.apiIp + config.serviceId.biService + '/emr/outData';
        var retult = await httpUitl.post(url, ctx.request.body, null);
        ctx.json(retult);
        return;
    }

    var query = ctx.request.body || {};
    var info_id = query.info_id;
    var table_id = query.table_id;
    var data_id = query.data_id;
    var info = await statisticsService.dbInfoById(info_id);
    if (!info) {
        ctx.json(api.error("db info is null!" + JSON.stringify(query)));
        return;
    }
    var entTable = await tableService.findTableById(table_id);
    if (!entTable) {
        ctx.json(api.error("table info is null!"));
        return;
    }
    var parentObj = await emrService.findById(info, entTable, data_id);
    if (!parentObj) {
        ctx.json(api.error("parentObj is null!"));
        return;
    }

    var fieldList = await tableService.findFieldListByTableId(table_id);

    var wb = new xl.Workbook();
    o.outParent(wb, entTable, fieldList, parentObj);

    await o.outChilds(wb, info, parentObj, table_id);

    // var tableChilds = await tableService.tableList({ parent_id: table_id });
    // for (var i = 0; i < tableChilds.length; i++) {
    //     var tableChild = tableChilds[i];
    //     var child_table_id = tableChild._id + '';
    //     var fileListChld = await tableService.findFieldListByTableId(child_table_id);

    //     var vals = JSON.parse(tableChild.data_id_key);
    //     var q = {};
    //     for (var key in vals) {
    //         var val = parentObj[key];
    //         q[vals[key]] = val;
    //     }
    //     var objList = await emrService.findData(info, tableChild, q, {});
    //     o.outChild(wb, tableChild, fileListChld, objList);
    // }

    var buffer = await o.out(wb);
    let data = new Buffer(buffer, 'binary');
    var file_name = data_id;
    ctx.set('Content-Type', 'application/vnd.openxmlformats');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    ctx.body = data;

    // wb.writeToBuffer().then(function(buffer) {
    //     let data = new Buffer(buffer, 'binary');
    //     var file_name = data_id;
    //     ctx.set('Content-Type', 'application/vnd.openxmlformats');
    //     ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(file_name) + ".xlsx");
    //     ctx.body = data;
    // });


});

router.prefix('/emr');
module.exports = router;