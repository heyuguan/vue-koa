var projectDao = require('../dao/projectDao');


var s = {
    projectPagelist: async function(pageIndex, pageSize, query) {
        var pagelist = await projectDao.pageList(pageIndex, pageSize, {});
        return pagelist;
    }
};

module.exports = s;