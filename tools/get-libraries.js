//TODO
/*
    Проверять наличие папки для чекаута
    Смотреть в process.argv[]
*/

var Vow = require('vow'),
    exec = require("child_process").exec,
    Path = require("path"),
    fs = require("fs"),
    inherit = require('inherit'),
    moduleConfig = require('../../enb/lib/config/module-config');

var api = inherit(moduleConfig, {   

    __constructor: function() {
        this.__base();
        this._libraries = {};
    },

    addLibraries: function(newLibraries) {

        var libs = this._libraries;
        var newLibs = Object.keys(newLibraries);

        newLibs.forEach(function(lib) {

            if (libs.hasOwnProperty(lib)) {

                var props = Object.keys(newLibraries[lib]);
                props.forEach(function(prop) {

                    libs[lib][prop] = newLibraries[lib][prop];
                })

            } else {
                libs[lib] = newLibraries[lib];
            }
        })
        return this;
    },

    checkoutLibraries: function(enbTask) {

        var _this = this;
        this.exec();

        var promise;
        var libs = this._libraries;
        var libNames = Object.keys(libs);

        promise = Vow.all(libNames.map(function(libName) {

            var lib = libs[libName];
            lib.treeish = lib.treeish || "master";

            return _this.getLibState(lib, libName)
                .then(function(state) {
                    enbTask.log(state + ' ' + libName);
                    // console.log(lib);
                    if (state !== "exist") {
                        promiseExec(
                            commands[state]
                                .replace(/\{lib.url\}/g, lib.url)
                                .replace(/\{lib.Name\}/g, libName)
                                .replace(/\{lib.treeish\}/g, lib.treeish)
                        ).then(function() {

                        }, function(err) {
                            enbTask.log(err + ' ' + libName)
                        });
                    } else {

                    }
                },
                function(error) {
                    enbTask.log(error + ' ' + libName)
                })
        }))

        return promise;
    },

    getLibState: function(lib, path) {

        var promise = Vow.promise();
        var state = "doesn't exist";
        if (fs.existsSync(Path.resolve(path))) {
            state = "exist";

            this.getLibRepositoryInfo(path, lib.url)
                .then(function(info) {
                    if (info.indexOf(lib.treeish) === -1) {
                        state = "another branch";
                    } else if (typeof info === 'string') {
                        state = info;
                    }
                    promise.fulfill(state)
                },
                function(error) {
                    promise.reject(error);
                })

        } else {
            promise.fulfill(state)
        }
        return promise;
    },

    getLibRepositoryInfo: function(path, url) {
        var promise = Vow.promise();
        var repositoryInfo = [];
        var cd = "cd "+path+" && ";

        promiseExec(cd + "git config --get remote.origin.url")
            .then(function(stdout) {
                var remote = stdout.split("\n")[0];
                console.log(remote);
                if (remote !== url) {
                    promise.fulfill('another repository');
                    return;
                }
                promiseExec(cd + "git rev-parse HEAD")
                    .then(function(stdout) {
                        var hash = stdout.split("\n")[0];
                        repositoryInfo.push(hash);
                        return promiseExec(cd + "git describe --always --tag");
                    })
                    .then(function(stdout) {
                        var tag = stdout.split("\n")[0];
                        repositoryInfo.push(tag);
                        return promiseExec(cd + "git rev-parse --abbrev-ref HEAD");
                    })
                    .then(function(stdout) {
                        var branch = stdout.split("\n")[0];
                        repositoryInfo.push(branch);
                        promise.fulfill(repositoryInfo)
                    });
            },
            function(error) {
                promise.reject(error);
            });
        return promise;
    }
})

var promiseExec = function(cmd) {
    var promise = Vow.promise();
    exec(cmd, function(error, stdout, stderr) {
        if (error !== null) {
            promise.reject(error);
            return;
        }
        if (stderr !== "") {
            promise.reject(stderr);
            return;
        }
        promise.fulfill(stdout);
    });
    return promise;
}

var commands = {
    "doesn't exist": "git clone {lib.url} {lib.Name} && cd {lib.Name} && git checkout {lib.treeish}",
    "another branch": "cd {lib.Name} && git checkout {lib.treeish}"
};

module.exports = function(config) {
    return config.registerModule('enb-checkout', new api());
}