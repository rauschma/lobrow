"use strict";

var strset = require("./strset");

describe('strset', function () {
    it('creates sets via the constructor', function () {
        var sset = new strset.StringSet("a");
        expect(sset.contains("a")).toBeTruthy();
        expect(sset.contains("b")).toBeFalsy();
    });
    it('copies sets via the constructor', function () {
        var orig = new strset.StringSet("a");
        var copy = new strset.StringSet(orig);
        expect(copy.contains("a")).toBeTruthy();
        expect(copy.contains("b")).toBeFalsy();
    });

    it("throws an exception if add() argument is illegal", function () {
        expect(function() {
            new strset.StringSet().add(3);
        }).toThrow(new TypeError("Argument is not a string: 3"));
    });
});
