var fs = require('fs');
var path = require('path');
var zipper = require('../classes/Zipper');
var generateMd5 = require('../classes/GenerateMD5');
var async = require('async');
var moment = require('moment');

if (process.cwd().split(path.sep).pop() === 'utils') {
    process.chdir('../');
}
var config = require('../config');

// consts
var VERSION = config.version;
var ENV = process.env.NODE_ENV || 'development';
var TWEETS_PATH = config.paths.tweets;
var TRENDS_PATH = config.paths.trends;
var ARCHVIES_PATH = config.paths.archives;

// helper functions
var getDirectories = function (srcpath, ignoreArr) {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory() && !ignoreArr.includes(file))
}

var writeArchiveZipFile = function (pathName, type, skipExisted, callback) {
    // Archive directory
    type = type || 'tweets';
    var dayZipFileName = `${pathName}-${type}.zip`;
    var daySourcePath;
    var dayZipFullName = path.join(ARCHVIES_PATH, dayZipFileName);
    if (type === 'tweets') {
        daySourcePath = path.join(TWEETS_PATH, pathName);
    } else if (type === 'trends') {
        daySourcePath = path.join(TRENDS_PATH, pathName);
    } else {
        return callback('Error in writeArchiveZipFile - not specific type defined [trends/tweets]');
    }

    if (skipExisted) {
        if (fs.existsSync(dayZipFullName)) {
            console.log(dayZipFileName, 'Archive exists - skipping');
            return callback();
        }
    }

    var zipperConfig = {
        type: 'dirzip',
        sourcePath: daySourcePath,
        insideZipFilePath: pathName,
        testArchive: true
    };

    var zipFile = new zipper(ARCHVIES_PATH, dayZipFileName, zipperConfig, function (err, bytes) {
        if (err) {
            return callback(`Error creating archive zip [${dayZipFullName}]`, err);
        } else {
            console.log(`Archive created [${dayZipFullName}] (${bytes}Kb)`);
            generateMd5(path.join(ARCHVIES_PATH, dayZipFileName), function(err, msg) {
                if (err) {
                    return callback(err);
                }
                if (msg) {
                    console.log(msg);
                }
                return callback();
            });
        }
    });
}

console.log('TwitArk CLI Util v' + VERSION);
console.log(`Current ENV: ${ENV}`);
console.log(`Current Tweets Path: ${TWEETS_PATH}`);
console.log(`Current Trends Path: ${TRENDS_PATH}`);
console.log(`Current Archives Path: ${ARCHVIES_PATH}`);
console.log();

var paths;
var rootPath;
var actionType = process.argv[2];
var errors = [];
var skipExistedArchive;
if (actionType === 'tweets') {
    rootPath = TWEETS_PATH;
    paths = process.argv.slice(3);
    if (!paths.length) {
        errors.push('No path(s) name to archive specified');
    }
    skipExistedArchive = false;
} else if (actionType === 'trends') {
    rootPath = TRENDS_PATH;
    paths = process.argv.slice(3);
    skipExistedArchive = false;
    if (!paths.length) {
        console.log('No path(s) specified to archive, will archive all exisiting paths in trends folder, but will skip existing archives in the destined archive path')
        paths = getDirectories(TRENDS_PATH, [moment().format('DD-MM-YYYY')]);
        skipExistedArchive = true;
        if (!paths.length) {
            errors.push('No existing path(s) to archive in trends folder');
        }
    }
} else {
    errors.push('Usage Examples:');
    errors.push('Archiving tweets path: node dailyArchiveCli.js tweets 17-01-2017');
    errors.push('Archiving tweets multiple paths: node dailyArchiveCli.js tweets 17-01-2017 20-01-2017');
    errors.push('Archiving all trends: node dailyArchiveCli.js trends');
    errors.push('Archiving trends path: node dailyArchiveCli.js trends 17-01-2017');
    errors.push('');
}

if (errors.length === 0) {
    console.log(`Processing ${paths.length} Directories:`)
    async.eachOfSeries(paths, function (pathToArchive, index, async_cb) {
        var fullPathToArchive = path.join(rootPath, pathToArchive);
        fs.stat(fullPathToArchive, function (err, stat) {
            if (err !== null && err.code === 'ENOENT') {
                console.log(`The directory: [${fullPathToArchive}] does not exist - skipped`);
                return async_cb(); // intentionally not raising error to continue iteration
            }
            console.log(`Creating Archive from: ${fullPathToArchive}...`);
            // TODO wrape the async_cb to show MD5 creation log?!
            writeArchiveZipFile(pathToArchive, actionType, skipExistedArchive, async_cb);
        });

    }, function (err) {
        if (err) console.log(err);
    });
} else {
    console.log(errors.join('\n'));
}