var request = require("request");
//var needle = require("needle"); 
//var logger=require('../../models/logger')
var httpUtil = {

    post: async function (url, data) {
        this.post(url, data, null);
    },
    post: async function (url, data, ticket) {
        var headers = {
            "content-type": "application/json",
        };
        if (ticket != null) {
            headers.ticket = ticket;
        }
        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: "POST",
                json: true,
                headers: headers,
                body: data
            }, function (error, response, data) {
                if (!error && response.statusCode == 200) {
                    resolve(data);
                }
            });
        })

    },
    put: async function (url, data, ticket) {
        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: "PUT",
                json: true,
                headers: {
                    "content-type": "application/json",
                    ticket: ticket
                },
                body: data
            }, function (error, response, data) {
                if (!error && response.statusCode == 200) {

                    resolve(data);
                }


            });
        })

    },
    get: async function (url, data) {
        this.get(url, data, null);
    },
    get: async function (url, data, ticket) {
        var headers = {
            "content-type": "application/json",
        };
        if (ticket != null) {
            headers.ticket = ticket;
        }
        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: "GET",
                json: true,
                headers: headers,
                body: data
            }, function (error, response, data) {
                if (!error && response.statusCode == 200) {

                    resolve(data);
                } else {
                    // reject(reject);
                }


            });
        })

    },
    delete: async function (url, data, ticket) {
        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: "DELETE",
                json: true,
                headers: {
                    "content-type": "application/json",
                    ticket: ticket
                },
                body: data
            }, function (error, response, data) {
                if (!error && response.statusCode == 200) {

                    resolve(data);
                }


            });
        })

    },
    uploadPost: async function (option) {
        return new Promise(function (resolve, reject) {
            request(option
                , function (error, response, data) {
                    if (!error && response.statusCode == 200) {

                        resolve(data);
                    }


                });

        })
    },
    postForm: async function (url, data) {
        return new Promise(function (resolve, reject) {
            request({
                url: url,
                method: "POST",
                json: true,
                headers: {
                    "content-type": "multipart/form-data"
                },
                formData: data
            }, function (error, response, data) {
                if (!error && response.statusCode == 200) {
                    // 请求成功的处理逻辑

                    resolve(data);
                }
                // else{
                //     resolve(error);
                // }

            });
        })

    }


}
module.exports = httpUtil;