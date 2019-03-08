
var crypto = require('crypto');
var logger = require("../../../models").logger;
var _ = require('lodash');
var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;

var xl = require('excel4node');
var fs = require('fs');

var tableService = require('../../table/service/tableService');
var statisticsService = require('../../statistics/service/statisticsService');
var emrService = require('../../emr/service/emrService');

var myDao = require('../dao/taskDao');
var dataInfoDBName = "task_data_";
const path = require('path');
var config = require('../../../config');
const util = require('util');
var zipper = require("zip-local");
var moment = require('moment');

var s = {
    // 获取列表 
    PageList: async function (pageIndex, pageSize, query) {
        var q = {};
        if (query && query.ent_status !== undefined && query.ent_status != "") {
            q.ent_status = query.ent_status;
        }
        if (query && query.status !== undefined && query.status != "") {
            q.status = query.status;
        }
        if (query && query.name) {
            q = { name: { $regex: new RegExp(query.name) } };
        }
        // if (query && query.data_source_id !== undefined) {
        //     q.data_source_id = query.data_source_id;
        // }
        return await myDao.pageList(pageIndex, pageSize, q, { create_date: 1 });
    },
    PageListname: async function (pageIndex, pageSize, query) {
        return await myDao.pageList(pageIndex, pageSize, query, { create_date: 1 });
    },
    // 根据ID获取
    findById: async function (query) {
        return await myDao.findById2(query);
    },
    find: async function (query, options) {
        return await myDao.find(query, options);
    },
    // 新建
    add: async function (query, data_source_id) {
        return await myDao.insert(query);
    },
    // 更新
    update: async function (query, data_source_id) {
        return await myDao.update2(query);
    },
    // 导出数据任务--提取数据到mongoDB
    exportData: async function (data) {
        var info_id = data.info_id;
        if (!info_id) {
            var _po = {};
            _po.id = data.id;
            _po.status = "-1";
            _po.stop_cause = "参数错误";
            await myDao.update2(_po);
            // ctx.json(api.error("参数错误"));
            return;
        }
        var tableId = data.tableId;
        logger.info("##-->>" + JSON.stringify(data));
        var info = await statisticsService.dbInfoById(info_id);
        var entTable = await tableService.findTableById(tableId);
        if (!entTable) {
            var _po = {};
            _po.id = data.id;
            _po.status = "-1";
            _po.stop_cause = "数据未找到";
            await myDao.update2(_po);
            // ctx.json(api.error("数据未找到:" + tableId));
            return;
        }
        if (!data.hospital_id) {
            var _po = {};
            _po.id = data.id;
            _po.status = "-1";
            _po.stop_cause = "医院ID未找到";
            await myDao.update2(_po);
            return;
        }
        var search = {};
        if (data.search != "") {
            search = JSON.parse(data.search);
        }
        var fieldList = await tableService.findFieldListByTableId(tableId);
        var dataList = await emrService.pageList(info, entTable, 1, 1, search);
        var total = dataList.total;
        // 更新进度；
        var _po = {};
        _po.id = data.id;
        _po.status = "2";
        _po.execute_data = new Date();
        _po.stop_cause = "";
        _po.dataTotal = total;
        await myDao.update2(_po);
        var pageCount = parseInt((total + 20 - 1) / 20);
        logger.info("##-->>pageCount=" + pageCount);
        for (var page = data.page || 1; page <= pageCount; page++) {
            var _data = await this.findById(data);
            if ((_data.is_stop && _data.is_stop == "1") || (_data.ent_status && _data.ent_status == "1")) {
                // 判断是否停止提取任务；
                var _po = {};
                _po.id = data.id;
                _po.status = "0";
                _po.page = page;
                _po.execute_data = new Date();
                _po.stop_cause = "";
                _po.dataTotal = total;
                await myDao.update2(_po);
                return;
            }
            {
                var list = await emrService.pageList(info, entTable, page, 20, search);
                var m = 1;
                for (var j in list.items) {
                    var ent = list.items[j];
                    var _query = {};
                    _query.info = info;
                    _query.entTable = entTable;
                    _query.data_id = ent.id;
                    _query.task_id = data.id;
                    _query.table_id = tableId;
                    await s.outData(_query);

                    // 更新进度；
                    var progress = ((((page - 1) * 20 + m) / total) * 100).toFixed(2);
                    logger.info("##-->>progress" + progress);
                    var _po = {};
                    _po.progress = "查询:" + progress + "%|导出:0%";
                    _po.id = data.id;
                    _po.status = "2";
                    _po.page = page;
                    _po.execute_data = new Date();
                    _po.stop_cause = "";
                    _po.dataTotal = total;
                    await myDao.update2(_po);
                    m++;
                }
                // // 更新进度；
                // var progress = ((page / pageCount) * 100).toFixed(2);
                // logger.info("##-->>progress" + progress);
                // var _po = {};
                // _po.progress = "查询:" + progress + "%|导出:0%";
                // _po.id = data.id;
                // _po.status = "2";
                // _po.page = page;
                // _po.execute_data = new Date();
                // _po.stop_cause = "";
                // _po.dataTotal = total;
                // await myDao.update2(_po);
            }
        }
        var _po = {};
        _po.progress = "查询:100%|导出:0%";
        _po.id = data.id;
        _po.status = "2";
        _po.page = pageCount + 1;
        _po.execute_data = new Date();
        _po.stop_cause = "";
        _po.dataTotal = total;
        await myDao.update2(_po);
        await s.exportFile(data);
    },
    outData: async function (query) {
        var info = query.info;
        var entTable = query.entTable;
        var data_id = query.data_id;
        var task_id = query.task_id;
        var table_id = query.table_id;
        var parentObj = await emrService.findById(info, entTable, data_id);
        if (!parentObj) {
            ctx.json(api.error("parentObj is null!"));
            return;
        }
        var fieldList = await tableService.findFieldListByTableId(table_id);
        var parentData = await o.outParent(entTable, fieldList, parentObj, task_id);
        await o.outChilds(info, parentObj, table_id, task_id, parentData);
    },
    // 导出文件任务--将数据写入文件；
    exportFile: async function (data) {
        var entTable = await tableService.findTableById(data.tableId);
        var tableChilds = await tableService.tableList({ parent_id: data.tableId });
        var wb = new xl.Workbook();
        await outSaveFile.outParent(wb, entTable, tableChilds.length, 1, data);
        await outSaveFile.outChilds(wb, tableChilds, data);
        // 保存文件
        var buffer = await outSaveFile.out(wb);
        let fileData = new Buffer(buffer, 'binary');
        var file_name = data.id + '.xlsx';
        var output_path = config.output_path;
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        var export_path = path.join(output_path, data.id);
        if (!fs.existsSync(export_path)) {
            fs.mkdirSync(export_path);
        }
        var filePath = export_path + '/' + file_name;
        var file_path = path.join(export_path, file_name);
        if (fs.existsSync(file_path)) {
            fs.unlinkSync(file_path);
        }
        try {
            fs.writeFileSync(filePath, fileData, (err) => {
                if (err) {
                    logger.error("error:::===>", err);
                }
                console.log(patientName + '...保存完毕');
            });
        } catch (e) {
            emdata.logger.error(e);
        }

        // 压缩文件
        var zipName = data.id + ".zip";
        var file_path_zip = path.join(output_path, zipName);
        if (fs.existsSync(file_path_zip)) {
            fs.unlinkSync(file_path_zip);
        }
        var buff = zipper.sync.zip(export_path).compress();
        buff.save(output_path + "/" + zipName);

        var _po = {};
        _po.id = data.id;
        _po.progress = "查询:100%|导出:100%";
        _po.status = "1";
        _po.execute_data = new Date();
        _po.stop_cause = "";
        _po.file = zipName;
        await myDao.update2(_po);
    }
};

var o = {
    outParent: async function (entTable, fieldList, parentObj, task_id) {
        var data = {};
        var r = 2;
        for (var i = 0; i < fieldList.length; i++) {
            var field = fieldList[i];
            if (parentObj.hasOwnProperty(field.field_name)) {
                var val = parentObj[field.field_name];
                logger.info("##-->>val=" + val);
                if (val) {
                    if (field.data_type == 'date') {
                        data[fieldList[i].title] = val;
                    } else {
                        if (val != "")
                            data[fieldList[i].title] = val + '';
                    }
                }
            } else {
                logger.warn(field.title);
            }
        }

        var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
        data.task_id = task_id;
        var result = _myDao.find(data);
        if (!result.task_id) {
            await _myDao.insert(data);
        }
        return data;
    },
    outChild: async function (entTable, fieldList, objList, task_id, parentData) {
        var r = 2;
        for (var j = 0; j < objList.length; j++) {
            var obj = objList[j];
            var data = {};
            if (parentData && parentData.住院号) {
                data["住院号"] = parentData.住院号;
            }
            if (parentData && parentData.记录号) {
                data["记录号"] = parentData.记录号;
            }
            if (parentData && parentData.病区) {
                data["病区"] = parentData.病区;
            }
            if (parentData && parentData.科室) {
                data["科室"] = parentData.科室;
            }
            for (var i = 0; i < fieldList.length; i++) {
                var field = fieldList[i];
                if (obj.hasOwnProperty(field.field_name)) {
                    var val = obj[field.field_name];
                    if (val) {
                        if (field.data_type == 'date') {
                            data[fieldList[i].title] = val;
                        } else {
                            data[fieldList[i].title] = val + '';
                        }
                    }
                } else {
                    logger.warn(field.title);
                }
            }
            var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
            data.task_id = task_id;
            var result = _myDao.find(data);
            if (!result.task_id)
                await _myDao.insert(data);
            r++;
        }
    },
    outChilds: async function (info, obj, parent_id, task_id, parentData) {
        var _this = this;
        var tableChilds = await tableService.tableList({ parent_id: parent_id });
        for (var i = 0; i < tableChilds.length; i++) {
            var tableChild = tableChilds[i];
            var child_table_id = tableChild._id + '';
            var fileListChld = await tableService.findFieldListByTableId(child_table_id);
            logger.info("##-->>" + JSON.stringify(tableChild.data_id_key));
            var q = {};
            if (tableChild.data_id_key !== undefined) {
                var vals = JSON.parse(tableChild.data_id_key);
                for (var key in vals) {
                    var val = obj[key];
                    q[vals[key]] = val;
                }
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
                    for (var j in sub_objList) {
                        var sub_item = sub_objList[j];
                        for (var k in fileListChld) {
                            var p = fileListChld[k].field_name;
                            sub_item[p] = item[p];
                        }
                        logger.warn(sub_item);
                        sub_obj_list.push(sub_item);
                    }
                }
                for (var k in sub_fileListChld) {
                    fileListChld.push(sub_fileListChld[k]);
                }
                await _this.outChild(tableChild, fileListChld, sub_obj_list, task_id, parentData);
            } else {
                await _this.outChild(tableChild, fileListChld, objList, task_id, parentData);
            }
        }
    }
};

var outSaveFile = {
    out: async function (wb) {
        return new Promise(function (resolve, reject) {
            wb.writeToBuffer().then(function (buffer) {
                return resolve(buffer);
            });
        });
    },
    outParent: async function (wb, entTable, fileTotal, fileIndex, data) {
        var m = 1;
        var _wb;
        var ws;
        var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
        var q = { task_id: data.id };
        var dataList = await _myDao.pageList(1, 1, q);
        var total = dataList.total;
        if (total < 1){
            return;
        }
        if (total > 2000 && total > (data.dataTotal + 100)) {
            _wb = new xl.Workbook();
            ws = _wb.addWorksheet(entTable.title);
        } else {
            ws = wb.addWorksheet(entTable.title);
        }
        var pageCount = parseInt((total + 20 - 1) / 20);
        var r = 1;
        var fieldList = [];
        for (var page = 1; page <= pageCount; page++) {
            if (page > 250 * m) {
                if (_wb) {
                    await this.saveFile(_wb, data, entTable, m);
                    m++;
                    _wb = new xl.Workbook();
                    ws = _wb.addWorksheet(entTable.title);
                }
            }
            var list = await _myDao.pageList(1, 20, q);
            for (var j in list.items) {
                var ent = list.items[j];
                if (r == 1) {
                    for (var key in ent) {
                        if (key && key != "task_id" && key != "_id")
                            fieldList.push(key);
                    }
                    for (var i = 0; i < fieldList.length; i++) {
                        var field = fieldList[i];
                        ws.cell(r, i + 1).string(field);
                    }
                    r++;
                }
                for (var i = 0; i < fieldList.length; i++) {
                    var field = fieldList[i];
                    var val = ent[field];
                    if (util.isDate(val)) {
                        ws.cell(r, i + 1).date(val);
                    } else if (util.isString(val)) {
                        ws.cell(r, i + 1).string(val);
                    } else if (util.isNumber(val)) {
                        ws.cell(r, i + 1).string(val + "");
                    } else if (util.isUndefined(val)) {
                        ws.cell(r, i + 1).string("");
                    } else {
                        ws.cell(r, i + 1).string("未知字段类型:" + JSON.stringify(val));
                    }
                }
                r++;
            }

            // 更新进度；
            var progress = ((page / pageCount) * 100).toFixed(2);
            logger.info("##-->>progress" + progress);
            var _po = {};
            _po.id = data.id;
            _po.status = "2";
            _po.progress = "查询:100%|导出:" + fileIndex + "(" + progress + "%)/" + fileTotal;
            _po.execute_data = new Date();
            _po.stop_cause = "";
            await myDao.update2(_po);
        }
        if (_wb) {
            await this.saveFile(_wb, data, entTable, m);
        }
    },
    outChilds: async function (wb, tableChilds, data) {
        var _this = this;
        for (var i = 0; i < tableChilds.length; i++) {
            var _data = await s.findById(data);
            if ((_data.is_stop && _data.is_stop == "1") || (_data.ent_status && _data.ent_status == "1")) {
                // 判断是否停止任务；
                var _po = {};
                _po.id = data.id;
                _po.status = "0";
                _po.execute_data = new Date();
                _po.stop_cause = "";
                await myDao.update2(_po);
                return;
            }
            var tableChild = tableChilds[i];
            await _this.outParent(wb, tableChild, tableChilds.length, i + 2, data);
        }
    },
    saveFile: async function (wb, data, entTable, i) {
        // 保存文件
        var buffer = await this.out(wb);
        let fileData = new Buffer(buffer, 'binary');
        var file_name = data.id + "_" + entTable.table_name + "_" + i + '.xlsx';
        var output_path = config.output_path;
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        var export_path = path.join(output_path, data.id);
        if (!fs.existsSync(export_path)) {
            fs.mkdirSync(export_path);
        }
        var filePath = export_path + '/' + file_name;
        var file_path = path.join(export_path, file_name);
        if (fs.existsSync(file_path)) {
            fs.unlinkSync(file_path);
        }
        try {
            fs.writeFileSync(filePath, fileData, (err) => {
                if (err) {
                    logger.error("error:::===>", err);
                }
                console.log(patientName + '...保存完毕');
            });
        } catch (e) {
            emdata.logger.error(e);
        }
    },
    deleteFolderRecursive: async function(path) {
        if( fs.existsSync(path) ) {
            fs.readdirSync(path).forEach(function(file) {
                var curPath = path + "/" + file;
                if(fs.statSync(curPath).isDirectory()) { // recurse
                    outSaveFile.deleteFolderRecursive(curPath);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
        }
    }
};

module.exports = s;