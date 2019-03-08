
var crypto = require('crypto');
var logger = require("../../../models").logger;
var _ = require('lodash');
var utils = require('../../../models').utils;
var Dao_mongo = require("../../../models/mongo/MongoDao");
var db_mongo = require("../../../models").mongo;
var Dao = require("../../../models").MysqlDao;
var MysqlDB = require("../../../models").MysqlDB;
var emrService = require('../../emr/service/emrService');
var myDao = require('../dao/importHFDao');
var xinshuaiServcie = require('./index.js');
var moment = require('moment');
var config = require('../../../config');
var core = require('../../../models');
var q_name = config.fix + 'hf_op_data';
var hospitalDbService = require('../../hospitalDb/service/myService');

var s = {
    queue: async function () {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    process: async function () {
        if (config.task_server) {
            var mq = await this.queue();
            await mq.consumer(q_name, async function (data) {
                await s.taskOP(data);
            }, 1);
        }
    },
    addTaskOP: async function (configInfo, info_id) {
        // var info_id = configInfo._id+"";
        //存储门诊医嘱信息
        var orderDao = new Dao_mongo(db_mongo, "hf_op_order");
        //通过医院id删除用药
        var query = { 'info_id': info_id };
        await orderDao.delete(query);
        var q = { info_id: info_id, ent_status: 0 };
        var dataList = await myDao.pageList(1, 20, q, { _id: 1 });
        var total = dataList.total;
        if (total > 0) {
            await xinshuaiServcie.update({ op_status: "2", op_count: total, _id: info_id });
        }
        var pageCount = parseInt((total + 20 - 1) / 20);
        var mq = await this.queue();
        var index = 1;
        for (var page = 1; page <= pageCount; page++) {
            var list;
            if (page == 1) {
                list = dataList;
            } else {
                list = await myDao.pageList(page, 20, q, { _id: 1 });
            }
            for (var j in list.items) {
                var ent = list.items[j];
                var _query = {
                    _id: ent._id,
                    ID: ent.ID,
                    db: ent.db,
                    hospital_db_id: configInfo.hospital_db_id,
                    info_id: query.info_id,
                    index: index,
                    total: total,
                    hospital_id: configInfo.hospital_id,
                    admission_number: ent.住院号,
                    out_datetime: ent.出院时间
                };
                await mq.publish(q_name, _query);
                index++;
            }
        }
    },
    taskOP: async function (data) {
        // logger.info("##-->>taskOP-data:" + JSON.stringify(data));
        var _id = data._id;
        // var hf_import = await myDao.findById(_id);
        // var out_datetime = data.out_datetime;
        var db;
        if (data.hospital_db_id) db = await hospitalDbService.getDb(data.hospital_db_id);
        else if (data.db) db = await core.getDb(data.db);
        if (!db) return;
        // var dao = new Dao(db, 'ip_medical_history_info');

        var params = {
            out_datetime: data.out_datetime,
            hospital_id: data.hospital_id,
            admission_number: data.admission_number
        }
        var ip_medical_history_info = await emrService.findHistoryId(data.db, params, 1, data.hospital_db_id);

        // var ip_medical_history_info = await dao.findByKV("id", data.ID);
        // logger.info("##-->>taskOP-ip_medical_history_info:" + JSON.stringify(ip_medical_history_info));
        if (ip_medical_history_info && ip_medical_history_info.patient_id) {
            var obj = await this.taskOPItem(db, ip_medical_history_info, data);
            // 更新到心衰表；
            obj._id = _id;
            obj.ID = ip_medical_history_info.id;
            await myDao.update(obj);
            // 存储到临时表测试，发布时删除；
            // obj.hf_import_id = _id;
            // obj.hospital_id = hf_import.hospital_id;
            // var _myDaoObj = new Dao_mongo(db_mongo, "hf_op_obj_test");
            // var _obj = await _myDaoObj.find({ hf_import_id: _id });
            // delete obj._id;
            // if (_obj && _obj._id) {
            //     await _myDaoObj.update(obj);
            // } else {
            //     await _myDaoObj.insert(obj);
            // }
        }
        if (data.total == data.index)
            await xinshuaiServcie.update({ op_status: "1", modify_date: new Date(), _id: data.info_id });
    },
    taskOPItem: async function (db, ip_medical_history_info, data) {
        var obj = {};
        var patient_id = ip_medical_history_info.patient_id;
        var out_datetime = ip_medical_history_info.out_datetime;
        var _out_datetime = new Date(out_datetime);
        var out_datetime_30D = moment(_out_datetime).add(30, 'days');
        var out_datetime_3W = moment(_out_datetime).add(3 * 7, 'days');// 3周
        var out_datetime_6W = moment(_out_datetime).add(6 * 7, 'days');
        var out_datetime_2M = moment(_out_datetime).add(2, 'months');
        var out_datetime_4M = moment(_out_datetime).add(4, 'months');
        var out_datetime_10M = moment(_out_datetime).add(10, 'months');
        var out_datetime_15M = moment(_out_datetime).add(15, 'months');
        console.log('============>', out_datetime_15M);
        // var db = await core.getDb(data.db);
        var where = " 1 = 1";
        var params = [];
        var dao = new Dao(db, 'op_medical_history_info');
        where += " and in_datetime >= ?";
        params.push(out_datetime);
        where += " and patient_id = ?";
        params.push(patient_id);
        var results = await dao.list(where, params);
        var op_medical_history_info_30D = [];
        var op_medical_history_info_1M = [];
        var op_medical_history_info_3M = [];
        var op_medical_history_info_1y = [];
        var dead_type_30D = [];
        var dead_type_1y = [];

        //存储门诊医嘱信息
        var orderDao = new Dao_mongo(db_mongo, "hf_op_order");
        var order_info_ACEI = [];
        var order_info_Beta = [];
        var order_info_reg2 = [];
        var order_info_reg3 = [];
        var order_info_ACEI_3M = [];
        var order_info_ACEI_1y = [];
        var order_info_Beta_3M = [];
        var order_info_Beta_1y = [];
        var _temp_order_str = '';
        if (results && results.length > 0) {
            // function unique(order_infos, order_info) {
            //     for(var index in order_infos){
            //         var order = order_infos[index];
            //         if (order.order_name==order_info.order_name&&order.order_dose==order_info.order_dose&&order.order_dose_unit==order_info.order_dose_unit&&order.order_spec==order_info.order_spec){
            //             return order_infos;
            //         }
            //     }
            //     order_infos.push(order_info);
            //     return order_infos;
            // };
            var ACEI = /开博通|雅施达|洛汀新|普利/;
            var Beta = /美托洛尔|比索洛尔|卡维地洛|倍他乐克|康忻|络德|奈必洛尔|阿替洛尔|拉贝洛尔|阿罗洛尔/;
            var reg2 = /呋塞米|呋塞咪|布美他尼|托拉塞米|泽通|氢氯噻嗪|吲达帕胺|阿米洛利|氨苯喋啶|速尿|苏麦卡|呋噻米|美托拉宗|依他尼酸/; //托伐普坦
            var reg3 = /螺内酯|螺内脂|依普利酮|安体舒通/;
            for (var index in results) {
                var order_op = [];
                var op_medical_history_info = results[index];
                var in_datetime = op_medical_history_info.in_datetime;
                var type = "0";
                var _type = "0";
                if (in_datetime) {
                    var time = in_datetime.getTime();
                    if (time <= out_datetime_30D.valueOf()) {
                        op_medical_history_info_30D.push(op_medical_history_info);
                        _type = "1";
                    }
                    if (time > out_datetime_3W.valueOf() && time <= out_datetime_6W.valueOf()) {
                        op_medical_history_info_1M.push(op_medical_history_info);
                        type = "1";
                    } else if (time > out_datetime_2M.valueOf() && time <= out_datetime_4M.valueOf()) {
                        op_medical_history_info_3M.push(op_medical_history_info);
                        type = "2";
                    } else if (time > out_datetime_10M.valueOf() && time <= out_datetime_15M.valueOf()) {
                        op_medical_history_info_1y.push(op_medical_history_info);
                        type = "3";
                        _type = "3";
                    }
                }
                if (_type === "1" || _type === "3") {
                    var ip_index_records = await db.query('select dead_type from op_index_record where medical_history_id = ?', [op_medical_history_info.id]);
                    if (ip_index_records && ip_index_records.length > 0) {
                        var ip_index_record = ip_index_records[0];
                        if (ip_index_record.dead_type && ip_index_record.dead_type === 1) {
                            if (_type === "1") {
                                dead_type_30D.push(ip_index_record.dead_type);
                            } else {
                                dead_type_1y.push(ip_index_record.dead_type);
                            }
                        }
                    }
                }
                var order_info = await db.query('select id, order_name,order_begin_time,medical_chemical_name,medical_trade_name,order_method,order_dose,order_dose_unit,order_freq,order_spec from op_order_info where medical_history_id = ?', [op_medical_history_info.id]);
                if (order_info && order_info.length > 0) {
                    for (var indexO in order_info) {
                        var order = order_info[indexO];
                        if (ACEI.test(order.order_name)) {
                            order_info_ACEI.push(order);

                            order_op.push(order);
                            // order_info_ACEI=unique(order_info_ACEI, order);
                            if (type == "2") {
                                // order_info_ACEI_3M=unique(order_info_ACEI_3M, order);
                                order_info_ACEI_3M.push(order);
                            } else if (type == "3") {
                                // order_info_ACEI_1y=unique(order_info_ACEI_1y, order);
                                order_info_ACEI_1y.push(order);
                            }
                        }
                        if (Beta.test(order.order_name)) {
                            // order_info_Beta=unique(order_info_Beta, order);
                            order_info_Beta.push(order);
                            order_op.push(order);
                            if (type == "2") {
                                // order_info_Beta_3M=unique(order_info_Beta_3M, order);
                                order_info_Beta_3M.push(order);
                            } else if (type == "3") {
                                // order_info_Beta_1y=unique(order_info_Beta_1y, order);
                                order_info_Beta_1y.push(order);
                            }
                        }
                        if (reg2.test(order.order_name)) {
                            order_op.push(order);
                            order_info_reg2.push(order);
                        }
                        if (reg3.test(order.order_name)) {
                            order_op.push(order);
                            order_info_reg3.push(order);
                        }

                    }
                    //insertOrder(order_op,op_medical_history_info,orderDao);
                    if (order_op && order_op.length > 0) {
                        for (var index in order_op) {
                            var order = order_op[index];
                            var orderResult = {
                                '病史ID': ip_medical_history_info.id,
                                '住院号': ip_medical_history_info.admission_number,
                                '出院时间': ip_medical_history_info.out_datetime != null ? moment(ip_medical_history_info.out_datetime).format("YYYY-MM-DD HH:mm:ss") : null,
                                '门诊号': op_medical_history_info.reg_number,
                                '门诊时间': op_medical_history_info.in_datetime != null ? moment(op_medical_history_info.in_datetime).format("YYYY-MM-DD HH:mm:ss") : null,
                                '医嘱名称': order.order_name,
                                '医嘱开立时间': order.order_begin_time != null ? moment(order.order_begin_time).format("YYYY-MM-DD HH:mm:ss") : null,
                                '化学名': order.medical_chemical_name,
                                '商品名': order.medical_trade_name,
                                '使用方式': order.order_method,
                                '剂量': order.order_dose,
                                '剂量单位': order.order_dose_unit,
                                '频次': order.order_freq,
                                '规格': order.order_spec,
                                info_id: data.info_id,
                                order_id: order.id,
                                hf_import_data_id: data._id
                            };

                            await orderDao.insert(orderResult);
                        }
                    }
                }

            }
            // 存储到临时表，发布时删除；
            // var _temp_order_info = [];
            // var _temp_order_str = "";
            // var _myDao = new Dao_mongo(db_mongo, "hf_op_order_test");
            for (var index in order_info_ACEI) {
                var order = order_info_ACEI[index];
                order.type = "ACEI";
                // var _order = await _myDao.find(order);
                // if (!_order || !_order._id){
                //     await _myDao.insert(order);
                // }
                // _temp_order_info.push(order);
                _temp_order_str += (order.order_name + "," + order.order_dose + "," + order.order_dose_unit + "\n");
            }
            for (var index in order_info_Beta) {
                var order = order_info_Beta[index];
                order.type = "BETA";
                // var _order = await _myDao.find(order);
                // if (!_order || !_order._id){
                //     await _myDao.insert(order);
                // }
                // _temp_order_info.push(order);
                _temp_order_str += (order.order_name + "," + order.order_dose + "," + order.order_dose_unit + "\n");
            }
            // obj.order = JSON.stringify(_temp_order_info);
            // obj.order = _temp_order_str;
        }
        function getMax(order_infos) {
            var order_info = null;
            for (var index in order_infos) {
                var order = order_infos[index];
                if (order_info === null) {
                    order_info = order;
                } else {
                    if (order.order_dose && order_info.order_dose && order.order_dose > order_info.order_dose) {
                        order_info = order;
                    }
                }
            }
            return order_info;
        };
        var order_info_ACEI_3M_max = getMax(order_info_ACEI_3M);
        var order_info_ACEI_1y_max = getMax(order_info_ACEI_1y);
        var order_info_Beta_3M_max = getMax(order_info_Beta_3M);
        var order_info_Beta_1y_max = getMax(order_info_Beta_1y);
        var obj = {
            "一月随访": op_medical_history_info_1M.length > 0 ? "是" : "否",
            "三月随访": op_medical_history_info_3M.length > 0 ? "是" : "否",
            "一年随访": op_medical_history_info_1y.length > 0 ? "是" : "否",
            "ACEI类药物使用": order_info_ACEI.length > 0 ? "是" : "否",
            "β受体阻断剂使用": order_info_Beta.length > 0 ? "是" : "否",
            "袢利尿剂使用": order_info_reg2.length > 0 ? "是" : "否",
            "醛固酮受体拮抗剂使用": order_info_reg3.length > 0 ? "是" : "否",
            "3个月内随访Max用量ACEI类药物": order_info_ACEI_3M_max !== null ? order_info_ACEI_3M_max.order_name : "",
            "3个月内随访Max用量ACEI类药物用量": order_info_ACEI_3M_max !== null ? order_info_ACEI_3M_max.order_dose + order_info_ACEI_3M_max.order_dose_unit : "",
            "1年内随访Max用量ACEI类药物": order_info_ACEI_1y_max !== null ? order_info_ACEI_1y_max.order_name : "",
            "1年内随访Max用量ACEI类药物用量": order_info_ACEI_1y_max !== null ? order_info_ACEI_1y_max.order_dose + order_info_ACEI_1y_max.order_dose_unit : "",
            "3个月内随访Max用量β受体阻断剂药物": order_info_Beta_3M_max !== null ? order_info_Beta_3M_max.order_name : "",
            "3个月内随访Max用量β受体阻断剂药物用量": order_info_Beta_3M_max !== null ? order_info_Beta_3M_max.order_dose + order_info_Beta_3M_max.order_dose_unit : "",
            "1年内随访Max用量β受体阻断剂药物": order_info_Beta_1y_max !== null ? order_info_Beta_1y_max.order_name : "",
            "1年内随访Max用量β受体阻断剂药物用量": order_info_Beta_1y_max !== null ? order_info_Beta_1y_max.order_dose + order_info_Beta_1y_max.order_dose_unit : "",
            "order": _temp_order_str
        };

        // var _myDaoObj = new Dao_mongo(db_mongo, "hf_op_obj_test");
        // var orderResult = {
        //     hospital_id: ip_medical_history_info.hospital_id,
        //     '病史ID':ip_medical_history_info.id,
        //     '住院号':ip_medical_history_info.admission_number,
        //     '出院时间':ip_medical_history_info.out_datetime!=null?moment(ip_medical_history_info.out_datetime).format("YYYY-MM-DD HH:mm:ss"):null,
        //     info_id:data.info_id,
        //     hf_import_data_id:data._id,
        //     order_info_ACEI:JSON.stringify(order_info_ACEI),
        //     order_info_Beta:JSON.stringify(order_info_Beta),
        //     order_info_reg2:JSON.stringify(order_info_reg2),
        //     order_info_reg3:JSON.stringify(order_info_reg3),
        //     out_datetime:JSON.stringify(out_datetime)
        // };
        // await _myDaoObj.insert(orderResult);

        var whereI = " 1 = 1";
        var paramsI = [];
        var daoI = new Dao(db, 'ip_medical_history_info');
        whereI += " and patient_id = ?";
        paramsI.push(patient_id);
        whereI += " and in_datetime >= ? and in_datetime <= ?";
        paramsI.push(out_datetime);
        paramsI.push(out_datetime_15M.format());
        var resultsI = await daoI.list(whereI, paramsI);
        var ip_medical_history_info_30D = [];
        // var ip_medical_history_info_in_datetime_30D = [];
        var ip_medical_history_info_1y = [];
        if (resultsI && resultsI.length > 0) {
            for (var index in resultsI) {
                var _ip_medical_history_info = resultsI[index];
                var in_datetime = _ip_medical_history_info.in_datetime;
                var type = "0";
                if (in_datetime) {
                    var time = in_datetime.getTime();
                    // if (time > out_datetime_3W.getTime() && time <= out_datetime_6W.getTime()){
                    //     ip_medical_history_info_30D.push(op_medical_history_info);
                    // }  
                    if (time <= out_datetime_30D.valueOf()) {
                        ip_medical_history_info_30D.push(_ip_medical_history_info);
                        // ip_medical_history_info_in_datetime_30D.push(_ip_medical_history_info.id + ":" +in_datetime);
                        type = "1";
                    } else if (time > out_datetime_10M.valueOf() && time <= out_datetime_15M.valueOf()) {
                        ip_medical_history_info_1y.push(_ip_medical_history_info);
                        type = "2";
                    }
                }
                if (type !== "0") {
                    var ip_index_records = await db.query('select dead_type from ip_index_record where medical_history_id = ?', [_ip_medical_history_info.id]);
                    if (ip_index_records && ip_index_records.length > 0) {
                        var ip_index_record = ip_index_records[0];
                        if (ip_index_record.dead_type && ip_index_record.dead_type === 1) {
                            if (type === "1") {
                                dead_type_30D.push(ip_index_record.dead_type);
                            } else {
                                dead_type_1y.push(ip_index_record.dead_type);
                            }
                        }
                    }
                }
            }
        }
        obj.出院后30天再入院 = ip_medical_history_info_30D.length > 0 ? "是" : "否";
        obj.出院1年再入院 = ip_medical_history_info_1y.length > 0 ? "是" : "否";
        obj.出院后30天死亡 = dead_type_30D.length > 0 ? "是" : "否";
        obj.出院1年死亡 = dead_type_1y.length > 0 ? "是" : "否";

        // var _myDaoObj = new Dao_mongo(db_mongo, "hf_op_obj_test");
        // var orderResult = {
        //     hospital_id: ip_medical_history_info.hospital_id,
        //     '病史ID':ip_medical_history_info.id,
        //     '住院号':ip_medical_history_info.admission_number,
        //     '出院时间':ip_medical_history_info.out_datetime!=null?moment(ip_medical_history_info.out_datetime).format("YYYY-MM-DD HH:mm:ss"):null,
        //     info_id:data.info_id,
        //     hf_import_data_id:data._id,
        //     ip_medical_history_info_in_datetime_30D:JSON.stringify(ip_medical_history_info_in_datetime_30D),
        //     out_datetime:JSON.stringify(out_datetime)
        // };
        // await _myDaoObj.insert(orderResult);

        return obj;
    }
}
module.exports = s;