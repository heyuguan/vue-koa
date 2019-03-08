/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
module.exports = {
    success: function(msg, code, data) {
        return { success: true, msg: msg || 'ok', code: code || 200, data: data || null };
    },
    error: function(msg, code, data) {
        return { success: false, msg: msg || 'error', code: code || 500, data: data || null };
    },
    data: function(data) {
        return this.success('ok', 200, data);
    },
    result: function(success, msg, code, data) {
        return { success: success, msg: msg || 'ok', code: code || 200, data: data || null };
    }
};