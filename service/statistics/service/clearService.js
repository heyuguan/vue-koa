var core = require('../../../models');
var config = require('../../../config');
var q_name = config.fix + 'clear_hospital';
var dbInfoDao = require('../dao/hospitalDbInfoDao');
var _ = require('lodash');

var s = {
    clearLogs: async function(id, pageIndex, pageSize, query) {
        var name = "hospital_clear_log_" + id;
        var logsDao = new core.MongoDao(core.mongo, name);
        var q = {};
        var pagelist = await logsDao.pageList(pageIndex, pageSize, q);
        return pagelist;
    },
    contains: function(finds,text){
        var flag = false;
        if(finds.length>0){
            for(var i =0 ;i < finds.length ;i++){
                var find = finds[i];
                if(find.indexOf(text) >-1){
                    flag = true;
                }
            }
            if(!flag){
                finds.push(text);
            }
        }else{
            finds.push(text);
        }
    },
    find: function(txt, regs, finds) {
        for (var i = 0; i < regs.length; i++) {
            var reg = new RegExp(regs[i], 'g');
            while (m = reg.exec(txt)) {
                if (m[1]&&m[1].indexOf("*") < 0 ) {
                    this.contains(finds,m[1].trim());
                }
            }
        }
    },
    repalce: function(txt, list, replace_to) {
        var after = txt;
        if (list.length > 0) {
            for (var i = 0; i < list.length; i++) {
                // var data = list[i];
                // if(list[i].indexOf("*") > -1){
                //     data = data.replace(_reg,"");    
                // }
                var item = new RegExp(list[i], 'g');
                after = after.replace(item, replace_to);
            }
        }
        return after;
    },
    execClear: async function(info_id, id) {
        var info = await dbInfoDao.findById(info_id);
        var db = await core.getDb(info.db);
        try {
            var json = eval(info.replaceConfig);
        } catch (error) {
            console.error(error);
        }

        for (var i = 0; i < json.length; i++) {
            var item = json[i];
            var find_sql = item.find_sql;
            find_sql = "medical_history_id=? and " + find_sql;
            var dao = new core.MysqlDao(db, item.table);
            var list = await dao.list(find_sql, [id]);
            var finds = [];
            //find
            for (var j = 0; j < list.length; j++) {
                var ent = list[j];
                var find_field = ent[item.find_field];
                if (!find_field) {
                    continue;
                }
                this.find(find_field, item.find_reg, finds);
            }
            console.log(finds);
            //repalce
            find_sql = "medical_history_id=? ";
            list = await dao.list(find_sql, [id]);

            if (finds.length > 0) {
                for (var j = 0; j < list.length; j++) {
                    var ent = list[j];
                    var old_value = ent[item.replace_field];
                    if (!old_value) {
                        continue;
                    }
                    var new_value = await this.repalce(old_value, finds, item.replace_to);

                    if (old_value != new_value) {
                        var doc = {};
                        doc[item.replace_field] = new_value;
                        doc["id"] = ent.id;
                        try {
                            await dao.update(doc);
                        } catch (error) {
                            console.error(error);
                        }

                        //保存操作日志
                        var name = "hospital_clear_log_" + info.hospital_id;
                        var logsDao = new core.MongoDao(core.mongo, name);
                        await logsDao.insert({
                            table_name: item.table,
                            data_id: list[j].id,
                            find_data: finds,
                            flag: "正则脱敏",
                            old_value: old_value,
                            new_value: new_value
                        });
                    }
                }
            }
            var mDao = new core.MysqlDao(db, 'ip_medical_history_info');
            var medicalhistoryInfo = await mDao.findById(id);
            var data = {};
            if (medicalhistoryInfo.bs_flag == 2) {
                data["bs_flag"] = 3;
                data["id"] = id;
            } else if (medicalhistoryInfo.bs_flag == -1) {
                data["bs_flag"] = 1;
                data["id"] = id;
            }
            try {
                await mDao.update(data);
            } catch (error) {
                console.log(data);
                console.log(medicalhistoryInfo.bs_flag);
                console.error(error);
            }
            console.log(id + ":脱敏成功");
        }
    },

    //  获取备份患者信息的数据库连接
    getInfoDb: async function() {
        if (!this.db_backup_patient) {
            this.db_backup_patient = new core.MysqlDB();
            this.db_backup_patient.debug = true;
            this.db_backup_patient.connect(config.uinfo);
        }
        return this.db_backup_patient;
    },

    execReplace: async function(info_id, mhi_id) {
        //core.logger.warn('===>>>2');
        var info = await dbInfoDao.findById(info_id);
        var db = await core.getDb(info.db);
        var info_db = await this.getInfoDb();
        //await core.getDb(info.db);
        //await this.getInfoDb();

        var emr_mhi_dao = new core.MysqlDao(db, 'ip_medical_history_info'); //emr1-16库 病史表 dao
        var emr_dr_dao = new core.MysqlDao(db, 'ip_doc_record'); //emr1-16库 文书表 dao
        var backup_pi_dao = new core.MysqlDao(info_db, 'ip_patient_info_md5_fxy_copy'); //备份患者信息库 患者表 dao?

        var data_mhi = await emr_mhi_dao.findById(mhi_id);
        var data_pi = await backup_pi_dao.findById(data_mhi.patient_id);

        if (!data_pi) {
            //core.logger.warn('===>>>2.1');
            return;
        }

        //var sensitive_data = [data_pi.patient_name, data_pi.identity_no, data_pi.mobilphone]; //抽取患者信息中的敏感信息
        var data_doc_list = await emr_dr_dao.list(' medical_history_id = ? ', [data_mhi.id]); //查出该次出院所有文书
        //core.logger.warn('===>>>3');
        for (var i = 0; i < data_doc_list.length; i++) {
            var query = data_doc_list[i];
            var update_doc_flag = false;
            var new_summary = query.summary;
            
            if (data_pi.patient_name) {
                try {
                    new_summary = new_summary.replace(new RegExp(data_pi.patient_name, "gm"), "****");
                    update_doc_flag = true;
                } catch (error) {
                    core.logger.error(error);
                }
            }

            var reg_identity_no = new RegExp("(\\d{18})|(\\d{17}(\\d|X|x))|(\\d{15})");
            var identity_no = reg_identity_no.exec(data_pi.identity_no);
            if (data_pi.identity_no && identity_no) {
                try {
                    new_summary = new_summary.replace(new RegExp(identity_no[0], "gm"), "****");
                    update_doc_flag = true;
                } catch (error) {
                    core.logger.error(error);
                }
            }

            var reg_mobile = new RegExp("(\\(\\d{3,4}\\)|\\d{3,4}-|\\s)?\\d{7,14}");
            var mobile = reg_mobile.exec(data_pi.mobilphone);
            if (data_pi.mobilphone && mobile) {
                try {
                    new_summary = new_summary.replace(new RegExp(mobile[0], "gm"), "****");
                    update_doc_flag = true;
                } catch (error) {
                    core.logger.error(error);
                }
            }

            // for (let index = 0; index < sensitive_data.length; index++) {
            //     if (sensitive_data[index] &&
            //         sensitive_data[index] !== "" &&
            //         query.summary.search(new RegExp(sensitive_data[index], "gm")) !== -1) {

            //         if (index === 1 && sensitive_data[index].match("[1-9]\\d{5}(18|19|([23]\\d))\\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\\d{3}[0-9Xx]") === null) {
            //             continue;
            //         } else if (index === 2 && sensitive_data[index].match("(\\(\\d{3,4}\\)|\\d{3,4}-|\s)?\\d{7,14}") === null) {
            //             continue;
            //         }

            //         new_summary = new_summary.replace(new RegExp(sensitive_data[index], "gm"), "****");

            //         update_doc_flag = true;
            //     }
            // }

            // 保存替换后的文书
            if (!update_doc_flag) {
                continue;
            }

            var doc = {};
            doc["summary"] = new_summary;
            doc["id"] = query.id;
            try {
                await emr_dr_dao.update(doc);
            } catch (error) {
                core.logger.error(error);
            }

            var log_table_name = "hospital_clear_log_" + info.hospital_id;
            var logsDao = new core.MongoDao(core.mongo, log_table_name);
            logsDao.insert({
                //table_name: item.table,
                table_name: 'ip_doc_record',
                data_id: query.id,
                flag: "replace脱敏",
                old_value: query.summary,
                new_value: new_summary
            });
        }

        var mDao = new core.MysqlDao(db, 'ip_medical_history_info'); //emr1-16库 病史表 dao
        var medicalhistoryInfo = await mDao.findById(mhi_id);
        var data = {};
        console.log(medicalhistoryInfo.bs_flag);
        if (medicalhistoryInfo.bs_flag == 1) {
            data["bs_flag"] = 3;
            data["id"] = mhi_id;
        } else {
            data["bs_flag"] = 2;
            data["id"] = mhi_id;
        }
        try {
            console.log(data);
            await mDao.update(data);
        } catch (error) {
            console.log(data);
            console.log(medicalhistoryInfo.bs_flag);
            console.error(error);
        }
        console.log("执行成功");
    },

    clearHospital: async function(id) {
        var info = await dbInfoDao.findById(id);
        var db = await core.getDb(info.db);
        var dao = new core.MysqlDao(db, 'ip_medical_history_info');
        var pageIndex = 1;
        var pageSize = 100;
        var mq = await this.queue();
        var last = '';
        var _index = 0;
        while (true) {
            var list = await dao.list("hospital_id = ? and bs_flag <> 1 and bs_flag <> 3 and id > ?", [info.hospital_id, last], pageSize, "id");
            for (var i = 0; i < list.length; i++) {
                core.logger.error("publish=====>"+_index++);
                var item = {
                    info_id: id,
                    db: info.db,
                    flag: 'clear',
                    data_id: list[i].id
                };

                await mq.publish(q_name, item);

                // var data_id = list.items[i].id;
                // await this.execClear(id, data_id);
            }
            if (list.length <= 0) {
                break;
            }
            last = list[list.length - 1].id;
        }

        //var total = await dao.pageList(pageIndex, pageSize, "hospital_id = ? and bs_flag <> 1 and bs_flag <> 3", [info.hospital_id], "id");
        //var pageCount = parseInt((total.total + pageSize - 1) / pageSize);
        //for (var page = 1; page <= pageCount; page++) {
        // }
    },

    replaceHospital: async function(id) {
        var info = await dbInfoDao.findById(id);
        var db = await core.getDb(info.db);
        var dao = new core.MysqlDao(db, 'ip_medical_history_info');
        var pageIndex = 1;
        var pageSize = 100;
        var mq = await this.queue();
        //var total = await dao.pageList(pageIndex, pageSize, "hospital_id = ? and bs_flag <> 2 and bs_flag <> 3", [info.hospital_id], "id");
        //var pageCount = parseInt((total.total + pageSize - 1) / pageSize);
        //for (var page = 1; page <= pageCount; page++) {
        var last = '';
        while (true) {
            var list = await dao.list("hospital_id = ? and bs_flag <> 2 and bs_flag <> 3 and id > ?", [info.hospital_id, last], pageSize, "id");

            for (var i = 0; i < list.length; i++) {
                var item = {
                    info_id: id,
                    db: info.db,
                    flag: 'replace',
                    data_id: list[i].id
                };
                await mq.publish(q_name, item);
                //await this.execReplace(id, list[i].id);
            }

            if (list.length <= 0) {
                break;
            }
            last = list[list.length - 1].id;
        }
    },

    queue: async function() {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    process: async function() {
        var q = await this.queue();
        var _this = this;

        await q.consumer(q_name, async function(data) {
            if (data.flag == 'clear') {
                await s.execClear(data.info_id, data.data_id);
            } else if (data.flag == 'replace') {
                core.logger.warn('===>>>1');
                await s.execReplace(data.info_id, data.data_id);;
            } else if (data.flag == 'restore') {
                core.logger.warn('===>>>restore');
                await s.execRestore(data.info_id, data.data_id);;
            }
        }, 1);

    },

    restoreHospital: async function(id) {
        var info = await dbInfoDao.findById(id);
        var db = await core.getDb(info.db);
        var dao = new core.MysqlDao(db, 'ip_medical_history_info');
        var pageIndex = 1;
        var pageSize = 100;
        var mq = await this.queue();
        var last = '';
        var _index = 0;
        while (true) {
            var list = await dao.list("hospital_id = ? and bs_flag <> -1 and bs_flag <> 1 and id > ?", [info.hospital_id, last], pageSize, "id");
            core.logger.warn('publish=======>' + list.length);
            for (var i = 0; i < list.length; i++) {
                var item = {
                    info_id: id,
                    db: info.db,
                    flag: 'restore',
                    data_id: list[i].id
                };
                core.logger.warn('publish=======>' + _index++);
                await mq.publish(q_name, item);
            }

            if (list.length <= 0) {
                break;
            }
            last = list[list.length - 1].id;
        }
    },

    execRestore: async function(info_id, mhi_id) {
        var info = await dbInfoDao.findById(info_id);
        var db = await core.getDb(info.db);
        var info_db = await this.getInfoDb();
        //await core.getDb(info.db);
        //await this.getInfoDb();

        var emr_mhi_dao = new core.MysqlDao(db, 'ip_medical_history_info'); //emr1-16库 病史表 dao
        var emr_dr_dao = new core.MysqlDao(db, 'ip_doc_record'); //emr1-16库 文书表 dao
        var backup_pi_dao = new core.MysqlDao(info_db, 'ip_patient_info_md5_fxy_copy'); //备份患者信息库 患者表 dao?

        var log_table_name = "hospital_clear_log_" + info.hospital_id;
        var logsDao = new core.MongoDao(core.mongo, log_table_name); //脱敏日志库 dao

        var data_mhi = await emr_mhi_dao.findById(mhi_id);
        var data_pi = await backup_pi_dao.findById(data_mhi.patient_id);

        if (!data_pi) {
            return;
        }


        var skip = true;
        if (data_pi.identity_no && !data_pi.identity_no.match("(\\d{18})|(\\d{17}(\\d|X|x))|(\\d{15})")) {
            skip = false;
        }

        if (data_pi.mobilphone && !data_pi.mobilphone.match("(\\(\\d{3,4}\\)|\\d{3,4}-|\\s)?\\d{7,14}")) {
            skip = false;
        }

        if (!skip) {
            var data_doc_list = await emr_dr_dao.list(' medical_history_id = ? ', [data_mhi.id]);
            for (var i = 0; i < data_doc_list.length; i++) {
                var query = data_doc_list[i];
                var log_info = await logsDao.find({ "data_id": query.id });
                if (!log_info) {
                    continue;
                }

                var doc = {};
                doc["summary"] = log_info.old_value;
                doc["id"] = query.id;
                try {
                    await emr_dr_dao.update(doc);
                } catch (error) {
                    core.logger.error("更新文书summary" + error);
                    core.logger.error(error);
                }
            }

            var data = {};
            data["bs_flag"] = -1;
            data["id"] = mhi_id;
            try {
                await emr_mhi_dao.update(data);
            } catch (error) {
                core.logger.error("更新medical_historybs_flag" + error);
                core.logger.error(error);
            }
        }

        // var sensitive_data = [data_pi.patient_name, data_pi.identity_no, data_pi.mobilphone]; //抽取患者信息中的敏感信息
        // var data_doc_list = await emr_dr_dao.list(' medical_history_id = ? ', [data_mhi.id]); //查出该次出院所有文书
        // core.logger.warn('===>>>3');
        // for (let index = 1; index < sensitive_data.length; index++) {
        //     if (sensitive_data[index] && sensitive_data[index] !== "") {
        //         if (index === 1 && sensitive_data[index].match("[1-9]\\d{5}(18|19|([23]\\d))\\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\\d{3}[0-9Xx]") !== null) {
        //             continue;
        //         } else if (index === 2 && sensitive_data[index].match("(\\(\\d{3,4}\\)|\\d{3,4}-|\s)?\\d{7,14}") !== null) {
        //             continue;
        //         }
        //         for (var i = 0; i < data_doc_list.length; i++) {
        //             var query = data_doc_list[i];
        //             var update_doc_flag = false;
        //             var new_summary = query.summary;
        //             //查脱敏日志记录
        //             var log_info = await logsDao.find({ "data_id": query.id });
        //             if (!log_info) {
        //                 continue;
        //             }
        //             //替换原来的文书内容
        //             update_doc_flag = true;
        //             new_summary = log_info.old_value;
        //             if (update_doc_flag) {
        //                 // 保存替换后的文书
        //                 core.logger.warn('===>>>4');
        //                 var doc = {};
        //                 doc["summary"] = new_summary;
        //                 doc["id"] = query.id;
        //                 try {
        //                     await emr_dr_dao.update(doc);
        //                 } catch (error) {
        //                     core.logger.error("更新文书summary" + error);
        //                     core.logger.error(error);
        //                 }
        //                 //删除脱敏log日志
        //                 //await logsDao.delete({ data_id: query.id});
        //             }
        //         }

        //         //还原脱敏执行状态
        //         var medicalhistoryInfo = await emr_mhi_dao.findById(mhi_id);
        //         var data = {};
        //         console.log(medicalhistoryInfo.bs_flag);
        //         data["bs_flag"] = -1;
        //         data["id"] = mhi_id;
        //         try {
        //             await emr_mhi_dao.update(data);
        //         } catch (error) {
        //             core.logger.error("更新medical_historybs_flag" + error);
        //             core.logger.error(error);
        //         }
        //     }
        // }
    }
};

module.exports = s;