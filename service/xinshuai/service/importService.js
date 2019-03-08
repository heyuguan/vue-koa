
var crypto = require('crypto');
var logger = require("../../../models").logger;
var _ = require('lodash');
var utils = require('../../../models').utils;
var Dao = require("../../../models/mongo/MongoDao");
var mongodb = require("../../../models").mongo;
var emrService = require('../../emr/service/emrService');
// var statisticsService = require('../../statistics/service/statisticsService');
var myDao = require('../dao/importHFDao');
var orderOpDao = require('../dao/orderOpDao');
var xinshuaiServcie = require('./index.js');
var moment = require('moment');
var json2xls = require('json2xls');
var config = require('../../../config');
var core = require('../../../models');
var configDao = require('../dao/configDao');
var ObjectID = require("mongodb").ObjectID;
var fs = require('fs');
const path = require('path');

var s = {
    // 获取列表 
    PageList: async function (pageIndex, pageSize, query) {
        var q = {};
        if (query) {
            for (var key in query) {
                if (query[key] !== undefined && query[key] !== '') {
                    q[key] = query[key];
                }
            }
        }
        return await myDao.pageList(pageIndex, pageSize, q, { create_date: -1 });
    },
    // 根据ID获取
    find: async function (query) {
        return await myDao.find(query);
    },
    // 根据ID获取
    findById: async function (query) {
        return await myDao.findById2(query);
    },
    // 新建
    add: async function (query) {
        return await myDao.insert(query);
    },
    // 更新
    updateQuery: async function (data,query) {
        return await myDao.update(data,query);
    },
    // 更新
    update: async function (query) {
        return await myDao.update2(query);
    },
    // 删除
    delete: async function (query) {
        var update = _.pick(query, 'ent_status', 'update_date', 'updater');
        var po = await myDao.findById(query._id);
        // po.ent_status = 1;
        return await myDao.update(_.assign(po, update));
    },
    importExcel: async function (list, user, info) {
        var insertNum = 0;
        var updateNum = 0;
        var hospital_id = info.hospital_id+"";
        var _existDates = [];
        var totalNum = 0;
        if (list) {
            // logger.info("##-->>list:" + JSON.stringify(list));
            var notSave = ['_id', 'async_id', '失败原因'];
            // var _hospitalInfo = {};
            for (var i = 0; i < list.length; i++) {
                var excleData = list[i].data;
                if (excleData.length > 1) {
                    totalNum += excleData.length-1;
                    var keyArray = {};
                    var _excelData0 = excleData[0];
                    for (var index in _excelData0) {
                        var key = _excelData0[index]+"";
                        if (key){
                            var is = true;
                            for (var _index in notSave){
                                if (notSave[_index] === key){
                                    is = false;
                                }
                            }
                            if (is){
                                keyArray[index]=key;
                            }
                        }
                    }
                    logger.info("##-->>keyArray:" + JSON.stringify(keyArray));
                    for (var j = 1; j < excleData.length; j++) {
                        var curData = excleData[j];
                        if (curData.length == 0) continue;
                        var obj = {};
                        for (var key in keyArray){
                            var _key = keyArray[key];
                            if (_key==='住院号' || _key === 'hospital_id'){
                                obj[_key] = curData[key]+"";
                            } else {
                                obj[_key] = curData[key];
                            }
                        }
                        logger.info("##-->>obj:" + JSON.stringify(obj));
                        // for (var m = 0; m < keyArray.length; m++) {
                        //     obj[keyArray[m]] = curData[m];
                        // }
                        // logger.info("##-->>obj:" + JSON.stringify(obj));
                        if (!obj.hospital_id) {
                            obj.hospital_id = hospital_id;
                        } else {
                            if (hospital_id != obj.hospital_id+""){
                                obj.失败原因 = '医院不正确';
                                _existDates.push(obj);
                                continue;
                            }
                        }
                        if (!obj.hospital_id) {
                            // result.msg = '“hospital_id”不能为空！请完善报告信息后重试';
                            // return result;
                            obj.失败原因 = '“hospital_id”不能为空';
                            _existDates.push(obj);
                            continue;
                        }
                        // 判断病史ID是否存在;
                        if (!obj.ID) {
                            if (!obj.出院时间) {
                                // result.msg = '“出院时间”不能为空！请完善报告信息后重试';
                                // return result;
                                obj.失败原因 = '“出院时间”不能为空';
                                _existDates.push(obj);
                                continue;
                            } else if (!obj.住院号) {
                                // result.msg = '“住院号”不能为空！请完善报告信息后重试';
                                // return result;
                                obj.失败原因 = '“住院号”不能为空';
                                _existDates.push(obj);
                                continue;
                            }
                            // var db = _hospitalInfo[obj.hospital_id + ''];
                            // if (!db||db.length == 0) {
                            //     var info = await xinshuaiServcie.list({ hospital_id: obj.hospital_id+'' });
                            //     // var info = await statisticsService.dbInfoList({ hospital_id: obj.hospital_id + '' });
                            //     logger.info("##-->>info:" + JSON.stringify(info));
                            //     if (!info || info.length == 0) {
                            //         obj.失败原因 = '医院信息未找到';
                            //         _existDates.push(obj);
                            //         continue;
                            //     }
                            //     db = [];
                            //     for (var key in info) {
                            //         var _info = info[key];
                            //         if (_info && _info.db) {
                            //             var _tempp = {};
                            //             _tempp[_info.db] = _info._id;
                            //             db.push(_tempp);
                            //         }
                            //     }
                            //     _hospitalInfo[obj.hospital_id + ''] = db;
                            // }
                            // if (db.length == 0) {
                            //     obj.失败原因 = '医院信息未找到';
                            //     _existDates.push(obj);
                            //     continue;
                            // }
                            var params = {
                                out_datetime: obj.出院时间,
                                hospital_id: obj.hospital_id + '',
                                admission_number: obj.住院号
                            }
                            // var db = info.db;
                            // logger.info("##-->>db:" + JSON.stringify(db));
                            obj.ID = await emrService.findHistoryId(info.db, params, null, info.hospital_db_id);
                            if (obj.ID){
                                logger.info("##-->>obj.ID:" + JSON.stringify(obj.ID));
                            } else {
                                logger.info("##-->>病史信息未找到obj.ID:" + JSON.stringify(obj.ID));
                                obj.失败原因 = '病史信息未找到';
                                _existDates.push(obj);
                                continue;
                            }

                            // for (var key in db){
                            //     var _db = db[key];
                            //     for (var _key in _db){
                            //         var info_id = _db[_key];
                            //         obj.ID = await emrService.findHistoryId(_key, params);
                            //         if (obj.ID){
                            //             logger.info("##-->>obj.ID:" + JSON.stringify(obj.ID));
                            //             obj.db = _key;
                            //             obj.info_id = info_id;
                            //             break;
                            //         }
                            //     }
                            //     if (obj.ID){
                            //         break;
                            //     }
                            // }
                            // if (!obj.ID) {
                            //     logger.info("##-->>病史信息未找到obj.ID:" + JSON.stringify(obj.ID));
                            //     obj.失败原因 = '病史信息未找到';
                            //     _existDates.push(obj);
                            //     continue;
                            // }
                            logger.info("##-->>obj:" + JSON.stringify(obj));
                        }
                        obj.db = info.db + "";
                        obj.info_id = info._id+"";
                        obj.hospital_db_id = info.hospital_db_id;
                        var _result = await myDao.find({ ID: obj.ID, ent_status: 0, info_id: obj.info_id});
                        logger.info("##-->>find _result:" + JSON.stringify(_result));
                        // var paegList = await myDao.pageList(1, 1, {ID:obj.ID}, { create_date: 1 });
                        if (!_result || !_result.ID) {
                            obj.hospital_id = obj.hospital_id+"";
                            var po = _.assign({}, obj, {
                                // id: utils.autoId() + '',
                                creater: user.id,
                                updater: user.id,
                                create_date: new Date(),
                                update_date: new Date(),
                                ent_status: 0
                            });
                            var data = await myDao.insert(po);
                            logger.info("##-->>insert:" + JSON.stringify(data));
                            insertNum++;
                        } else {
                            var errorMsg = "";
                            var _temp = {};
                            if (true){
                                // 直接覆盖保存
                                for (var key in obj){
                                    if (obj[key] != _result[key]) {
                                        if (obj[key]) {
                                            if (!_temp.ID) {
                                                _temp["ID"] = obj.ID;
                                            }
                                            _temp[key] = obj[key];
                                        }
                                    }
                                }
                            } else {
                                for (var key in obj) {
                                    if (obj[key] != _result[key]) {
                                        // logger.info("##-->>数据需要更新:" + JSON.stringify(_result));
                                        // _existDates.push(_result);
                                        if (_result[key] && obj[key]) {
                                            errorMsg += key + ":" + _result[key] + ";";
                                        } else if (obj[key]) {
                                            if (!_temp.ID) {
                                                _temp["ID"] = obj.ID;
                                            }
                                            _temp[key] = obj[key];
                                        }
                                    }
                                }
                            }
                            if (_temp && _temp.ID){
                                logger.info("##-->>数据需要更新:" + JSON.stringify(_temp));
                                await myDao.update(_temp, {ID: _temp.ID,info_id: obj.info_id,ent_status: 0});
                                updateNum++;
                            } else {
                                logger.info("##-->>数据无可更新字段");
                            }
                            if (errorMsg){
                                logger.info("##-->>数据已存在，需手动录入修改:"+errorMsg);
                                obj.失败原因 = '数据已存在,需手动修改录入('+errorMsg+")";
                                _existDates.push(obj);
                            } else {
                                logger.info("##-->>数据已存在，且没有需要更新的字段");
                            }
                            // logger.info("##-->>数据已存在:" + JSON.stringify(_result));
                        }
                    }
                }
            }
        }
        var results = {insertNum:insertNum, updateNum:insertNum, totalNum: totalNum};
        results._existDates = _existDates;
        return results;
    },
    // 新增或者更新重新计算某些字段。
    getData: function (data) {
        if (data) {
            var _isFangChan = false;
            var _isFangPu = false;
            if (data["出院诊断"]) {
                var out_diagnosis = data["出院诊断"];
                var _outD = [];
                _outD.push({ diagnosis_content: out_diagnosis });
                var _outD2 = { out_diagnosis: _outD };
                _isFangChan = xinshuaiServcie.checkIsFangchan(_outD2);
                _isFangPu = xinshuaiServcie.checkIsFangpu(_outD2);
                data["房颤"] = _isFangChan ? "是" : "否";
                data["房扑"] = _isFangPu ? "是" : "否";
                data["房颤/房扑"] = _isFangChan || _isFangPu ? "是" : "否";
            }
            if (data["EF值"]) {
                var ef_per = data["EF值"];
                data["EF有无"] = ef_per ? "有" : "无";
                data["EF分类"] = ef_per ? (ef_per < 40.0 ? "降低" : (ef_per > 49.0 ? "保留" : "中间值")) : "";
            }
            if (data["出院时间"]) {
                var out_datetime = data["出院时间"];
                data["出院月份"] = out_datetime ? moment(out_datetime).format('MM') : '';
            }
        }
        return data;
    },
    downLoad: async function (id,_result) {
        var noDown = ["create_date", "update_date", "ent_status", "creater", "updater", "_id", "report_code", "report_data", "report_msg", "report_result", "status"];
        var out = [];
        var query = { info_id: id, ent_status:0};
        var total = await myDao.count(query);
        var pageCount = parseInt((total + 20 - 1) / 20);
        var obj = {};
        for (var page = 1; page <= pageCount; page++) {
            var list = await myDao.pageList(page, 20, query);
            for (var j in list.items) {
                var ent = list.items[j];
                for (var index in noDown) {
                    delete ent[noDown[index]];
                }
                for (var key in ent){
                    if (!obj.hasOwnProperty(key)) obj[key]="";
                }
                out.push(ent);
            }
        }
        if (out.length > 0) {
            for (var key in obj)
                out[0][key] = out[0][key] || "";
        }
        // return out;
        await this.toFile(out,_result);
    },
    //将查询的数据保存到文件系统，并在本地保存文件系统返回的保存完文件的id以及文件的名称
    toFile: async function (json,_result) {
        var xls = json2xls(json);
        let data = new Buffer(xls, 'binary');
        var file_name = _result.name + '_' + moment().format('YYYYMMDDHHmmss') + '.xlsx';
        var ent = "xlsx";
        var filedId = await core.fdfs.uploadFile(data,{ext : ent});
        //将返回的id保存到mongo库
        var biConfirmDao = new Dao(mongodb,'confirm_file_info');
        var info_id = _result._id;
        var info = await biConfirmDao.findByKV('info_id',info_id);
        //通过查询出的信息删除文件系统中已经存在的文件
        if(info && info.filedId){
            var delInfo = await core.fdfs.del(info.filedId);
        }
        //更改信息
        var fileInfo = {
            hospital_id:_result.hospital_id,
            hospital_name:_result.name,
            info_id:info_id,
            filedid:filedId.fileId,
            file_name:file_name
        };
        //记录保存文件的位置先删除后插入
        var delresult = await biConfirmDao.delete({'info_id':info_id});
        var insertRes = await biConfirmDao.insert(fileInfo);
        //修改医院的文件状态
        await this.updateFlag(info_id);
        return result;
    },
    insertFlag: async function(_result) {
        var info_id = _result._id;
        return await configDao.update({flag:-1},{'_id': info_id});
    },
    updateFlag: async function (info_id) {
        return await configDao.update({flag:1,update_time:new Date()},{'_id' : info_id});
    },
    getFile: async function(info_id){
        //查询文件在文件系统的地址并下载
        var biConfirmDao = new Dao(mongodb,'confirm_file_info');
        var objId = new ObjectID(info_id);
        var info = await biConfirmDao.findByKV('info_id',new ObjectID(info_id));
        var filedId = info.filedid;
        var file_name = info.file_name;
        var output_path = config.output_path;
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        output_path = config.output_path + "/confirmExport";
        if (!fs.existsSync(output_path)) {
            fs.mkdirSync(output_path);
        }
        var file_path = path.join(output_path, file_name);
        if (fs.existsSync(file_path)) {//本地服务器上已存在文件
            
        }else{//不存在文件时从文件服务器上下载
            var ws = fs.createWriteStream(file_path);
            var fileId =  await core.fdfs.download(filedId, ws);
            logger.info(JSON.stringify(fileId));
            if (!fileId || !fileId.fileId) {
                ctx.json(api.error('下载失败！'));
                return;
            }
        }
        var file = {fileName : file_name,output_path : output_path};
        return file;
    },
    fileFlag: async function(info_id){
        var info = await configDao.findByKV('_id',info_id);
        return info;
    },
    downLoadOrder: async function (id) {
        var noDown = ["info_id","order_id","hf_import_data_id","_id"];
        var out = [];
        var query = { info_id: id};
        var total = await orderOpDao.count(query);
        var pageCount = parseInt((total + 20 - 1) / 20);
        for (var page = 1; page <= pageCount; page++) {
            var list = await orderOpDao.pageList(page, 20, query);
            for (var j in list.items) {
                var ent = list.items[j];
                for (var index in noDown){
                    delete ent[noDown[index]];
                }
                out.push(ent);
            }
        }
        return out;
    },
    downLoadAll: async function () {
        var noDown = ["create_date", "update_date", "ent_status", "creater", "updater", "_id", "report_code", "report_data", "report_msg", "report_result", "status"];
        var out = [];
        var query = {ent_status:0};
        var total = await myDao.count(query);
        var pageCount = parseInt((total + 20 - 1) / 20);
        for (var page = 1; page <= pageCount; page++) {
            var list = await myDao.pageList(page, 20, query);
            for (var j in list.items) {
                var ent = list.items[j];
                for (var index in noDown){
                    delete ent[noDown[index]];
                }
                out.push(ent);
            }
        }
        return out;
    }
}

module.exports = s;