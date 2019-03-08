var mysql = require('mysql');
var errors = require('../errors');
var logger = require("../logger");
var Client = require("mysql-pro");

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
function MysqlDB() {
    this.pool = null;
    this.debug = false;
    this.connect = async function(connStrJson) {
        if (this.debug) {
            logger.info('Connecting to MySQL...', connStrJson);
        }
        this.pool = mysql.createPool(connStrJson);
        // this.pool = new Client({ mysql: connStrJson });
        this.pool.on('acquire', function(connection) {
            console.log('Connection %d acquired', connection.threadId);
        });
    }

    this.query = async function(sql, params) {
        if (!this.pool) {
            throw errors.CUSTOM('pool 参数尚未初始化，请执行启动应用的时候执行 connect 方法');
        }
        if (this.debug) {
            logger.info("-----------------start-----------------------");
            logger.info("sql: ", sql);
            logger.info("params: ", params);
            logger.info("------------------end----------------------");
        }

        // return await this.pool.query(sql, params);
        let _this = this;
        return new Promise(function(resolve, reject) {
            _this.pool.query(sql, params, function(error, rows, fields) {
                if (error) {
                    logger.error(error);
                    return reject(error);
                }

                return resolve(rows);
            });
        });

        // _this = this;
        // return function(callback) {
        //     _this.pool.query(sql, params, function(err, rows, fields) {
        //         if (err) {
        //             callback(err);
        //         } else {
        //             callback(null, rows);
        //         }
        //     });
        // }
    }



    this.queryOne = async function(sql, params) {
        var rows = await this.query(sql, params);
        if (rows.length > 0) {
            return rows[0];
        }
        return null;
    }

    this.list = async function(table, conditions) {
        conditions = conditions || {};
        if (!conditions.cols) {
            conditions.cols = '*';
        }
        // if (!conditions.skip) {
        //     conditions.skip = 0;
        // }
        // if (!conditions.limit) {
        //     conditions.limit = 5;
        // }
        if (!conditions.where) {
            conditions.where = "1=1"
        }
        if (conditions.orderBy) {
            conditions.orderBy = 'order by ' + conditions.orderBy;
        } else {
            conditions.orderBy = '';
        }
        table = "`" + table + "`";
        var sql = `select ${conditions.cols} from ${table} where ${conditions.where} ${conditions.orderBy}`;
        if (conditions.limit) {
            sql += ` limit ${conditions.limit}`;
        }
        if (conditions.skip) {
            sql += ` offset ${conditions.skip}`;
        }
        return await this.query(sql, conditions.params);
        //var cql  = `select count(*) as ct from ${table} where ${conditions.where} `;
        //var rows = await this.query(sql, conditions.params);
        //var cts  = await this.query(cql, conditions.params);
        //return {total: cts[0].ct, data: rows};
    }

    this.insert = async function(table, model) {
        table = "`" + table + "`";
        var sql = `insert into ${table} set ?`;
        var result = await this.query(sql, model);
        if (result.affectedRows >= 1) {
            return { id: result.insertId };
        }
        throw errors.CUSTOM("插入失败。");
    }

    this.update = async function(table, model) {
        if (!model.hasOwnProperty('id')) {
            throw errors.WHAT_REQUIRE('id');
        }
        var id = model.id;
        table = "`" + table + "`";
        var sql = `update ${table} set ? where ?`;
        delete model.id;
        var result = await this.query(sql, [model, { id: id }]);
        if (result.changedRows) {
            return true;
        }
        throw errors.CUSTOM("没有数据被更新。");
    }

    this.updateBatch = async function(table, model, conditions) {
        if (model.hasOwnProperty('id')) {
            throw errors.CUSTOM('id 不能被修改。');
        }
        if (!conditions || !conditions.where) {
            throw errors.CUSTOM('批量修改必须有 {where: xxx, params:xxx}。');
        }
        table = "`" + table + "`";
        var sql = `update ${table} set ? where ${conditions.where}`;
        var result = await this.query(sql, [model, conditions.params]);
        if (result.changedRows) {
            return true;
        }
        throw errors.CUSTOM("更新失败，没有符合条件的数据。");
    }

    this.load = async function(table, conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=1";
        conditions.limit = 1;
        conditions.cols = conditions.cols || '*';
        table = "`" + table + "`";
        var sql = `select ${conditions.cols} from ${table} where ${conditions.where} limit ${conditions.limit}`;
        var rows = await this.query(sql, conditions.params);
        if (rows.length > 0) {
            return rows[0];
        }
        return null;
    }

    this.loadByKV = async function(table, key, value) {
        return await this.load(table, {
            where: key + " = ?",
            params: [value]
        });
    }

    this.loadById = async function(table, id) {
        return await this.loadByKV(table, "id", id);
    }

    this.delete = async function(table, conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=2";
        table = "`" + table + "`";
        var sql = `delete from ${table} where ${conditions.where}`;
        var result = await this.query(sql, conditions.params);
        return (result.changedRows > 0);
    }

    this.count = async function(table, conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=1";
        table = "`" + table + "`";
        var sql = `select count(*) as ct from ${table} where ${conditions.where} `;
        var rows = await this.query(sql, conditions.params);
        if (rows.length > 0) {
            return rows[0].ct;
        }
        return 0;
    }

    this.sum = async function(table, conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=1";
        table = "`" + table + "`";
        var sql = `select sum(${conditions.col}) as ct from ${table} where ${conditions.where} `;
        var rows = await this.query(sql, conditions.params);
        if (rows.length > 0) {
            return rows[0].ct;
        }
        return 0;
    }

    this.listMoreTable = async function(conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=1";
        conditions.cols = conditions.cols || '*';
        if (conditions.orderBy) {
            conditions.orderBy = 'order by ' + conditions.orderBy;
        } else {
            conditions.orderBy = '';
        }

        var sql = `select ${conditions.cols} from ${conditions.table} where ${conditions.where} ${conditions.orderBy}`;
        if (conditions.limit) {
            sql += ` limit ${conditions.limit}`;
        }
        if (conditions.skip) {
            sql += ` offset ${conditions.skip}`;
        }
        var rows = await this.query(sql, conditions.params);
        return rows;
    }

    this.countMoreTable = async function(conditions) {
        conditions = conditions || {};
        conditions.where = conditions.where || "1=1";
        var sql = `select count(*) as ct from ${conditions.table} where ${conditions.where} `;
        var rows = await this.query(sql, conditions.params);
        if (rows.length > 0) {
            return rows[0].ct;
        }
        return 0;
    }
}

module.exports = MysqlDB;