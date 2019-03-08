var Dao = require("../../../models").MysqlDao;
var MysqlDB = require("../../../models").MysqlDB;
var logger = require("../../../models").logger;
var config = require('../../../config');
var core = require('../../../models');
var importLogDao = require('../dao/importLogDao');

var xlsx = require("node-xlsx");
var fs = require('fs');
var zipper = require('zip-local');
var moment = require('moment');
var utils = require('../../../models').utils;

var taskPush = require('./taskPush');

var ObjectID = require("mongodb").ObjectID;

var importService = {

    importExcel: async function (info) {


        var logEnt = {
            logIds: [],
            createTime: new Date(),
            info: info,
            // hospital_id: info.hospital_id,
            // emr_db : info.db,
            // zipPath : info.zipPath,
            importMsg: "正在导入",
            history_info_num: 0,
            time_consuming: 0,
            state: 1,
            // file_name : info.fileName,
            id: utils.autoId()
        }
        await importLogDao.insert(logEnt);

        let path = info.upload_path + '/' + logEnt.id;
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
        var _this = this;
        new Promise(async function (a, b) {
            let logEntId = logEnt._id;
            try {

                logEnt.importMsg = "正在解压文件,文件越大时间越长";
                await importLogDao.update(logEnt);
                logEnt._id = logEntId;

                zipper.sync.unzip(info.upload_path + '/' + info.fileName).save(path);

                logEnt.importMsg = "解压完成,准备导入";
                await importLogDao.update(logEnt);
                logEnt._id = logEntId;

                logEnt.upload_path = info.upload_path;

                _this.processZip(logEnt);

            } catch (err) {
                logger.error(err);
                logEnt.importMsg = "解压文件失败";
                let logEntId = logEnt._id;
                await importLogDao.update(logEnt);
                logEnt._id = logEntId;
            }
        });

    },
    processZip: async function (logEnt) {
        var logTime = new Date();
        let path = logEnt.upload_path + '/' + logEnt.id;
        let info = logEnt.info;
        let fileList = fs.readdirSync(path);

        // var db;

        // if (config.isMyDev) {
        //     db = new MysqlDB();
        //     db.debug = config.debug;
        //     db.connect(config.emr[info.db]);
        // } else {
        //     info.database = info.db;
        //     db = await core.getDbV2(info);
        // }

        // var ermdb = new MysqlDB();
        // ermdb.debug = config.debug;
        // ermdb.connect(config.emr['emr']);

        var logEntId = logEnt._id;

        if (fileList && fileList.length > 0) {
            var index = logEnt.history_info_num || 0;
            if (index >= fileList.length) {
                index = 0;
            }
            try {
                logger.error("准备导入：" + info.hospital_id);
                logger.error("文件数量：" + fileList.length);

                console.log("准备导入：" + info.hospital_id);
                console.log("文件数量：" + fileList.length);

                for (var i = 0; i < fileList.length; i++) {
                    if (fileList[i].lastIndexOf(".xlsx") >= 0) {
                        await taskPush.push({
                            path: path + '/' + fileList[i],
                            info: info,
                            logEntId: logEnt._id
                        });
                        // let result = await this.processData(path + '/' + fileList[i], db, info);
                        // if (result) {
                        //     logEnt.logIds.push(result);
                        //     index++;
                        //     // if(index%5 == 0){
                        //     logEnt.history_info_num = index;
                        //     logEnt.importMsg = "正在导入";
                        //     logEnt.history_info_count = fileList.length;
                        //     await importLogDao.update(logEnt);
                        //     logEnt._id = logEntId;
                        //     // }
                        //     // logEnt.logIds.push(result);
                        // }
                    }
                    logger.error("导入队列中:" + info.hospital_id + ",文件数：" + fileList.length + ",当前执行：" + i);
                    console.log("导入队列中:" + info.hospital_id + ",文件数：" + fileList.length + ",当前执行：" + i);

                }
                logger.error("队列导入完成：" + info.hospital_id);
                // logEnt.history_info_num = logEnt.logIds.length;
                logEnt.history_info_count = fileList.length;
                logEnt.importMsg = '已导入到队列中，正在执行导入';
                // logEnt.state = 2;
                // for (var i = 0; i < fileList.length; i++) {
                //     if (fileList[i].lastIndexOf(".xlsx") >= 0) {
                //        fs.unlinkSync(path+'/'+fileList[i]);
                //     }
                // }
            } catch (err) {
                logger.error("导入错误啦..." + err.code, err);
                console.error(err);
                logEnt.state = 0;
                logEnt.history_info_num = index;
                logEnt.importMsg = '程序错误';
                logEnt.createTime = new Date();
            } finally {

            }
        }
        let time_consuming = ((new Date().getTime() - logTime.getTime()) / 1000 / 60);

        logger.info("耗时:" + time_consuming);
        logEnt.time_consuming = (parseFloat(logEnt.time_consuming || 0) + time_consuming.toFixed(2));

        await importLogDao.update(logEnt);
    },
    processData: async function (excePath, db, info) {
        let list = xlsx.parse(excePath);

        let result = {};

        if (list) {

            let item_medical_history = null;//未解析 的 病史 ，需要 把病史放到最后 入库， 所以 需要 在第二次循环中 重新 解析 入库
            let item_medical_history_v2 = null;//解析 后的 病史 主要用来给其它表 添加 医院 id 患者id 
            let ip_patient_hospital_rel_flag = false;
            for (let i = 0; i < list.length; i++) {
                let item = list[i];
                if (item.name == 'ip_medical_history_info' || item.name == 'op_medical_history_info') {
                    let tempObj = {};
                    let data = item.data;
                    var dataj = data[1];//一行数据
                    let fields = data[0]
                    for (let k = 0; k < fields.length; k++) {//循环单行数据的列 
                        let field_name = fields[k];

                        if (dataj[k]) {
                            tempObj[field_name] = dataj[k];//将列数据 赋值到 insert 对象
                        }

                    }
                    let dao = new Dao(db, item.name);//item.name = 表名
                    let temp_ip_medical_history_info = await dao.findById(tempObj.id);
                    if (temp_ip_medical_history_info) {
                        return null;
                    }


                    item_medical_history = item;
                    item_medical_history_v2 = tempObj;
                    delete list[i];
                    // break;// 新增 患者医院中间表 之后 逻辑修改
                } else if (item.name == 'ip_patient_hospital_rel') {//患者医院 中间表
                    //如果中间表的数据只有 一行列头 则也判断 为 无数据，需要程序自动创建
                    if (item.data && item.data.length > 1) {
                        ip_patient_hospital_rel_flag = true;
                    }
                    
                    if (item_medical_history) break;//如果 找到了患者医院 中间表 & 也找到了 病史表 则不需要 再往下循环了
                }
            }
            list.push(item_medical_history);
            if (!item_medical_history) return null;

            if (!item_medical_history_v2.hospital_id) {
                item_medical_history_v2.hospital_id = info.hospital_id;
            }

            // let patientDao = new Dao(ermdb, 'ip_patient_info');

            for (let i = 0; i < list.length; i++) {
                let item = list[i];//sheet 
                if (!item) continue;
                let data = item.data;//一个sheet的所有数据 集

                if (data && data.length > 1) {
                    let dao = new Dao(db, item.name);//item.name = 表名
                    let fields = data[0];//第一行 为 列名

                    result[item.name] = [];//保存 insert id

                    //当目标 表 是病史时 需要 额外 的处理(patientCode列)

                    for (let j = 1; j < data.length; j++) {
                        let tempObj = {};//insert 的对象 
                        var dataj = data[j];//一行数据
                        for (let k = 0; k < fields.length; k++) {//循环单行数据的列 
                            let field_name = fields[k];

                            if (dataj[k]) {
                                tempObj[field_name] = dataj[k];//将列数据 赋值到 insert 对象
                            }

                        }
                        if (item.name == 'ip_patient_info') {
                            logger.warn("目标表为患者表 不做导入处理...");
                            continue;
                        }
                        if (item.name == 'op_medical_history_info' || item.name == 'ip_medical_history_info') {
                            if (tempObj.patientCode) {
                                let patientInfo = utils.des({
                                    alg: 'des-ede3',    //3des-cbc  
                                    autoPad: true,
                                    key: tempObj.id.substring(0, 24),
                                    plaintext: tempObj.patientCode,
                                    iv: null
                                }).decrypt();

                                patientInfo = JSON.parse(patientInfo);
                                if (patientInfo.create_datetime) {
                                    patientInfo.create_datetime = new Date(patientInfo.create_datetime);
                                }
                                if (patientInfo.modify_datetime) {
                                    patientInfo.modify_datetime = new Date(patientInfo.modify_datetime);
                                }
                                if (patientInfo.birthdate) {
                                    patientInfo.birthdate = new Date(patientInfo.birthdate);
                                }

                                let patientDao = new Dao(db, 'ip_patient_info');
                                let patient = await patientDao.findById(patientInfo.id);

                                if (!patient) {//如果患者不存在 则 添加 
                                    await patientDao.insert(patientInfo);
                                    result['ip_patient_info'] = [];
                                    result['ip_patient_info'].push(patientInfo.id);
                                }

                                //判断 是否是 新配置的 数据 包，主要看是否 存在 患者医院 中间表
                                //如果 存在 说明 是 新配置不需要 做 调整
                                //如果 不存在 说明 是旧配置 需要  手动添加 患者医院 中间表
                                if (!ip_patient_hospital_rel_flag) {
                                    let ip_patient_hospital_rel_dao = new Dao(db, "ip_patient_hospital_rel");
                                    let ip_patient_hospital_rel_where = " patient_id = ? and hospital_id = ? ";
                                    let ip_patient_hospital_rel_params = [patientInfo.id, item_medical_history_v2.hospital_id];
                                    let ip_patient_hospital_rel_obj = await ip_patient_hospital_rel_dao.list(ip_patient_hospital_rel_where, ip_patient_hospital_rel_params);
                                    if (!ip_patient_hospital_rel_obj || ip_patient_hospital_rel_obj.length <= 0) {
                                        ip_patient_hospital_rel_obj = {
                                            id: utils.uuid().replace(/-/g, ""),
                                            patient_id: patientInfo.id,
                                            hospital_id: item_medical_history_v2.hospital_id,
                                            create_operator: item_medical_history_v2.hospital_id + "-import",
                                            create_datetime: new Date(),
                                            identity_no: patientInfo.identity_no,
                                            mobilphone: patientInfo.mobilphone,
                                            patient_name: patientInfo.patient_name,
                                            gender: patientInfo.gender,
                                            nationality: patientInfo.nationality,
                                            nation: patientInfo.nation,
                                            job: patientInfo.job,
                                            education: patientInfo.education,
                                            birthdate: patientInfo.birthdate,
                                            birthplace: patientInfo.birthplace,
                                            hkadr: patientInfo.hkadr,
                                            native_place: patientInfo.native_place,
                                            resource: patientInfo.resource,
                                            resource_id: patientInfo.resource_id,
                                            bs_flag: patientInfo.bs_flag
                                        }
                                        await ip_patient_hospital_rel_dao.insert(ip_patient_hospital_rel_obj);
                                    }
                                    if (!result["ip_patient_hospital_rel"]) {
                                        result["ip_patient_hospital_rel"] = [];
                                    }
                                    if (ip_patient_hospital_rel_obj instanceof Array) {
                                        for (let o = 0; o < ip_patient_hospital_rel_obj.length; o++) {
                                            result["ip_patient_hospital_rel"].push(ip_patient_hospital_rel_obj[o].id);
                                        }
                                    } else {
                                        result["ip_patient_hospital_rel"].push(ip_patient_hospital_rel_obj.id);
                                    }

                                }
                                tempObj.patient_id = patientInfo.id;
                            }
                            //目前只对 病史 表添加  有的表 没有 这个字段 
                            delete tempObj.patientCode;

                            // tempObj.hospital_id = info.hospital_id;//医院 id
                        } else if (item.name == 'ip_doc_in' || item.name == 'ip_doc_physical_exam') {
                            if (tempObj.exam_datetime) {
                                logger.error(`开具时间格式重置前:${tempObj.exam_datetime}`);
                                tempObj.exam_datetime = moment(new Date(tempObj.exam_datetime)).format('YYYY-MM-DD HH:mm:ss');
                                logger.error(`开具时间格式重置后:${tempObj.exam_datetime}`);
                            }
                        } else if (item.name == 'op_index_record') {
                            if (tempObj.out_call_datetime) {
                                logger.error(`出诊时间时间格式重置前:${tempObj.out_call_datetime}`);
                                tempObj.out_call_datetime = moment(new Date(tempObj.out_call_datetime)).format('YYYY-MM-DD HH:mm:ss');
                                logger.error(`出诊时间时间格式重置后:${tempObj.out_call_datetime}`);
                            }
                        }

                        tempObj.hospital_id = item_medical_history_v2.hospital_id;

                        if (item_medical_history_v2.patient_id) {
                            tempObj.patient_id = item_medical_history_v2.patient_id;
                        }


                        // if(item.name=='ip_medical_history_info'){
                        //     tempObj.resource = 'excelImport';
                        // }
                        let tempData = await dao.findById(tempObj.id);
                        result[item.name].push(tempObj.id);
                        if (tempData) continue;

                        try {
                            if (!tempObj.create_datetime) {
                                tempObj.create_datetime = new Date();
                            }
                            await dao.insert(tempObj);
                        } catch (err) {
                            logger.error(err);
                        } finally {

                        }

                    }
                    // console.log(saveList);
                }
            }
            return result;
        }
    },

    logList: async function (pageIndex, pageSize, query) {
        var q = {};

        if (query) {
            // q = { "info.hospital_id": { $regex: new RegExp(query.hospital_id) } };
            if (query.hospital_id) {
                q["info.hospital_id"] = Number.parseInt(query.hospital_id);
            }
            if (query.hospital_name) {
                q["info.hospital_name"] = { $regex: new RegExp(query.hospital_name) }
            }

        }
        var cols = { logIds: false };
        return await importLogDao.pageListByCols(pageIndex, pageSize, q, cols, { createTime: -1 });
    },
    reset: async function (id) {
        var data = await importLogDao.findById(id);
        var db;
        if (config.isMyDev) {
            db = new MysqlDB();
            db.debug = config.debug;
            db.connect(config.emr[data.info.db]);
        } else {
            data.info.database = data.info.db;
            db = await core.getDbV2(data.info);
        }
        // var db = new MysqlDB();
        // db.debug = config.debug;
        // db.connect(config.emr[data.info.db]);

        // data.info.database = data.info.db;
        // var db = await core.getDbV2(data.info);

        var name = "import_local_ids_log_" + data.info.hospital_id;
        var logsDao = new core.MongoDao(core.mongo, name);
        var count = await logsDao.count({ info_id: new ObjectID(id) });
        if (count > 0) {
            let page = 1;
            let pageSize = 200;
            let step = parseInt(count / pageSize) + 1;
            logger.error(`准备重置中：${data.info.hospital_id},step:${step}`);
            for (let i = 0; i < step; i++) {
                let logs = await logsDao.pageList(page, pageSize, { info_id: new ObjectID(id) });
                logger.error(`当前重置第${i}页`);
                if (logs && logs.items.length > 0) {
                    for (let j = 0; j < logs.items.length; j++) {
                        let item = logs.items[j].result;
                        for (const key in item) {
                            if (item.hasOwnProperty(key) && key != 'ip_patient_info') {//key == 表名
                                const element = item[key];//id array
                                if (element && element.length > 0) {
                                    await db.delete(key, { where: ' id in (?) ', params: [element] });
                                }
                            }
                        }
                        await logsDao.delete({ _id: new ObjectID(logs.items[j]._id) });
                    }
                }
            }
        }

        var existName = "import_local_exist_log_" + data.info.hospital_id;
        var existDao = new core.MongoDao(core.mongo, existName);
        await existDao.delete({ info_id: new ObjectID(id) });

        if (data.logIds && data.logIds.length > 0) {
            for (let i = 0; i < data.logIds.length; i++) {
                let item = data.logIds[i];
                for (const key in item) {
                    if (item.hasOwnProperty(key) && key != 'ip_patient_info') {//key == 表名
                        const element = item[key];//id array
                        if (element && element.length > 0) {
                            await db.delete(key, { where: ' id in (?) ', params: [element] });
                        }
                    }
                }
            }
        }

        // data.importMsg = '重置完成';
        data.resetFlag = true;
        await importLogDao.update(data);

    },
    restExportFile: async function (params) {


        var buff = fs.readFileSync(params.output_path + "/" + params.fileName);
        var keyOut = params.fileName;
        keyOut = keyOut.substring(keyOut.lastIndexOf(".") + 1, keyOut.length);
        keyOut = parseInt(keyOut, 16);
        // keyOut = keyOut.split("-");
        var keyBuff = buff.slice(0, keyOut);
        buff = buff.slice(keyOut, buff.length);
        var keyStr = keyBuff.toString();
        keyStr = utils.des({
            alg: 'des-ecb',
            autoPad: true,
            key: '1mdatanb',
            plaintext: keyStr,
            iv: null
        }).decrypt();
        var keyArray = keyStr.split(',');
        var keys = [];
        var outBuffs = [];
        var countLength = 0;
        for (let i = 0; i < keyArray.length; i++) {

            var tempBuff = null;

            // if(i==keyArray.length){
            //     tempBuff = buff.slice(countLength,buff.length-keyBuff.length);
            //     outBuffs[i] = tempBuff;
            //     break;
            // }

            var temp = keyArray[i].split('-');
            let temp1 = parseInt(temp[1]);
            keys[temp[0]] = temp1;

            if (i == 0) {
                tempBuff = buff.slice(0, temp1);
            } else {
                tempBuff = buff.slice(countLength, countLength + temp1);
            }
            countLength += temp1;

            outBuffs[temp[0]] = tempBuff;

        }

        var outBuff = Buffer.concat(outBuffs);
        return outBuff;

    },
    retry: async function (logId, upload_path) {
        let logEnt = await importLogDao.findById(logId);
        if (logEnt) {
            logEnt.upload_path = upload_path;
            logEnt.resetFlag = false;//重置 重置标记
            this.processZip(logEnt);
        }
    }

}

module.exports = importService