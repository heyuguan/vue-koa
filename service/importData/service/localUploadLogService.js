var Dao = require("../../../models").MysqlDao;
var MysqlDB = require("../../../models").MysqlDB;
var logger = require("../../../models").logger;
var config = require('../../../config');
var localUploadLogDao = require('../dao/localUploadLogDao');

var localUploadLogService = {
    save: async function(data){
        return await localUploadLogDao.insert(data);
        // return data;

    },
    findById: async function(id){
        return await localUploadLogDao.findById(id);
    },
    update : async function(data){
        return await localUploadLogDao.update(data);
    },
    findByLodeId:async function(lodeId){
        return await localUploadLogDao.findByKV("emr_project_lode_id",lodeId);
    },
    logList : async function(pageIndex, pageSize, query){
        var q = {};
      
        if (query && query.hospital_id) {
            q = { hospital_id: { $regex: new RegExp(query.hospital_id) } };
        }
        if (query && query.hospital_name) {
            q = { hospital_name: { $regex: new RegExp(query.hospital_name) } };
        }
        return await localUploadLogDao.pageListByCols(pageIndex, pageSize, q,{}, { create_date: -1 });
    },



}


module.exports = localUploadLogService;