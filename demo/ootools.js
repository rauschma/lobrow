"use strict";

exports.copyOwnTo = function(source, target) {
    Object.getOwnPropertyNames(source).forEach(function(propName) {
        Object.defineProperty(target, propName,
            Object.getOwnPropertyDescriptor(source, propName));
    });
    return target;
};
