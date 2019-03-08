const router = require('koa-router')();
var api = require('../models').api;
var MysqlDB = require('../models').MysqlDB;
var MysqlDao = require('../models').MysqlDao;
var core = require("../models");

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.get('/', async function(ctx, next) {
    // var conf = {
    //     connectionLimit: 10,
    //     host: '127.0.0.1',
    //     user: 'root',
    //     password: '123456',
    //     database: 'demo'
    // };
    // var db = new MysqlDB();
    // await db.connect(conf);
    // var dao = new MysqlDao(db, "category");
    // var list = await dao.list();
    // var result = {};
    // for (var i in list) {
    //     var item = list[i];
    //     var name = item.field9;
    //     if (name && !result[name]) {
    //         var obj = {
    //             category1: item.field2,
    //             category2: item.field3,
    //             category3: item.field4,
    //             category: item.field4 || item.field3 || item.field2,
    //             name: name
    //         };
    //         result[name] = obj;
    //     }

    //     name = item.field8;
    //     if (name && !result[name]) {
    //         var obj = {
    //             category1: item.field2,
    //             category2: item.field3,
    //             category3: item.field4,
    //             category: item.field4 || item.field3 || item.field2,
    //             name: name
    //         };
    //         result[name] = obj;
    //     }

    //     name = item.field6;
    //     if (name && !result[name]) {
    //         var obj = {
    //             category1: item.field2,
    //             category2: item.field3,
    //             category3: item.field4,
    //             category: item.field4 || item.field3 || item.field2,
    //             name: name
    //         };
    //         result[name] = obj;
    //     }
    // }
    // ctx.body = JSON.stringify(result);

    // var categorys = require('../config/category');
    // var result = categorys['头孢呋辛酯片'] ? categorys['头孢呋辛酯片'].category : '';

    // ctx.json(api.data(result));

    ctx.json(api.success());
});

module.exports = router;