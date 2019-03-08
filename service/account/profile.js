const router = require('koa-router')();
var adminService = require('./service/adminServcie');
var api = require('../../models').api;

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.post('/info', async function(ctx, next) {
    var admin = await adminService.userInfo(ctx.state.user.id);
    // admin.user_pass = null;

    var menu = [];
    var index = 1;
    // menu.push({
    //     title: '数据工具',
    //     href: 'main.statistics.hospital',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [{
    //             title: '数据统计',
    //             href: 'main.statistics.hospital',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 1
    //         },
    //         {
    //             title: '导入数据',
    //             href: 'main.importData.logList',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 2
    //         }, {
    //             title: '导出数据',
    //             href: 'main.statistics.task',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 3
    //         },{
    //             title:'上传记录',
    //             href: 'main.importData.localUploadLog',
    //             icon: 'fa fa-circle-o',
    //             id: (index *10) + 4
    //         }
    //         //{
    //         //         title: '数据统计',
    //         //         href: 'main.statistics.hospital',
    //         //         icon: 'fa fa-circle-o',
    //         //         id: 41
    //         //     },
    //         //     {
    //         //         title: '心衰报告',
    //         //         href: 'main.xinshuai.list',
    //         //         icon: 'fa fa-circle-o',
    //         //         id: 51
    //         //     }, {
    //         //         title: '解析任务',
    //         //         href: 'main.monitor.task',
    //         //         icon: 'fa fa-circle-o',
    //         //         id: 61
    //         //     }
    //         //     // {
    //         //     //     title: '项目统计',
    //         //     //     href: 'main.project.list',
    //         //     //     icon: 'fa fa-circle-o',
    //         //     //     id: 42
    //         //     // }
    //     ]
    // });
    // menu.push({
    //     title:'导入数据',
    //     href:'main.importData.logList',
    //     icon: 'fa fa-circle-o',
    //     id:7,
    //     items:[]
    // });

    // menu.push({
    //     title: '心衰项目',
    //     href: 'main.xinshuai.list',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [{
    //             title: '生成报告',
    //             href: 'main.xinshuai.list',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 1
    //         },
    //         {
    //             title: '确认报告',
    //             href: 'main.xinshuai.import',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 2
    //         },
    //         {
    //             title: '心衰数据汇总',
    //             href: 'main.xinshuai.import',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 3
    //         }
    //     ]
    // });

    menu.push({
        title: '生成报告',
        href: 'main.xinshuai.list',
        icon: 'fa fa-circle-o',
        id: index++,
        items: [
        ]
    });

    menu.push({
        title: '确认报告',
        href: 'main.xinshuai.import',
        icon: 'fa fa-circle-o',
        id: index++,
        items: [
        ]
    });

    menu.push({
        title: '上报汇总',
        href: 'main.xinshuai.count',
        icon: 'fa fa-circle-o',
        id: index++,
        items: [
        ]
    });

    // menu.push({
    //     title: '解析任务',
    //     href: 'main.monitor.task',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [
    //         //{
    //         //title: '数据集',
    //         //href: 'main.xinshuai.list',
    //         //icon: 'fa fa-circle-o',
    //         //id: 51
    //         //}
    //     ]
    // });


    // menu.push({
    //     title: '基础数据',
    //     href: 'main.common',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [{
    //             title: '省市数据',
    //             href: 'main.baseData.province',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 1
    //         },
    //         {
    //             title: '医院科室',
    //             href: 'main.baseData.hosptial',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 2
    //         },
    //     ]
    // });

    // if (admin.adminInfo) {
    //     menu.push({
    //         title: '心衰报告',
    //         href: 'main.xinshuai',
    //         icon: 'fa fa-circle-o',
    //         id: 5,
    //         items: [{
    //                 title: '数据集',
    //                 href: 'main.xinshuai.list',
    //                 icon: 'fa fa-circle-o',
    //                 id: 51
    //             },
    //             // {
    //             //     title: '用户管理',
    //             //     href: 'main.xinshuai.detail',
    //             //     icon: 'fa fa-circle-o',
    //             //     id: 12
    //             // }
    //         ]
    //     });

    // menu.push({
    //     title: '系统管理',
    //     href: 'main.admin',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [
    //         // {
    //         //     title: '字段管理',
    //         //     href: 'main.admin.table',
    //         //     icon: 'fa fa-circle-o',
    //         //     id: (index * 10) + 1
    //         // }, 
    //         {
    //             title: '客户管理',
    //             href: 'main.admin.business',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 2
    //         },
    //         {
    //             title: '用户管理',
    //             href: 'main.admin.user',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 3
    //         }
    //         // {
    //         //     title: 'emr库管理',
    //         //     href: 'main.admin.emrdb',
    //         //     icon: 'fa fa-circle-o',
    //         //     id: (index * 10) + 4
    //         // }
    //         // {
    //         //     title: '数据源管理',
    //         //     href: 'main.admin.datasource',
    //         //     icon: 'fa fa-circle-o',
    //         //     id: 13
    //         // },
    //         // {
    //         //     title: '数据库管理',
    //         //     href: 'main.admin.statistics',
    //         //     icon: 'fa fa-circle-o',
    //         //     id: 14
    //         // },
    //     ]
    // });

    // menu.push({
    //     title: '客户管理',
    //     href: 'main.admin.business',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [
    //     ]
    // });

    // menu.push({
    //     title: '用户管理',
    //     href: 'main.admin.user',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [
    //     ]
    // });

    // menu.push({
    //     title: '用户信息',
    //     href: 'main.user',
    //     icon: 'fa fa-circle-o',
    //     id: index++,
    //     items: [{
    //             title: '个人信息',
    //             href: 'main.user.profile',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 1
    //         },
    //         {
    //             title: '安全退出',
    //             href: 'main.user.logout',
    //             icon: 'fa fa-circle-o',
    //             id: (index * 10) + 2
    //         },
    //     ]
    // });

    menu.push({
        title: '个人信息',
        href: 'main.user.profile',
        icon: 'fa fa-circle-o',
        id: index++,
        items: [
        ]
    });

    menu.push({
        title: '安全退出',
        href: 'main.user.logout',
        icon: 'fa fa-circle-o',
        id: index++,
        items: [
        ]
    });

    var result = { account: admin, menu: menu };
    ctx.json(api.data(result));
});
router.prefix('/profile');
module.exports = router;