/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
function MysqlDao(db, table) {
    this.table = table;
    this.db = db;
    this.insert = async function(data) {
        return await db.insert(this.table, data);
    };

    this.update = async function(data) {
        return await db.update(this.table, data);
    };

    this.findById = async function(id) {
        return await db.loadById(this.table, id);
    };

    this.findByKV = async function(key, value) {
        return await db.loadByKV(this.table, key, value);
    };

    this.find = async function(where, params) {
        var conditions = {};
        conditions.where = where;
        conditions.params = params;
        return await db.load(this.table, conditions);
    };

    this.list = async function(where, params, count, cols) {
        var conditions = {};
        conditions.where = where;
        conditions.params = params;
        conditions.cols = cols;
        if (count) {
            conditions.limit = count;
        }
        return await db.list(this.table, conditions);
    };

    this.pageList = async function(pageIndex, pageSize, where, params, cols, orderBy) {
        var conditions = {};
        conditions.where = where;
        conditions.params = params;
        conditions.limit = pageSize;
        conditions.skip = pageSize * (pageIndex - 1);
        conditions.cols = cols;
        conditions.orderBy = orderBy;
        var items = await db.list(this.table, conditions);
        var total = await db.count(this.table, conditions);
        return {
            items: items,
            total: total,
            pageIndex: pageIndex,
            pageSize: pageSize
        };
    };

    this.pageListMoreTable = async function(conditions, pageIndex, pageSize) {
        conditions = conditions || {};
        // conditions.where = where;
        // conditions.params = params;
        conditions.limit = pageSize;
        // conditions.orderBy = orderBy;
        conditions.skip = pageSize * (pageIndex - 1);
        console.log(conditions.table);
        var items = await db.listMoreTable(conditions);
        var total = await db.countMoreTable(conditions);
        return {
            items: items,
            total: total,
            pageIndex: pageIndex,
            pageSize: pageSize
        };
    };

    this.findOneMoreTable = async function(conditions) {
        conditions = conditions || {};
        console.log(conditions.table);
        var items = await db.listMoreTable(conditions);
        if (items && items.length > 0) {
            return items[0];
        }
        return;
    };

    this.count = async function(where, params) {
        var conditions = {};
        if(where){
            conditions.where = where;
        }
        if(params){
            conditions.params = params; 
        }
        var total = await db.count(this.table, conditions);
        return {
            total: total,
        };
    };
}

module.exports = MysqlDao;