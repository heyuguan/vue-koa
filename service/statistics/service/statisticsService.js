var dataInfoDao = require('../dao/hospitalDataInfoDao');
var dbInfoDao = require('../dao/hospitalDbInfoDao');
var config = require('../../../config');
var MysqlDB = require('../../../models/mysql/MysqlDB');
var emrService = require('./emrService');
var core = require('../../../models');
var MysqlDB = core.MysqlDB;
var ObjectID = require("mongodb").ObjectID;
var moment = require('moment');
var hospitalDbService = require('../../hospitalDb/service/myService');

var statisticsService = {
    hospitalList: async function(pageIndex, pageSize, query, searchStr) {
        var q = searchStr||{};
        if (query.name) {
            q = { name: { $regex: new RegExp(query.name) } };
        }
        if (query.hospital_id) {
            q = { hospital_id: { $regex: new RegExp(query.hospital_id) } };
        }
        if (query._id) {
            q = { _id: new ObjectID(query._id) };
        }
        var pagelist = await dbInfoDao.pageList(pageIndex, pageSize, q);
        for (var i = 0; i < pagelist.items.length; i++) {
            var item = pagelist.items[i];
            var info = await dataInfoDao.find({ "hospital_id": item.hospital_id, hospital_db_id: item.hospital_db_id }) || {};
            item.hospital_db_id = item.hospital_db_id;
            item.database = item.database;
            item.remark = item.remark;
            item.hospital_name = item.name;
            item.ip_count = info.ip_count || 0;
            item.ip_min_date = info.ip_min_date;
            item.ip_max_date = info.ip_max_date;
            item.ip_month = info.ip_month || [];
            item.ip_dept = info.ip_dept || [];
            item.op_count = info.op_count || 0;
            item.op_min_date = info.op_min_date;
            item.op_max_date = info.op_max_date;
            item.op_month = info.op_month || [];
            item.op_dept = info.op_dept || [];
            item.update_date = info.update_date;
            pagelist.items[i] = item;
        }
        return pagelist;
    },
    dbInfoById: async function(id) {
        return await dbInfoDao.findById(id);
    },
    dbInfoByHostptial: async function(hospital_id, db) {
        var query = {
            hospital_id: hospital_id
        };
        if (db) {
            query.db = db;
        }
        return await dbInfoDao.find(query);
    },
    dbInfoList: async function(query) {
        return await dbInfoDao.list(query);
    },
    updateDbInfo: async function() {
        //await dbInfoDao.delete({ hospital_id: { $ne: '' } });
        var version = core.utils.uuid();

        var dataList = await hospitalDbService.pageList(1, 20, {});
        var total = dataList.total;
        var pageCount = parseInt((total + 20 - 1) / 20);
        for (var page = 1; page <= pageCount; page++) {
            var list;
            if (page == 1) {
                list = dataList;
            } else {
                list = await hospitalDbService.pageList(page, 20, {});
            }
            for (var j in list.items) {
                var item = list.items[j];
                var old = await dbInfoDao.find({ hospital_id: item.hospital_id, hospital_db_id: item.id });
                core.logger.info("##-->>updateDbInfo:hospital_id="+item.hospital_id+";hospital_name="+item.hospital_name+";");
                if (!old) {
                    var _item = {};
                    _item.hospital_db_id = item.id;
                    _item.version = version;
                    _item.hospital_id = item.hospital_id+"";
                    _item.name = item.hospital_name;
                    _item.remark = item.remark;
                    _item.database = item.database;
                    await dbInfoDao.insert(_item);
                } else {
                    old.hospital_db_id = item.id;
                    old.version = version;
                    old.hospital_id = item.hospital_id+"";
                    old.name = item.hospital_name;
                    old.remark = item.remark;
                    old.database = item.database;
                    await dbInfoDao.update({ version: version }, { _id: old._id });
                }
            }
        }

        // var dbs = config.emr;
        // for (var key in dbs) {
        //     var db = await core.getDb(key);
        //     // var db = new MysqlDB();
        //     // db.debug = config.debug;
        //     // await db.connect(dbs[i]);
        //     var list = await emrService.findHospitals(db);
        //     for (var j = 0; j < list.length; j++) {
        //         var item = list[j];
        //         var old = await dbInfoDao.find({ hospital_id: item.hospital_id, db: key });
        //         core.logger.info("##-->>updateDbInfo:key=" + key + ";hospital_id="+item.hospital_id+";hospital_name="+item.name+";");
        //         if (!old) {
        //             item.db = key;
        //             item.version = version;
        //             await dbInfoDao.insert(item);
        //         } else {
        //             old.version = version;
        //             await dbInfoDao.update({ version: version }, { _id: old._id });
        //         }
        //     }
        // }
        await dbInfoDao.delete({ version: { $ne: version } });
    },
    countHospitalById: async function(id) {
        var info = await dbInfoDao.findById(id);
        await this.countHospital(info);
    },
    countHospital: async function(item, db) {
        // var dbs = config.emr;
        if (!db) {
            if (item.hospital_db_id){
                db = await hospitalDbService.getDb(item.hospital_db_id);
            } else {
                db = await core.getDb(item.db);
            }
            // db = await core.getDb(item.db);
            // db = new MysqlDB();
            // db.debug = config.debug;
            // await db.connect(dbs[item.db]);
        }
        var info = await emrService.countByHospital(db, item);
        info.hospital_db_id = item.hospital_db_id;
        await dataInfoDao.delete({ hospital_id: info.hospital_id, hospital_db_id: info.hospital_db_id });
        await dataInfoDao.insert(info);
    },
    countAllHospital: async function() {
        var dbs = config.emr;
        var list = await this.dbInfoList();
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var conn = dbs[item.db];
            var db = await core.getDb(conn);
            // var db = new MysqlDB();
            // db.debug = config.debug;
            // await db.connect(conn);
            await this.countHospital(item, db);
        }
    },
    update: async function(data) {
        await dbInfoDao.update(data);
    },
    findById: async function(id) {
        return await dbInfoDao.findById(id);
    },
    hospitalAll: async function() {
        var pagelist = await dbInfoDao.pageList(1, 200, {});
        var resultsIp = [];
        var resultsOp = [];
        for (var i = 0; i < pagelist.items.length; i++) {
            var item = pagelist.items[i];
            var info = await dataInfoDao.find({ "hospital_id": item.hospital_id, db: item.db }) || {};
            item.db = item.db;
            item.hospital_name = item.name;
            item.ip_count = info.ip_count || 0;
            item.ip_min_date = info.ip_min_date;
            item.ip_max_date = info.ip_max_date;
            item.ip_month = info.ip_month || [];
            item.ip_dept = info.ip_dept || [];
            item.op_count = info.op_count || 0;
            item.op_min_date = info.op_min_date;
            item.op_max_date = info.op_max_date;
            item.op_month = info.op_month || [];
            item.op_dept = info.op_dept || [];
            item.update_date = info.update_date;
            // pagelist.items[i] = item;

            item.ip_dept = info.ip_dept || [];
            item.op_dept = info.op_dept || [];
            for (var index in item.ip_dept){
                var _item = item.ip_dept[index];
                resultsIp.push({
                    医院名称:item.hospital_name,
                    ID:item.hospital_id,
                    科室名称:_item.dept_name,
                    EMR存储位置: item.db,
                    "min Time":moment(_item.minTime).format("YYYY-MM-DD HH:mm:ss"),
                    "max Time":moment(_item.maxTime).format("YYYY-MM-DD HH:mm:ss"),
                    数量:_item.total
                });
            }
            for (var index in item.op_dept){
                var _item = item.op_dept[index];
                resultsOp.push({
                    医院名称:item.hospital_name,
                    ID:item.hospital_id,
                    科室名称:_item.dept_name,
                    EMR存储位置: item.db,
                    "min Time":moment(_item.minTime).format("YYYY-MM-DD HH:mm:ss"),
                    "max Time":moment(_item.maxTime).format("YYYY-MM-DD HH:mm:ss"),
                    数量:_item.total
                });
            }
        }
        return {住院:resultsIp,门诊:resultsOp};
    },
    out: async function(wb) {
        return new Promise(function(resolve, reject) {
            wb.writeToBuffer().then(function(buffer) {
                return resolve(buffer);
            });
        });
    },
};

module.exports = statisticsService;