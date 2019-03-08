var ObjectID = require("mongodb").ObjectID;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
function MongoDao(db, collectionName) {
    this.collectionName = collectionName;
    this.db = db;
    this.insert = async function(data) {
        return await db.insert(this.collectionName, data);
    };

    this.update = async function(data, query) {
        var q = query;
        if (!query) {
            var val = data._id;
            if (typeof val == 'string') {
                val = new ObjectID(val);
            }
            q = { _id: val };
        }
        delete data._id;
        return await db.updateOne(this.collectionName, data, q);
    };


    this.updateAll = async function(data, query) {
        var q = query;
        return await db.updateMany(this.collectionName, data, q);
    };

    this.update2 = async function(data) {
        return await db.updateById2(this.collectionName, data);
    };

    this.delete = async function(query) {
        return await db.delete(this.collectionName, query);
    };

    this.findById = async function(id) {
        return await db.findOne(this.collectionName, { _id: new ObjectID(id) });
    };

    this.findById2 = async function(query) {
        if (query._id){
            return await db.findOne(this.collectionName, { _id: new ObjectID(query._id) });
        }
        return result = await db.findOne(this.collectionName, { id: query.id });
    };

    this.findByKV = async function(key, value) {
        var map = {};
        map[key] = value;
        return await db.findOne(this.collectionName, map);
    };

    this.find = async function(query, options) {
        return await db.findOne(this.collectionName, query, options);
    };

    this.list = async function(query, options) {
        return await db.find(this.collectionName, query, options);
    };

    this.count = async function(query) {
        return await db.count(this.collectionName, query, null);
    };

    this.pageList = async function(pageIndex, pageSize, query, sort) {
        var sort = sort || { _id: 1 };
        var options = { limit: pageSize, skip: (pageIndex - 1) * pageSize, sort: sort };
        var items = await db.find(this.collectionName, query, options);
        var total = await db.count(this.collectionName, query, null);
        return {
            items: items,
            total: total,
            pageIndex: pageIndex,
            pageSize: pageSize
        };
    };
    /**
     * 根据 cols 查询指定的字段
     * @param {*} pageIndex 
     * @param {*} pageSize 
     * @param {*} query 
     * @param {*} cols 
     * @param {*} sort 
     */
    this.pageListByCols = async function(pageIndex, pageSize, query, cols, sort) {
        var sort = sort || { _id: 1 };
        var options = { limit: pageSize, skip: (pageIndex - 1) * pageSize, sort: sort };
        options.cols = cols;
        var items = await db.find(this.collectionName, query, options);
        var total = await db.count(this.collectionName, query, null);
        return {
            items: items,
            total: total,
            pageIndex: pageIndex,
            pageSize: pageSize
        };
    };
}

module.exports = MongoDao;