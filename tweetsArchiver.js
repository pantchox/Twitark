var config = require('./config');
var Twit = require('twit')
var fs = require('fs');
var path = require('path');
var async = require('async');
var moment = require('moment');
var zipper = require('./classes/Zipper');
var loggerFunc = require('./classes/Logger');
var generateMd5 = require('./classes/GenerateMD5');
var rimraf = require('rimraf');

// consts
var VERSION = config.version;
var ENV = process.env.NODE_ENV || 'development';
var TWEETS_PATH = config.paths.tweets;
var ARCHVIES_PATH = config.paths.archives;
var ARCHIVE_MODE = config.archiveMode; // flag for archiving a day folder to the archives path
var DELETE_ARCHIVE_SOURCE_DIR = config.archiveDeleteSrcDir; // if true will delete the original folder after archiving
var FILTER_STREAM = config.filter.enable; // if true will connect to filter stream rather then sample stream

// helper functions
function getRandomArbitrary(min, max) {
    return parseInt(Math.random() * (max - min) + min, 10);
}

function loadFilterStreamOptions() {
    var optionsList = ['track', 'follow'];
    var returnOptions = {};

    optionsList.forEach(function(option) {
        if (config.filter[option]) {
            if (typeof config.filter[option]  === 'string') {
                // load the json file
                try {
                    returnOptions[option] = require('./' + config.filter[option]);
                } catch(e) {
                    throw 'Filter configuration of [' + option + '] is invalid, required file: [' + config.filter[option] + '] was not found';
                }
            } else if (Array.isArray(config.filter.track)) {
                // array list
                returnOptions[option] = config.filter[option];
            };
        }

    });
    return returnOptions;
}

function loadAdapters(logger, main) {
    var adapters = [];
    if (config.adapters && Array.isArray(config.adapters)) {
        async.eachOfSeries(config.adapters, function(adapter, index, async_cb) {
            try {
                var loadedAdapter = require('./adapters/' + adapter)(logger);
                // callback function to add adapter if there is no error
                var currentEachCallback = function(err) {
                    if (err) {
                        logger.error('Could not load adapter [' + adapter +'] from config: ' + err + ' - this adapter will be ignored!');
                    } else {
                        adapters.push({name: adapter, instance: loadedAdapter});
                    }
                    async_cb();
                };

                if (loadedAdapter.init) {
                    // adapter has init method, send callback to be called when done init
                    loadedAdapter.init(currentEachCallback);
                } else {
                    currentEachCallback();
                }
            } catch(err) {
                // skipping adapter
                logger.error('Could not load adapter [' + adapter +'] from config: ' + err + ' - this adapter will be ignored!');
                async_cb();
            }
        }, function() {
            // finished init adapters call main with loaded adapters
            main(adapters);
        });
    } else {
        // no adapters in config run without
        main(null);
    }
}

var writeTwitterArrayToZipFile = function (tweets, fileTimestamp, cb) {
    // cb param is for gracefull exit
    // Archive consumed whole minutes tweets
    if (tweets.length === 0) {
        logger.info('No tweets, no file to save');
        if (cb) {
            return cb();
        }
    }
    var monthPath = fileTimestamp.format("DD-MM-YYYY");
    var hourPath = fileTimestamp.format("HH");
    var fileHHmm = fileTimestamp.format("HH-mm");
    var postFixFileName = fileHHmm + '-' + Date.now() + '-' + getRandomArbitrary(100, 1000000) + '-' + tweets.length;
    var zipFileName = postFixFileName + '.zip';
    var insideZipFileName = postFixFileName + '.json';
    var zipPath = path.join(TWEETS_PATH, monthPath, hourPath);
    var zipFullName = path.join(zipPath, zipFileName);
    var zipperConfig = {
        type: 'memzip',
        insideZipFileName,
        fileData: JSON.stringify(tweets),
        testArchive: true
    };

    var zipFile = new zipper(zipPath, zipFileName, zipperConfig, function (err, bytes) {
        if (err) {
            logger.error(`Error saving zip [${zipFullName}]`, err);
        } else {
            logger.info(`Saved [${zipFullName}] (${bytes}Kb) with [${tweets.length}] tweets`);
        }
        if (cb) {
            cb(err);
        }
    });
}

var writeDailyArchiveZipFile = function (dailyTimestamp) {
    // Archive directory and delete it's contents if required by config
    var dayDirFormat = dailyTimestamp.format("DD-MM-YYYY");
    var dayZipFileName = dayDirFormat + "-tweets.zip";
    var daySourcePath = path.join(TWEETS_PATH, dayDirFormat);
    var dayZipFullName = path.join(ARCHVIES_PATH, dayZipFileName);
    var zipperConfig = {
        type: 'dirzip',
        sourcePath: daySourcePath,
        insideZipFilePath: dayDirFormat,
        testArchive: true
    };

    var zipFile = new zipper(ARCHVIES_PATH, dayZipFileName, zipperConfig, function (err, bytes) {
        if (err) {
            logger.error(`Error saving daily archive zip [${dayZipFullName}]`, err);
        } else {
            generateMd5(path.join(ARCHVIES_PATH, dayZipFileName), function (err) {
                logger.info(`Daily Archive Saved [${dayZipFullName}] (${bytes}Kb)`);
                if (err) {
                    logger.error(err);
                    if (DELETE_ARCHIVE_SOURCE_DIR) {
                        logger.error('MD5 Error, skipping delete action of tweets source path');
                    }
                } else {
                    if (DELETE_ARCHIVE_SOURCE_DIR) {
                        rimraf(daySourcePath, function(err) {
                            if (err) {
                                logger.error(`Error deleting tweets source path: ${daySourcePath}`);
                            } else {
                                logger.info(`Tweets source path: ${daySourcePath} - deleted`);
                            }
                        })
                    }
                }
            });
        }
    });
}

// ## program start ##
// init logging instance
var logger = loggerFunc(config.paths.logs, config.streamLogsPrefix);
logger.info('Init TwitArk Archiver v' + VERSION + ' ENV: ' + ENV);
logger.info('Mode: ' + (FILTER_STREAM ? 'Filter (statuses/filter)' : 'Sample (statuses/sample)'));
// init Twit Lib
var T = new Twit({
    consumer_key: config.twitterAPI.consumerKey,
    consumer_secret: config.twitterAPI.consumerSecret,
    access_token: config.twitterAPI.accessToken,
    access_token_secret: config.twitterAPI.accessTokenSecret,
    timeout_ms: config.twitterAPI.timeoutMs
});

var main = function(adapters) {
    // archiver mode, filter or sample
    if (FILTER_STREAM) {
        try {
            var filterOptions = loadFilterStreamOptions();
            if (Object.keys(filterOptions).length === 0) {
                throw 'Filter mode is enabled but missing valid configuration';
            }
        } catch(err) {
            logger.error(err);
            process.exit(1);
        }
        var stream = T.stream('statuses/filter', filterOptions);
    } else {
        var stream = T.stream('statuses/sample');
    }
    var minuteTweetsArray = [];
    var bufferStartMinuteTimestamp = moment();
    var programStartTimestamp = moment();
    var programCurrentTimestamp = moment();

    stream.on('tweet', function (tweet) {
        // in case this is the first tweet
        if (minuteTweetsArray.length === 0) {
            bufferStartMinuteTimestamp = moment();
        }

        var bufferCurrentMinuteTimeStamp = moment();
        var minuteTimestampDiff = (+bufferCurrentMinuteTimeStamp.format("mm")) - (+bufferStartMinuteTimestamp.format("mm"));
        if (minuteTimestampDiff !== 0) {
            // save original array for write file and clear the old one and push current tweet
            var minuteTweetsArrayCopywrite = Object.assign([], minuteTweetsArray);
            minuteTweetsArray = [];
            minuteTweetsArray.push(tweet);

            // save writefile timestamp and change the global start timestamp to current
            var fileTimestamp = bufferStartMinuteTimestamp.clone();
            bufferStartMinuteTimestamp = bufferCurrentMinuteTimeStamp;

            // write minute archive file
            writeTwitterArrayToZipFile(minuteTweetsArrayCopywrite, fileTimestamp);
            if (ARCHIVE_MODE) {
                var currentTimestamp = moment();
                var dateDiff = currentTimestamp.startOf('day')
                    .diff(programCurrentTimestamp.startOf('day'), 'days');
                //var dateDiff = currentTimestamp.diff(programCurrentTimestamp, 'seconds');
                //if (dateDiff > 120) {
                if (dateDiff > 0) {
                    logger.info('New daily tweets archive start');
                    writeDailyArchiveZipFile(programCurrentTimestamp);
                    programCurrentTimestamp = currentTimestamp.clone();
                }
            }
        } else {
            // add tweet to tweets array
            minuteTweetsArray.push(tweet);
            // call adapters
            if (adapters) {
                adapters.forEach(function(adapter) {
                    try {
                        adapter.instance.push(tweet);
                    } catch (e) {
                        logger.error('In adapter [' + adapter.name + '] - ' + e.message);
                    }
                });
            }
            //console.log(tweet.text);
            //process.stdout.write(".");
        }
    });

    stream.on('disconnect', (disconnectMessage) => {
        logger.warn('* Connection terminated');
        reject(disconnectMessage);
    });

    stream.on('connect', () => {
        logger.info('* Connection Attempted')
    });

    stream.on('connected', () => {
        logger.info('* Connection Successful')
    });

    stream.on('reconnect', (req, res, interval) => {
        logger.info(`* Reconnecting in ${interval / 1000.0} seconds`);
    });

    stream.on('warning', (warning) => {
        logger.warn(warning);
    });

    stream.on('parser-error', (err) => {
        // incase un-auth, happens when you change time for example
        logger.error('Parser Error', err);
    });

    stream.on('error', (err) => {
        logger.error('Stream Error', err);
    });

    process.on("SIGINT", function () {
        logger.info('* stopping stream listen');
        stream.stop();
        // call teardown of adapters if exists
        if (adapters) {
            async.eachOfSeries(adapters, function(adapter, index, async_cb) {
                try {
                    // if teardown method exists call it
                    if (adapter.instance.teardown) {
                        adapter.instance.teardown(function(err) {
                            delete adapter.instance;
                            async_cb(err);
                        });
                    } else {
                        delete adapter.instance;
                        async_cb();
                    }
                } catch (err) {
                    logger.error('In adapater [' + adapter.name + '] - ' + err);
                    async_cb();
                }
            }, function() {
                // write last minute file
                writeTwitterArrayToZipFile(minuteTweetsArray, bufferStartMinuteTimestamp, function() {
                    logger.info('exiting');
                    process.exit(0);
                });
            });
        } else {
            // write last minute file
            writeTwitterArrayToZipFile(minuteTweetsArray, bufferStartMinuteTimestamp, function() {
                logger.info('exiting');
                process.exit(0);
            });
        }
    });
};

var adapters = loadAdapters(logger, main);
