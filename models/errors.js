/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
var errors = {
    CUSTOM: function(msg) {
        return { errno: 500, errText: msg };
    },
    WHAT_REQUIRE: function(msg) {
        return { errno: 501, errText: "缺少参数 " + msg };
    }
}

module.exports = errors;