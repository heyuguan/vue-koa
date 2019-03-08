var crypto = require('crypto');
var tableDao = require('../dao/tableDao');
var fieldDao = require('../dao/fieldDao');
var logger = require("../../../models").logger;

var tableService = {
    tablePageList: async function(pageIndex, pageSize, query) {
        var q = {};
        if (query && query.ent_status !== undefined) {
            q.ent_status = query.ent_status;
        }
        if (query && query.table_name) {
            q = { table_name: { $regex: new RegExp(query.table_name) } };
        }
        return await tableDao.pageList(pageIndex, pageSize, q, { create_date: 1 });
    },

    tableList: async function(query) {
        var q = { ent_status: 0 };
        if (query && query.parent_id !== undefined) {
            q.parent_id = query.parent_id;
        } else {
            q.parent_id = '0';
        }

        var o = {
            sort: { create_date: 1 }
        };
        return await tableDao.list(q, o);
    },

    saveTable: async function(saveObj) {
        return await tableDao.insert(saveObj);
    },
    updateTable: async function(ent) {
        return await tableDao.update(ent);
    },

    fieldPageList: async function(pageIndex, pageSize, query) {
        var q = {};

        if (query) {
            if (query.ent_status !== undefined) {
                q.ent_status = query.ent_status;
            }
            if (query.title) {
                q = { title: { $regex: new RegExp(query.title) } };
            }
            if (query.table_id) {
                q.table_id = query.table_id;
            }
        }
        return await fieldDao.pageList(pageIndex, pageSize, q, { create_date: -1 });
    },
    saveField: async function(ent) {
        return await fieldDao.insert(ent);
    },
    updateField: async function(ent) {
        return await fieldDao.update(ent);
    },
    findFieldById: async function(id) {
        return await fieldDao.findById(id);
    },
    findFieldListByTableId: async function(tableId) {
        var q = {
            ent_status: 0,
            table_id: tableId
        };
        return await fieldDao.list(q);
    },
    findTableById: async function(id) {
        return await tableDao.findById(id);
    },
    deleteTable: async function(data) {
        data.ent_status = 1;
        return await tableDao.update(data);
    },
    deleteField: async function(data) {
        data.ent_status = 1;
        return await fieldDao.update(data);
    }
}


module.exports = tableService;