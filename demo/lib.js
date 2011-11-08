var otherHello = require("./libOther").otherHello;

exports.hello = function (msg) {
    otherHello(msg);
};
