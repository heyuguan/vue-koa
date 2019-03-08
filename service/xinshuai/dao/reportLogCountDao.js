var Dao = require("../../../models/mysql/MysqlDao");


function reportLogCountDao(db) {
    this.db = db;
    this.getHospitalIds = async function() {
        var where = `SELECT GROUP_CONCAT(DISTINCT(hospital_id)) "hospital_id" FROM hospital_report_log`;

        return await this.db.query(where,[]);
    }
    // this.getHospitalIds = async function() {
    //     var where = `SELECT hospital_id FROM hospital_report_log`;

    //     return await this.db.query(where,[]);
    // }
    this.getHfcHospitalId = async function(hospital_id) {

        var where = `SELECT DISTINCT hospital_id_chfc as "心衰医院id" FROM hospital_report_log WHERE hospital_id = ? AND hospital_id_chfc is not NULL`;

        return await this.db.query(where, [hospital_id]);
    }
    this.ipDateTime = async function(hospital_id) {

        var where = `
        SELECT
            MIN(ip_end_datetime) as "住院上报成功最小时间",
            MAX(ip_end_datetime) as "住院上报成功最大时间"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND disease_code = 'xinshuai'
        AND ip_state = 2
        AND ent_status = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.ipNumberNotFilter = async function(hospital_id) {
        var where = `
        SELECT
            COUNT(id) as "住院上报成功数未去重"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND ip_state = 2
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        `;
        return await this.db.query(where, [hospital_id]);
    }
    this.ipNumberFilter = async function(hospital_id){
        var where = `
        SELECT
            COUNT(DISTINCT patient_id) as "住院上报成功数去重"
        FROM
            hospital_report_log
        WHERE
            disease_code = 'xinshuai'
        AND ip_state = 2
        AND hospital_id = ?
        AND ent_status = 1
        `;
        return await this.db.query(where, [hospital_id]);
    }
    this.weekNumber = async function(hospital_id){
        var where = `
        SELECT
            COUNT(id) as "一周随访成功数"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND op_state_7d = 2
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        `;
        return await this.db.query(where, [hospital_id]);
    }
    this.oneMonthNumber = async function(hospital_id){
        var where = `
        SELECT
            COUNT(id) as "一个月随访成功数"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND op_state_1m = 2
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.threeMonthNumber = async function(hospital_id){
        var where = `
        SELECT
            COUNT(id) as "三个月随访成功数"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND op_state_3m = 2
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.oneYearNumber = async function(hospital_id){
        var where = `
        SELECT
            COUNT(id) as "一年随访成功数"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND op_state_1y = 2
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.opHave = async function(hospital_id){
        var where = `
        SELECT IF(SUM(a.7dcount)+SUM(b.1mcount)+SUM(c.3mcount)+SUM(d.1ycount) >0,"有","无") as "有无门诊" from 
        (SELECT COUNT(id) 7dcount FROM  hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_7d = 2) a,
        (SELECT COUNT(id) 1mcount FROM  hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1m = 2) b,
        (SELECT COUNT(id) 3mcount FROM  hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_3m = 2) c,
        (SELECT COUNT(id) 1ycount FROM  hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1y = 2) d 
        `;

        return await this.db.query(where, [hospital_id,hospital_id,hospital_id,hospital_id]);
    }
    // this.opDateTime = async function(hospital_id){
    //     var where = `
    //     SELECT LEAST(a.mindate,b.mindate,c.mindate,d.mindate) as "门诊最小时间",GREATEST(a.maxdate,b.maxdate,c.maxdate,d.maxdate) as "门诊最大时间" FROM
    //     (SELECT MIN(op_datetime_7d) mindate,MAX(op_datetime_7d) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_7d = 2) a,
    //     (SELECT MIN(op_datetime_1m) mindate,MAX(op_datetime_1m) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1m = 2) b,
    //     (SELECT MIN(op_datetime_3m) mindate,MAX(op_datetime_3m) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_3m = 2) c,
    //     (SELECT MIN(op_datetime_1y) mindate,MAX(op_datetime_1y) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1y = 2) d;
    //     `;

    //     return await this.db.query(where, [hospital_id,hospital_id,hospital_id,hospital_id]);
    // }
    this.opDateTime = async function(hospital_id){
        var where = `
        SELECT a.mindate a_mindate,b.mindate b_mindate,c.mindate c_mindate,d.mindate d_mindate,a.maxdate a_maxdate,b.maxdate b_maxdate,c.maxdate c_maxdate,d.maxdate d_maxdate FROM
        (SELECT MIN(op_datetime_7d) mindate,MAX(op_datetime_7d) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_7d = 2) a,
        (SELECT MIN(op_datetime_1m) mindate,MAX(op_datetime_1m) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1m = 2) b,
        (SELECT MIN(op_datetime_3m) mindate,MAX(op_datetime_3m) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_3m = 2) c,
        (SELECT MIN(op_datetime_1y) mindate,MAX(op_datetime_1y) maxdate FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ent_status = 1 AND op_state_1y = 2) d;
        `;

        return await this.db.query(where, [hospital_id,hospital_id,hospital_id,hospital_id]);
    }
    this.lastReportDate = async function(hospital_id){
        var where = `
        SELECT
        FROM_UNIXTIME(MAX(modify_date/1000)) as "最后上报日期"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        AND ip_state = 2
        `;
        return await this.db.query(where, [hospital_id]);
    }
    this.ipFailNumber = async function(hospital_id){
        var where = `
        SELECT
            COUNT(id) as "住院上报失败条数"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        AND ip_state = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.failReason = async function(hospital_id){
        var where = `
        SELECT
            GROUP_CONCAT(remark SEPARATOR ';') as "失败原因"
        FROM
            hospital_report_log
        WHERE
            hospital_id = ?
        AND disease_code = 'xinshuai'
        AND ent_status = 1
        AND ip_state = 1
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.ipMonth = async function(hospital_id){
        var where = `
        SELECT CONCAT_WS('-',m.\`年\`,m.\`月\`) as "月份",SUM(m.\`未去重上报数量\`) as "未去重上报数量",SUM(m.\`去重上报数量\`) as "去重上报数量" FROM 
        ((SELECT YEAR(ip_end_datetime) "年",MONTH(ip_end_datetime) "月",COUNT(id) "未去重上报数量",0 AS "去重上报数量" FROM hospital_report_log 
        WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ip_state = 2 AND ent_status = 1 GROUP BY YEAR(ip_end_datetime),MONTH(ip_end_datetime)) 
        UNION ALL
        (SELECT YEAR(a.ip_end_datetime) "年",MONTH(a.ip_end_datetime) "月",0 AS "未去重上报数量",COUNT(a.id) "去重上报数量" FROM
        (SELECT ip_end_datetime,id from hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND ip_state = 2 AND ent_status = 1 GROUP BY patient_id) a
        GROUP BY YEAR(a.ip_end_datetime),MONTH(a.ip_end_datetime))) m GROUP BY m.\`年\`,m.\`月\`
        `;

        return await this.db.query(where, [hospital_id,hospital_id]);
    }
    this.opMonth = async function(hospital_id){
        var where = `
        SELECT CONCAT_WS('-',a.\`年\`,a.\`月\`) as "月份",SUM(a.\`数量\`) as "数量"
        FROM 
        (
        SELECT YEAR(op_datetime_7d) "年",MONTH(op_datetime_7d) "月",COUNT(id) "数量" FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND op_state_7d = 2 AND ent_status = 1 GROUP BY YEAR(op_datetime_7d),MONTH(op_datetime_7d)
        UNION ALL
        SELECT YEAR(op_datetime_1m) "年",MONTH(op_datetime_1m) "月",COUNT(id) "数量" FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND op_state_1m = 2 AND ent_status = 1 GROUP BY YEAR(op_datetime_1m),MONTH(op_datetime_1m)
        UNION ALL
        SELECT YEAR(op_datetime_3m) "年",MONTH(op_datetime_3m) "月",COUNT(id) "数量" FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND op_state_3m = 2 AND ent_status = 1 GROUP BY YEAR(op_datetime_3m),MONTH(op_datetime_3m)
        UNION ALL
        SELECT YEAR(op_datetime_1y) "年",MONTH(op_datetime_1y) "月",COUNT(id) "数量" FROM hospital_report_log WHERE hospital_id = ? AND disease_code = 'xinshuai' AND op_state_1y = 2 AND ent_status = 1 GROUP BY YEAR(op_datetime_1y),MONTH(op_datetime_1y)
        ) a GROUP BY a.\`年\`,a.\`月\`
        `;
        return await this.db.query(where, [hospital_id,hospital_id,hospital_id,hospital_id]);
    }
}
module.exports = reportLogCountDao;