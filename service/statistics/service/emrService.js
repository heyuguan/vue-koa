var IpDao = require('../dao/ipMedicalHistoryInfoDao');
var OpDao = require('../dao/opMedicalHistoryInfoDao');
var hospitalDao = require('../../baseData/dao/hospitalDao');

var emrService = {
    countByHospital: async function(db, hospital) {
        var id = hospital.hospital_id;
        var _ipdao = new IpDao(db);
        var ipInfo = await _ipdao.countByHospital(id);
        var ipMonth = await _ipdao.monthByHospital(id);
        var ipDept = await _ipdao.deptByHospital(id);

        var _opdao = new OpDao(db);
        var opInfo = await _opdao.countByHospital(id);
        var opMonth = await _opdao.monthByHospital(id);
        var opDept = await _opdao.deptByHospital(id);

        var result = {
            hospital_id: id,
            hospital_name: hospital.name || hospital.hospital_name,
            ip_count: ipInfo.num,
            ip_min_date: ipInfo.minTime,
            ip_max_date: ipInfo.maxTime,
            ip_month: ipMonth,
            ip_dept: ipDept,
            op_count: opInfo.num,
            op_min_date: opInfo.minTime,
            op_max_date: opInfo.maxTime,
            op_month: opMonth,
            op_dept: opDept,
            update_date: new Date()
        };
        return result;
    },
    findHospitals: async function(db) {
        var _ipdao = new IpDao(db);
        var _opdao = new OpDao(db);

        var hids1 = await _ipdao.findHospitals();
        var hids2 = await _opdao.findHospitals();

        var hids = [];
        for (var i in hids1) {
            var hospital_id = hids1[i].hospital_id;
            if (hids.indexOf(hospital_id) <= -1) {
                hids.push(hospital_id);
            }
        }

        for (var i in hids2) {
            var hospital_id = hids2[i].hospital_id;
            if (hids.indexOf(hospital_id) <= -1) {
                hids.push(hospital_id);
            }
        }

        var list = [];
        for (var i = 0; i < hids.length; i++) {
            var hospital_id = hids[i];
            var info = await hospitalDao.findById(hospital_id);
            if (info) {
                list.push({
                    hospital_id: hospital_id,
                    name: info.name
                });
            }
        }
        return list;
    }
};

module.exports = emrService;