var Vow = require('vow');
var exec = require("child_process").exec;
var Path = require("path");
var fs = require("fs");

var mergeLibraries = function(oldConfig, newConfig) {

    var config = oldConfig;
    var newLibs = Object.keys(newConfig);

    newLibs.forEach(function(lib) {

        if (config.hasOwnProperty(lib)) {

            var props = Object.keys(newConfig[lib]);
            props.forEach(function(prop) {

                config[lib][prop] = newConfig[lib][prop];
            })

        } else {
            config[lib] = newConfig[lib];
        }
    })
    return config;
}

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
    })
    return promise;
}

var getLibRepositoryInfo = function(path, url) {
    var promise = Vow.promise();
    var repositoryInfo = [];
    var cd = "cd "+path+" && ";

    promiseExec(cd + "git config --get remote.origin.url")
        .then(function(stdout) {
            var remote = stdout.split("\n")[0];
            console.log(remote)
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
            promise.reject(error)
        })
    return promise;
}

var getLibState = function(lib, path) {

    var promise = Vow.promise();
    var state = "doesn't exist";
    if (fs.existsSync(Path.resolve(path))) {
        state = "exist";

        getLibRepositoryInfo(path, lib.url)
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
}

var commnads = {
    "doesn't exist": "git clone {lib.url} libName && cd {lib.Name} && git checkout {lib.treeish}",
    "another branch": "cd {lib.Name} && git checkout {lib.treeish}"
};

var num;

var api = {
    setNumber: function(i) {
        num = i;
    },
    getLibraries: function() {
        console.log(num);
    }
}

module.exports = function(config) {
    return config.registerModule('enb-checkout', api);
}

// module.exports = function(task, config) {
//     var promise;
//     var libs = mergeLibraries(config.libraries || {}, config.personalLibraries || {});
//     var libNames = Object.keys(libs);
//     var lib;

//     promise = Vow.all(libNames.map(function(libName) {

//         lib = libs[libName];
//         lib.treeish = lib.treeish || "master";

//         return getLibState(lib, libName)
//             .then(function(state) {
//                 task.log(state + ' ' + libName)
//                 // if (state !== "exist") {
//                 //     task.shell(commnads[state]);
//                 // } else {

//                 // }
//             },
//             function(error) {
//                 task.log(error + ' ' + libName)
//             })
//     }))

//     return promise;
// }
