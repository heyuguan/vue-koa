var tableService = require('../../table/service/tableService');
var statisticsService = require('../../statistics/service/statisticsService');
var emrService = require('../../emr/service/emrService');
var core = require('../../../models');
var config = require('../../../config');
var pushJobDao = require('../dao/pushJobDao');
var redis = require("redis");
var q_name = config.fix + 'push_search';
// var kue = require('kue'),
//     queue = kue.createQueue({
//         prefix: 'q',
//         redis: config.redis
//     });

// queue.watchStuckJobs();

var max_keyword_match_count = 2;
var max_keyword_desc_length = 20;
var s = {
    tasks: {},
    findTableInfo: async function (info_id, table_id) {
        var key = "search_table_" + info_id + '_' + table_id;
        var table_infostr = await core.redis.get(key);
        var table_info = null;
        if (table_infostr) {
            try {
                table_info = JSON.parse(table_infostr);
            } catch (e) {
                core.logger.error(e);
            }
        }

        if (!table_info || !table_info.names || !table_info.info || !table_info.table || !table_info.childs) {
            table_info = {};
            var info = await statisticsService.dbInfoById(info_id);
            var entTable = await tableService.findTableById(table_id);
            entTable.fields = await tableService.findFieldListByTableId(table_id);
            var names = {};
            for (var f in entTable.fields) {
                var field = entTable.fields[f];
                names[field.field_name] = field.title;
            }
            var childTables = await tableService.tableList({ parent_id: table_id });
            for (var i = 0; i < childTables.length; i++) {
                var table = childTables[i];
                childTables[i].fields = await tableService.findFieldListByTableId(table._id + '');
                for (var f in childTables[i].fields) {
                    var field = childTables[i].fields[f];
                    names[table.table_name + '.' + field.field_name] = field.title;
                }
            }

            table_info.info = info;
            table_info.table = entTable;
            table_info.childs = childTables;
            table_info.names = names;
            if (table_info.info && table_info.table && table_info.childs) {
                await core.redis.set(key, JSON.stringify(table_info), 6 * 60 * 60);
            }
        }

        if (!table_info || !table_info.info || !table_info.table || !table_info.childs) {
            return null;
        }

        return table_info;
    },
    findKeyword: function (fieldList, obj, keyword, match_info) {
        if (!keyword) {
            return;
        }

        for (var j = 0; j < fieldList.length; j++) {
            var field_name = fieldList[j].field_name;
            var title = fieldList[j].title;
            var val = obj[field_name] + '';
            var index = val.indexOf(keyword);
            if (index > -1) {
                m = {};
                m.key = field_name;
                m.title = fieldList[j].title;
                if (index > max_keyword_desc_length) {
                    var end = index + max_keyword_desc_length + keyword.length;
                    end = val.length < end ? val.length : end;
                    var endstr = val.length > end ? '...' : '';
                    val = '...' + val.substring(index - max_keyword_desc_length, end) + endstr;
                }
                m.value = val;
                match_info.push(m);
            }

            if (match_info.length > max_keyword_match_count) {
                break;
            }
        }
    },
    findKeywords: function (fieldList, list, keywords, match_info) {
        var arr = keywords.split(/ /g);
        for (var i = 0; i < arr.length; i++) {
            var keyword = arr[i];
            this.findKeyword(fieldList, list, keyword, match_info);
            if (match_info.length > max_keyword_match_count) {
                break;
            }
        }
        return match_info;
    },
    findAllKeywords: function (fieldList, list, keywords, match_info) {
        for (var c = 0; c < list.length; c++) {
            this.findKeywords(fieldList, list[c], keywords, match_info);
            if (match_info.length > max_keyword_match_count) {
                break;
            }
        }
    },
    query: async function (info_id, table_id, keyword, pageIndex, pageSize) {
        var from = pageSize * (pageIndex - 1);
        q = {
            match_all: {}
        };
        var arr = keyword.split(/ /g);
        if (keyword && arr.length == 1) {
            q = {
                simple_query_string: {
                    query: '\"' + keyword + '\"',
                    default_operator: "and"
                }
            };
        } else if (arr.length > 1) {
            q = {
                bool: {
                    should: []
                }
            }
            for (var i = 0; i < arr.length; i++) {
                q.bool.should.push({
                    simple_query_string: {
                        query: '\"' + arr[i] + '\"',
                        default_operator: "and"
                    }
                });
            }
        }

        // q = {
        //     bool: {
        //         should: [{
        //                 "bool": {
        //                     "should": [{
        //                         "simple_query_string": {
        //                             "query": "\"心血管\""
        //                         }
        //                     }, {
        //                         "simple_query_string": {
        //                             "query": "\"343919\""
        //                         }
        //                     }],
        //                     minimum_should_match: 1
        //                 }
        //             },
        //             {
        //                 "bool": {
        //                     "should": [{
        //                         "simple_query_string": {
        //                             "query": "\"感染性\""
        //                         }
        //                     }],
        //                     minimum_should_match: 1
        //                 }
        //             }
        //         ],
        //         minimum_should_match: 2
        //     }
        // };

        var body = {
            size: pageSize,
            from: from,
            query: q,
            highlight: {
                pre_tags: ["<span class='text-red'>"],
                post_tags: ["</span>"],
                fields: {
                    "*": {},
                    "_all": {}
                },
                fragment_size: 20,
                number_of_fragments: 5
            }
        }

        core.logger.warn(JSON.stringify(body.query));
        var table_info = await this.findTableInfo(info_id, table_id);

        // var index = 'em_r_' + table_info.info.hospital_id + '_' + table_info.info.db + '_' + table_id;
        var index = 'em_r_' + table_info.info.hospital_id + '_' + table_info.info.hospital_db_id + '_' + table_id;
        var result = await core.elasticsearch.client.search({ index: index, body: body });

        var list = [];

        var entTable = table_info.table;
        var fieldList = table_info.table.fields;
        var childTables = table_info.childs;

        for (var i = 0; i < result.hits.hits.length; i++) {
            var item = result.hits.hits[i];

            var obj = {};
            var match_info = {};
            for (var j = 0; j < fieldList.length; j++) {
                var field_name = fieldList[j].field_name;
                var val = item._source[field_name];
                obj[field_name] = val;
            }

            //obj.highlight = item.highlight;
            var match_info = [];
            //core.logger.warn(item);
            if (item.highlight) {
                var highlight = item.highlight;
                for (var k in highlight) {
                    var item = {
                        title: table_info.names[k],
                        value: highlight[k]
                    };
                    match_info.push(item);
                }
                obj.highlight = match_info;
            } else {
                this.findKeywords(fieldList, item._source, keyword, match_info);
                for (var k = 0; k < childTables.length; k++) {
                    var table = childTables[k];
                    var clist = item._source[table.table_name] || [];
                    this.findAllKeywords(table.fields, clist, keyword, match_info);
                    if (match_info.length > max_keyword_match_count) {
                        break;
                    }
                }
                obj.match_info = match_info;
            }

            list.push(obj);
        }

        var data = {
            items: list,
            total: result.hits.total,
            pageIndex: pageIndex,
            pageSize: pageSize
        };

        return data;
    },
    // delIndex: async function(hospital_id, db, table_id) {
    //     try {
    //         var index = 'em_r_' + hospital_id + '_' + db + '_' + table_id;
    //         await core.elasticsearch.client.indices.delete({ index: index });
    //         // await core.elasticsearch.client.indices.create({ index: index });
    //     } catch (e) {
    //         core.logger.error(e);
    //     }
    // },
    delIndex: async function (hospital_id, hospital_db_id, table_id) {
        try {
            var index = 'em_r_' + hospital_id + '_' + hospital_db_id + '_' + table_id;
            await core.elasticsearch.client.indices.delete({ index: index });
            // await core.elasticsearch.client.indices.create({ index: index });
        } catch (e) {
            core.logger.error(e);
        }
    },
    push: async function (info_id, table_id) {
        var info = await statisticsService.dbInfoById(info_id);
        var entTable = await tableService.findTableById(table_id);

        // await this.delIndex(info.hospital_id, info.db, table_id);
        await this.delIndex(info.hospital_id, info.hospital_db_id, table_id);

        // //获取主表id
        // //插入任务
        var pageIndex = 1;
        var pageSize = 100;
        var dataList = await emrService.pageList(info, entTable, pageIndex, pageSize, {});

        var pageCount = parseInt((dataList.total + pageSize - 1) / pageSize);

        var mq = await this.queue();

        var task_id = core.utils.uuid();

        var _this = this;
        for (var page = 1; page <= pageCount; page++) {
            var list = await emrService.pageList(info, entTable, page, pageSize, {});
            for (var i = 0; i < list.items.length; i++) {
                var index = ((page - 1) * pageSize) + i + 1;
                var item = {
                    task_id: task_id,
                    info_id: info_id,
                    hospital_id: info.hospital_id,
                    // db: info.db,
                    total: dataList.total,
                    index: index,
                    table_id: table_id,
                    data_id: list.items[i].id,
                    hospital_db_id: info.hospital_db_id
                };

                await mq.publish(q_name, item);
            }
        }
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
            await _this.pushToEs(data);
        }, 2);
    },
    formatData: function (obj, fields) {
        var new_obj = {};
        for (var i in fields) {
            var field_name = fields[i].field_name;
            var val = obj[field_name];
            var data_type = fields[i].data_type;;
            if (!data_type) {
                data_type = field_name.indexOf('date') > -1 ? 'date' : '';
            }
            if (!data_type) {
                data_type = field_name.indexOf('time') > -1 ? 'date' : '';
            }

            if (data_type == 'date') {
                val = val || new Date();
            } else if (data_type == 'number') {
                val = val || 0;
            } else {
                val = (val || '') + '';
            }
            new_obj[field_name] = val;
        }
        if (!new_obj.id && obj.id) {
            new_obj.id = obj.id;
        }
        return new_obj;
    },
    formatDatas: function (list, fields) {
        var res = [];
        for (var j = 0; j < list.length; j++) {
            var obj = list[j];
            var new_obj = this.formatData(obj, fields);
            res.push(new_obj);
        }
        return res;
    },

    buildData: async function (info_id, table_id, data_id) {
        var table_info = await this.findTableInfo(info_id, table_id);
        if (!table_info) {
            core.logger.warn('table_info is null!');
            return null;
        }

        var obj = await emrService.findById(table_info.info, table_info.table, data_id);
        var data = this.formatData(obj, table_info.table.fields);
        for (var i = 0; i < table_info.childs.length; i++) {
            var table = table_info.childs[i];
            if (table && table.table_name) {
                try {
                    var vals = JSON.parse(table.data_id_key);
                    var q = {};
                    for (var key in vals) {
                        var val = obj[key];
                        q[vals[key]] = val;
                    }
                    var list = await emrService.findData(table_info.info, table, q);
                    var res = this.formatDatas(list, table.fields);
                    data[table.table_name] = res;
                } catch (e) {
                    core.logger.error(e);
                    core.logger.error(table.table_name + '==>' + table.data_id_key);
                }
            }
        }

        return data;
    },
    pushToEs: async function (obj) {
        try {
            var data = await s.buildData(obj.info_id, obj.table_id, obj.data_id);
            if (!data) {
                core.logger.warn('data is null!');
                return;
            }
            // var index = 'em_r_' + obj.hospital_id + '_' + obj.db + '_' + obj.table_id;
            var index = 'em_r_' + obj.hospital_id + '_' + obj.hospital_db_id + '_' + obj.table_id;
            //'emr_' + obj.info_id + '_' + obj.table_id;
            var type = 'table_' + obj.table_id;
            await core.elasticsearch.client.create({
                index: index,
                type: type,
                id: obj.data_id,
                body: data
            });
        } catch (e) {
            core.logger.error(e);
        }
    }
}

//if (config.task_server) {
// queue.process("push_search_", function(job, done) {
//     console.log('...skip...');
//     done();
// });
//}

//  queue.shutdown(5000, function (err) {
//      console.log('Kue shutdown: ', err || '');
//      process.exit(0);
//  });

module.exports = s;