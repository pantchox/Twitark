var fs = require('fs');
var util = require('util');
var _ = require('lodash');

function checkConfigPaths(paths) {
    paths = paths || ['error in loading config file'];
    var errors = [];
    paths.forEach(function(path) {
        if (!fs.existsSync(path)) {
            errors.push('Path: ' + path + ' - doesn\'t exists');
        }
    });
    return errors;
}

var env = process.env.NODE_ENV || 'development';
var configFile = __dirname + util.format('/%s.config.js', env);

if (!fs.existsSync(configFile)) {
    console.log(env, 'config file is missing');
    process.exit(1);
}

var configData = require(configFile);
var configPathsErrors = checkConfigPaths(_.values(configData.paths));
if (configPathsErrors.length > 0) {
    console.log(configPathsErrors.join('\n'));
    process.exit(1);
}

module.exports = configData;