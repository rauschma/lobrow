"use strict";

var ootools = require("./ootools");

exports.StringSet = function (other) {
    this.data = {};
    if (other instanceof exports.StringSet) {
        ootools.copyOwnTo(other.data, this.data);
    } else {
        // arguments is not an array; borrow forEach
        Array.prototype.forEach.call(arguments, function(elem) {
            this.add(elem);
        }, this); // pass "this" on to the function
    }
};

exports.StringSet.prototype.toString = function() {
    return "StringSet("+Object.keys(this.data).join(", ")+")";
};

exports.StringSet.prototype.add = function(elem) {
    if (typeof elem !== "string") {
        throw new TypeError("Argument is not a string: "+elem);
    }
    this.data[elem] = true;
    return this; // allow method chaining
};

exports.StringSet.prototype.contains = function(elem) {
    // Comparison ensures boolean result
    return this.data[elem] === true;
};
