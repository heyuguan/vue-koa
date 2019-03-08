const log4js = require('log4js');

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */

var l = {
    log4js: log4js,
    files: {},
    _logger: null,
    default: {
        appenders: {
            file: {
                type: 'dateFile',
                filename: 'logs/',
                backups: 50,
                //pattern: 'app-yyyy-MM-dd.log',
                alwaysIncludePattern: true,
                level: 'WARN'
            },
            filter: {
                "type": "logLevelFilter",
                "level": "WARN",
                "appender": 'file'
            },
            console: {
                type: 'console'
            },
        },
        categories: {
            default: {
                appenders: ['filter', 'console'],
                level: 'ALL',
            }
        },
        pm2: true,
        replaceConsole: true
    },
    logger: function() {
        if (!this._logger) {
            this.configure();
        }
        return this._logger;
    },
    configure: function(name, opts, baselog) {
        name = name || 'app';
        this.files = baselog || {};
        var opt = opts || this.default;
        this.log4js.configure(opt);
        this._logger = this.log4js.getLogger(name);
    },
    logstash: function(host, port) {
        var otp = this.default;
        otp.appenders.logstash = {
            type: 'log4js-logstash-tcp',
            host: host,
            port: port,
        };
        otp.appenders.filterLogstash = {
            "type": "logLevelFilter",
            "level": "ERROR",
            "appender": 'logstash'
        };
        otp.categories.default.appenders.push('filterLogstash');
        return otp;
    },
    build: function(message, args) {
        var log = Object.assign(this.files, {});
        log.msg = (typeof(message) == 'string') ? message : JSON.stringify(message);
        log.params = [];
        for (var i = 0; i < args.length; i++) {
            var item = args[i];
            log.params.push((typeof(item) == 'string') ? item : JSON.stringify(item));
        }
        return log;
    },
    info: function(message, ...args) {
        var log = this.build(message, args);
        this.logger().info(log);
    },
    debug: function(message, ...args) {
        var log = this.build(message, args);
        this.logger().debug(log);
    },
    warn: function(message, ...args) {
        var log = this.build(message, args);
        this.logger().warn(log);
    },
    error: function(message, ...args) {
        var log = this.build(message, args);
        this.logger().error(log);
    },
    trace: function(message, ...args) {
        var log = this.build(message, args);
        this.logger().trace(log);
    }
}

module.exports = l;