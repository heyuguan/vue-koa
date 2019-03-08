var config = require('../../../config');
var core = require('../../../models');
var q_name = config.fix + 'local_import';

var taskPush = {

    push: async function (data) {
        var mq = await this.queue();
        await mq.publish(q_name, data);
    },
    queue: async function () {
        if (!this.task_q) {
            this.task_q = new core.MQ();
            await this.task_q.connect(config.mq);
        }
        return this.task_q;
    }
}

module.exports = taskPush