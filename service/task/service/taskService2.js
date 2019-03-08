var crypto = require('crypto');
var logger = require("../../../models").logger;
var _ = require('lodash');
var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;
var core = require('../../../models');

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
var q_name = config.fix + 'export_data';
var q_name_file = config.fix + 'export_data_file';
var q_name_delete = config.fix + 'export_data_delete';

// var kue = require('kue');
// queue = kue.createQueue({
//     prefix: 'q',
//     redis: config.redis
// });
// queue.watchStuckJobs();

var s = {
    tasks: [],
    queue: async function() {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    findTableInfo: async function(info_id, table_id) {
        var key = "export_table_" + info_id + '_' + table_id;
        var table_infostr = await core.redis.get(key);
        var table_info = null;
        if (table_infostr) {
            logger.info("##-->>使用redis中缓存的tableInfo信息...");
            try {
                table_info = JSON.parse(table_infostr);
            } catch (e) {
                core.logger.error(e);
            }
        }
        if (!table_info || !table_info.info || !table_info.table || !table_info.childs) {
            table_info = {};
            logger.info("##-->>redis中不存在缓存，开始查表获取...");
            var info = await statisticsService.dbInfoById(info_id);
            var entTable = await tableService.findTableById(table_id);
            entTable.fields = await tableService.findFieldListByTableId(table_id);

            var childTables = await tableService.tableList({ parent_id: table_id });
            for (var i = 0; i < childTables.length; i++) {
                var tableChild = childTables[i];
                var child_table_id = tableChild._id + '';
                var fileListChld = await tableService.findFieldListByTableId(child_table_id);
                var sub_tableChilds = await tableService.tableList({ parent_id: child_table_id });
                childTables[i].fileListChld = fileListChld;
                childTables[i].sub_tableChild = sub_tableChilds;
                if (sub_tableChilds.length > 0) {
                    var sub_tableChild = sub_tableChilds[0];
                    var sub_child_table_id = sub_tableChild._id + '';
                    var sub_fileListChld = await tableService.findFieldListByTableId(sub_child_table_id);
                    childTables[i].sub_fileListChld = sub_fileListChld;
                }
            }

            table_info.info = info;
            table_info.table = entTable;
            table_info.childs = childTables;
            if (table_info.info && table_info.table && table_info.childs) {
                logger.info("##-->>将获取到的tableInfo信息存储到reids中...");
                await core.redis.set(key, JSON.stringify(table_info), 6 * 60 * 60);
            }
        }
        if (!table_info || !table_info.info || !table_info.table || !table_info.childs) {
            logger.error("##-->>tableInfo信息是null.");
            return null;
        }
        return table_info;
    },
    findTaskCondition: async function(task_id) {
        var key = "export_condition_" + task_id;
        var condition = await core.redis.get(key);
        if (!condition) {
            var result = await myDao.findById2({ id: task_id });
            if (result) {
                condition = result.condition;
                await core.redis.set(key, condition, 6 * 60 * 60);
            }
        }
        return condition;
    },
    // 获取列表 
    PageList: async function(pageIndex, pageSize, query) {
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
        return await myDao.pageList(pageIndex, pageSize, q, { create_date: -1 });
    },
    PageListname: async function(pageIndex, pageSize, query) {
        return await myDao.pageList(pageIndex, pageSize, query, { create_date: 1 });
    },
    // 根据ID获取
    findById: async function(query) {
        return await myDao.findById2(query);
    },
    find: async function(query, options) {
        return await myDao.find(query, options);
    },
    // 新建
    add: async function(query, data_source_id) {
        return await myDao.insert(query);
    },
    // 更新
    update: async function(query, data_source_id) {
        return await myDao.update2(query);
    },
    // processExportFile: function() {
    //     if (config.task_server) {
    //         var job_name = "export_data_to_file";
    //         queue.process(job_name, function (job, done) {
    //             s.exportFile(job.data).then(function () {
    //                 done();
    //             }, function (error) {
    //                 done(new Error(error));
    //             });
    //         });
    //     }
    // },
    process:async function() {
        if (config.task_server) {
            var delay = 200;
            var mq = await this.queue();
            await mq.consumer(q_name, async function(data) {
                await s.outData(data);
            }, 1);
            await mq.consumer(q_name_file, async function(data) {
                await s.exportFile(data);
            }, 1);
            await mq.consumer(q_name_delete, async function(data) {
                await s.deleteDB(data);
            }, 1);

            // queue.process(q_name, function(job, done) {
            //     if (job.data.isExportFile && job.data.isExportFile === '1') {
            //         s.exportFile(job.data).then(function() {
            //             setTimeout(() => {
            //                 done();
            //             }, delay);
            //         }, function(error) {
            //             setTimeout(() => {
            //                 done(new Error(error));
            //             }, delay);
            //         });
            //     } else if (job.data.isExportFile && job.data.isExportFile === '2') {
            //         s.deleteDB(job.data).then(function() {
            //             setTimeout(() => {
            //                 done();
            //             }, delay);
            //         }, function(error) {
            //             setTimeout(() => {
            //                 done(new Error(error));
            //             }, delay);
            //         });
            //     } else {
            //         s.outData(job.data).then(function() {
            //             setTimeout(() => {
            //                 done();
            //             }, delay);
            //         }, function(error) {
            //             setTimeout(() => {
            //                 done(new Error(error));
            //             }, delay);
            //         });
            //     }
            // });
        }
    },
    checkTask: async function() {
        if (!config.task_server) {
            var mq = await this.queue();
            {
                // var list = await myDao.list({ ent_status: '0', status: '2', is_stop: '0' });
                // for (var i = 0; i < list.length; i++) {
                //     var task = list[i];
                //     var _list = this.tasks.filter(function (t) {
                //         return t.id === task.id;
                //     });
                //     var exist = _list.length > 0;
                //     if (!exist) {
                //         this.tasks.push(task);
                //         // this.process('export_data_' + task.id);
                //         this.process(q_name);
                //     }
                // }
                // logger.info(JSON.stringify(list));
            } {
                // 检查是否有查询完成的任务，开始导出文件；
                var list = await myDao.list({ ent_status: '0', status: '2', is_stop: '0' });
                for (var i = 0; i < list.length; i++) {
                    var task = list[i];
                    var _myDao = new Dao(db, dataInfoDBName + "ip_medical_history_info");
                    var dataList = await _myDao.pageList(1, 1, { task_id: task.id });
                    if (dataList.total == 0) {
                        var _myDao2 = new Dao(db, dataInfoDBName + "op_medical_history_info");
                        var dataList2 = await _myDao2.pageList(1, 1, { task_id: task.id });
                        dataList.total = dataList2.total;
                    }
                    logger.info("##-->>task.status=2:total=" + task.dataTotal + ";nowTotal=" + dataList.total);
                    if (task.dataTotal == dataList.total) {
                        await myDao.update({ status: "3", index: task.dataTotal }, { id: task.id });
                        var _query = {
                            // isExportFile: '1', // 1-生成文件;2-删除缓存数据;
                            info_id: task.info_id,
                            id: task.id,
                            tableId: task.tableId,
                            dataTotal: task.dataTotal
                        };
                        await mq.publish(q_name_file, _query);
                        // var job = queue.create(q_name, _query).save(function(err) {
                        //     if (err) {
                        //         logger.error(err);
                        //     }
                        // });
                    }
                }
                // logger.info(JSON.stringify(list));
            } {
                // 生成文件成功后删除数据库数据及临时文件
                var list = await myDao.list({ ent_status: '0', status: '4', is_stop: '0' });
                for (var i = 0; i < list.length; i++) {
                    var task = list[i];
                    await this.deleteTask(task, '0');
                }
                logger.info("##-->>task.status=4:" + list.length);
            }
        }
    },
    deleteTask: async function(task, isRemove) {
        await myDao.update({ is_stop: "1" }, { id: task.id });
        var _query = {
            // isExportFile: '2',
            info_id: task.info_id,
            id: task.id,
            tableId: task.tableId,
            isRemove: isRemove
        };
        var mq = await this.queue();
        await mq.publish(q_name_delete, _query);
        // var job = queue.create(q_name, _query).save(function(err) {
        //     if (err) {
        //         logger.error(err);
        //     }
        // });
    },
    push_before: async function(data) {
        var condition = data.condition;
        var info_id = data.info_id;
        var tableId = data.tableId;
        var table_info = await this.findTableInfo(info_id, tableId);
        var info = table_info.info;
        var entTable = table_info.table;
        var search = {};
        if (data.search != "") {
            search = JSON.parse(data.search);
        }
        var fieldList = entTable.fields;
        var dataList = await emrService.pageList(info, entTable, 1, 1, search);
        var total = dataList.total;
        return total;
    },
    push: async function(data, _page, _pageSize) {
        logger.info("##-->>开始查询数据并添加到任务队列...(push;)");
        _page = _page || 1;
        if (_page < 1){
            _page = 1;
        }
        _pageSize = _pageSize || 500;
        if (_pageSize < 1){
            _pageSize = 500;
        }
        if (_pageSize > 1000){
            _pageSize = 1000;
        }
        var info_id = data.info_id;
        var tableId = data.tableId;
        logger.info("##-->>根据ID获取相关数据...");
        var table_info = await this.findTableInfo(info_id, tableId);
        var info = table_info.info;
        var entTable = table_info.table;
        var search = {};
        if (data.search != "") {
            search = JSON.parse(data.search);
        }
        var fieldList = entTable.fields;
        logger.info("##-->>从emr库开始查询数据...");
        var dataList = await emrService.pageList(info, entTable, 1, 20, search);
        var total = dataList.total;
        var pageCount = parseInt((total + 20 - 1) / 20);
        var mq = await this.queue();
        logger.info("##-->>:" + JSON.stringify({page:(_page-1)*(_pageSize/20)+1,maxPage:_page*(_pageSize/20)}));
        var m = 0;
        for (var page = (_page-1)*(_pageSize/20)+1; page <= pageCount && page <= _page*(_pageSize/20); page++) {
            var list;
            if (page == 1) {
                list = dataList;
            } else {
                list = await emrService.pageList(info, entTable, page, 20, search);
            }
            for (var j in list.items) {
                var ent = list.items[j];
                // logger.info("##-->>ent:" + JSON.stringify(ent));
                var _query = {
                    info_id: data.info_id,
                    data_id: ent.id,
                    task_id: data.id,
                    table_id: data.tableId
                };
                m++;
                await mq.publish(q_name, _query);
                // var job = queue.create(q_name, _query).save(function(err) {
                //     if (err) {
                //         logger.error(err);
                //     }
                // });
                // job.on('complete', async function(result) {
                //     logger.info("##-->>complete:" + JSON.stringify(result));
                // }).on('failed attempt', async function(errorMessage, doneAttempts) {
                //     logger.error(errorMessage);
                //     await myDao.update({ status: "-1" }, { id: job.data.task_id });
                // }).on('failed', async function(errorMessage) {
                //     logger.error(errorMessage);
                //     await myDao.update({ status: "-1" }, { id: job.data.task_id });
                // }).on('progress', async function(progress, data) {
                //     // await myDao.update({ status: "2", progress: progress + "%" }, { id: job.data.task_id });
                // });
            }
        }
        return m;
        // await myDao.update({ dataTotal: m }, { id: data.id });
    },
    outData: async function(query) {
        var info_id = query.info_id;
        var data_id = query.data_id;
        var task_id = query.task_id;
        var table_id = query.table_id;
        var condition = await this.findTaskCondition(task_id);
        var _condition = null;
        if (condition) {
            try {
                _condition = JSON.parse(condition);
            } catch (error) {}
        }

        var table_info = await this.findTableInfo(info_id, table_id);
        var info = table_info.info;
        var entTable = table_info.table;
        var fieldList = entTable.fields;
        var parentObj = await emrService.findById(info, entTable, data_id);
        if (!parentObj) {
            ctx.json(api.error("parentObj is null!"));
            return;
        }
        var parentData = await o.outParent(entTable, fieldList, parentObj, task_id);
        await o.outChilds(info, parentObj, table_id, task_id, parentData, table_info, _condition);
    },
    // 导出文件任务--将数据写入文件；
    exportFile: async function(data) {
        logger.info("##-->>exportFile:" + JSON.stringify(data));
        var table_info = await this.findTableInfo(data.info_id, data.tableId);

        var entTable = table_info.table;
        var tableChilds = table_info.childs;
        var wb = new xl.Workbook();
        logger.info("##-->>exportFile:1")
        await outSaveFile.outParent(wb, entTable, data, "");
        logger.info("##-->>exportFile:2")
        await outSaveFile.outChilds(wb, tableChilds, data);
        logger.info("##-->>exportFile:3")
        // 保存文件
        var buffer = await outSaveFile.out(wb);
        let fileData = new Buffer(buffer, 'binary');
        var file_name = data.id + '.xlsx';
        var output_path = config.output_path;
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        output_path = config.output_path + "/exportdata";
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

        // outSaveFile.deleteFolderRecursive(export_path);// 删除文件

        await myDao.update({ status: "4", file: zipName }, { id: data.id });
    },
    deleteDB: async function(data) {
        logger.info("##-->>deleteDB:" + JSON.stringify(data));
        var table_info = await this.findTableInfo(data.info_id, data.tableId);

        var entTable = table_info.table;
        var tableChilds = table_info.childs;
        await deleteTaskDB.deleteParent(entTable, data);
        await deleteTaskDB.deleteChilds(tableChilds, data);

        var output_path = config.output_path;
        if (fs.existsSync(output_path)) {
            output_path = config.output_path + "/exportdata";
            if (fs.existsSync(output_path)) {
                var export_path = path.join(output_path, data.id);
                if (fs.existsSync(export_path)) {
                    outSaveFile.deleteFolderRecursive(export_path); // 删除文件
                }
            }
        }
        if (data && data.isRemove && data.isRemove === "1") {
            var zipName = data.id + ".zip";
            var file_path_zip = path.join(output_path, zipName);
            if (fs.existsSync(file_path_zip)) {
                fs.unlinkSync(file_path_zip);
            }
            await myDao.delete({ id: data.id });
        }
    }
};
var deleteTaskDB = {
    deleteParent: async function(entTable, data) {
        var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
        await _myDao.delete({ task_id: data.id });
    },
    deleteChilds: async function(tableChilds, data) {
        if (tableChilds) {
            for (var i = 0; i < tableChilds.length; i++) {
                var tableChild = tableChilds[i];
                await this.deleteParent(tableChild, data);
            }
        }
    }
};
var o = {
    outParent: async function(entTable, fieldList, parentObj, task_id) {
        var data = {};
        var r = 2;
        for (var i = 0; i < fieldList.length; i++) {
            var field = fieldList[i];
            if (parentObj.hasOwnProperty(field.field_name)) {
                var val = parentObj[field.field_name];
                logger.info("##-->>val=" + val);
                if (val) {
                    if (field.data_type == 'date') {
                        // var _val = val.toISOString().replace(/T/, ' ').replace(/\..+/, '');
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
        // var result = await _myDao.find(data);
        // if (!result || !result.task_id)
        await _myDao.insert(data);
        return data;
    },
    outChild: async function(entTable, fieldList, objList, task_id, parentData) {
        var r = 2;
        for (var j in objList){
            var obj = objList[j];
            var data = {};
            if (parentData && parentData.门诊号) {
                data["门诊号"] = parentData.门诊号;
            }
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
            for (var i in fieldList){
                var field = fieldList[i];
                data[field.title] = '';
                if (obj.hasOwnProperty(field.field_name)) {
                    var val = obj[field.field_name];
                    if (val) {
                        if (field.hasOwnProperty('data_type')&&field.data_type){
                            if (field.data_type == 'date') {
                                data[field.title] = val;
                            } else {
                                data[field.title] = val + '';
                            }
                        } else {
                            data[field.title] = val + '';
                        }
                    }
                } else {
                    logger.warn(field.title);
                }
            }
            var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
            data.task_id = task_id;
            // var result = await _myDao.find(data);
            // if (!result || !result.task_id)
            await _myDao.insert(data);
            r++;
        }
    },
    outChilds: async function(info, obj, parent_id, task_id, parentData, table_info, condition) {
        var tableChilds = table_info.childs;
        for (var i = 0; i < tableChilds.length; i++) {
            var tableChild = tableChilds[i];
            var table_name = tableChild.table_name;
            // 根据选定结果导出数据;选定结果为空时全部导出;
            var exist = true;
            if (condition && condition.length > 0) {
                var _list = condition.filter(function(t) {
                    return t === table_name;
                });
                logger.info("##-->>outChilds:_list:" + JSON.stringify(_list));
                exist = _list.length > 0;
            }
            if (exist) {
                var fileListChld = tableChild.fileListChld;// 二级表字段;
                var sub_tableChilds = tableChild.sub_tableChild;// 三级表;
                var objList = null;
                {
                    var q = {};
                    if (tableChild.data_id_key !== undefined) {
                        var vals = JSON.parse(tableChild.data_id_key);
                        for (var key in vals) {
                            var val = obj[key];
                            q[vals[key]] = val;
                        }
                    }
                    objList = await emrService.findData(info, tableChild, q, {});
                }
                if (objList == null) {
                    continue;
                }
                if (sub_tableChilds.length > 0) {
                    var sub_tableChild = sub_tableChilds[0];
                    var sub_fileListChld = tableChild.sub_fileListChld;// 三级表字段;
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
                        if (sub_objList && sub_objList.length > 0){
                            for (var j in sub_objList) {
                                var _sub_item = sub_objList[j];
                                var sub_item = {};
                                for (var k in fileListChld) {
                                    var p = fileListChld[k].field_name;
                                    sub_item[p] = item[p];
                                }
                                for (var k in sub_fileListChld) {
                                    var p = sub_fileListChld[k].field_name;
                                    sub_item[p] = _sub_item[p];
                                }
                                // logger.warn("##-->>"+JSON.stringify(sub_item));
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
                    // logger.info("##-->>fileListChld:" + JSON.stringify(fileListChld));
                    // logger.info("##-->>sub_obj_list:" + JSON.stringify(sub_obj_list));
                    await this.outChild(tableChild, fileListChld, sub_obj_list, task_id, parentData);
                } else {
                    await this.outChild(tableChild, fileListChld, objList, task_id, parentData);
                }
            }
        }
    }
};
var outSaveFile = {
    out: async function(wb) {
        return new Promise(function(resolve, reject) {
            wb.writeToBuffer().then(function(buffer) {
                return resolve(buffer);
            });
        });
    },
    outParent: async function(wb, entTable, data, msg) {
        var pageSize = 20;
        var mInt = 5000 / pageSize;
        var m = 1;
        var _wb;
        var ws;
        var _myDao = new Dao(db, dataInfoDBName + entTable.table_name);
        var q = { task_id: data.id };
        var dataList = await _myDao.pageList(1, 1, q);
        logger.info("##-->>exportFile:2:"+JSON.stringify(entTable)+" "+JSON.stringify(dataList));
        var total = dataList.total;
        if (total < 1) {
            return;
        }
        if (total > 2000 && total > (data.dataTotal + 100)) {
            _wb = new xl.Workbook();
            ws = _wb.addWorksheet(entTable.title);
        } else {
            ws = wb.addWorksheet(entTable.title);
        }
        var pageCount = parseInt((total + pageSize - 1) / pageSize);
        var r = 1;
        var fieldList = [];
        for (var page = 1; page <= pageCount; page++) {
            logger.info("##-->>exportFile:2:"+(msg?msg:"")+";"+page+"/"+pageCount);
            if (page > mInt * m) {
                if (_wb) {
                    await this.saveFile(_wb, data, entTable, m);
                    r = 1;
                    m++;
                    _wb = new xl.Workbook();
                    ws = _wb.addWorksheet(entTable.title);
                }
            }
            var list = await _myDao.pageList(page, pageSize, q);
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
                        var val_str = moment(val).format("YYYY-MM-DD HH:mm:ss");
                        ws.cell(r, i + 1).string(val_str);
                        // ws.cell(r, i + 1).date(val);
                    } else if (util.isString(val)) {
                        var _val = val.replace(/\u0000|\u0001|\u0002|\u0003|\u0004|\u0005|\u0006|\u0007|\u0008|\u0009|\u000a|\u000b|\u000c|\u000d|\u000e|\u000f|\u0010|\u0011|\u0012|\u0013|\u0014|\u0015|\u0016|\u0017|\u0018|\u0019|\u001a|\u001b|\u001c|\u001d|\u001e|\u001f/g,"");
                        logger.info(_val);
                        ws.cell(r, i + 1).string(_val);
                    } else if (util.isNumber(val)) {
                        ws.cell(r, i + 1).string(val + "");
                    } else if (util.isUndefined(val)) {
                        ws.cell(r, i + 1).string("");
                    } else {
                        // ws.cell(r, i + 1).string("未知字段类型:" + JSON.stringify(val));
                    }
                }
                r++;
            }
        }
        if (_wb) {
            await this.saveFile(_wb, data, entTable, m);
        }
    },
    outChilds: async function(wb, tableChilds, data) {
        var _this = this;
        if (tableChilds) {
            var tableChildsTotal = tableChilds.length;
            logger.info("##-->>exportFile:2:tableChilds total:"+tableChildsTotal);
            for (var i = 0; i < tableChilds.length; i++) {
                var tableChild = tableChilds[i];
                await _this.outParent(wb, tableChild, data, i+"/"+tableChildsTotal);
            }
        } else {
            logger.info("##-->>exportFile:2:tableChilds is null")
        }
    },
    saveFile: async function(wb, data, entTable, i) {
        // 保存文件
        var buffer = await this.out(wb);
        let fileData = new Buffer(buffer, 'binary');
        var file_name = data.id + "_" + entTable.title + "_" + i + '.xlsx';
        var output_path = config.output_path;
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        output_path = config.output_path + "/exportdata";
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
    // 删除目录
    deleteFolderRecursive: async function(path) {
        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function(file) {
                var curPath = path + "/" + file;
                if (fs.existsSync(curPath)){
                    if (fs.statSync(curPath).isDirectory()) { // recurse
                        outSaveFile.deleteFolderRecursive(curPath);
                    } else { // delete file
                        fs.unlinkSync(curPath);
                    }
                }
            });
            fs.rmdirSync(path);
        }
    }
};

// if (config.task_server) {
//     queue.process("export_data_", function(job, done) {
//         console.log('...skip...');
//         done();
//     });
// }

module.exports = s;