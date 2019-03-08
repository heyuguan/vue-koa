var ObjectID = require("mongodb").ObjectID;

var assert = require('assert');  
var crypto = require('crypto');  

var u = {
    //baseTime: 1508225619000,
    baseTime: 1420041600000,
    autoId: function() {
        var timestamp = Date.parse(new Date());
        var n = 8;
        var num = (timestamp - this.baseTime) + '';
        console.log(num);
        var i = num.length;
        while (i++ < n)
            num = num + '0';
        num = num + this.randNum(1000, 9999);
        return parseInt(num);
    },
    randNum: function(Min, Max) {
        var Range = Max - Min;
        var Rand = Math.random();
        return (Min + Math.round(Rand * Range));
    },
    randStr: function(n) {
        var chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        var res = "";
        for (var i = 0; i < n; i++) {
            var id = Math.ceil(Math.random() * 35);
            res += chars[id];
        }
        return res;
    },
    uuid: function() {
        return (new ObjectID()).toHexString();
    },
    des:function(param) { 
         
        var key = new Buffer(param.key);  //加密/解密key
        var iv = new Buffer(param.iv ? param.iv : 0)  
        var plaintext = param.plaintext  //加密/解密数据
        var alg = param.alg  
        var autoPad = param.autoPad 
        //加密
        function encrypt () {
            //encrypt  
            var cipher = crypto.createCipheriv(alg, key, iv);  
            cipher.setAutoPadding(autoPad)  //default true  
            var ciph = cipher.update(plaintext, 'utf8', 'hex');  
            ciph += cipher.final('hex');  
            // console.log(alg, ciph)  
            return ciph;
        }
        //解密
        function decrypt () {
        //decrypt  
            var decipher = crypto.createDecipheriv(alg, key, iv);  
            decipher.setAutoPadding(autoPad)  
            var txt = decipher.update(plaintext, 'hex', 'utf8');  
            txt += decipher.final('utf8');  
            // console.log("txt",txt)      ;
            return txt;
        // assert.equal(txt, plaintext, 'fail');  
        }
    
        return {
            encrypt : encrypt,
            decrypt : decrypt

        }
      
    

    }  
}
module.exports = u;