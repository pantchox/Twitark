var config = require('./config');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var filendir = require('filendir');
var Twit = require('twit');
var moment = require('moment');
var Jobber = require('./classes/Jobber');
var loggerFunc = require('./classes/Logger');
var countriesIds = require('./includes/countriesIds');

// consts
var VERSION = config.version;
var ENV = process.env.NODE_ENV || 'development';
var TRENDS_PATH = config.paths.trends;

// helper functions
var getRandomArbitrary = function(min, max) {
    return Math.random() * (max - min) + min;
}

var twitterRateLimitCalcDelay = function(twitterHeaderDate, twitterHeaderRateResetDate) {
    var twitterDate = moment(twitterHeaderDate, "ddd, DD MMM YYYY HH:mm:ss Z");
    var meDate = moment();
    var dateDiff = twitterDate.diff(meDate, 'seconds');
    return (+twitterHeaderRateResetDate - twitterDate.unix() + dateDiff);
};

// init logging instance
var logger = loggerFunc(config.paths.logs, config.trendsLogsPrefix);
logger.info('Init TwitArk Trends Get v' + VERSION + ' ENV: ' + ENV);
// init Twit Lib
var T = new Twit({
    consumer_key: config.twitterAPI.consumerKey,
    consumer_secret: config.twitterAPI.consumerSecret,
    access_token: config.twitterAPI.accessToken,
    access_token_secret: config.twitterAPI.accessTokenSecret,
    timeout_ms: config.twitterAPI.timeoutMs
});
// init jobs manager
var myJobs = new Jobber(countriesIds);

myJobs.on('err', function (error) {
    logger.error('Jobber Error', error);
});

myJobs.on('run', function (currentJob, counter, orgJobs, message) {
    var countryName = currentJob.name;
    var countryCode = currentJob.countryCode;
    var woeid = currentJob.woeid;
    T.get('trends/place', { id: woeid }, function (err, data, res) {
        if (!res) {
            var backoffTimeout = 60;
            if (message) {
                backoffTimeout = message.timeout;
                backoffTimeout *= 2;
                logger.info(`connection timeout, trying again ${backoffTimeout / 60} minutes`)
            } else {
                logger.warn('Warning, no response received maybe connection error) - delaying in 1 minute', err);
            }
            
            setTimeout(function () {
                    myJobs.resetJob({timeout: backoffTimeout});
                }, backoffTimeout * 1000);
            return;
        } 

        var rateLimitResetUnixTime = res.headers['x-rate-limit-reset'];
        var rateLimitRemaining = res.headers['x-rate-limit-remaining'];
        var responseHeaderDate = res.headers.date;
        var timeToResetInSeconds = twitterRateLimitCalcDelay(responseHeaderDate, rateLimitResetUnixTime) + 10; // extra seconds for safety

        if (err) {
            if (err.code === 88) {
                // rate limit error - only happens on reconnect after the limit already has started and we dont know
                logger.warn('Warning, rate limit exceeded without detecting it - forcing delay:', timeToResetInSeconds / 60, 'minutes');
                setTimeout(function () {
                    logger.info('Resuming resetted Job [From Error Status] - ', countryName + '-' + countryCode + '-' + woeid);
                    myJobs.resetJob();
                }, timeToResetInSeconds * 1000);
                return;
            } else {
                logger.error('Error, unhandled twitter error received', err);
                myJobs.resetJob();
                return;
            }
        }

        if (rateLimitRemaining === "0") {
            if (counter > 0) {
                logger.info('normal Rate limit exceeded, delaying in ', timeToResetInSeconds / 60, 'minutes and restarting jobber');
                setTimeout(function () {
                    myJobs.restart();
                }, timeToResetInSeconds * 1000);
                return;

            } 
            logger.info('normal Rate limit exceeded, delaying in ', timeToResetInSeconds / 60, 'minutes');
            setTimeout(function () {
                logger.info('Resuming resetted Job [From Normal Status] - ', countryName + '-' + countryCode + '-' + woeid);
                myJobs.resetJob();
            }, timeToResetInSeconds * 1000);
            return;
        }

        var timestamp = moment();
        var monthPath = timestamp.format("DD-MM-YYYY");
        var hourPath = timestamp.format("HH-mm");
        var fileName = countryName + '-' + countryCode + '-' + woeid + '.json';
        var fullFilename = path.join(TRENDS_PATH, monthPath, hourPath, fileName);
        filendir.wa(fullFilename, JSON.stringify(data), function (err) {
            if (err) {
                logger.error('Error saving trend file - ', fullFilename, err);
            } else {
                logger.info(`Saving [${countryName}] trends - ${fullFilename}`);
            }
        });
        myJobs.nextJob();
    });
});

var restartTimeoutHandler = false;
myJobs.on('finished', function (jobsSummary) {
    logger.info('Jobs finished - summary', jobsSummary);
    if (jobsSummary.total === jobsSummary.dispatched && !restartTimeoutHandler) {
        /*
            Twitter 'trends/place' URL has a rate limit of 75 request per 15 min window time.
            Currently in "includes/ountriesIds.json" there are 63 countries.
            The delay of 7.5 min is intentional, since for every 15 min we will run full 63 countries iteration
            and after 7.5 min, another interation of 12 first countries of the json list again reaching the rate limit (63+12 = 75).
            In total we will have about 8 iterations of the top 12 countries of the JSON list and 4 full iterations
            of all countries per one hour.
            Thats why i have set US and UK at the top in "includes/countriesIds.json" file.
        */
        var minutesToRestart = 7.5;
        logger.info(`restarting in ${minutesToRestart} min`);
        restartTimeoutHandler = setTimeout(function () {
            myJobs.restart();
            restartTimeoutHandler = false;
        }, minutesToRestart * 60 * 1000);
        return;
    }
    logger.info('force quit');
    process.exit(0);
});

myJobs.start();

process.on("SIGINT", function () {
    logger.info('Trends fetching stopped');
    myJobs.stop();
});
