var config = require('./config');
var Twit = require('twit')
var fs = require('fs');
var path = require('path');
var moment = require('moment');
var zipper = require('./classes/Zipper');
var loggerFunc = require('./classes/Logger');
var generateMd5 = require('./classes/GenerateMD5');
var rimraf = require('rimraf');

// consts
var VERSION = 0.1;
var ENV = process.env.NODE_ENV || 'development';
var TWEETS_PATH = config.paths.tweets;
var ARCHVIES_PATH = config.paths.archives;
var ARCHIVE_MODE = config.archiveMode; // flag for archiving a day folder to the archives path
var DELETE_ARCHIVE_SOURCE_DIR = config.archiveDeleteSrcDir; // if true will delete the original folder after archiving

// helper functions
function getRandomArbitrary(min, max) {
    return parseInt(Math.random() * (max - min) + min, 10);
}

// Twit Lib init
var T = new Twit({
    consumer_key: config.twitterAPI.consumerKey,
    consumer_secret: config.twitterAPI.consumerSecret,
    access_token: config.twitterAPI.accessToken,
    access_token_secret: config.twitterAPI.accessTokenSecret,
    timeout_ms: config.twitterAPI.timeoutMs
});

//var stream = T.stream('statuses/filter', { track: 'mango' }) // Do this in the future release
var stream = T.stream('statuses/sample');
var logger = loggerFunc(config.paths.logs, config.streamLogsPrefix);

logger.verbose('Init Tweets Archiver v' + VERSION + ' ENV: ' + ENV);
var minuteTweetsArray = [];
var bufferStartMinuteTimestamp = moment();
var programStartTimestamp = moment();
var programCurrentTimestamp = moment();

var writeTwitterArrayToZipFile = function (tweets, fileTimestamp) {
    if (tweets.length === 0) {
        logger.warn('No tweets, no file to save');
        return;
    }
    var monthPath = fileTimestamp.format("DD-MM-YYYY");
    var hourPath = fileTimestamp.format("HH");
    var fileHHmm = fileTimestamp.format("HH-mm");
    var postFixFileName = fileHHmm + '_' + Date.now() + '_' + getRandomArbitrary(100, 1000000) + '_' + tweets.length;
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
                        logger.error('MD5 error, skipping delete action of tweets source path');
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

stream.on('tweet', function (tweet) {
    // case this is the first tweet
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
        writeTwitterArrayToZipFile(minuteTweetsArrayCopywrite, fileTimestamp, TWEETS_PATH);
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
        //console.log(tweet.text);
        process.stdout.write(".");
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
    // write last minute file
    writeTwitterArrayToZipFile(minuteTweetsArray, bufferStartMinuteTimestamp, TWEETS_PATH);
});
