module.exports = {
    debug: true,
    port: 9086,
    app_name: "emdata-bi-koa",
    task_server: false,
    web_server: true,
    is_use_service: false,// 是否使用emdata-bi-service服务
    is_send_log:true,
    fix: '',
    
    mysql: {
        connectionLimit: 10,
        host: '10.10.10.13',
        user: 'root',
        password: 'root',
        database: 'emdata'
    },
    platformDemo:{
        connectionLimit: 10,
        host: '10.10.10.13',
        user: 'root',
        password: 'root',
        database: 'emdata_platform_demo'
    },
    uinfo: {
        connectionLimit: 10,
        host: '10.10.10.44',
        user: 'root',
        password: 'root',
        database: 'emdata_emr'
    },
    diagnoseAccount:{
        connectionLimit: 10,
        host: '10.10.10.13',
        user: 'root',
        password: 'root',
        database: 'emdata_diagnose_account'
    },
    emr: {
        "emr": {
            connectionLimit: 10,
            host: '10.10.10.44',
            user: 'root',
            password: 'root',
            database: 'emdata_emr'
        },
        "emr2": {
            connectionLimit: 10,
            host: '10.10.10.44',
            user: 'root',
            password: 'root',
            database: 'emdata_emr2'
        },
        "emr3": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr3'
        },
        "emr4": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr4'
        },
        "emr5": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr5'
        },
        "emr6": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr6'
        },
        "emr7": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr7'
        },
        "emr8": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr8'
        },
        "emr9": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr9'
        },
        "emr10": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr10'
        },
        "emr11": {
            connectionLimit: 10,
            host: '10.10.10.44',
            port: '3307',
            user: 'root',
            password: 'root',
            database: 'emdata_emr11'
        },
        "emr16": {
            connectionLimit: 10,
            host: '10.10.10.44',
            user: 'root',
            password: 'root',
            database: 'emdata_emr16'
        },
        "emr17": {
            connectionLimit: 10,
            host: '10.10.10.44',
            user: 'root',
            password: 'root',
            database: 'emdata_emr17'
        },
        "emr18": {
            connectionLimit: 10,
            host: '10.10.10.44',
            user: 'root',
            password: 'root',
            database: 'emdata_emr18'
        },
        "tmp_emr": {
            connectionLimit: 10,
            host: '10.10.10.32',
            user: 'root',
            password: 'root',
            database: 'emdata_emr'
        },
        "emdata_emr_prod_731": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_731'
        },
        "emdata_emr_prod_714": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_714'
        },
        "emdata_emr_prod_364": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_364'
        },
        "emdata_emr_prod_149": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_149'
        },
        "emdata_emr_prod_730": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_730'
        },
        "emdata_emr_prod_264": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_264'
        },
        "emdata_emr_prod_690": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_690'
        },
        "emdata_emr_prod_144": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_144'
        },
        "emdata_emr_prod_256": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_256'
        },
        "emdata_emr_prod_716": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_716'
        },
        "emdata_emr_prod_722": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_722'
        },
        "emdata_emr_prod_378": {
            connectionLimit: 10,
            host: '10.10.10.14',
            user: 'root',
            password: 'root',
            database: 'emdata_emr_prod_378'
        }
    },
    mongo: {
        // dburl: "mongodb://127.0.0.1:27017/emdataBI"
        // dburl: "mongodb://root:emdata_2017_link_6029@10.168.0.101:3717/admin?replicaSet=mgset-4496273",
        dburl: "mongodb://10.10.10.45:20000",
        dbname: "emdataBI"
    },
    redis: {
        host: '10.10.10.80',
        port: '6379',
        usePool: true,
        password: '7e061213b7cffe044713b6f957a1c1ad'
    },
    mq: "amqp://guest:guest@10.168.0.122:5672",
    es: {
        //host: '127.0.0.1:9200',
        host: '10.10.10.40:9200',
        log: 'error'
    },
    account: {
        expire_in: 7200,
    },
    api: {
        chfcReport: 'http://data.chinahfc.org/index.php/Ym_api/ym_respond',
        // dmeodtReport: 'http://demo-dt.1mdata.com/v1/doc/imp'
        dmeodtReport: 'http://10.10.10.12:8080/emdata-docimp/v1/doc/imp'
    },
    //指定临时目录，如不指定为当前目录下的output
    output_path: '/tmp/bi',
    apiIp:'http://10.10.10.12:8080/',
    serviceId:{
        standardService:'emdata-standardize-service',
        commonService:'emdata-common-service',
        projectService:'emdata-platform-keydefine',
        etlMappingService:'em-etl-mapping',
        biService:'emdata-bi-service',
    },
    fdfs_client: {
        // tracker servers
        trackers: [{
            host: '10.10.10.16',
            port: 22122
        }],
        // 默认超时时间10s
        timeout: 10000,
        // 默认后缀
        // 当获取不到文件后缀时使用
        defaultExt: 'txt',
        // charset默认utf8
        charset: 'utf8'
    },
};

//10.27.20.177