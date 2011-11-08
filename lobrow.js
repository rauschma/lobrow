/**
 * Normalized name (extension ".js" is cut off)
 * - "../foo" = file foo in the directory above the current directory
 * - "" = current file
 * - "foo" = a sibling of the current file
 * - "bar/foo" = descend into bar to get to file foo
 *
 * Import name:
 * - "./foo" look for a sibling of the current file
 * - "../foo" look for "foo" in the directory above the current file
 */
var lobrow = function() {
    // A function whose name starts with an underscore is exported for unit tests only
    var e = {};
    
    //----------------- Internal constants
        
    /**
     * The file where everything starts.
     * Important: siblings must be correctly resolved. Example:
     * "./foo" resolved against e._START_FILE must become "foo"
     */
    e._START_FILE = "__START__"; // pseudo-name
    e._CURRENT_DIRECTORY = "";

    //----------------- Public interface

    /** body: function (m1, m2, ...) */
    e.main = function (importNames, body) {
        // "" means: the current file (which is the context for all loading)
        loadModules(normalizeImportNames(e._START_FILE, importNames), function (modules) {
            body.apply(null, modules);
        });
    }

    //----------------- Loading

    var moduleCache = {};
    var currentlyLoading = {};
    
    /**
     * @param callback has the signature function(moduleArray)
     * @return an array with the values of the modules named in `normalizedNames`
     */
    function loadModules(normalizedNames, callback) {
        if (normalizedNames.length === 0) {
            // Nothing to load, call back immediately
            callback([]);
        }
        var moduleCount = 0;
        var modules = [];
        normalizedNames.forEach(function (normalizedName, i) {
            if (moduleCache.hasOwnProperty(normalizedName)) {
                storeModule(i, normalizedName, moduleCache[normalizedName]);
            } else {
                loadRemotely(i, normalizedName);
            }
        });
        function loadRemotely(index, normalizedName) {
            if (currentlyLoading[normalizedName]) {
                throw new Error("Cycle: module '"+normalizedName+"' is already loading");
            }
            currentlyLoading[normalizedName] = true;
            var req = new XMLHttpRequest();
            req.open('GET', normalizedName+".js", true);
            // In Firefox, a JavaScript MIME type means that the script is immediately eval-ed
            req.overrideMimeType("text/plain");
            req.onreadystatechange = function(event) {
                if (req.readyState === 4 /* complete */) {
                    evaluateModule(normalizedName, req.responseText, function (result) {
                        delete currentlyLoading[normalizedName];
                        moduleCache[normalizedName] = result;
                        storeModule(index, result);
                    });
                }
            }
            req.send();
        }
        function storeModule(index, value) {
            modules[index] = value;
            moduleCount++;
            if (moduleCount >= normalizedNames.length) {
                callback(modules);
            }
        }
    }
    
    function evaluateModule(normalizedModuleName, source, callback) {
        var importNames = e._extractImportNames(source);
        // Wrap a function around the bare body, so that we can invoke it
        // Parens are necessary, so it won't be mistaken for a statement
        var moduleBody = eval("(function (require,exports,module) {"+source+"})");
        var normalizedNames = normalizeImportNames(normalizedModuleName, importNames);
        loadModules(normalizedNames, function(modules) {
            var moduleDict = e._zipToObject(importNames, modules);
            runEvaluatedBody(moduleBody, moduleDict, callback);
        });
    }
    
    // Match quoted text non-greedily (as little as possibly)
    var REQUIRE_REGEX = /require\s*\(\s*(["'])(.*?)\1\s*\)/g;
    e._extractImportNames = function (source) {
        var importNames = [];
        var match;
        while(match = REQUIRE_REGEX.exec(source)) {
            importNames.push(match[2]);
        }
        return importNames;
    }
    
    /**
     * moduleBody: (function (require, exports, module) {})
     */
    function runEvaluatedBody(moduleBody, moduleDict, callback) {
        var module = {
            require: function (importName) {
                return moduleDict[importName];
            },
            exports: {}
        };
        moduleBody(module.require, module.exports, module);
        callback(module.exports);
    }
    
    //----------------- Normalize module names

    /**
     * Either:
     * - Object: maps a global module name to either a path or an object (the module)
     * - Function: takes a global name and returns a path or an object
     */
    e.globalNames = {};

    function normalizeImportNames(baseName, importNames) {
        return importNames.map(function (importName) {
            return e._resolveImportName(baseName, importName);
        });
    }

    /**
     * The behavior of this function is modeled after Node’s url.resolve
     * http://nodejs.org/docs/latest/api/url.html#url.resolve
     */
    e._resolveImportName = function (baseName, importName) {
        if (!e._isLegalNormalizedName(baseName)) {
            throw new Error("Illegal normalized name: "+baseName);
        }
        if (startsWith(importName, "/")) {
            // absolute name
            return importName;
        }
        if (startsWith(importName, "./") || startsWith(importName, "../")) {
            // relative name: go down in current directory (possibly after going up)
            baseName = e._goToParentDir(baseName); // go to current directory
        
            if (startsWith(importName, "./")) {
                importName = removePrefixMaybe("./", importName);
            } else {
                while (startsWith(importName, "../")) {
                    // going up
                    importName = removePrefixMaybe("../", importName);
                    baseName = e._goToParentDir(baseName);
                }
            }
            // Now go down
            return e._descend(baseName, importName);
        } else {
            // global name
            var resolvedName;
            if (typeof e.globalNames === "function") {
                resolvedName = e.globalNames(importName);
            } else {
                resolvedName = e.globalNames[importName];
            }
            switch(typeof resolvedName) {
                case "object": // also result for null, but can't happen here
                    if (!moduleCache[importName]) {
                        moduleCache[importName] = resolvedName;
                    }
                    return importName;
                case "string":
                    return resolvedName;
                case "undefined":
                    throw new Error("Unknown global name: "+importName);
                default:
                    throw new Error("Illegal mapping value: "+resolvedName);
            }
        }
    };

    e._goToParentDir = function (name) {
        if (name === "") {
            return "..";
        }
        if (/^[.][.]([/][.][.])*$/.test(name)) {
            // We are currently *only* going up (as opposed to going up and down)
            return "../"+name;
        }
        
        // We are going down (possibly after going up)
        // => we can go up by removing the last path name segment
        var slashIndex = name.lastIndexOf("/");
        if (slashIndex < 0) {
            return e._CURRENT_DIRECTORY;
        } else {
            return name.slice(0, slashIndex);
        }
    };
    
    e._descend = function (base, path) {
        if (base.length === 0) {
            return path;
        } else {
            return base + "/" + path;
        }
    };

    e._isLegalNormalizedName = function (name) {
        // Can be absolute
        // Can be relative: "../foo" or "bar", but not "./bar"
        // Must be a JS file after appending ".js"
        return !endsWith(name, "/") && !startsWith(name, "./");
    };
    
    //----------------- Helpers
    
    e._zipToObject = function (keys, values) {
        if (keys.length !== values.length) {
            throw new Error("Both arrays must have the same length: "+keys+" "+values);
        }
        var obj = {};
        for (var i=0; i<keys.length; i++) {
            obj[keys[i]] = values[i];
        }
        return obj;
    }
    
    function removePrefixMaybe(prefix, str) {
        if (str.indexOf(prefix) === 0) {
            return str.slice(prefix.length);
        } else {
            return str;
        }
    }

    function startsWith(str, prefix) {
        return str.indexOf(prefix) === 0;
    }
    
    function endsWith(str, suffix) {
        var index = str.lastIndexOf(suffix);
        return index >= 0 && index === str.length - suffix.length;
    }

    //----------------- Done
    return e;
}();
