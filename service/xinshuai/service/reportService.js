var config = require('../../../config');
var core = require('../../../models');
var q_name = config.fix + 'chfc_report';
var get = require('simple-get');
var md5 = require('md5');
var uuid = require('uuid');
var moment = require('moment');
var configDao = require('../dao/configDao'); // 主表
var importHFDao = require('../dao/importHFDao'); // 字表


var s = {
    get: async function (options) {
        return new Promise(function (resolve, reject) {
            get.concat(options, function (err, res, rs) {
                if (err) {
                    console.error(err);
                    return reject(err);
                }
                return resolve(rs);
            });
            // get(options, function (err, res) {
            //     if (err) {
            //         console.error(err);
            //         return reject(err);
            //     }
            //     var rs = '';
            //     res.on('data', function (chunck) {
            //         rs += chunck;
            //     });
            //     res.on('end', function () {
            //         return resolve(rs);
            //     });
            // });
        });
    },
    push: async function (ID) {
        var mq = await this.queue();
        await mq.publish(q_name, {
            ID: ID
        });
    },
    queue: async function () {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    },
    process: async function () {
        var q = await this.queue();
        var _this = this;
        await q.consumer(q_name, async function (data) {
            var ID = data.ID;

            // 数据转换
            var body = [];
            var data = await importHFDao.find({
                'ID': ID
            });
            var message;
            var report_data = {};
            if (data && data.ID) {
                // if (data.report_code == '1') {
                //     console.warn(ID + ' has already reported');
                //     return;
                // }

                // 根据字符串长度,计算结果
                function cal_by_name_length(key) {
                    if (data[key] && data[key].length > 0) {
                        return 1;
                    } else {
                        return 2;
                    }
                }

                // 根据是/否,计算结果
                function cal_by_yes_no(key) {
                    if (data[key] == '是') {
                        return 1;
                    } else if (data[key] == '否') {
                        return 2;
                    }
                }

                // 转换时间格式
                function cal_date_format(key) {
                    if (data[key]) {
                        var time_ms = new Date(data[key]).getTime().toString();
                        var time_s = time_ms.substring(0, time_ms.length - 3)
                        return time_ms;
                    }
                }

                // 医院标示
                var config_data = await configDao.findById(data.info_id);
                var hospital_id = null;
                if (config_data && config_data.hfc_hospital_id) {
                    hospital_id = config_data.hfc_hospital_id;
                }

                // [destKey,srcKey,cal_function]
                var convert_cal_rels = [
                    ['orgid', 'hospital_id', function (key) { // 医院标示映射
                        return hospital_id;
                    }],
                    ['hos_number', '住院号'],
                    ['name', '住院号'], // 测试用
                    // ['bein_time', ''],
                    ['leave_time', '出院时间', cal_date_format],
                    ['in_time', '出院时间', cal_date_format],
                    // ['hospitalization_reasons', ''],
                    ['is_heart_cd', '房颤/房扑', cal_by_yes_no],
                    ['result_bnp', 'BNP'],
                    ['is_chaox', '超声心动', cal_by_yes_no],
                    ['shex_score', 'EF值'],
                    ['is_acei', 'ACEI类药物名称', cal_by_name_length],
                    ['is_arb', 'ARB类药物名称', cal_by_name_length],
                    ['is_beta', 'β受体阻断剂药物名称', cal_by_name_length],
                    ['is_ald', '醛固酮受体拮抗剂药物名称', cal_by_name_length],
                    ['nitrate_drugs', '离院方式', function (key) {
                        return 1;
                    }],
                    ['inotropic_action_of_vein', '离院方式', function (key) {
                        if (data[key] == '医嘱离院') {
                            return 1;
                        } else if (data[key] == '医嘱转院') {
                            return 2;
                        } else if (data[key] == '死亡') {
                            return 3;
                        } else if (data[key] == '自动离院') {
                            return 4;
                        } else {
                            return 5;
                        }
                    }],
                    ['is_suibl', '袢利尿剂药物名称', cal_by_name_length],
                    ['k_nj', '抗凝药物名称', cal_by_name_length]
                ];

                convert_cal_rels.forEach(function (convert_cal_rel) {
                    if (convert_cal_rel.length == 3) {
                        report_data[convert_cal_rel[0]] = convert_cal_rel[2](convert_cal_rel[1]);
                    } else {
                        report_data[convert_cal_rel[0]] = data[convert_cal_rel[1]];
                    }
                });

                if (report_data.orgid) {
                    body.push(report_data);

                    // 签名算法
                    var securet_key = 'Api0c57ef59942e018a765b09f51f55af3f';
                    // 时间戳
                    var now = Date.now().toString();
                    var time_stamp = now.substring(0, now.length - 3);
                    console.log('时间戳: ' + time_stamp);
                    // 随机串
                    var random_str = uuid.v1().substring(0, 8);
                    console.log('随机串: ' + random_str);
                    // 排序
                    var str = [time_stamp, random_str, securet_key].sort().join('');
                    console.log('签名前字符串: ' + str);
                    // 签名
                    var sign_str = md5(str).toUpperCase();
                    console.log('签名后字符串: ' + sign_str);

                    var url = config.api.chfcReport + '?timeStamp=' + time_stamp + '&randomStr=' + random_str + '&signature=' + sign_str;
                    console.log(url);

                    var rs = await _this.get({
                        url: url,
                        method: 'POST',
                        body: body,
                        headers: {
                            'timeStamp': time_stamp,
                            'randomStr': random_str,
                            'signature': sign_str
                        },
                        json: true,
                        timeout: 10000
                    });

                    console.info(rs);
                    await importHFDao.update({
                        'report_result': rs,
                        'report_code': rs ? rs.code : null,
                        'report_msg': rs ? rs.msg : null,
                        'report_data': JSON.stringify(report_data)
                    }, {
                        'ID': ID
                    });
                } else {
                    console.warn(ID + ' hfc_hospital_id not config');
                }
            } else {
                console.warn(ID + ' not found');
            }
        }, 2);
    }
}

module.exports = s;