module.exports = {
    debug: true,
    port: 9086,
    app_name: "emdata-bi-koa",
    task_server: true,
    web_server: true,
    fix: 'liushuai_',
    is_send_log:true,
    mysql: {
        connectionLimit: 10,
        host: '192.168.9.100',
        user: 'game',
        password: '1mdata',
        database: 'emdata_prod'
    },
    // hbase:{
    //     zookeeperHosts:["10.10.10.26:2181","10.10.10.27:2181","10.10.10.28:2181"],
    //     zookeeperRoot:"/hbase-unsecure",
    //     zookeeperReconnectTimeout:20000,
    //     rpcTimeout: 100000,
    //     callTimeout: 100000,
    //     tcpNoDelay: false,
    //     tcpKeepAlive: true
    // },
    platformDemo:{
        connectionLimit: 10,
        host: '10.10.10.13',
        user: 'root',
        password: 'root',
        database: 'emdata_platform_demo'
    },
    uinfo: {
        connectionLimit: 10,
        host: '192.168.9.100',
        user: 'game',
        password: '1mdata',
        database: 'emdata_emr'
    },
    emr: {
        "emr": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr'
        },
        "emr2": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr2'
        },
        "emr3": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr3'
        },
        "emr5": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr5'
        },
        "emr6": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr6'
        },
        "emr7": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr7'
        },
        "emr9": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr9'
        },
        "emr8": {
            connectionLimit: 10,
            host: '192.168.9.100',
            user: 'game',
            password: '1mdata',
            database: 'emdata_emr8'
        },
        "emdata_emr_loc_722": {
            connectionLimit: 10,
            host: '192.168.9.223',
            user: 'root',
            password: '123456',
            database: 'emdata_emr_loc_test'
        }
    },
    mongo: {
        dburl: "mongodb://192.168.9.223:27017/emdataBI"
    },
    redis: {
        host: '127.0.0.1',
        port: '6379'
        // host: '10.10.10.11',
        // port: '6379',
        // usePool: true,
        // password: 'emdata2018',
    },
    mq: "amqp://guest:guest@192.168.9.223:5672",
    // kafka:{
    //     host: "10.10.10.26:6667,10.10.10.27:6667,10.10.10.30:6667"
    // },
    es: {
        host: '192.168.9.223:9200',
        httpAuth: 'elastic:oN7SPwzlfJJhY0euMhPZ',
        log: 'error'
    },
    account: {
        expire_in: 7200,
    },
    api: {
        chfcReport: 'http://data.chinahfc.org/index.php/Ym_api/ym_respond',
        // dmeodtReport: 'http://demo-dt.1mdata.com/v1/doc/imp'
    },
    //指定临时目录，如不指定为当前目录下的output
    output_path: '/tmp/bi',
    apiIp:'http://10.10.10.12:8080/',
    serviceId:{
        commonService:'emdata-common-service',
        projectService:'emdata-platform-keydefine',
        etlMappingService:'em-etl-mapping',
        biService:'emdata-bi-service',
    },
    isMyDev : true,
    //本地版导入的包
    local_zip_path:'/data/local-zip',
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