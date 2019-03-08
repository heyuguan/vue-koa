const elasticsearch = require('elasticsearch');
var logger = require("./logger");


function Elasticsearch() {
    this.client = null;
    this.connect = function(connStrJson) {
        this.client = new elasticsearch.Client(connStrJson);

    };
}
module.exports = Elasticsearch;