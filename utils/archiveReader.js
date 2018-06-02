var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var extractZip = require('node-7z');
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
var getDirectoriesForRange = function(srcpath, dateStart, dateEnd) {
    return fs.readdirSync(srcpath)
        .filter(file => {
            return fs.statSync(path.join(srcpath, file)).isDirectory() && moment(file, 'DD-MM-YYYY') >= dateStart && moment(file, 'DD-MM-YYYY') <= dateEnd;
        });
}
var getDirectories = function(srcpath, ignoreArr) {
    ignoreArr = ignoreArr || [];
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory() && !ignoreArr.includes(file))
}

var getDirectoriesByArray = function(srcpath, directories) {
    directories = directories || [];
    if (directories.length === 0) return directories;
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory() && directories.includes(file))
}

var getArchivesByArray = function(srcpath, archives) {
    archives = archives || [];
    if (archives.length === 0) return archives;
    archives = archives.map(archive => `${archive}-tweets.zip`);
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isFile() && archives.includes(file))
}

var getArchivesForRange = function(srcpath, dateStart, dateEnd) {
    return fs.readdirSync(srcpath)
        .filter(file => {
            var fileSplit = file.split('-tweets.zip');
            var fileDate = fileSplit[0];
            return fs.statSync(path.join(srcpath, file)).isFile() && 
            path.extname(file).toLowerCase() === '.zip' &&
            fileSplit.length > 1 && // this is the check its in the format if not it will be length 1
            moment(fileDate, 'DD-MM-YYYY') >= dateStart && 
            moment(fileDate, 'DD-MM-YYYY') <= dateEnd;
        });
}

var getFiles = function (srcpath, extension) {
    return fs.readdirSync(srcpath)
        .filter(file => fs.statSync(path.join(srcpath, file)).isFile() && path.extname(file).toLowerCase() === '.' + extension)
}

var sortByDate = function(directoriesOrFilesArray) {
    // moment 2nd param formatter can init normal date strings and also file with this string structure of '17-09-2017-whateverIsHere...`
    return directoriesOrFilesArray.sort(function(a, b) {
        var aDate = moment(a, 'DD-MM-YYYY');
        var bDate = moment(b, 'DD-MM-YYYY');
        return aDate < bDate ? -1 : 1;
    });
}

var processDirectories = function(rootPath, paths = [], finish_cb) {
    var processingErrors = [];
    async.eachOfSeries(paths, function (datePath, index, async_cb) {
        var fullPathToRead = path.join(rootPath, datePath);
        var hoursPath = getDirectories(fullPathToRead);
        async.eachOfSeries(hoursPath, function(hourPath, index, async_cb_hoursPath) {
            var hourPathFiles = getFiles(path.join(fullPathToRead, hourPath), 'zip');
            async.eachOfSeries(hourPathFiles, function(hourPathFile, index, async_cb_hoursPathFiles) {
                var archiveExtract = new extractZip();
                var zipFile = path.join(fullPathToRead, hourPath, hourPathFile);
                var jsonFile = path.join(process.cwd(), 'tmp', hourPathFile.replace('.zip', '.json'));
                var processingJsonLocation = datePath + '\\' + hourPath + '\\' + hourPathFile.replace('.zip', '.json');
                var processingZipLocation = datePath + '\\' + hourPath + '\\' + hourPathFile;
                console.log('Processing', processingJsonLocation, '...');
                archiveExtract.extractFull(zipFile, 'tmp')
                .then(function() {
                    try {
                        var jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
                    } catch (e) {
                        throw "json";
                    }
                    
                    var meta = {
                        date: datePath,
                        hour: hourPath,
                        minute: hourPathFile.split('_')[0].split('-')[1],
                        fileName: jsonFile,
                        length: jsonData.length,
                        data: jsonData
                    }
                    console.log('Pushing - ', processingJsonLocation);
                    fs.unlinkSync(jsonFile);
                    adapter.pushBulk(meta, async_cb_hoursPathFiles);
                    // return async_cb_hoursPathFiles();
                    return;
                })
                .catch(function(err) {
                    var errMessage;
                    if (err === 'json') {
                        err = 'Could not parse JSON file, zip file might be corrupted';
                        errMessge = 'Error in file: ' + processingJsonLocation + ' - Skipped: ' + err;
                    } else {
                        err = err || 'Unzip error occurred';
                        errMessge = 'Error in file: ' + processingZipLocation + ' - Skipped: ' + err;
                    }
                    console.log(errMessge);
                    processingErrors.push(errMessge);
                    // intentionally not raising error in async since we want to continue the process
                    return async_cb_hoursPathFiles();
                });
            }, function () {
                return async_cb_hoursPath();
            });
        }, function () {
            return async_cb();
        })
    }, function () {
        if (finish_cb) {
            finish_cb(processingErrors);
        } else {
            // no callback show the errors
            console.log('Done');
            console.log();
            if (processingErrors.length > 0) {
                console.log('Few errors occurred:');
                console.log(processingErrors.join('\n'));
            }
            process.exit();
        }
    });
}

var processArchives = function(rootPath, archives = []) {
    var processingErrors = [];
    async.eachOfSeries(archives, function(archive, index, async_cb) {
        console.log('Extracting', archive, 'to temp directory...');
        var archiveExtract = new extractZip();
        var zipFile = path.join(rootPath, archive);
        // no need to validate the extracted date path since it was check before getting here
        var archiveDirectoryByDate = archive.split('-tweets.zip')[0];
        var archiveTempPath = path.join('tmp', archiveDirectoryByDate );
        archiveExtract.extractFull(zipFile, 'tmp')
        .then(function() {
            console.log('Processing', archive, '...');
            return processDirectories(process.cwd(), [archiveTempPath], function(processDirectoriesErrors) {
                // delete the directory
                if (processDirectoriesErrors && processDirectoriesErrors.length && processDirectoriesErrors.length > 0) {
                    processingErrors = processingErrors.concat(processDirectoriesErrors)
                }
                var deleteArchiveTempPath = path.join(process.cwd(), archiveTempPath);
                console.log('Deleting temp directory for ', deleteArchiveTempPath);
                rimraf(deleteArchiveTempPath, function(err) {
                    if (err) {
                        var errMessage = 'Error deleting temp directory ' + deleteArchiveTempPath;
                        console.log(errMessage);
                        processingErrors.push(errMessage);
                    }
                });
                async_cb();
            })
        })
        .catch(function err(err) {
            var errMessge = 'Error in ' + processingLocation + ' - Skipped: ' + err;
            console.log(errMessge);
            processingErrors.push(processingLocation);
            return async_cb();
        });
    }, function () {
        if (processingErrors.length > 0) {
            console.log('Few errors occurred:');
            console.log(processingErrors.join('\n'));
            console.log('Done');
        } else {
            console.log('Done');
        }
        process.exit();
    });
}

var errorExit = function(errMessage) {
    console.log(errMessage && Array.isArray(errMessage) ? errMessage.join('\n') : errMessage);
    process.exit(1);
}

console.log('TwitArk Archive Reader Util v' + VERSION);
console.log(`Current ENV: ${ENV}`);
console.log(`Current Tweets Path: ${TWEETS_PATH}`);
console.log(`Current Archives Path: ${ARCHVIES_PATH}`);
console.log();

var rootPath;
var errors = [];
var range = false;
var actionType = process.argv[2];

// Get action type of which folder to read from archives or tweets
if (actionType === 'tweets') {
    rootPath = TWEETS_PATH;
} else if (actionType === 'archives') {
    rootPath = ARCHVIES_PATH;
} else {
    errors.push('Usage Examples:');
    errors.push('Where <adapter> is a javacript adapter file name (with no .js extension)');
    errors.push('Reading tweets date path: node archiveReader.js tweets <adapter> 17-01-2017');
    errors.push('Reading tweets date path with hashtags echo adapter example: node archiveReader.js tweets examples/echo/hashtagsAdapter 17-01-2017');
    errors.push('Reading tweets multiple paths: node dailyArchiveCli.js tweets <adapter> 17-01-2017 20-01-2017 ...');
    
    errors.push('Reading archives path file: node archiveReader.js archives <adapter> 17-01-2017');
    errors.push('Reading archives path multiple files: node dailyArchiveCli.js archives <adapter> 17-01-2017 20-01-2017');

    errors.push('Reading tweets multiple paths within date range: node dailyArchiveCli.js archives <adapter> range:17-01-2017#20-01-2017');
    errors.push('Reading archives path multiple files within date range: node archiveReader.js archives <adapter> range:17-01-2017#20-01-2017');
    errors.push('');
    errorExit(errors);
}

// get adapter
var adapterName = process.argv[3];
if (!adapterName) {
    errorExit('No adapter name was specified');
}
// check if it exists
if (!fs.existsSync(path.join(process.cwd(), 'adapters',adapterName + '.js'))) {
    errorExit('Adapter ' + adapterName + ' doesn\'t exist');
}
var adapter = require('../adapters/' + adapterName + '.js')();
if (adapter.init) {
    adapter.init(function() {});
}

// Process the dates to read
var paths = process.argv.slice(4); 
if (!paths.length) {
    errorExit('No date(s) specified');
}

if (
    paths.length === 1 &&
    paths[0].toLowerCase().startsWith('range:') &&
    paths[0].includes('#')
) {
    range = true;
    var dates = paths[0].slice(6).split('#');
    var fromDate = moment(dates[0], 'DD-MM-YYYY');
    var toDate = moment(dates[1], 'DD-MM-YYYY');
    if (!fromDate.isValid() || !toDate.isValid()) {
        errorExit('Invalid range dates formats, please use format DD-MM-YYYY\nExample: `range:22-01-2018#25-01-2018`');
    }

    var dayDiff = toDate.diff(fromDate, 'days');
    if (dayDiff < 1) {
        errorExit('Invalid date ranges, equal or end date is bigger then start date');
    }
}

if (actionType === 'tweets') {
    if (range) {
        paths = getDirectoriesForRange(rootPath, fromDate, toDate);
    } else {
        paths = getDirectoriesByArray(rootPath, paths);
    }
    
    if (paths.length === 0) {
        errorExit('No directories were found to read');
    }
    paths = sortByDate(paths);
    processDirectories(rootPath, paths);
} else if (actionType === 'archives') {
    var archiveFiles = paths;
    if (range) {
        archiveFiles = getArchivesForRange(rootPath, fromDate, toDate);
    } else {
        archiveFiles = getArchivesByArray(rootPath, archiveFiles);
        if (archiveFiles.length === 0) {
            errorExit('No archive files were found to read');
        }
    }
    archiveFiles = sortByDate(archiveFiles);
    // now for each archive we need to extract is and process its directory
    processArchives(rootPath, archiveFiles);
}

var terminateAR = function() {
    // call teardown of adapters if exists
    if (adapter.teardown) {
        adapter.teardown(function() {
            console.log('TwitArk Archive Reader STOP');
            process.exit(0);
        });
    } else {
        console.log('TwitArk Archive Reader STOP');
        process.exit(0);
    }
};

process.on("SIGINT", function () {
    terminateAR();
});

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error.message);
  terminateAR();
});