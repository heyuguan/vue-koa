
const router = require('koa-router')();
var crypto = require('crypto');
var uuid = require('node-uuid');
var core = require('../../models');
var api = require('../../models').api;
var logger = require('../../models').logger;
var utils = require('../../models').utils;
var config = require('../../config');
var fs = require('fs');
var importService = require('./service/importService');
var localUploadLogService = require('./service/localUploadLogService');
const send = require('koa-send');
const path = require('path');
var upload_path = path.join(__dirname, '../../upload');
var httpUitl = require('../../models/httpUtil');
var ObjectID = require("mongodb").ObjectID;


router.post('/upload',async function(ctx,next){
//baseUrl+"/unzip"
    let file = ctx.request.body.files.file;
    let hospital_id = ctx.request.body.fields.hospital_id;
    let emr_db = ctx.request.body.fields.emr_db;
    let reader = fs.createReadStream(file.path);
    let info = {
        db : emr_db,
        hospital_id: hospital_id,
        fileName : file.name
    }
    if (!fs.existsSync(upload_path)) {
        fs.mkdirSync(upload_path);
    }
    let stream = fs.createWriteStream(upload_path+'/'+file.name);
    reader.pipe(stream);
    ctx.json(api.data(info));

})
router.post('/import',async function(ctx,next){
    let info = ctx.request.body.info;
    // info.unZipPath = upload_path+'/unzip',
    info.upload_path = upload_path;
    logger.debug("info...",info);
    importService.importExcel(info);
    ctx.json(api.success());
})

router.post('/decode',async function(ctx,next){
    let info = ctx.request.body.info;
    //如果info.filePath 存在  则可能 目标是由 本地化 自动 上传来的 数据包
    info.output_path = info.filePath?info.filePath:upload_path;

    let buff = await importService.restExportFile(info);
    info.fileName += '.zip';
    let zipPath = upload_path+'/'+info.fileName;
    if(fs.existsSync(zipPath)){
        fs.unlinkSync(zipPath);
    }
    fs.writeFileSync(zipPath,buff);
    // fs.unlinkSync(zipPath);
    ctx.json(api.data(info));
})

router.post('/logList',async function(ctx,next){
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var result = await importService.logList(pageIndex, pageSize, query);


    if(result && result.items.length>0){
        for(let i = 0;i<result.items.length;i++){
            let item = result.items[i];
            let existName = "import_local_exist_log_" + item.info.hospital_id;
            let existDao = new core.MongoDao(core.mongo, existName);

            let name = "import_local_ids_log_" + item.info.hospital_id;
            let logsDao = new core.MongoDao(core.mongo, name);

            let existNum = await existDao.count({info_id:new ObjectID(item._id)});
            let logsNum = await logsDao.count({info_id:new ObjectID(item._id)});
            item.history_info_num = logsNum || 0;

            item.importMsg = `${item.importMsg},已导入：${logsNum}，已存在：${existNum}`;
        }
    }

    ctx.json(api.data(result));
})
router.post('/reset/:id',async function(ctx,next){
    var logId = ctx.params.id;
    await importService.reset(logId);
    ctx.json(api.success());
})
router.post('/retry/:id',async function(ctx,next){
    var logId = ctx.params.id;
    importService.retry(logId,upload_path);
    ctx.json(api.success());
})
//本地化 上传的文件
router.post('/localUpload',async function(ctx,next){
    let data = ctx.request.body.fields;
    //1.确认token （以后再说）
    if(!data.token){
        ctx.json(api.error("缺少token"));
        return ;
    }
    //2.确认localUploadLog 的id 数据
    if(!data.localUploadLogId){
        ctx.json(api.error("缺少上传日志id"));
        return;
    }
    let localUploadLog = await localUploadLogService.findById(data.localUploadLogId);
    if(!localUploadLog){
        ctx.json(api.error("通过:"+data.localUploadLogId+",未找到数据"));
        return ;
    }
    //3.确认无误后 获取文件 写入服务器
    if(!fs.existsSync(config.output_path)){
        fs.mkdirSync(config.output_path);
    }
    let localUploadPath = config.output_path+"/"+"local_upload";
    if(!fs.existsSync(localUploadPath)){
        fs.mkdirSync(localUploadPath);
    }
    localUploadPath += "/"+localUploadLog.emr_project_lode_id;
    if(!fs.existsSync(localUploadPath)){
        fs.mkdirSync(localUploadPath);
    }

    let body = ctx.request.body;
    let file = ctx.request.body.files.file;
    let fileName = data.fileName;
    let reader = fs.createReadStream(file.path);
    let stream = fs.createWriteStream(localUploadPath+"/"+fileName);
    reader.pipe(stream);
    stream.on('finish', async () => {

        //4.更新记录
        localUploadLog.zip_path = localUploadPath;
        localUploadLog.file_name = fileName;
        localUploadLog.status = 2;//正在上传中
        localUploadLog.update_date = new Date();
        localUploadLog.current_index = data.index;
        localUploadLog.file_count = data.count;
        //合并文件 判断data.count == data.index
        //如果 就一个文件 不需要 进行 合并 因为 一个文件 的时候 说明 没有进行 切分上传
        if(data.count==1){
            localUploadLog.status = 1;
            localUploadLog.zip_name = data.zipName;
        }else if(data.count==data.index){//当前 上传的文件 是最后一个啦 将要开始合并喽 
            let tempFiles = [];
            let tempFilesLength = 0;
            for(let i = 0;i < data.count; i++){
                let tempFile = fs.readFileSync(localUploadPath+"/"+"temp_"+i);
                tempFiles.push(tempFile);
                tempFilesLength += tempFile.length;
                fs.unlink(localUploadPath+"/"+"temp_"+i,(err)=>{
                    if(err){
                        logger.error(err);
                    }
                });
            }

            let tempBuffer = Buffer.concat(tempFiles,tempFilesLength);
            if(tempBuffer.length!=data.countLength){
                logger.error("不是完整的数据:合并后数据大小:"+tempBuffer.length+",文件应该大小:"+data.countLength);
                localUploadLog.status = 3;
            }else{
                logger.info("数据校验成功,准备写入合并后的文件::"+data.zipName);
                fs.writeFileSync(localUploadPath+"/"+data.zipName,tempBuffer);
                localUploadLog.status = 1
                localUploadLog.zip_name = data.zipName;
            }
        }
        await localUploadLogService.update(localUploadLog);

    });
    stream.on('error', async (error) => {
        logger.error(error);
        localUploadLog.status = -1;
        await localUploadLogService.update(localUploadLog);
        stream.end();
    });

    ctx.json(api.success());
})
//本地化 上传文件 之前的 请求
//用来创建 一个 上传记录
router.post('/localUploadLog',async function(ctx,next){
    let data = ctx.request.body;
    //1.确认token
    if(!data.token){
        ctx.json(api.error("缺少token"));
        return;
    }
    //2.数据完整性 ， 医院id 医院名称 
    if(!data.hospital_id || !data.hospital_name){
        ctx.json(api.error("缺少医院id或医院名称"));
        return;
    }
    //3.创建log  不存在 记录时 创建 记录 ， 存在时 则返回 _id 则会 覆盖文件
    var saveData = await localUploadLogService.findByLodeId(data.emr_project_lode_id);
    if(!saveData){
        saveData = {
            hospital_id : data.hospital_id,
            hospital_name : data.hospital_name,
            emr_project_lode_id :data.emr_project_lode_id,
            emr_project_manager_id : data.emr_project_manager_id,
            status:0,//未上传文件
            create_date : new Date()
        }
        await localUploadLogService.save(saveData);
    }
    //4.返回log的id  ，id用于 上传文件时 再次使用
    ctx.json(api.data({id:saveData._id}));
})
//显示 本地上传的记录
router.post('/localUploadLogList',async function(ctx,next){
    var pageIndex = ctx.request.body.pageIndex || 1;
    var pageSize = ctx.request.body.pageSize || 10;
    var query = ctx.request.body.query || {};
    var result = await localUploadLogService.logList(pageIndex, pageSize, query);
    ctx.json(api.data(result));
});

router.post('/downloadLocalUploadZip',async function(ctx,next){
    var zip_path = ctx.request.body.zip_path;
    var file_name = ctx.request.body.file_name;
    ctx.attachment(zip_path+"/"+file_name);
    await send(ctx, file_name, { root: zip_path });
});

router.post('/getImportConfig', async function(ctx, next){
    //从bi 服务中 获取 配置
    var url = config.apiIp + config.serviceId.biService + '/hospitalDb/list';
    var paegList = await httpUitl.post(url, ctx.request.body, null);
    ctx.json(paegList);
});

router.prefix('/importData');
module.exports = router;