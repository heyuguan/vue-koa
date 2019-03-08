module.exports = {
    debug: true,
    port: 9086,
    app_name: "emdata-bi-koa",
    task_server: true,
    web_server: true,
    fix: 'my_', //your name please
    mysql: {
        connectionLimit: 10,
        host: '127.0.0.1',
        user: 'root',
        password: '123456',
        database: 'emdata_prod'
    },
    uinfo: {
        connectionLimit: 10,
        host: '127.0.0.1',
        user: 'root',
        password: '123456',
        database: 'emdata_emr'
    },
    emr: {
        "emr": {
            connectionLimit: 10,
            host: '127.0.0.1',
            user: 'root',
            password: '123456',
            database: 'emdata_emr'
        }
    },
    mongo: {
        dburl: "mongodb://127.0.0.1:27017/emdataBI"
    },
    redis: {
        host: '127.0.0.1',
        port: '6379'
    },
    mq: "amqp://guest:guest@192.168.9.223:5672",
    es: {
        // host: '127.0.0.1:9200',
        // httpAuth: 'elastic:oN7SPwzlfJJhY0euMhPZ',
        host: '192.168.9.102:9200',
        log: 'error'
    },
    account: {
        expire_in: 7200,
    },
    //指定临时目录，如不指定为当前目录下的output
    //output_path: '/tmp/bi'
};