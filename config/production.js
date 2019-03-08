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
        host: '39.105.157.104',
        user: 'root',
        password: '8952622Xa',
        database: 'emdata'
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
   
   
};

//10.27.20.177