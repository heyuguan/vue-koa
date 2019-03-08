module.exports = {
    debug: false,
    port: 9086,
    app_name: "emdata-bi-koa",
    task_server: true,
    web_server: false,
    fix: '',
    mysql: {
        connectionLimit: 10,
        host: 'rds193v4iefm7k01ee0s.mysql.rds.aliyuncs.com',
        user: 'emdata1906',
        password: 'link2015',
        database: 'emdata'
    },
    uinfo: {
        connectionLimit: 10,
        host: 'rm-m5eno4h8xahj07820.mysql.rds.aliyuncs.com',
        user: 'emdata',
        password: 'EmLink@2017',
        database: 'emdata_emr'
    },
    emr: {
        "emr": {
            connectionLimit: 10,
            host: 'rm-m5eno4h8xahj07820.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr'
        },
        "emr2": {
            connectionLimit: 10,
            host: 'rm-m5eno4h8xahj07820.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr2'
        },
        "emr3": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr3'
        },
        "emr4": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr4'
        },
        "emr5": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr5'
        },
        "emr6": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr6'
        },
        "emr7": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr7'
        },
        "emr8": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr8'
        },
        "emr9": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr9'
        },
        "emr10": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr10'
        },
        "emr11": {
            connectionLimit: 10,
            host: 'rm-m5e0wb2519b9pq3b9.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr11'
        },
        "emr16": {
            connectionLimit: 10,
            host: 'rm-m5eno4h8xahj07820.mysql.rds.aliyuncs.com',
            user: 'emdata',
            password: 'EmLink@2017',
            database: 'emdata_emr16'
        }
    },
    mongo: {
        //dburl: "mongodb://127.0.0.1:27017/emdataBI"
        dburl: "mongodb://root:emdata_2017_link_6029@dds-m5e2c258bf1644c41.mongodb.rds.aliyuncs.com:3717,dds-m5e2c258bf1644c42.mongodb.rds.aliyuncs.com:3717/admin?replicaSet=mgset-4496273",
        dbname: "emdataBI"
    },
    redis: {
        host: '10.25.82.46',
        port: '6379'
            //host: '10.144.63.146',
            //ssl: true,
            //port: '6379',
            //abortConnect: false,
            //password: 'HdGx2fDlCn5XcFPa',
            //auth: 'HdGx2fDlCn5XcFPa'
    },
    mq: "amqp://guest:!mdata~a1s2d3@10.25.82.46:5672",
    es: {
        //host: '127.0.0.1:9200',
        host: '10.27.20.177:9200',
        log: 'error'
    },
    account: {
        expire_in: 7200,
    },
    //指定临时目录，如不指定为当前目录下的output
    output_path: '/tmp/bi',
    api: {
        chfcReport: 'http://data.chinahfc.org/index.php/Ym_api/ym_respond'
    },
};

//10.27.20.177