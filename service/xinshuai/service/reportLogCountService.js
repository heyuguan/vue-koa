var config = require('../../../config');
var core = require('../../../models');
var get = require('simple-get');
var md5 = require('md5');
var uuid = require('uuid');
var moment = require('moment');
var logCountDao = require('../dao/reportLogCountDao'); // 主表
var db = require("../../../models").platformDemo;
var httpUitl = require('../../../models/httpUtil');
var Dao = require("../../../models/mongo/MongoDao");
var mongodb = require("../../../models").mongo; 
var log = core.logger;
var xl = require('excel4node');
var fs = require('fs');
const path = require('path');
const util = require('util');


var s = {
    getNameByHospitalIds:async function () {
        var _logCountDao = new logCountDao(db);
        var hospitalIds = await _logCountDao.getHospitalIds();//12,23,34
        var hospitalId_str = hospitalIds[0].hospital_id;
        var url = config.apiIp + config.serviceId.commonService + '/hospital/findHospitalNameByIds';
        var query = {ids:hospitalId_str};
        var result = await httpUitl.post(url, query, null);
      
        var info = {};
        if(result&&result.code==200){
            var hospitals_list = result.data;
            var biHospitalDao = new Dao(mongodb,'report_log_count');
            //插入之前先delete
            await biHospitalDao.delete();
            info = await biHospitalDao.insert(hospitals_list);
        }

        return info;
    },
    getCountByHospitalId:async function(hospital_id){
        var _logCountDao = new logCountDao(db);
        var hfcHospitalId = await _logCountDao.getHfcHospitalId(hospital_id);
        var ipDate = await _logCountDao.ipDateTime(hospital_id);
        var opDateList = await _logCountDao.opDateTime(hospital_id);
        var opDate = opDateList[0];
        var minList = [opDate.a_mindate,opDate.b_mindate,opDate.c_mindate,opDate.d_mindate];
        var maxList = [opDate.a_maxdate,opDate.b_maxdate,opDate.c_maxdate,opDate.d_maxdate];
        var min = [];
        if (minList.length > 0) {
            min = minList.filter(function (item) {
                if(item){
                    return item;
                }
            });
        }
        var max = [];
        if (maxList.length > 0) {
            max = maxList.filter(function (item) {
                if(item){
                    return item;
                }
            });
        }
        var opmax = max.length>0 ? Math.max.apply(null,max) : '';
        var opmin = min.length>0 ?Math.min.apply(null,min) : '';
        var ipNumberNotFilter = await _logCountDao.ipNumberNotFilter(hospital_id);
        var ipNumberFilter = await _logCountDao.ipNumberFilter(hospital_id);
        var weekNumber = await _logCountDao.weekNumber(hospital_id);
        var oneMonthNumber = await _logCountDao.oneMonthNumber(hospital_id);
        var threeMonthNumber = await _logCountDao.threeMonthNumber(hospital_id);
        var oneYearNumber = await _logCountDao.oneYearNumber(hospital_id);
        // var opHave = weekNumber[0]+oneMonthNumber[0]+threeMonthNumber[0]+oneYearNumber[0]>0 ? "有":"无";
        var opHave = await _logCountDao.opHave(hospital_id);
        var failNumber = await _logCountDao.ipFailNumber(hospital_id);
        var failReason = await _logCountDao.failReason(hospital_id);
        var lastReportDate = await _logCountDao.lastReportDate(hospital_id);

        var ipMonth = await _logCountDao.ipMonth(hospital_id);
        var opMonth = await _logCountDao.opMonth(hospital_id);

        var s = hfcHospitalId[0] ? hfcHospitalId[0].心衰医院id : "";
        var hospitalCountObj = {
            hospitalId:hospital_id,
            心衰医院id:hfcHospitalId[0] ? hfcHospitalId[0].心衰医院id : "",
            住院上报成功最小时间:ipDate[0] ? ipDate[0].住院上报成功最小时间 : "",
            住院上报成功最大时间:ipDate[0] ? ipDate[0].住院上报成功最大时间 : "",
            门诊最小时间:opmin ? new Date(opmin) : "",
            门诊最大时间:opmax ? new Date(opmax) : "",
            住院上报成功数未去重:ipNumberNotFilter[0] ? ipNumberNotFilter[0].住院上报成功数未去重 : "",
            住院上报成功数去重:ipNumberFilter[0] ? ipNumberFilter[0].住院上报成功数去重 : "",
            一周随访成功数:weekNumber[0] ? weekNumber[0].一周随访成功数 : "",
            一个月随访成功数:oneMonthNumber[0] ? oneMonthNumber[0].一个月随访成功数 : "",
            三个月随访成功数:threeMonthNumber[0] ? threeMonthNumber[0].三个月随访成功数 : "",
            一年随访成功数:oneYearNumber[0] ? oneYearNumber[0].一年随访成功数 : "",
            门诊有无:opHave[0].有无门诊,
            住院上报失败条数:failNumber[0] ? failNumber[0].住院上报失败条数 : "",
            失败原因:failReason[0] ? failReason[0].失败原因 : "",
            最后上报日期:lastReportDate[0] ? lastReportDate[0].最后上报日期 : "",
            ipMonth:ipMonth,
            opMonth:opMonth
        };

        var biHospitalDao = new Dao(mongodb,'report_log_count');
        var result = await biHospitalDao.update(hospitalCountObj,{'hospitalId':hospital_id});
    },

    list: async function (pageIndex, pageSize, query) {

        var countDao = new Dao(mongodb,'report_log_count');
        var sort = {
            hospitalId: 1
        };
        var q = {};

        if (query.hospitalName) {
            q.hospitalName = { $regex: new RegExp(query.hospitalName) };
        }
        return await countDao.pageList(pageIndex, pageSize, q, sort);
    },

    downLoad:async function(){
        var countDao = new Dao(mongodb,'report_log_count');
        var hospitalData = [];
        var ipMonthData = [];
        var opMonthData = [];
        var hospitalCount = {
            sheet_name:'各医院上报数据',
            data:hospitalData,
            fields:['hospitalId','心衰医院id','hospitalName','门诊有无','住院上报成功最小时间','住院上报成功最大时间','门诊最小时间','门诊最大时间','最后上报日期','住院上报成功数未去重','住院上报成功数去重','一周随访成功数','一个月随访成功数','三个月随访成功数','一年随访成功数','住院上报失败条数','失败原因'],
        };
        var _ipMonth = {
            sheet_name:'住院每月上报数据',
            data:ipMonthData,
            fields:['医院id','医院名称','月份','未去重上报数量','去重上报数量'],
        };
        var _opMonth = {
            sheet_name:'门诊每月上报数据',
            data:opMonthData,
            fields:['医院id','医院名称','月份','数量'],
        };
        var out = [hospitalCount,_ipMonth,_opMonth];
        var total = await countDao.count();
        var pageCount = parseInt((total + 20 - 1) / 20);
        for (var page = 1; page <= pageCount; page++) {
            var list = await countDao.pageList(page, 20, {});
            for (var j in list.items) {
                var ent = list.items[j];

                var _ipMonthData = {
                    monthData : ent.ipMonth,
                    hospitalName : ent.hospitalName,
                    hospitalId : ent.hospitalId,
                };

                var _opMonthData = {
                    monthData : ent.opMonth,
                    hospitalName : ent.hospitalName,
                    hospitalId : ent.hospitalId,
                };

                delete ent.ipMonth;
                delete ent.opMonth;
                delete ent._id;

                hospitalData.push(ent);
                ipMonthData.push(_ipMonthData);
                opMonthData.push(_opMonthData);
            }
        }
        // for(var key in hospitalData[0]){
        //     hospitalCount.fields.push(key); 
        // }
        return await this.json2Excel(out);
    },

    json2Excel:async function(dataList){
            try {
                log.warn('========>>>> start =========');
                let fileList = [];
                if (!dataList || dataList.length <= 0) {
                    return null;
                }
                let wb = new xl.Workbook();
                for (let i = 0; i < dataList.length; i++) {
                    let item = dataList[i];
                    let ws = wb.addWorksheet(item.sheet_name);
                    log.info('========>>>> do ' + item.sheet_name);
                    //创建表头
                    let r = 1;
                    let cols = 0;
                    let fieldList = [];
                    let colsNum = 0;
                    for (let j = 0; j < item.fields.length; j++) {
                        let field = item.fields[j];
                        ws.cell(r, ++cols).string(field);
                        fieldList.push({
                            field_name: field,
                        });
                        colsNum++;
                    }
                    //创建数据
                    if(item.sheet_name == '各医院上报数据'){
                        r++; //行
                        for (let j = 0; j < item.data.length; j++) {
                            cols = 0;
                            let data = item.data[j];
                            for (let k = 0; k < colsNum; k++) {
                                cols++;
                                var value = data[fieldList[k].field_name];
                                var type = typeof(data[fieldList[k].field_name]);
                                // if (data[fieldList[k].field_name]) {
                                    if (util.isDate(value)) {
                                        let tempDate = moment(value).format('YYYY-MM-DD HH:mm:ss');
                                        ws.cell(r, cols).string(tempDate);
                                    } else if(util.isString(value)){
                                        let tempFiledData = value.replace(/\u0000|\u0001|\u0002|\u0003|\u0004|\u0005|\u0006|\u0007|\u0008|\u0009|\u000a|\u000b|\u000c|\u000d|\u000e|\u000f|\u0010|\u0011|\u0012|\u0013|\u0014|\u0015|\u0016|\u0017|\u0018|\u0019|\u001a|\u001b|\u001c|\u001d|\u001e|\u001f/g,"");
                                        ws.cell(r, cols).string(tempFiledData);
                                    } else if (util.isNumber(value)) {
                                        ws.cell(r, cols).string(value + "");
                                    } else if (util.isUndefined(value)) {
                                        ws.cell(r, cols).string("");
                                    } else {
                                        // ws.cell(r, i + 1).string("未知字段类型:" + JSON.stringify(val));
                                    }
                                // }
        
                            }
                            r++;
                        }
                    }else{
                        for(let j = 0; j < item.data.length; j++){
                            let data = item.data[j];
                            var hospitalId = data.hospitalId+'';
                            var hospitalName = data.hospitalName+'';
                            let filed_index = 0;
                            var open = true;
                            for(let k = 0; k < data.monthData.length; k++){
                                cols = 0;
                                r++;
                                let month = data.monthData[k];
                                for (let x = 0; x < colsNum; x++) {
                                    cols++;
                                    //第一行展示医院id和医院的名称
                                    if(open && cols == 1){
                                        ws.cell(r, cols).string(hospitalId);
                                    }else if(open && cols == 2){
                                        ws.cell(r, cols).string(hospitalName);
                                    }else if(cols != 1 && cols != 2){
                                        var value = month[fieldList[x].field_name]+'';
                                        value = value.replace(/\u0000|\u0001|\u0002|\u0003|\u0004|\u0005|\u0006|\u0007|\u0008|\u0009|\u000a|\u000b|\u000c|\u000d|\u000e|\u000f|\u0010|\u0011|\u0012|\u0013|\u0014|\u0015|\u0016|\u0017|\u0018|\u0019|\u001a|\u001b|\u001c|\u001d|\u001e|\u001f/g,"");
                                        ws.cell(r, cols).string(value);
                                    }
                                }
                                open = false;
                            }
                        }

                    }
                }

                var _fileName = '心衰上报统计_' + moment().format('YYYYMMDDHHmmss') + '.xlsx';
                let fileName = _fileName + '.xlsx';
                log.warn('========>>>> fileName ' + fileName);
                var buffer = await this.out(wb);
                let fileData = new Buffer(buffer, 'binary');
                var output_path = config.output_path;
                if (!fs.existsSync(output_path)) {
                    fs.mkdirSync(output_path);
                }
                output_path = config.output_path + "/hfCountExport";
                if (!fs.existsSync(output_path)) {
                    fs.mkdirSync(output_path);
                }
                // var export_path = path.join(output_path, _fileName);
                // if (!fs.existsSync(export_path)) {
                //     fs.mkdirSync(export_path);
                // }
                var filePath = output_path + '/' + _fileName;
                var file_path = path.join(output_path, _fileName);
                if (fs.existsSync(file_path)) {
                    fs.unlinkSync(file_path);
                }
                try {
                    fs.writeFileSync(filePath, fileData, (err) => {
                        if (err) {
                            log.error("error:::===>", err);
                        }
                        console.log('...保存完毕');
                    });
                } catch (e) {
                    log.error(e);
                }

                var file = {fileName : _fileName,output_path : output_path};
                return file;
            } catch (e) {
                log.error(e);
            }

    },
    out: async function(wb) {
        return new Promise(function(resolve, reject) {
            wb.writeToBuffer().then(function(buffer) {
                return resolve(buffer);
            });
        });
    },
    count:async function(){
        // console.log("result:............");
        var result = await this.getNameByHospitalIds();
         //console.log("result:"+JSON.stringify(result));
        if(!result){
            return;
        }
        var countDao = new Dao(mongodb,'report_log_count');
        var count = await countDao.count();
        // console.log("count:"+JSON.stringify(count));
        var pageSize = 7;
        var pageCount = count / pageSize;
        if (count % pageSize > 0) {
            pageCount++;
        }
        var number = 0;
        for (var pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
            var pageList = await countDao.pageList(pageIndex, pageSize,{});
            // console.log("pageList:"+JSON.stringify(pageList));
            for (var i = 0; i < pageList.items.length; i++) {
                var hospitalId = pageList.items[i].hospitalId;
                if(hospitalId){
                    var info = await this.getCountByHospitalId(hospitalId);
                    // console.log("info:"+JSON.stringify(info));
                    number++;
                }
            }
        }
        if(number>0){
            var data = {
                flag : 2,
                hospitalId : null,
                reason: '',
                updateDate : new Date(),
            };
            await this.update(data); 
        }
    },
    insert:async function(data){
        var flagDao = new Dao(mongodb,'report_log_count_flag');
        //插入之前先删除
        var query = {hospitalId : data};
        await flagDao.delete(query);
        var flagObj = {
            flag : 1,
            createTime : new Date(),
            hospitalId : data,
        };
        var count = await flagDao.insert(flagObj);
        return count;
    },
    update:async function(data){
        var flagDao = new Dao(mongodb,'report_log_count_flag');
        var query = {hospitalId : data.hospitalId};
        var count = await flagDao.update(data,query);
        return count;
    },
    getFlag:async function(){
        var flagDao = new Dao(mongodb,'report_log_count_flag');
        var query = {hospitalId : null};
        var info = flagDao.find(query);
        return info;
    }
}

module.exports = s;