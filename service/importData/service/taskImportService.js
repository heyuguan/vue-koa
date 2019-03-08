var config = require('../../../config');
var core = require('../../../models');
var q_name = config.fix + 'local_import';
var importService = require('./importService');
var importLogDao = require('../dao/importLogDao');
var taskPush = require('./taskPush');
var ObjectID = require("mongodb").ObjectID;

var taskImportService = {

    process: async function () {
        var q = await taskPush.queue();
        var _this = this;
        await q.consumer(q_name, async function (data) {
            let logEnt = null;
            let logEntId = data.logEntId;
           
            try{
                let db;
                if (config.isMyDev) {
                    db = await core.getDbV2({
                        connectionLimit: 10,
                        host: '192.168.9.223',
                        user: 'root',
                        password: '123456',
                        database: 'emdata_emr_loc_test'
                    });
                } else {
                    data.info.database = data.info.db;
                    db = await core.getDbV2(data.info);
                }
                
                let result = await importService.processData(data.path, db, data.info);

                var name = "import_local_ids_log_" + data.info.hospital_id;
                var logsDao = new core.MongoDao(core.mongo, name);

                if (result) { // 不存在 则记录入库的ids
                    let saveObj = {
                        result : result,
                        info_id : new ObjectID(logEntId),
                        id : core.utils.uuid(),
                        hospital_id: data.info.hospital_id,
                        create_time : new Date()
                    }

                    await logsDao.insert(saveObj);

                    // logEnt = await importLogDao.findById(logEntId);
                    // if(!logEnt.logIds){
                    //     logEnt.logIds = [];
                    // }
                    // logEnt.logIds.push(result);
                    // if(logEnt.history_info_num){
                    //     logEnt.history_info_num ++;
                    // }else{
                    //     logEnt.history_info_num = 1;
                    // }
                    // logEnt.errorList = logEnt.errorList || [];
                    // logEnt.importMsg = "正在导入,错误文件数:"+logEnt.errorList.length;
                    // await importLogDao.update(logEnt);       
                }
                else if(result === null){//如果目标已存在 记录 已存在
                    let existName = "import_local_exist_log_" + data.info.hospital_id;
                    let existDao = new core.MongoDao(core.mongo, existName);
                    let existParams = {
                        path : data.path,
                        hospital_id : data.info.hospital_id,
                        info_id : new ObjectID(logEntId)
                    };
                    let existObj = await existDao.find(existParams);
                    if(!existObj){
                        let saveObj = {
                            path : data.path,
                            info_id : new ObjectID(logEntId),
                            id : core.utils.uuid(),
                            hospital_id: data.info.hospital_id,
                            create_time : new Date()
                        }
                        await existDao.insert(saveObj);
                    }
                    // existNum = await existDao.count({info_id:new ObjectID(logEntId)});
                
                //     let params = { _id: new ObjectID(logEntId) };
                //     let options = {
                //         cols : { logIds: false }
                //     }
                //     logEnt = await importLogDao.find(params,options);

                //     if(!logEnt.not_export_num){
                //         logEnt.not_export_num = 0;
                //     }
                //     logEnt.not_export_num ++;//已存在病史未导入数
                //     if(logEnt.not_export_num>logEnt.history_info_count){
                //         logEnt.not_export_num = logEnt.history_info_count;
                //     }
                //     logEnt.importMsg = "正在导入,已存在病史数："+logEnt.not_export_num;
                // }

                // if(logEnt.history_info_num==logEnt.history_info_count 
                //     || (logEnt.not_export_num == logEnt.history_info_count) 
                //     || (logEnt.not_export_num+logEnt.history_info_num==logEnt.history_info_count)){
                //     logEnt.importMsg = "导入完成,已存在病史数："+logEnt.not_export_num;
                //     if(logEnt.errorList && logEnt.errorList.length>0){
                //         logEnt.importMsg += ",错误文件数:"+logEnt.errorList.length;
                //     }
                }

                // let logIdsCountParams = {info_id : new ObjectID(logEntId)};
                // let logIdsCount = await logsDao.count(logIdsCountParams);
                // if(logEnt.history_info_count == logIdsCount){
                //     logEnt.importMsg = "导入完成,已存在病史数："+logEnt.not_export_num;
                //     await importLogDao.update(logEnt);       
                // }
                
                       
                
            }catch(err){
                core.logger.error(err);
                core.logger.info(err);
                if(!logEnt){
                    let params = { _id: new ObjectID(logEntId) };
                    let options = {
                        cols : { logIds: false }
                    }
                    logEnt = await importLogDao.find(params,options);
                }
                if(!logEnt.errorList){
                    logEnt.errorList = [];
                }
                logEnt.errorList.push(data.path);
                await importLogDao.update(logEnt);
            }

        }, 2);
    }
}

module.exports = taskImportService