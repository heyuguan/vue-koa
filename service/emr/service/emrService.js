var Dao = require("../../../models").MysqlDao;
var MysqlDB = require("../../../models").MysqlDB;
var logger = require("../../../models").logger;
var config = require('../../../config');
var core = require("../../../models");
var hospitalDbService = require('../../hospitalDb/service/myService');

var emrService = {
    pageList: async function(info, table, pageIndex, pageSize, query) {

        var where = " hospital_id=? ";
        var params = [info.hospital_id];
        var db;
        if (info.hospital_db_id){
            db = await hospitalDbService.getDb(info.hospital_db_id);
        } else {
            db = await core.getDb(info.db);
        }
        // var db = new MysqlDB();
        // db.debug = config.debug;
        // await db.connect(config.emr[info.db]);
        var dao = new Dao(db, table.table_name);
        if (query) {
            for (var key in query) {
                if (query.hasOwnProperty(key)) {
                    var value = query[key];
                    if (value) {
                        if (value.indexOf(',') > 0){
                            where += " and " + key + " in ("+value+") ";
                        } else {
                            // where += " and " + key + " like ? ";
                            // params.push('%' + value + '%');
                            where += " and " + key + " = ? ";
                            params.push(value);
                        }
                    }
                }
            }
        }

        // var items = await dao.list(where, params, pageSize);
        // var result = {
        //     items: items,
        //     total: pageSize,
        //     pageIndex: pageIndex,
        //     pageSize: pageSize
        // };
        //return result;
        return await dao.pageList(pageIndex, pageSize, where, params);
    },
    findData: async function(info, table, query, search) {
        var where = " 1 = 1";
        var params = [];
        var db;
        if (info.hospital_db_id){
            db = await hospitalDbService.getDb(info.hospital_db_id);
        } else {
            db = await core.getDb(info.db);
        }
        // var db = new MysqlDB();
        // db.debug = config.debug;
        // await db.connect(config.emr[info.db]);
        var dao = new Dao(db, table.table_name);
        if (query) {
            for (var key in query) {
                if (query.hasOwnProperty(key)) {
                    var value = query[key];
                    if (value) {
                        where += " and " + key + " = ? ";
                        params.push(value);
                    }
                }
            }
        }
        if (search) {
            for (var key in search) {
                if (search.hasOwnProperty(key)) {
                    var value = search[key];
                    if (value) {
                        where += " and " + key + " like ? ";
                        params.push("%" + value + "%");
                    }
                }
            }
        }
        return await dao.list(where, params);
    },
    findById: async function(info, table, id) {
        var db;
        if (info.hospital_db_id){
            db = await hospitalDbService.getDb(info.hospital_db_id);
        } else {
            db = await core.getDb(info.db);
        }
        // var db = new MysqlDB();
        // db.debug = config.debug;
        // await db.connect(config.emr[info.db]);
        var dao = new Dao(db, table.table_name);
        return await dao.findById(id);
    },
    findPatientInfo: async function(patient_ids, hospital_db_id) {
        if (!patient_ids||patient_ids.length == 0){
            return;
        }
        var where = " 1 = 1";
        var params = [];
        var db;
        if (hospital_db_id)
            db = await hospitalDbService.getDb(hospital_db_id);
        else
            db = await core.getDb('emr');
        var dao = new Dao(db, 'ip_patient_info');
        if (patient_ids) {
            for(var i=0;i<patient_ids.length;i++){
                var value = patient_ids[i];
                if(i==0){
                    where += " and (id = ?";
                } else {
                    where += " or id = ?";
                }
                params.push(value);
            }
            where += ")";
        }

        var list = await dao.list(where, params);

        //从patient_basic_info查的数据为空时，再从ip_patient_hospital_rel查询
        if(!list || list.length==0){
            var _where = " 1 = 1";
            var _params = [];
            var patientReldao = new Dao(db, 'ip_patient_hospital_rel');
            if (patient_ids) {
                for(var j=0;j<patient_ids.length;j++){
                    var value = patient_ids[j];
                    if(j==0){
                        _where += " and (patient_id = ?";
                    } else {
                        _where += " or patient_id = ?";
                    }
                    _params.push(value);
                }
                _where += ")";
            }
            list = await patientReldao.list(_where, _params);
        }
        return list;
    },
    findHistoryId: async function(dbStr, obj, type, hospital_db_id) {
        var where = " 1 = 1";
        var params = [];
        var db;
        if (hospital_db_id){
            logger.info("##-->>hospital_db_id:::" + hospital_db_id);
            db = await hospitalDbService.getDb(hospital_db_id);
        } else {
            logger.info("##-->>emrStr:::" + dbStr);
            db = await core.getDb(dbStr);
        }
        var dao = new Dao(db, 'ip_medical_history_info');
        if (obj.out_datetime) {
            where += " and out_datetime = ?";
            params.push(obj.out_datetime);
        }
        if (obj.hospital_id) {
            where += " and hospital_id = ?";
            params.push(obj.hospital_id);
        }
        if (obj.admission_number) {
            where += " and admission_number = ?";
            params.push(obj.admission_number);
        }
        var result = await dao.list(where, params);
        logger.info("##-->>findHistoryId" + JSON.stringify(result));
        if (result && result.length > 0){
            var _result = result[0];
            if(type&&type==1){
                return _result;
            }
            return _result.id;
        }
        return null;
    }
};

module.exports = emrService;