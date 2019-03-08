var koa = require('koa');
const logger = require('koa-logger');
//const router = require('koa-router')();
const koaBody = require('koa-body');
// const render = require('./render');
const serve = require('koa-static');
var cors = require('koa-cors');
var schedule = require("node-schedule");
var moment = require('moment');
var emdata = require('./models');
const path = require('path');
var config = require('./config');
config.output_path = config.output_path || path.join(eval("__dirname"), './output');
// const session = require('koa-session');
// var flash = require('koa-flash');
var searchService = require('./service/search/service/searchService');
var taskService = require('./service/task/service/taskService2');
var clearService = require('./service/statistics/service/clearService');
// var standardizeService = require('./service/statistics/service/standardizeService');
var reportService = require('./service/xinshuai/service/reportService');
var xinshuaiService = require('./service/xinshuai/service/index');
var outpatientService = require('./service/xinshuai/service/outpatientService');
var uploadService = require('./service/xinshuai/service/uploadService');
var taskImportService = require('./service/importData/service/taskImportService');

var app = new koa();
app.use(logger());
app.use(koaBody({ multipart: true }));
app.use(cors());
// app.use(flash());

//views
// app.use(render);
//static
app.use(serve('public'));

// //session
// app.keys = ['some secret key'];
// app.use(session({
//     key: "SESSIONID", //default "koa:sid" 
//     maxAge: 86400000,
//     overwrite: true,
//     httpOnly: false,
//     signed: true,
//     rolling: false
// }, app));

//favicon 
// router.use(async function favicon(ctx, next) {
//     if (ctx.url.match(/favicon\.ico$/)) {
//         ctx.body = "";
//         return;
//     }
//     await next();
// });
// app.use(router.routes());
if (config.is_send_log) {
    var otptions = emdata.logger.logstash('10.10.10.16', 5678);
    var baselog = {
        "env": process.env.NODE_ENV || 'dev'
    };
    emdata.logger.configure('xinshuai-koa', otptions, baselog);
}
//moment
app.use(async function(ctx, next) {
    //ctx.state.moment = require('moment');
    ctx.json = function(obj) {
        ctx.set("Content-Type", "application/json;charset=utf-8");
        ctx.body = JSON.stringify(obj);
    }

    if (ctx.url.match(/favicon\.ico$/)) {
        ctx.body = "";
        return;
    }

    var ticket = ctx.cookies.get("enuo-www") || ctx.headers.ticket || ctx.query.ticket || ctx.request.body.ticket || '';

    var user = null;
    if (ticket) {
        var userStr = await emdata.redis.get(ticket);
        if (userStr) {
            user = JSON.parse(userStr + "");
        }
    }

    //emdata.logger.info(user);

    if (user && user.id) {
        await emdata.redis.set(ticket, JSON.stringify(user), user.expires_in);
        ctx.state.user = user;
        await next();
    } else {
        var arr = ctx.url.split('/');
        for (var i = 0, length = arr.length; i < length; i++) {
            arr[i] = arr[i].split('?')[0];
        }

        var controller = arr.length > 1 ? arr[1] : '';
        var action = arr.length > 2 ? arr[2] : '';
        var url = controller + '/' + action;
        var openUrl = ['/','account/captcha' ,'account/login', 'account/logout','importData/localUpload','importData/localUploadLog'];
        var index = openUrl.indexOf(url);
        if (openUrl.indexOf(url) > -1) {
            await next();
        } else {
            // ctx.session.originalUrl = ctx.originalUrl ? ctx.originalUrl : null;
            // ctx.flash.error = '请先登陆！';
            //await ctx.redirect('/account/login');
            ctx.json(emdata.api.error('登录已经过期，请重新登录！', 401));
        }
    }
});

app.use(require('./service').routes());
app.use(require('./service/account').routes());
app.use(require('./service/account/profile').routes());
app.use(require('./service/baseData').routes());
app.use(require('./service/statistics').routes());
app.use(require('./service/monitor').routes());
app.use(require('./service/business').routes());
app.use(require('./service/xinshuai').routes());
app.use(require('./service/table').routes());
app.use(require('./service/emr').routes());
app.use(require('./service/project').routes());
app.use(require('./service/importData').routes());
app.use(require('./service/search').routes());
app.use(require('./service/task').prefix('/task').routes());
app.use(require('./service/xinshuai/import').prefix('/hfImport').routes());
app.use(require('./service/emrdb').routes());


app.use(async function pageNotFound(ctx, next) {
    // var info = {
    //     error: {
    //         status: 404,
    //         stack: 'Page Not Found'
    //     },
    //     message: 'Page Not Found'
    // };

    ctx.status = 404;
    ctx.json(emdata.api.error('Not Found！', 404));

    var error_info = {
        url: ctx.url,
        status: ctx.status,
        method: ctx.method
    };
    emdata.logger.error(error_info);
    // switch (ctx.accepts('html', 'json')) {
    //     case 'html':
    //         ctx.type = 'html';
    //         //ctx.body = '<p>Page Not Found</p>';
    //         await ctx.render('error/index', info);
    //         break;
    //     case 'json':
    //         ctx.body = {
    //             code: 404,
    //             msg: 'Page Not Found'
    //         };
    //         break;
    //     default:
    //         ctx.type = 'text';
    //         //ctx.body = 'Page Not Found';
    //         await ctx.render('error/index', info);
    // }
});

app.use(async function(ctx, next) {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        // var info = {
        //     error: {
        //         status: ctx.status
        //     },
        //     message: 'Server Error'
        // };

        // ctx.type = 'html';
        // await ctx.render('error/index', info);
        //ctx.body = '<p>Something <em>exploded</em>, please contact Maru.</p>';

        ctx.json(emdata.api.error('Server Error！', ctx.status));
        var error_info = {
            url: ctx.url,
            status: ctx.status,
            method: ctx.method
        };
        ctx.app.emit('error', error_info, ctx);
    }
});

app.on('error', function(err) {
    emdata.logger.error(err);
});

var server = app.listen(config.port, function() {
    emdata.logger.info("http://localhost:" + server.address().port);
});

emdata.mysql.debug = config.debug;
emdata.mysql.connect(config.mysql);


emdata.redis.debug = config.debug;
emdata.redis.connect(config.redis);

// emdata.diagnoseAccount.debug = config.debug;
// emdata.diagnoseAccount.connect(config.diagnoseAccount);


// schedule 定时任务 每天早上9点自动执行
// var rule = new schedule.RecurrenceRule();
// //rule.hour = [9];
// //rule.minute = 2;
// //rule.dayOfWeek = [0, new schedule.Range(1, 6)];
// //rule.hour = 9;
// //rule.minute = 1;
// rule.second = 20;
// var j = schedule.scheduleJob(rule, function() {
//     //emdata.logger.info("执行任务", new Date());
//     if (!config.task_server) {
//         // taskService.checkTask();
//         //emdata.logger.warn("checkTask", new Date());
//     }
// });

if (config.task_server) {
    // taskService.process();
    // searchService.process();
    // clearService.process();
    reportService.process();
    xinshuaiService.process();
    outpatientService.process();
    uploadService.process();
    // taskImportService.process();
    // standardizeService.process();
}

module.exports = app;