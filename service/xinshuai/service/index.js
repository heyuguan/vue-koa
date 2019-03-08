var configDao = require('../dao/configDao');
var lookForDao = require('../dao/lookForDao');
var dataDao = require('../dao/dataDao');
var statisticsService = require('../../statistics/service/statisticsService');
var MysqlDB = require('../../../models/mysql/MysqlDB');
var config = require('../../../config');
var logger = require('../../../models').logger;
var ObjectID = require("mongodb").ObjectID;
var moment = require('moment');
var core = require('../../../models');
var Dao = require("../../../models/mongo/MongoDao");
var db = require("../../../models").mongo;
var q_name = config.fix + 'build_xinshuai_data';
var q_name1 = config.fix + 'xinshuai_saveData';
var _ = require('lodash');
//var Queue = require('promise-queue-plus');
var hospitalDbService = require('../../hospitalDb/service/myService');

var s = {
    pageList: async function (pageIndex, pageSize, query) {
        var sort = {
            hospital_id: 1
        };
        var q = {};
        if (query.is_delete != undefined) {
            q.is_delete = query.is_delete;
        }

        if (query.name) {
            q.name = {
                $regex: new RegExp(query.name)
            };
        }

        return await configDao.pageList(pageIndex, pageSize, q, sort);
    },
    list: async function (query) {
        return await configDao.list(query);
    },
    add: async function (data) {
        await configDao.insert(data);
    },
    saveData: async function (data) {
        return await lookDataDao.insert(data);
    },
    findById: async function (id) {
        return await configDao.findById(id);
    },
    queue: async function () {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    process: async function () {
        var q = await this.queue();
        var _this = this;
        await q.consumer(q_name, async function (data) {
            if (data.type == 'async_2') {
                await _this.asyncDataItem(data);
            } else {
                core.logger.warn(data);
            }
        }, 2);
        await q.consumer(q_name1, async function (ent) {
            await _this.outDataItem(ent);
        }, 2);
    },
    find: async function (query) {
        return await configDao.find(query);
    },
    downLoad: async function (id) {
        var out = [];
        var query = {
            async_id: id,
            是否匹配: '是'
        };
        var total = await lookForDao.count(query);
        var pageCount = parseInt((total + 1000 - 1) / 1000);
        for (var page = 1; page <= pageCount; page++) {
            var list = await lookForDao.pageList(page, 1000, query);

            out = out.concat(list.items);

        }
        return out;
    },
    lookForList: async function (pageIndex, pageSize, query) {
        var sort = {
            _id: 1
        };
        var q = {};
        if (query.is_delete != undefined) {
            q.is_delete = query.is_delete;
        }

        if (query.admission_number) {
            q.住院号 = query.admission_number;
        }
        q.async_id = query._id;

        return await lookForDao.pageList(pageIndex, pageSize, q, sort);
    },
    update: async function (data) {
        await configDao.update(data);
    },
    asyncData: async function (data) { //提取数据，从sql库到mongo xinshuai_data库，
        //start out data
        data.out_date = null; //new Date();
        data.out_status = 1;
        var hospital_id = data.hospital_id + '';
        var db;
        if (data.hospital_db_id) {
            db = await hospitalDbService.getDb(data.hospital_db_id);
        } else {
            db = await core.getDb(data.db);
        }
        if (!db) {
            return;
        }

        await configDao.update({
            out_date: data.out_date,
            out_status: data.out_status
        }, {
                _id: data._id
            });

        var params = [data.hospital_id];
        var where = `select id,admission_number,register_number,ward_name,record_number,dept_name,out_datetime,in_datetime,patient_id,remark from ip_medical_history_info where hospital_id = ?`;
        if (data.deptNames && data.deptNames.length > 0) {
            var arr = data.deptNames.split(' ');
            where += ' and dept_name in (';
            for (var i in arr) {
                where += '?';
                if (i < arr.length - 1) {
                    where += ',';
                }
                params.push(arr[i]);
            }
            where += ' )';
        }
        if (data.deptNameLike) {
            where += ' and dept_name like ?';
            params.push('%' + data.deptNameLike + '%');
        }
        if (data.start_date) {
            where += ' and out_datetime >= ? ';
            params.push(data.start_date);
        }
        if (data.end_date) {
            where += ' and out_datetime < ? ';
            params.push(data.end_date);
        }

        //筛选患者 住院号-admission_number
        var result = await db.query(where, params);
        //   logger.info(JSON.stringify(result));
        var history_ids = [];
        if (data.history_ids) {
            history_ids = data.history_ids.split(' ');
        }

        data.out_count = 0;
        await dataDao.delete({
            async_id: data._id
        });

        var start_time = (new Date()).getTime();

        var _this = this;
        var working = 0;
        var mq = await this.queue();

        var list = result;
        if (history_ids.length > 0) {
            list = result.filter(function (item) {
                return history_ids.indexOf(item.admission_number) >= 0;
            });
        }
        logger.info("##-->>asyncData()-list.length:" + list.length);
        if (list && list.length > 0) {
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                item.task_index = i + 1;
                item.task_total = list.length;
                logger.warn(item.task_index + '-' + item.task_total);

                // if (history_ids.length > 0 && history_ids.indexOf(item.admission_number) <= -1) {
                //     continue;
                // } else {
                // }

                //await this.asyncDataItem(db, data, item);
                item.db = data.db;
                item.hospital_db_id = data.hospital_db_id;
                item.hospital_id = hospital_id;
                item.task_id = data._id;
                //item.diagnosis_from=data.diagnosis_from;
                item.type = 'async_2';
                await mq.publish(q_name, item);
            }
        } else {
            data.out_status = 0;
            await configDao.update({
                out_date: data.out_date,
                out_status: data.out_status,
                out_count: 0
            }, {
                    _id: data._id
                });
        }
        // core.logger.warn('=== time ===');
        // core.logger.warn((new Date()).getTime() - start_time);

        // end out data
        // await configDao.update({ out_count: result.length + 1, out_date: new Date(), out_status: 0 }, { _id: data._id });
        // logger.warn(data.name + " >> 提取数据条数:" + data.out_count);
    },
    asyncDataItem: async function (data) {
        var hospital_id = data.hospital_id;

        // var dbInfo = await statisticsService.dbInfoByHostptial(data.hospital_id, data.db);
        // if (!dbInfo) {
        //     logger.warn("dbInfo is null");
        //     return;
        // }
        logger.info("=======>");
        logger.info(data);
        var db;
        if (data.hospital_db_id) {
            db = await hospitalDbService.getDb(data.hospital_db_id);
        } else {
            db = await core.getDb(data.db);
        }

        var item = Object.assign({}, data);
        //var hospital_id = data.hospital_id + '';
        //item.hospital_id = hospital_id;
        item.async_id = new ObjectID(data.task_id);

        //首页信息 离院方式是out_model
        item.ip_index_record = await db.query('select out_type from ip_index_record where medical_history_id = ?', [item.id]);

        //筛选首页诊断
        //特定的医院，安康医院逻辑 患者诊断 代替 首页诊断   
        if (hospital_id == "700" || hospital_id == "216" || hospital_id == "763") {
            logger.info("==========>安康医院逻辑提取");
            item.ip_index_diagnosis = await db.query('select out_diagnosis,in_diagnosis from ip_patient_diagnosis where medical_history_id = ?', [item.id]);
        } else {
            //病案首页的诊断
            item.ip_index_diagnosis = await db.query('select diagnosis_code,sort,icd_name,diagnosis_type,diagnosis_content,diagnosis_desc from ip_index_diagnosis where medical_history_id = ? order by sort', [item.id]);
        }


        item.ip_order_out = await db.query('select order_name from ip_order_out where medical_history_id = ?', [item.id]);
        //文书出院out_diagnosis和入院诊断in_diagnosis  筛选出院诊断
        //item.ip_patient_diagnosis = await db.query('select out_diagnosis from ip_patient_diagnosis where medical_history_id = ?', [item.id]);

        //ip_doc_record
        var ip_doc_record = await db.query("select title,summary from `ip_doc_record` where  medical_history_id = ?", [item.id]);
        item.ip_doc_record = [];
        for (var i in ip_doc_record) {
            var record = ip_doc_record[i];
            // if (record.title && (record.title.indexOf('出院记录') > -1 || record.title.indexOf('出院小结') > -1)) {
            //     item.ip_doc_record.push(record);
            // }
            if (record.title) {
                item.ip_doc_record.push(record);
            }
        }
        //item.ip_doc_record
        //title like '%出院记录%' or  title like '%出院小结%'  and
        //筛选医嘱 从order_name判断用药
        var order_info = [];
        order_info = order_info.concat(await db.query('select order_name,order_flag,medical_chemical_name from ip_order_info where medical_history_id = ?', [item.id]));
        order_info = order_info.concat(await db.query('select order_name,order_flag,medical_chemical_name from ip_order_short where medical_history_id = ?', [item.id]));
        order_info = order_info.concat(await db.query('select order_name,order_flag,medical_chemical_name from ip_order_long where medical_history_id = ?', [item.id]));
        item.ip_order_info = order_info;

        //筛选检查 exam_desc提示和exam_result结论
        item.ip_exam_info = await db.query('select id,exam_item,exam_result,exam_type,exam_desc from ip_exam_info where medical_history_id = ?', [item.id]);
        for (var j in item.ip_exam_info) {
            var ef_per = await db.queryOne('select ef_per from ip_exam_ucg_result where exam_id = ?', [item.ip_exam_info[j].id]);
            if (ef_per) {
                item.ip_exam_info[j].ef_per = ef_per.ef_per;
            } else {
                item.ip_exam_info[j].ef_per = null;
            }
        }

        var sql = `
            SELECT
                t2.lab_item AS '小项名称',
                t1.lab_name AS '检验大项'
            FROM ip_lab_main_info t1
            LEFT JOIN ip_lab_detail_info t2 ON t2.lab_main_id = t1.id
            WHERE t1.medical_history_id= ?
            `;
        item.ip_lab_main_info = await db.query(sql, [item.id]);

        var sql2 = `
                select in_datetime,dept_name 
                from ip_medical_history_info 
                where  patient_id = ? and  hospital_id = ? and in_datetime > ? and in_datetime <= ?
            `;

        var params2 = [item.patient_id];
        params2.push(hospital_id);
        params2.push(moment(item.out_datetime).format('YYYY-MM-DD HH:mm:ss'));
        params2.push(moment(item.out_datetime).add(30, 'days').format('YYYY-MM-DD HH:mm:ss'));
        item.again_info = await db.query(sql2, params2);

        await dataDao.insert(item);
        core.logger.warn(data.task_index);
        core.logger.warn(data.task_total);
        if (data.task_index >= data.task_total) {
            await configDao.update({
                out_count: data.task_total,
                out_date: new Date(),
                out_status: 0
            }, {
                    _id: new ObjectID(data.task_id)
                });
            core.logger.warn("end task ==>" + data.task_id + ' with count:' + data.task_total);
        }
    },
    checkBNP: function (data) {
        //从检查获取
        var reg = /脑自然肽N端前体蛋白|B型促尿([纳|钠])排泄缩氨酸|B型([纳|钠])(酸|尿)肽|BNP|脑(尿)?([纳|钠])肽|利([纳|钠])肽前体|B型利([纳|钠])肽/i;
        if (data.ip_lab_main_info) {
            var ip_lab_main_info = data.ip_lab_main_info.filter(function (item) {
                return reg.test(item.小项名称);
            })


            if (ip_lab_main_info && ip_lab_main_info.length > 0) {
                return "有";
            }
        };
        //从用药获取
        var reg2 = /脑自然肽N端前体蛋白|B型促尿([纳|钠])排泄缩氨酸|B型([纳|钠])(酸|尿)肽|BNP|脑(尿)?([纳|钠])肽|利([纳|钠])肽前体|B型利([纳|钠])肽|心肌标志物/i;
        var order_info = data.ip_order_info.filter(function (item) {
            return reg2.test(item.order_name);
        });
        if (order_info && order_info.length > 0) {
            return "有";
        };

        //从病史的remark字段获取
        var history_remark = data.remark;
        var remark_info = [];
        if (history_remark && history_remark.indexOf('type')>-1) {
            var remark_arr = JSON.parse(history_remark);
            if(remark_arr && remark_arr.length>0){
                remark_info = remark_arr.filter(function (item) {
                    return item.type == 'BNP' && item.value;
                });
            }
        }
        return (remark_info && remark_info.length > 0) ? "有" : "无";
    },
    checkIsFangchanAnKang: function (data) { //安康  患者诊断  代替   首页诊断
        var reg = /心房颤动|心房纤颤|房颤/;
        return reg.test(data.out_diagnosis);
    },
    checkIsFangchan: function (data) {
        var out_diagnosis = data.out_diagnosis.map(e => e.diagnosis_content || e.icd_name || e.diagnosis_desc).join(',');
        var reg = /心房颤动|心房纤颤|房颤/;
        return reg.test(out_diagnosis);
    },
    checkIsFangpuAnKang: function (data) {
        var reg = /房扑/;
        return reg.test(data.out_diagnosis);
    },
    checkIsFangpu: function (data) {
        var out_diagnosis = data.out_diagnosis.map(e => e.diagnosis_content || e.icd_name || e.diagnosis_desc).join(',');
        var reg = /房扑/;
        return reg.test(out_diagnosis);
    },
    checkIsXinshuaiAnKang: function (data) {
        var result = false;
        var acute = false;
        //扩张.{0,1}心肌病|缺血.{0,1}心肌病
        var reg = /心衰|心力衰竭|心功能衰竭|心功能不全|心功能衰竭|扩张.{0,1}心肌病|缺血.{0,1}心肌病/;

        var diagnosis_content = data.ip_index_diagnosis;
        if (!diagnosis_content) {
            var result = {
                result: result,
                acute: acute ? '是' : '否'
            };

            return result;
        }

        // diagnosis_content = diagnosis_content.replace(/,/g, '\n').replace(/;/g, '\n');

        var content = reg.test(diagnosis_content);
        acute = acute || diagnosis_content.indexOf('心源性休克') > -1;
        if (content) {
            acute = acute || diagnosis_content.indexOf('急') > -1;
        }
        result = result || content;

        //killip and nyha
        var exp = /心功能(.{1,7})(级|期|Killip)|NYHA(.{1,7}[^分])级|(killip|Kiilip|Kiliip|KillP|Kiliips)(.{0,7}[^分])级/i;
        var m = diagnosis_content.match(exp);
        if (m) {
            var level_str = m[0];
            var killip = /killip|Kiilip|Kiliip|KillP|Kiliips/i.test(level_str);
            var level = false;
            if (killip) {
                level_str = level_str.replace(/Kiliip|Kiliips|Kiilip/, 'killip');
                level = /Ⅱ|II|Ⅲ|III|Ⅳ|IV|2|3|4/i.test(level_str);
                acute = acute || level;
            } else {
                level = /Ⅲ|III|Ⅳ|IV|3|4/i.test(level_str);
            }
            if (level) {
                //logger.warn('math by level:' + data.admission_number + ' ' + m[0]);
            }
            result = result || level;
        }


        var result = {
            result: result,
            acute: acute ? '是' : '否'
        };

        return result;
    },
    checkIsXinshuai: function (data) {
        var result = false;
        var acute = false;
        //扩张.{0,1}心肌病|缺血.{0,1}心肌病
        var reg = /心衰|心力衰竭|心功能衰竭|心功能不全|心功能衰竭|扩张.{0,1}心肌病|缺血.{0,1}心肌病/;
        for (var i in data.out_diagnosis) {
            var item = data.out_diagnosis[i];

            //icd code
            // var code = item.diagnosis_code && (item.diagnosis_code.indexOf('I50.') > -1 ||
            //     item.diagnosis_code.indexOf('I11.0') > -1 ||
            //     item.diagnosis_code.indexOf('I13.0') > -1 ||
            //     item.diagnosis_code.indexOf('I13.2') > -1
            // );
            // result = result || code;

            var name = reg.test(item.icd_name);
            result = result || name;

            //diagnosis
            // var diagnosis_content = item.diagnosis_content + ',' + item.icd_name + ',' + item.diagnosis_desc;
            if (!item.diagnosis_content) {
                item.diagnosis_content = "";
            }
            var diagnosis_content = item.diagnosis_content.replace(/,/g, '\n').replace(/;/g, '\n');
            for (var i = 0; i < 2; i++) {
                if (i == 1 && result == false && item.diagnosis_desc) {

                    diagnosis_content = item.diagnosis_desc.replace(/,/g, '\n').replace(/;/g, '\n');

                }
                //diagnosis

                var content = reg.test(diagnosis_content);
                acute = acute || diagnosis_content.indexOf('心源性休克') > -1;
                if (content) {
                    acute = acute || diagnosis_content.indexOf('急') > -1;
                }
                result = result || content;

                //killip and nyha
                var exp = /心功能(.{1,7})(级|期|Killip)|(纽约|NYHA)(.{1,7}[^分])级|(killip|Kiilip|Kiliip|KillP|Kiliips)(.{0,7}[^分])级|泵功能(.{0,7}[^分])级/i;
                var m = diagnosis_content.match(exp);
                if (m) {
                    var level_str = m[0];
                    var killip = /killip|Kiilip|Kiliip|KillP|Kiliips/i.test(level_str);
                    var level = false;
                    if (killip) {
                        level_str = level_str.replace(/Kiliip|Kiliips|Kiilip/, 'killip');
                        level = /Ⅱ|II|Ⅲ|III|Ⅳ|IV|2|3|4/i.test(level_str);
                        acute = acute || level;
                    } else {
                        level = /Ⅲ|III|Ⅳ|IV|3|4/i.test(level_str);
                    }
                    if (level) {
                        //logger.warn('math by level:' + data.admission_number + ' ' + m[0]);
                    }
                    result = result || level;
                }
            }


        }

        var result = {
            result: result,
            acute: acute ? '是' : '否'
        };

        return result;
    },
    // 中山附一临时使用逻辑：判断心衰（20180305）
    checkIsXinshuaiZhongShanFuYi: function (data) {
        var result = false;
        var acute = false;
        //扩张.{0,1}心肌病|缺血.{0,1}心肌病
        var reg = /心衰|心力衰竭|心功能衰竭|心功能不全|心功能衰竭|扩张.{0,1}心肌病|缺血.{0,1}心肌病|肥厚.{0,1}心肌病|限制.{0,1}心肌病|致密化不全|淀粉样变/;
        for (var i in data.out_diagnosis) {
            var item = data.out_diagnosis[i];

            //icd code
            // var code = item.diagnosis_code && (item.diagnosis_code.indexOf('I50.') > -1 ||
            //     item.diagnosis_code.indexOf('I11.0') > -1 ||
            //     item.diagnosis_code.indexOf('I13.0') > -1 ||
            //     item.diagnosis_code.indexOf('I13.2') > -1
            // );
            // result = result || code;

            var name = reg.test(item.icd_name);
            result = result || name;
            // var diagnosis_content = item.diagnosis_content + ',' + item.icd_name + ',' + item.diagnosis_desc;
            diagnosis_content = diagnosis_content.replace(/,/g, '\n').replace(/;/g, '\n');
            for (var i = 0; i < 2; i++) {
                if (i == 1 && result == false && item.diagnosis_desc) {
                    diagnosis_content = item.diagnosis_desc.replace(/,/g, '\n').replace(/;/g, '\n');

                }
                //diagnosis

                var content = reg.test(diagnosis_content);
                acute = acute || diagnosis_content.indexOf('心源性休克') > -1;
                if (content) {
                    acute = acute || diagnosis_content.indexOf('急') > -1;
                }
                result = result || content;

                //killip and nyha
                var exp = /心功能(.{1,7})(级|期|Killip)|(纽约|NYHA)(.{1,7}[^分])级|(killip|Kiilip|Kiliip|KillP|Kiliips)(.{0,7}[^分])级|泵功能(.{0,7}[^分])级/i;
                var m = diagnosis_content.match(exp);
                if (m) {
                    var level_str = m[0];
                    var killip = /killip|Kiilip|Kiliip|KillP|Kiliips/i.test(level_str);
                    var level = false;
                    if (killip) {
                        level_str = level_str.replace(/Kiliip|Kiliips|Kiilip/, 'killip');
                        level = /Ⅱ|II|Ⅲ|III|Ⅳ|IV|2|3|4/i.test(level_str);
                        acute = acute || level;
                    } else {
                        level = /Ⅲ|III|Ⅳ|IV|3|4/i.test(level_str);
                    }
                    if (level) {
                        //logger.warn('math by level:' + data.admission_number + ' ' + m[0]);
                    }
                    result = result || level;
                }
            }
        }

        var result = {
            result: result,
            acute: acute ? '是' : '否'
        };

        return result;
    },
    regEF: function (input) {
        //logger.warn("try ef:" + input);
        if (!input) {
            return null;
        }

        var exp = /(EF|射血分数)(.){0,10}?([0-9]+([.]{1}[0-9]+){0,1})(%)?/g;
        var m = input.match(exp);
        // if (m && m.indexOf('EFA')==-1) {//排除NEFA的情况
        if(m){    
            var s = m[0];
            var exp2 = /([0-9]+([.]{1}[0-9]+){0,1})/;
            // var ef = s.match(exp2);
            var ef = [];
            for(var i=0;i<m.length;i++){
                var item = m[i];
                if(item.indexOf('EFA')==-1){
                    var ef_value = item.match(exp2);
                    var _ef_value = ef_value[0]*1;
                    if(_ef_value && _ef_value>0 && _ef_value<100){
                        ef.push(_ef_value);
                    }
                }
            }

            if(ef && ef.length>0){
                //获取数组中的最小值
                var min_ef = Math.min.apply(null, ef);
                return min_ef;
            }
        }

        if (/射血分数正常/.test(input)) {
            return '正常';
        }
        return null;
    },
    getEfValue: function (exam_reg, ent) {

        var ef_exam = false;
        //try get from exam_desc
        for (var i in ent.ip_exam_info) {
            var item = ent.ip_exam_info[i];

            if (item.ef_per) {
                var ef = item.ef_per;
                if (item.ef_per.indexOf('null') > -1) {
                    ef = item.ef_per.replace(/null/g, '');
                    ef = ef.replace(/;/g, '');
                    ef = parseFloat(ef) * 100;
                }

                if (ef) {
                    ent.ip_exam_info[i].ef_per = ef;
                    ent.ip_exam_info[i].ef_source = '检查值';
                    continue;
                }
            }
            item.exam_desc += item.exam_result;
            //todo
            var test = (exam_reg.test(item.exam_item)) || (/超声|心脏彩超/.test(item.exam_item) && /心脏|主动脉/.test(item.exam_desc));
            if (!test) {
                continue;
            }

            ef_exam = true;
            var ef = this.regEF(item.exam_desc);
            if (ef) {
                ent.ip_exam_info[i].ef_per = ef;
                ent.ip_exam_info[i].ef_source = item.exam_item;
            }
        }

        var list = ent.ip_exam_info.filter(function (item) {
            return item.ef_per
        });


        if (list.length <= 0) {
            //try get from ip_doc_record
            for (var i in ent.ip_doc_record) {
                var item = ent.ip_doc_record[i];
                var ef = this.regEF(item.summary);
                if (ef && ef<100) {
                    list.push({
                        ef_per: ef,
                        ef_source: '文书记录'
                    });
                }
            }

            //其他解析的EF
            // if (ent.remark) {
            //     try {
            //         var json = JSON.parse(ent.remark);
            //         for (var i in json) {
            //             list.push({
            //                 ef_per: json[i].value,
            //                 ef_source: json[i].source == '其他' ? json[i].title : json[i].source
            //             });
            //         }
            //         //logger.warn(list);
            //     } catch (e) {
            //         logger.error(e);
            //     }
            // }
        }

        var min = {
            ef_per: null,
            ef_source: '',
            ef_exam: ef_exam
        };
        for (var i in list) {
            var ef_per = list[i].ef_per;
            var ef_source = list[i].ef_source;
            if (ef_per == '正常') {
                min.ef_per = ef_per;
                min.ef_source = ef_source;
                min.ef_exam = true;
                break;
            } else if (parseFloat(ef_per)) {
                min.ef_exam = true;
                ef_per = parseFloat(ef_per);
                ef_per = ef_per.toFixed(2);
                if (!min.ef_per || ef_per < min.ef_per) {
                    min.ef_per = ef_per;
                    min.ef_source = ef_source;
                }
            } else {
                logger.error("ef value error:" + ef_per);
            }
        }
        return min;
    },
    unique: function (array) {
        var r = [];
        for (var i = 0, l = array.length; i < l; i++) {
            for (var j = i + 1; j < l; j++)
                if (array[i] === array[j]) j = ++i;
            r.push(array[i]);
        }
        return r;
    },
    getOrderNames: function (ent, reg, reg_not) {
        // if (ent.hospital_id && ent.hospital_id == '120') {
        //     ent.ip_order_out = ent.ip_order_out || [];
        //     var arr2 = this.unique(ent.ip_order_out.filter(
        //         function(item) {
        //             return reg.test(item.order_name);
        //         }).map(e => e.order_name));
        //     return arr2.join(',');
        // }else if(ent.hospital_id && ent.hospital_id == '136'){//136  临时  长期，出院带药
        //     var arr1 = this.unique(ent.ip_order_info.filter( //长期，临时
        //         function(item) {
        //             return reg.test(item.order_name);
        //         }).map(e => e.order_name));


        //         ent.ip_order_out = ent.ip_order_out || [];
        //         var arr2 = this.unique(ent.ip_order_out.filter(  //出院带药
        //             function(item) {
        //                 return reg.test(item.order_name);
        //             }).map(e => e.order_name));
        //             arr1.push(arr2);
        //     return arr1.join(',');
        // } else {
        //     var arr1 = this.unique(ent.ip_order_info.filter(
        //         function(item) {
        //             return reg.test(item.order_name);
        //         }).map(e => e.order_name));
        //     return arr1.join(',');
        // }
        var arr1 = this.unique(ent.ip_order_info.filter( //长期，临时
            function (item) {
                if(reg_not){
                    return reg.test(item.order_name) && !reg_not.test(item.order_name) && item.order_name.indexOf('停') < 0 && item.order_name.indexOf('退') < 0;
                }
                return reg.test(item.order_name) && item.order_name.indexOf('停') < 0 && item.order_name.indexOf('退') < 0;
            }).map(e => e.order_name));


        ent.ip_order_out = ent.ip_order_out || [];
        var arr2 = this.unique(ent.ip_order_out.filter( //出院带药
            function (item) {
                if(reg_not){
                    return reg.test(item.order_name) && !reg_not.test(item.order_name);
                }
                return reg.test(item.order_name);
            }).map(e => e.order_name));

        var arr3 = arr1.concat(arr2);

        //去重，去最后逗号
        var result = _.uniq(arr3).join(',');
        if (result.charAt(result.length - 1) == ',') {
            result = result.substring(0, result.length - 1);
        }
        return result;
    },

    //分级
    level: function (ent) {
        var levelObjList = [];
        var hospitalName = ent.hospitalName;
        var in_diagnosis, out_diagnosis;
        //急性心肌梗死的正则
        var heartExp = /急性.{0,12}(心肌梗死|心肌梗塞|心梗|心肌梗)/g;
        if (hospitalName && (hospitalName == '安康市中心医院' || hospitalName == "徐州医学院附属医院" || hospitalName == "上海中医药大学附属曙光医院")) {
            //注意诊断是字符串
            in_diagnosis = ent.in_diagnosis; //病案首页的入院诊断
            out_diagnosis = ent.out_diagnosis; //病案首页的出院诊断
            //判断各种诊断里是否有心肌梗死
            var isHeart = false;
            var heartMatch_out, heartMatch_in;
            if (in_diagnosis) {
                heartMatch_out = in_diagnosis.match(heartExp);
            }
            if (out_diagnosis) {
                heartMatch_in = out_diagnosis.match(heartExp);
            }
            if ((heartMatch_out && heartMatch_out.length > 0) || (heartMatch_in && heartMatch_in.length > 0)) {
                isHeart = true;
            }

            //对医院的诊断进行规范解析
            if (hospitalName && hospitalName == '安康市中心医院') {
                if (out_diagnosis) {
                    out_diagnosis = out_diagnosis.replace(';', ' ');
                    out_diagnosis = out_diagnosis.replace('；', ' ');
                    out_diagnosis = out_diagnosis.replace(/[1-9]\d*(\.|、)/g, '##');
                    out_diagnosis = out_diagnosis.split('##');
                }
            }

            if (hospitalName && hospitalName == '徐州医学院附属医院') {
                if (out_diagnosis) {
                    //1. 1、
                    out_diagnosis = out_diagnosis.replace(/[1-9]\d*(\.|、)/g, '##');
                    //(1). (1)、
                    out_diagnosis = out_diagnosis.replace(/\([1-9]\)\d*(\.|、)/g, ' ');
                    out_diagnosis = out_diagnosis.split('##');
                }
            }

            if (hospitalName && hospitalName == '上海中医药大学附属曙光医院') {
                if (out_diagnosis) {
                    out_diagnosis = out_diagnosis.replace('西医诊断', ' ');
                    out_diagnosis = out_diagnosis.replace('中医诊断', '##');
                    out_diagnosis = out_diagnosis.replace(/[1-9]\d*(\.|、)/g, '##');
                    out_diagnosis = out_diagnosis.replace(',', '##');
                    out_diagnosis = out_diagnosis.split('##');
                }
            }

            levelObjList = this.dealDiagnose(out_diagnosis, isHeart);

        } else {
            //注意诊断是数组
            in_diagnosis = ent.in_diagnosis; //病案首页的入院诊断
            out_diagnosis = ent.out_diagnosis; //病案首页的出院诊断

            var out_diagnose_str = ent.out_diagnosis.map(e => e.diagnosis_content + '(' + e.diagnosis_desc + ')' || e.icd_name || e.diagnosis_desc).join(',');
            out_diagnose_str = out_diagnose_str.replace(/\([1-9]\)\d*/g, ',');
            var out_diagnose_arr = out_diagnose_str.split(',');
            var in_diagnose_str = ent.in_diagnosis.map(e => e.diagnosis_content + '(' + e.diagnosis_desc + ')' || e.icd_name || e.diagnosis_desc).join(',');
            var in_diagnose_arr = in_diagnose_str.split(',');

            //判断各种诊断里是否有心肌梗死
            var heartMatch_out, heartMatch_in;
            if (out_diagnose_str) {
                heartMatch_out = out_diagnose_str.match(heartExp);
            }
            if (in_diagnose_str) {
                heartMatch_in = in_diagnose_str.match(heartExp);
            }

            var isHeart = false;
            if ((heartMatch_out && heartMatch_out.length > 0) || (heartMatch_in && heartMatch_in.length > 0)) {
                isHeart = true;
            }

            levelObjList = this.dealDiagnose(out_diagnose_arr, isHeart);
        }

        var nyhaLevel_arr = [];
        var killipLevel_arr = [];
        var levelObj = {};
        if (levelObjList && levelObjList.length > 0) {
            for (var m = 0; m < levelObjList.length; m++) {
                var levelLast = levelObjList[m].levelLast;
                var isNYHA = levelObjList[m].isNYHA;
                var isKillip = levelObjList[m].isKillip;
                if (isNYHA) {
                    nyhaLevel_arr.push(levelLast);
                } else if (isKillip) {
                    killipLevel_arr.push(levelLast);
                }
            }
        }


        if (nyhaLevel_arr && nyhaLevel_arr.length > 0) {
            nyhaLevel = Math.max.apply(null, nyhaLevel_arr);
            levelObj.nyhaLevel = this.standerLevel(nyhaLevel);
        }

        if (killipLevel_arr && killipLevel_arr.length > 0) {
            killipLevel = Math.max.apply(null, killipLevel_arr);
            levelObj.killipLevel = this.standerLevel(killipLevel);
        }

        return levelObj;
    },


    dealDiagnose: function (out_diagnose_arr, isHeart) {

        console.log("dealDiagnose start");
        //匹配分级的正则
        var exp = /心功能(.{1,7})(级|期|Killip)|心功能不全(.{1,7})(级|期|Killip)|NYHA|nyha|纽约(.{1,7}|[^分])级|(killip|Kiilip|Kiliip|KillP|Kiliips|Ｋｉｌｌｉｐ|KILLIP|Killip)|(.{0,7}|[^分])级|泵功能(.{0,7}|[^分])级/ig;
        //级别的正则
        var levelExp = /IV|Ⅳ|III|Ⅲ|iii|ⅲ|II|Ⅱ|ii|ⅱ|Ⅰ|I|i|1|2|3|4|１|２|３|４/ig;
        //killip的正则
        var killipExp = /killip|Kiilip|Kiliip|KillP|Kiliips|Ｋｉｌｌｉｐ/ig;
        //nyha的正则
        var nyhaExp = /NYHA|NHYA/ig;

        var levelObjList = [];
        //每个诊断分别判断，有同时存在两种诊断级别的情况
        if (out_diagnose_arr && out_diagnose_arr.length > 0) {
            for (var i = 0; i < out_diagnose_arr.length; i++) {
                var out_dia = out_diagnose_arr[i];

                var levelObj = {};
                var m = out_dia.match(exp)
                var mStr = '';
                if (m) {
                    for (var j = 0; j < m.length; j++) {
                        mStr = mStr + ' ' + m[j];
                    }
                }

                // mStr = mStr.toUpperCase();
                var levelLast;
                var isNYHA = false;
                var isKillip = false;
                if (mStr) {
                    var level = mStr.match(levelExp);
                    //Ⅱ-Ⅲ  取后者较大的值
                    if (level) {
                        var max_level = this.maxLevel(level);
                        //比较获取最大值
                        levelLast = max_level;
                    }

                    if (mStr.match(killipExp)) {
                        mStr = mStr.replace(killipExp, '');
                        level = mStr.match(levelExp);
                        if (level) {
                            levelLast = this.maxLevel(level);
                        }
                        isKillip = true;
                    } else if (mStr.match(nyhaExp) && level) {
                        isNYHA = true;
                    } else if (mStr.indexOf('心功能') != -1 && level && !isHeart) { //诊断中只有心功能分级，没有带NYHA，这种情况需要再判断患者“首页诊断表”中的“入院诊断”，若入院诊断无急性心梗，则为NYHA分级；如果无“入院诊断”，再从“首页诊断表”中的“出院诊断”判断。
                        isNYHA = true;
                    } else if (mStr.indexOf('心功能') != -1 && level && isHeart) {
                        isKillip = true;
                    }

                }

                if (levelLast && (isNYHA || isKillip)) {
                    levelObj.levelLast = levelLast;
                    //将分级格式化
                    levelObj.isNYHA = isNYHA;
                    levelObj.isKillip = isKillip;
                    levelObjList.push(levelObj);
                }

            }
        }
        console.log("dealDiagnose end");
        return levelObjList;
    },

    //分级转化
    standerLevel: function (levelLast) {
        var oneExp = /Ⅰ|I|i|1|１/ig;
        var twoExp = /II|Ⅱ|ii|ⅱ|2|２/ig;
        var threeExp = /III|Ⅲ|iii|ⅲ|3|３/ig;
        var foreExp = /IV|Ⅳ|4|４/ig;
        levelLast = levelLast + '';
        if (levelLast.match(foreExp)) {
            levelLast = 'Ⅳ';
        } else if (levelLast.match(threeExp)) {
            levelLast = 'Ⅲ';
        } else if (levelLast.match(twoExp)) {
            levelLast = 'Ⅱ';
        } else if (levelLast.match(oneExp)) {
            levelLast = 'Ⅰ';
        }
        return levelLast;
    },

    //找出分级中最大的分级
    maxLevel: function (level) {
        var oneExp = /Ⅰ|I|i|1|１/ig;
        var twoExp = /II|Ⅱ|ii|ⅱ|2|２/ig;
        var threeExp = /III|Ⅲ|iii|ⅲ|3|３/ig;
        var foreExp = /IV|Ⅳ|4|４/ig;
        var level_number_arr = [];
        for (var i = 0; i < level.length; i++) {
            var level_number;
            if (level[i].match(foreExp)) {
                level_number = 4;
            } else if (level[i].match(threeExp)) {
                level_number = 3;
            } else if (level[i].match(twoExp)) {
                level_number = 2;
            } else if (level[i].match(oneExp)) {
                level_number = 1;
            }
            level_number_arr.push(level_number);
        }

        var max_level = Math.max.apply(null, level_number_arr);

        return max_level;
    },

    outData: async function (data, _id) { //生产数据， 进行筛选判断，进xinshuai_lookfor_data库   async_id  为配置id
        await lookForDao.delete({
            async_id: _id
        }); //每次查看删除该配置的数据，重新入库。
        //   logger.info(`=========>_id:${_id}`);



        var history_ids = [];
        if (data.history_ids) {
            history_ids = data.history_ids.split(' ');
        }

        var query = {
            async_id: data._id
        };
        //logger.info(`=========>data._id:${data._id}`);
        if (history_ids.length > 0) {
            query.admission_number = {
                $in: history_ids
            };
        }
        var total = await dataDao.count(query);

        var pageCount = parseInt((total + 100 - 1) / 100);
        var _this = this;
        var diagnosis_types = ['出院诊断', '入院诊断', '初步诊断', '入院初诊'];
        if (data.diagnosis_types) {
            diagnosis_types = data.diagnosis_types.split(' ');
        }

        //todo
        var exam_items = ['心脏', '心肌灌注'];
        if (data.exam_items) {
            exam_items = [];
            var arr = data.exam_items.split(' ');
            for (var i in arr) {
                exam_items.push(arr[i]);
            }
        }
        // var exam_reg = new RegExp(exam_items.join('|'));
        var exam_reg = exam_items.join('|');
        var mq = await this.queue();
        // function unique(array) {
        //     var r = [];
        //     for (var i = 0, l = array.length; i < l; i++) {
        //         for (var j = i + 1; j < l; j++)
        //             if (array[i] === array[j]) j = ++i;
        //         r.push(array[i]);
        //     }
        //     return r;
        // }


        for (var page = 1; page <= pageCount; page++) {

            var list = await dataDao.pageList(page, 100, query);


            for (var j = 0; j < list.items.length; j++) {

                //   logger.info(`====>count${list.items.length}`)
                var ent = list.items[j];

                ent.task_index = j + 1;
                ent.task_total = list.items.length;

                ent.exam_reg = exam_reg;
                ent.hospitalName = data.name;
                ent.diagnosis_types = diagnosis_types;
                ent.hospital_id = data.hospital_id;
                ent.task_id = ent.id;
                ent._id = _id;


                logger.warn(ent.task_index + '-' + ent.task_total);

                await mq.publish(q_name1, ent);


            }
        }

        // logger.warn(data.name + " >> output :" + out.length);

        // return out.length;
    },
    outDataItem: async function (ent) {
        var ACEI = /开博通|雅施达|洛汀新|普利|达爽|蒙诺|瑞泰/;
        var ARB = /安博维|安博诺|倍博特|代文|复代文|科素亚|傲坦|美卡素|海捷亚|必洛斯|沙坦|科苏|奥必欣|穗悦|伲利安/;
        var ARB_NOT = /沙库巴曲/;
        var Beta = /美托洛尔|比索洛尔|卡维地洛|倍他乐克|康忻|络德|奈必洛尔|阿替洛尔|拉贝洛尔|阿罗洛尔|博苏|金络|阿尔马尔/;
        var reg2 = /呋塞米|呋塞咪|布美他尼|托拉塞米|泽通|氢氯噻嗪|吲达帕胺|阿米洛利|氨苯喋啶|速尿|苏麦卡|呋噻米|美托拉宗|依他尼酸|安博诺|复代文|海捷亚|纳催离|特苏尼|拓赛|蒙达清/; //托伐普坦
        var reg3 = /螺内酯|螺内脂|依普利酮|安体舒通/;
        var reg4 = /华法令|华法林|达比加群|利伐沙班|阿哌沙班|泰毕全|拜瑞妥|艾乐通|艾乐妥/;
        var reg5 = /沙库巴曲|诺欣妥/;
        var exam_reg = new RegExp(ent.exam_reg);
        var hospitalName = ent.hospitalName;
        var diagnosis_types = ent.diagnosis_types;
        var hospital_id = ent.hospital_id;
        var _id = ent._id;

        var ef = this.getEfValue(exam_reg, ent);
        var ef_exam = ef.ef_exam || ent.ip_order_info.filter(function (item) {
            return /超声心动/.test(item.order_name);
        }).length > 0;
        console.log('ent.diagnosis_types', ent.diagnosis_types);
        if (hospitalName == '安康市中心医院' || hospitalName == "徐州医学院附属医院" || hospitalName == "上海中医药大学附属曙光医院") {
            logger.info('使用安康市中心医院逻辑');
            ent.out_diagnosis = ent.ip_index_diagnosis[0] ? ent.ip_index_diagnosis[0].out_diagnosis : '';
            ent.in_diagnosis = ent.ip_index_diagnosis[0] ? ent.ip_index_diagnosis[0].in_diagnosis : '';
            ent.ip_index_diagnosis = ent.out_diagnosis;
            console.log(ent);
            var xinshuai = this.checkIsXinshuaiAnKang(ent);
            var _isFangChan = this.checkIsFangchanAnKang(ent);
            var _isFangPu = this.checkIsFangpuAnKang(ent);
            var levelObj = this.level(ent);

            var item = {
                "hospital_id": hospital_id,
                "async_id": _id, //配置id                  
                "是否匹配": '',
                "ID": ent.id,
                "住院号": ent.admission_number,
                "登记号": ent.register_number || '',
                "记录号": ent.record_number || '',
                "科室": ent.dept_name || '',
                "病区": ent.ward_name || '',
                "出院时间": ent.out_datetime ? moment(ent.out_datetime).format('YYYY-MM-DD HH:mm:ss') : '',
                "出院月份": ent.out_datetime ? moment(ent.out_datetime).format('MM') : '',
                "出院诊断": ent.out_diagnosis,
                "入院诊断": ent.in_diagnosis,
                "NYHA分级": levelObj.nyhaLevel,
                "killip分级": levelObj.killipLevel,
                "ICD编码": '',
                "急性心衰患者": '', //this.checkAcute(ent),
                "超声心动": ef_exam ? '是' : '否',
                "EF值": ef.ef_per || '',
                "EF有无": ef.ef_per ? "有" : "无",
                "EF分类": ef.ef_per ? (ef.ef_per < 40.0 ? "降低" : (ef.ef_per > 49.0 ? "保留" : "中间值")) : "",
                "EF来源": ef.ef_source,
                "BNP": this.checkBNP(ent),
                "ACEI类药物名称": this.getOrderNames(ent, ACEI, null),
                "ARB类药物名称": this.getOrderNames(ent, ARB, ARB_NOT),
                "β受体阻断剂药物名称": this.getOrderNames(ent, Beta ,null),
                "袢利尿剂药物名称": this.getOrderNames(ent, reg2 ,null), 
                "醛固酮受体拮抗剂药物名称": this.getOrderNames(ent, reg3 ,null),
                "ARNI类药物名称": this.getOrderNames(ent, reg5 ,null),
                "房颤": _isFangChan ? "是" : "否",
                "房扑": _isFangPu ? "是" : "否",
                "房颤/房扑": _isFangChan || _isFangPu ? "是" : "否",
                "抗凝药物名称": this.checkIsFangchanAnKang(ent) ? this.getOrderNames(ent, reg4 ,null) : '',
                "离院方式": ent.ip_index_record.map(e => e.out_type).join(','),
                "30天再入院": ent.again_info.length > 0 ? '有' : '无',
                "symptomsOfCongestiveHeartFailure": levelObj.nyhaLevel ? "是":"",
            };
        } else {
            console.log(ent.ip_index_diagnosis);
            ent.out_diagnosis = ent.ip_index_diagnosis.filter(function (item) {
                return diagnosis_types.indexOf(item.diagnosis_type) == 0;
            });

            ent.in_diagnosis = ent.ip_index_diagnosis.filter(function (item) {
                return diagnosis_types.indexOf(item.diagnosis_type) > 0;
            });

            ent.out_diagnosis.sort(function (a, b) {
                var sort1 = a.sort || '0';
                var sort2 = b.sort || '0';
                var sort1_ = parseFloat(sort1);
                var sort2_ = parseFloat(sort2);
                return sort1_ - sort2_;
            });

            ent.in_diagnosis.sort(function (a, b) {
                var sort1 = a.sort || '0';
                var sort2 = b.sort || '0';
                var sort1_ = parseFloat(sort1);
                var sort2_ = parseFloat(sort2);
                return sort1_ - sort2_;
            });

            if (ent.out_diagnosis.length <= 0) {
                logger.warn("没有出院诊断！");
            }

            if (ent.in_diagnosis.length <= 0) {
                logger.warn("没有入院诊断！");
            }
            var xinshuai = this.checkIsXinshuai(ent);
            var _isFangChan = this.checkIsFangchan(ent);
            var _isFangPu = this.checkIsFangpu(ent);
            var levelObj = this.level(ent);

            // var xinshuai;
            // if (data.name == '中山大学附属第一医院') {
            //     logger.info('使用中山附一心衰判断逻辑...');
            //     xinshuai = this.checkIsXinshuaiZhongShanFuYi(ent);
            // } else {
            //     xinshuai = this.checkIsXinshuai(ent);
            // }

            var item = {
                "hospital_id": hospital_id,
                "async_id": _id, //配置id                  
                "是否匹配": '',
                "ID": ent.id,
                "住院号": ent.admission_number,
                "登记号": ent.register_number || '',
                "记录号": ent.record_number || '',
                "科室": ent.dept_name || '',
                "病区": ent.ward_name || '',
                "出院时间": ent.out_datetime ? moment(ent.out_datetime).format('YYYY-MM-DD HH:mm:ss') : '',
                "出院月份": ent.out_datetime ? moment(ent.out_datetime).format('MM') : '',
                "出院诊断": ent.out_diagnosis.map(e => e.diagnosis_content || e.icd_name || e.diagnosis_desc).join(','),
                "入院诊断": ent.in_diagnosis.map(e => e.diagnosis_content || e.icd_name || e.diagnosis_desc).join(','),
                "NYHA分级": levelObj.nyhaLevel,
                "killip分级": levelObj.killipLevel,
                "急性心衰患者": '', //this.checkAcute(ent),
                "ICD编码": ent.out_diagnosis.filter(function (item) {
                    return item.diagnosis_code && item.diagnosis_code.trim().length > 0;
                }).map(e => e.diagnosis_code).join(','),
                "超声心动": ef_exam ? '是' : '否',
                "EF值": ef.ef_per || '',
                "EF有无": ef.ef_per ? "有" : "无",
                "EF分类": ef.ef_per ? (ef.ef_per < 40.0 ? "降低" : (ef.ef_per > 49.0 ? "保留" : "中间值")) : "",
                "EF来源": ef.ef_source,
                "BNP": this.checkBNP(ent),
                "ACEI类药物名称": this.getOrderNames(ent, ACEI ,null),
                "ARB类药物名称": this.getOrderNames(ent, ARB ,ARB_NOT),
                "β受体阻断剂药物名称": this.getOrderNames(ent, Beta ,null),
                "袢利尿剂药物名称": this.getOrderNames(ent, reg2 ,null),
                "醛固酮受体拮抗剂药物名称": this.getOrderNames(ent, reg3 ,null),
                "ARNI类药物名称": this.getOrderNames(ent, reg5 ,null),
                // "ACEI类药物名称": unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && ACEI.test(item.order_name);
                //     }).map(e => e.order_name)).join(','),
                // "ARB类药物名称": unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && ARB.test(item.order_name);
                //     }).map(e => e.order_name)).join(','),
                // "β受体阻断剂药物名称": unique(ent.ip_order_info.filter(function(item) {
                //     return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && Beta.test(item.order_name);
                // }).map(e => e.order_name)).join(','),
                // "袢利尿剂药物名称": unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && reg2.test(item.order_name);
                //     }).map(e => e.order_name)).join(','),
                // "醛固酮受体拮抗剂药物名称": unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && reg3.test(item.order_name);
                //     }).map(e => e.order_name)).join(','),
                // "ARNI类药物名称": unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && reg5.test(item.order_name);
                //     }).map(e => e.order_name)).join(','),
                "房颤": _isFangChan ? "是" : "否",
                "房扑": _isFangPu ? "是" : "否",
                "房颤/房扑": _isFangChan || _isFangPu ? "是" : "否",
                "抗凝药物名称": this.checkIsFangchan(ent) ? this.getOrderNames(ent, reg4 ,null) : '',
                // "抗凝药物名称": this.checkIsFangchan(ent) ? unique(ent.ip_order_info.filter(
                //     function(item) {
                //         return (item.order_flag == '长期医嘱' || item.order_flag == '嘱托长嘱') && reg4.test(item.order_name);
                //     }).map(e => e.order_name)).join(',') : '',
                "离院方式": ent.ip_index_record.map(e => e.out_type).join(','),
                "30天再入院": ent.again_info.length > 0 ? '有' : '无',
                "是否有充血性心力衰竭症状": levelObj.nyhaLevel ? "是":"",
            };
        }
        item.急性心衰患者 = xinshuai.acute || '否';
        // if (history_ids.length > 0) {
        //     //if (history_ids.indexOf(ent.admission_number) > -1) {
        //     out.push(item);
        //     logger.info('add  by history_ids!');
        //     //}
        // } else {
        var out = [];
        if (xinshuai.result) {
            item.是否匹配 = '是';
            out.push(item);
            logger.info('add by inshuai!');
        } else {
            item.是否匹配 = '否';
            out.push(item);
            logger.info('not add!');
        }
        //  }

        await lookForDao.insert(item); //入库
        if (ent.task_index >= ent.task_total) {
            core.logger.warn("end task ==>" + ent.task_id + ' with count:' + ent.task_total);
        }

    }
}

module.exports = s;