var Dao = require("../../../models/mysql/MysqlDao");

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */

function opMedicalHistoryInfoDao(db) {
    this.db = db;
    this.countByHospital = async function(hospital_id) {
        var where = `
                SELECT
                    count(*) as num,min(imhi.in_datetime) as minTime,max(imhi.in_datetime) as maxTime
                FROM
                    op_medical_history_info imhi
                WHERE
                    imhi.hospital_id = ?`;

        return await this.db.queryOne(where, [hospital_id]);
    }
    this.monthByHospital = async function(hospital_id) {

        var where = `
            SELECT  
                count(imhi.id) as total, year(imhi.in_datetime) as year, month(imhi.in_datetime) as month
            FROM  
                op_medical_history_info imhi
            WHERE  
                imhi.hospital_id = ?
            GROUP BY  
                year(imhi.in_datetime), month(imhi.in_datetime)
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.deptByHospital = async function(hospital_id) {

        var where = `
            SELECT  
                count(imhi.id) as total, imhi.dept_name,
                min(imhi.in_datetime) as minTime,
                max(imhi.in_datetime) as maxTime
            FROM  
                op_medical_history_info imhi
            WHERE  
                imhi.hospital_id = ?
            GROUP BY  
                imhi.dept_name
        `;

        return await this.db.query(where, [hospital_id]);
    }
    this.findHospitals = async function() {
        var where = `select hospital_id  from op_medical_history_info group by hospital_id`;
        return await this.db.query(where, []);
    }
}
module.exports = opMedicalHistoryInfoDao;