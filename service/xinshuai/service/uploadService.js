var config = require('../../../config');
var core = require('../../../models');
var log = core.logger;
var q_name = config.fix + 'demodt_upload';
var get = require('simple-get');
var md5 = require('md5');
var uuid = require('uuid');
var moment = require('moment');
var configDao = require('../dao/configDao'); // 主表
var importHFDao = require('../dao/importHFDao'); // 字表
var emrService = require('../../emr/service/emrService');
var db_mongo = require("../../../models").mongo;
var Dao_mongo = require("../../../models/mongo/MongoDao");


var s = {
    get: async function (options) {
        return new Promise(function (resolve, reject) {
            get.concat(options, function (err, res, rs) {
                if (err) {
                    console.error(err);
                    log.error("err:"+err);
                    log.info("err:"+err);
                    return reject(err);
                }
                return resolve(rs);
            });
            // get(options, function (err, res) {
            //     if (err) {
            //         console.error(err);
            //         return reject(err);
            //     }
            //     var rs = '';
            //     res.on('data', function (chunck) {
            //         rs += chunck;
            //     });
            //     res.on('end', function () {
            //         return resolve(rs);
            //     });
            // });
        });
    },
    push: async function (ID,flag, configInfo) {
        var mq = await this.queue();
            await mq.publish(q_name, {
                ID: ID,
                flag:flag,
                hospital_db_id: configInfo.hospital_db_id,
                info_id:configInfo._id
            });
    },
    queue: async function () {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    demodtReport:async function (dataInput) {
        // var ID = dataInput.ID;

        // // 数据转换
        // var body = [];
        // var data = await importHFDao.find({
        //     'ID': ID
        // });
        var data = await this.queryData(dataInput);

        var report_data ={};
        var patient_basic_info = {};
        var patient_medical_history = {};
        var laboratory_examination = {};
        var discharge_summary = {};
        var follow_up_conclusion = {};
        if (data && data.ID) {

            // //通过病史id及对应的emr库查询患者信息以及完善病史信息
            // var emrDB = data.db;
            // var info = {db:emrDB};
            // var patient_ids = [];
            // var table = {table_name:'ip_medical_history_info'};
            // var historyData = await emrService.findById(info,table,ID);
            // if(!historyData){
            //     log.warn("historyData is null");
            //     return ;
            // }

            // console.log("historyData.patient_id:"+historyData.patient_id);
            // patient_ids.push(historyData.patient_id);
            // var patientData = await emrService.findPatientInfo(patient_ids);
            // patientData = patientData && patientData.length>0?patientData[0]:{};

            // // 医院标示
            // var config_data = await configDao.findById(data.info_id);
            // var hospital_id = null;
            // if (config_data && config_data.hfc_hospital_id) {
            //     hospital_id = config_data.hfc_hospital_id;
            // }
            var returnData =await this.queryEmr(data, dataInput);
            var historyData = returnData.historyData;
            var patientData = returnData.patientData;
            var hospital_id = data.hospital_id;

            //用药的剂量转换
            function order_dose_format(key){
                if(data[key]){
                    //正浮点型和正整数
                    console.log("reg:"+data[key]);
                    var reg1 = /([1-9]\d*|0)(\.\d{1,3})?/;
                    var value = "";
                    if(data[key].match(reg1)){
                        value = data[key].match(reg1)[0];
                        console.log("reg_value:"+value);
                    }
                    var unit = data[key].replace(value,'');
                    var valueUnit = {
                        'value':value,
                        'unit':unit
                    }
                    return valueUnit;
                }
            }

            var patient_basic_info_list =await this.patientInstall(patientData);

            var history = {historyData:historyData,data:data};
            var patient_medical_history_list = await this.historyInstall(history);
            // console.log("patient_medical_history_list:"+JSON.stringify(patient_medical_history_list));
            // [destKey,srcKey,cal_function]
            var laboratory_examination_list = await this.labInstall(data);
            
            var discharge_summary_list = await this.dischargeInstall();

            var follow_up_conclusion_list = [
                ['oneMonthFollowUp', '一月随访'],
                ['threeMonthFollowUp', '三月随访'],
                ['oneYearFollowUp', '一年随访'],
                ['threeMonthsFUMaxForACEIDrugs', '3个月内随访Max用量ACEI类药物'],
                ['dosageOfThreeMonthsFUMaxForACEIDrugs', '3个月内随访Max用量ACEI类药物用量',order_dose_format],
                ['oneYearFUMaxForACEIDrugs', '1年内随访Max用量ACEI类药物'],
                ['dosageOfOneYearFUMaxForACEIDrugs', '1年内随访Max用量ACEI类药物用量',order_dose_format],
                ['threeMonthsFUMaxForBetaBlockerDrugs', '3个月内随访Max用量β受体阻断剂药物'],
                ['dosageOfThreeMonthsFUMaxForBetaBlockerDrugs', '3个月内随访Max用量β受体阻断剂药物用量',order_dose_format],
                ['oneYearFUMaxForBetaBlockerDrugs', '1年内随访Max用量β受体阻断剂药物'],                    
                ['dosageOfOneYearFUMaxForBetaBlockerDrugs', '1年内随访Max用量β受体阻断剂药物用量',order_dose_format],
                ['thirtyDaysOfDeathAfterDischarge', '出院后30天死亡'],
                ['rehospitalizationForOneYearsAfterDischarge', '出院1年再入院'],
                ['oneYearOfDeathAfterDischarge', '出院1年死亡'],
                ['isAcei','ACEI类药物使用'],
                ['isBetaBlockerUse','β受体阻断剂使用'],
                ['isLoopDiureticUse','袢利尿剂使用'],
                ['isAldosteroneAntagonistsUse','醛固酮受体拮抗剂使用'],
                ['rehospitalizationOneMonthAfterDischarge','出院后30天再入院']
            ];

            //患者信息
            await this.installReportData(patient_basic_info_list,patient_basic_info,"patient_basic_info",report_data,data);
            // report_data.patient_basic_info=patient_basic_info;
            //病史信息
            await this.installReportData(patient_medical_history_list,patient_medical_history,"patient_medical_history",report_data,data);
            // console.log("report_data;;;;;;;;;;;;;;;;;;;;;;:"+JSON.stringify(report_data));
            // console.log("data:"+JSON.stringify(data));

            // report_data.patient_medical_history=patient_medical_history;
            //实验室检查
            await this.installReportData(laboratory_examination_list,patient_medical_history,"patient_medical_history",report_data,data);
            // report_data.laboratory_examination=laboratory_examination;
            //出院小结
            await this.installReportData(discharge_summary_list,patient_medical_history,"patient_medical_history",report_data,data);
            // report_data.discharge_summary=discharge_summary;
            //随访信息
            await this.installReportData(follow_up_conclusion_list,follow_up_conclusion,"follow_up_conclusion",report_data,data);
            // report_data.follow_up_conclusion=follow_up_conclusion;
            //医院id
            // report_data.hospital_id = data.hospital_id;
            report_data.hospitalId = parseInt(hospital_id);
            //病种id
            report_data.diseaseId = 47;
            //科室id
            report_data.deptId = 1;
            //病史id
            report_data.historyId = data.ID;


            // console.log("report_data------------:"+JSON.stringify(report_data));
            
            //保存到库里看数据
            //存储同步的数据
            var demoDao = new Dao_mongo(db_mongo, "hf_demo_test");
            var query = {'historyId':data.ID};
            await demoDao.delete(query);
            await demoDao.insert(report_data);

            if (report_data.historyId) {
                await this.sendData(report_data);
            } else {
                console.warn(ID + ' hfc_hospital_id not config');
            }
        } else {
            console.warn(ID + ' not found');
        }
    },
    queryData:async function (dataInput) {
        var ID = dataInput.ID;

        // 数据转换
        var body = [];
        var data = await importHFDao.find({
            'ID':ID,
            "ent_status":0,
            'info_id':dataInput.info_id
        });
        return data;
    },
    queryEmr:async function (data, dataInput) {
        //通过病史id及对应的emr库查询患者信息以及完善病史信息
        var emrDB = data.db;
        var info = {db:emrDB, hospital_db_id: dataInput.hospital_db_id};
        var patient_ids = [];
        var table = {table_name:'ip_medical_history_info'};
        var ID = data.ID;
        var returnData = {};
        var historyData = await emrService.findById(info,table,ID);
        if(!historyData){
            log.warn("historyData ID is change");
            
            var params = {
                out_datetime: data.出院时间,
                hospital_id: data.hospital_id + '',
                admission_number: data.住院号
            }
            var db = info.db;
            log.info("##-->>db:" + JSON.stringify(db));
            historyData = await emrService.findHistoryId(db, params,1,dataInput.hospital_db_id);
        }

        returnData.historyData = historyData;

        console.log("historyData.patient_id:"+historyData.patient_id);
        patient_ids.push(historyData.patient_id);
        var patientData = await emrService.findPatientInfo(patient_ids, info.hospital_db_id);
        // console.log("info.hospital_db_id:"+info.hospital_db_id);
        console.log("historyData.patientData.length:"+JSON.stringify(patientData.length));
        patientData = patientData && patientData.length>0?patientData[0]:{};
        // console.log("historyData.patientData:"+JSON.stringify(patientData));
        returnData.patientData = patientData;

        // 医院标示
        var config_data = await configDao.findById(data.info_id);
        var hospital_id = null;
        if (config_data && config_data.hfc_hospital_id) {
            hospital_id = config_data.hfc_hospital_id;
        }
        returnData.hospital_id = hospital_id;

        return returnData;
    },
    patientInstall:async function (patientData) {
        var patient_basic_info_list = [
            ['patientBasicInfoPatientUserName','',function(key){
                return patientData.patient_name;
            }],
            ['patientBasicInfoIdCard','',function(key){
                return patientData.identity_no;
            }],
            ['patientBasicInfoGender','',function(key){
                var gender = patientData.gender;
                if(gender && gender=='1'){
                    return '男';
                }else if(gender && gender=='2'){
                    return '女';
                }
            }],
            ['patientBasicInfoBirthday','',function(key){
                if(patientData.birthdate){
                    var birth = (patientData.birthdate).getTime();
                    return patientData.birthdate!=null?moment(birth).format("YYYY-MM-DD HH:mm:ss"):null;
                }
                return null;
            }]
        ];
        return patient_basic_info_list;
    },
    historyInstall:async function (history) {
        var historyData = history.historyData;
        var data = history.data;
        var patient_medical_history_list = [
            ['toReport','',function(key){
                return '是';
            }],
            ['patientMedicalHistoryAdmissionNumber', '住院号'],             
            ['patientMedicalHistoryDischargeDate', '',function(key){
                if(historyData.out_datetime){
                    var date = (historyData.out_datetime).getTime();
                    var outdate = historyData.out_datetime!=null?moment(date).format("YYYY-MM-DD HH:mm:ss"):null;
                    return outdate;
                }
                return null;
            }],
            ['patientMedicalHistoryAdmissionDate', '',function(key){
                if(historyData.in_datetime){
                    var date = (historyData.in_datetime).getTime();
                    var indate = historyData.in_datetime!=null?moment(date).format("YYYY-MM-DD HH:mm:ss"):null;
                    return indate;
                }
                return null;
            }],
            ['patientMedicalHistoryVisitId', '',function(key){
                return historyData.hos_visit_id;
            }],
            ['dischargeMonth', '出院月份',function(key){
                if(data[key]){
                    var month = (data[key]+'').replace('月','');
                    return parseInt(month);
                }
            }],
            ['atrialFibrillationOrFlutter', '房颤/房扑'],
            ['patientsWithAcuteHF', '急性心衰患者'],
            ['dischargeNYHAClassification','NYHA分级'],
            ['dischargeKILLIPClassification','killip分级'],
            ['symptomsOfCongestiveHeartFailure','NYHA分级',function(key){
                return data[key] ? "是":"";
            }],
        ];
        return patient_medical_history_list;
    },
    labInstall:async function(data){
        var laboratory_examination_list = [
            ['isBNP', 'BNP'],
            ['echocardiographyinrecent12', '超声心动',function(key){
                if(data[key] && data[key]=='是'){
                    return '做过';
                }else if(data[key] && data[key]=='否'){
                    return '未做';
                }
            }],
            ['checkEquipmentInspectionEf', 'EF值',function(key){
                if(data[key]){
                    log.info("ef:"+data[key]);
                    var number_arr = data[key]+''.match(/[1-9]\d*.\d*|0.\d*[1-9]\d*/ig);
                    var number = number_arr.length > 0? number_arr[0] : '';
                    var ValueUnit = {};
                    if(number && number.length == data[key].length){
                        ValueUnit.value = data[key];
                        ValueUnit.unit = '%'
                    }else{
                        ValueUnit.value_str = data[key];
                        ValueUnit.unit = '%'
                    }
                    return ValueUnit;
                }
            }],
            ['isEF', 'EF有无'],
            ['eFClassification', 'EF分类'],
        ];
        return laboratory_examination_list;
    },
    dischargeInstall:async function(){
        var discharge_summary_list = [
            ['dischargeDiagnosis', '出院诊断'],
            ['patientWhereabouts', '离院方式'],
            ['withinOnemonthRehospitalization', '30天再入院'],
        ];
        return discharge_summary_list;
    },
    //组装
    installReportData:async function(list,var_name,name,report_data,data){
        list.forEach(function(list_index){
            if (list_index.length == 3) {
                var_name[list_index[0]] = list_index[2](list_index[1]);
            } else {
                var_name[list_index[0]] = data[list_index[1]];
            }
        });
        report_data[name]=var_name;
    },
    dmeodtReport49:async function (dataInput) {
        var data = await this.queryData(dataInput);

        var report_data ={};
        var patient_basic_info = {};
        var patient_medical_history = {};
        var laboratory_examination = {};
        var discharge_summary = {};
        var follow_up_conclusion = {};
        if (data && data.ID) {
            
            var returnData =await this.queryEmr(data, dataInput);
            var historyData = returnData.historyData;
            var patientData = returnData.patientData;
            var hospital_id = data.hospital_id;

            var patient_basic_info_list =await this.patientInstall(patientData);
            // patient_basic_info_list = patient_basic_info_list.splice(0,1);
            var history = {historyData:historyData,data:data};
            var patient_medical_history_list = await this.historyInstall(history);
            // patient_medical_history_list = patient_medical_history_list.splice(0,1);
            // patient_medical_history_list = patient_medical_history_list.splice(3,1);
            // [destKey,srcKey,cal_function]
            var laboratory_examination_list = await this.labInstall(data);
            
            var discharge_summary_list = await this.dischargeInstall();

            // [destKey,srcKey,cal_function]
            var drug_list = [
                ['aceiDrugSpecific','ACEI类药物名称'],
                ['arbDrugName','ARB类药物名称'],
                ['betaBlockerName','β受体阻断剂药物名称'],
                ['intramedullaryDiuretic','袢利尿剂药物名称'],
                ['aaDrugName','醛固酮受体拮抗剂药物名称'],
                ['arniDrugSpecific','ARNI类药物名称'],
                ['isAFib','房颤'],
                ['flutter','房扑'],
                ['anticoagulantDrugName','抗凝药物名称'],
            ];
            //患者信息
            await this.installReportData(patient_basic_info_list,patient_basic_info,"patient_basic_info",report_data,data);
            //病史信息
            await this.installReportData(patient_medical_history_list,patient_medical_history,"patient_medical_history",report_data,data);
            await this.installReportData(laboratory_examination_list,patient_medical_history,"patient_medical_history",report_data,data);
            await this.installReportData(discharge_summary_list,patient_medical_history,"patient_medical_history",report_data,data);
            await this.installReportData(drug_list,patient_medical_history,"patient_medical_history",report_data,data);

            delete report_data.patient_basic_info.patientBasicInfoIdCard;
            delete report_data.patient_medical_history.toReport;
            delete report_data.patient_medical_history.patientMedicalHistoryVisitId;

            //医院id
            report_data.hospitalId = parseInt(hospital_id);
            //病种id
            report_data.diseaseId = 49;
            //科室id
            report_data.deptId = 1;
            //病史id
            report_data.historyId = data.ID;
            
            //保存到库里看数据
            //存储同步的数据
            var demoDao = new Dao_mongo(db_mongo, "hf_demo_test49");
            var query = {'historyId':data.ID};
            await demoDao.delete(query);
            await demoDao.insert(report_data);

            if (report_data.historyId) {
                await this.sendData(report_data);
            } else {
                console.warn(ID + ' hfc_hospital_id not config');
            }
        } else {
            console.warn(ID + ' not found');
        }    
    },
    sendData:async function(report_data){
        if (report_data.historyId) {
            var url = config.api.dmeodtReport;
            // console.log(url);
            log.error("url:"+url);

            var rs = await this.get({
                url: url,
                method: 'POST',
                body: report_data,
                json: true,
                timeout: 10000
            });

            console.info(rs);
            log.error("rs:"+rs);
            log.info("rs:"+JSON.stringify(rs));
            log.info("diseaseId:"+report_data.diseaseId);
            if(report_data&&report_data.diseaseId==47){
                await importHFDao.update({  
                    'dmeodt_report_code': rs ? rs.success : null,
                    'demodt_report_msg': rs ? rs.msg : null,
                }, {
                    'ID': report_data.historyId
                });

                log.info("diseaseId47:"+"success");
            }else if(report_data&&report_data.diseaseId==49){
                await importHFDao.update({  
                    'dmeodt_report_code49': rs ? rs.success : null,
                    'demodt_report_msg49': rs ? rs.msg : null,
                }, {
                    'ID': report_data.historyId
                });

                log.info("diseaseId49:"+"success");
            }
        } else {
            console.warn(ID + ' hfc_hospital_id not config');
        }
    },
    process: async function () {
        var q = await this.queue();
        var _this = this;
        await q.consumer(q_name, async function (data) {
            if(data&&data.flag=="47"){
                await _this.demodtReport(data);
            }else if(data&&data.flag=="49"){
                await _this.dmeodtReport49(data);
            }
        }, 1);       
    }
}

module.exports = s;