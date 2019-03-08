var FdfsClient = require('fdfs');
var logger = require("./logger");

function Fdfs() {
    this.fdfs = null;
    this.debug = false;

    this.connect = function (fdfs_client_json) {
        if (this.debug) {
            logger.info('Connecting to FdfsClient...', fdfs_client_json);
        }
        this.fdfs = new FdfsClient(fdfs_client_json);
    };

    this.uploadFile = async function (filePath, options) {
        var fdfs = this.fdfs;
        return new Promise(function (resolve, reject) {
            fdfs.upload(filePath, options).then(function (fileId) {
                // fileId 为 group + '/' + filename
                console.log("##-->>uploadFile:" + fileId);
                resolve({fileId: fileId});
            }).catch(function (err) {
                console.error(err);
                reject(err);
            }
            );
        })
    };

    this.del = async function (fileId) {
        var fdfs = this.fdfs;
        return new Promise(function (resolve, reject) {
            // 删除文件
            fdfs.del(fileId).then(function () {
                // 删除成功
                resolve({fileId: fileId});
            }).catch(function (err) {
                logger.error(err);
                console.error(err);
                reject(err);
            }
            );
        })
    };

    this.download = async function (fileId, path) {
        var fdfs = this.fdfs;
        return new Promise(function (resolve, reject) {
            fdfs.download(fileId, path).then(function() {
                // 下载完成
                resolve({fileId: fileId});
            }).catch(function(err) {
                logger.error(err);
                console.error(err);
                reject(err);
            }
            );
        })
    };
};

module.exports = Fdfs;