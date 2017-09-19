<img src="twitark.png" height="64">

Twitark
=

## Archive the Twitter sample firehose and daily trends, written in Node.js
After reviewing various libs and scripts that allows to save tweets from twitter firehose stream i could not find something satisfactory that will archive the firehose automaticly on a daily basis.

## Why
In this modern days when internet information is pouring with massive data, Twitter is one of the leading public data sources for the pulse of the internet.
Twitter sample firehose provides as it happens tweets ([about %1 sample size](https://twittercommunity.com/t/potential-adjustments-to-streaming-api-sample-volumes/31628)) that can reflect many diffrent events in real time.
Twitter data is a gold mine for data scientists and researchers applying various Machine Learning methods such as sentiment analysis, NLP and more which infer many new insights and social analytics over specific period of time.

Having a daily basis Twitter archive can be a great benefit when there is a need for data analysis on historical events such elections, sports, movies, tv shows and more.

## Requirements
Node v6+ and [7zip](http://www.7-zip.org/).

7zip must be available via command line.

On windows consider to add the installation directory to the `PATH` enviroment variable.

On linux it should be available from command line after you install it via your OS package manager.

7zip is needed to test archives integrity after creation. I have not yet found any Node package that can test an archive compression integrity (with no dependencies).

To verify 7zip installtion, it should be available anywhere by entering `7z` on your command line prompt.

> This project was not tested on macOS, if this project is working for you on macOS please open an issue with your experience, thanks!

## Getting started
Before using this project you will need to to claim Twitter auth keys and tokens, create a new app - https://apps.twitter.com/  
Clone the repo or download zip run `npm install` and follow this document configuration instructions, should be running in just few minutes.

## Configuration
`config` folder includes `example.config.js`, 
Make a copy for your desired enviroment depending on `NODE_ENV` enviroment variable.
* `NODE_ENV` = `production` -> create a copy named `production.config.js`
* `NODE_ENV` = `development` -> create a copy named `development.config.js`

If `NODE_ENV` is not configured in your enviroment to any value it will try to load by default `development.config.js`

### Config settings
```js
var config = {
    type: 'example', // change to any name you wish
    twitterAPI: { // fill in Twitter auth needed keys and tokens
        consumerKey: '',
        consumerSecret: '',
        accessToken: '',
        accessTokenSecret: '',
        timeoutMs: 60 * 1000
    },
    paths: {
        tweets: 'tweets', // saved tweets folder, for use with `twitterArchiver.js`
        archives: 'archives', // saved archives folder, for use with `twitterArchiver.js`
        logs: 'logs', // logs folder
        trends: 'trends' // saved trends folder, for use with `getTrends.js`
    },
    archiveMode: false, // if true will create a zip file for each daily tweets folder under the configured `archives` path
    archiveDeleteSrcDir: false, // if `archiveMode` is true, when creating an archive it will delete the source folder to save space
    streamLogsPrefix: 'twitter-stream', // prefix for the log files of `twitterArchiver.js`
    trendsLogsPrefix: 'trends' // prefix for the log file of the trends `trendsGet.js`
}
```
### Paths config
When configuring the paths settings, **create** all the needed paths and *make sure they exists*

---

Example of paths settings that are relative to your project directory
```js
paths: {
    tweets: 'tweets', // saved tweets folder, for use with `twitterArchiver.js`
    trends: 'trends' // saved trends folder, for use with `trendsGet.js`
    archives: 'archives', // saved archives folder, for use with `twitterArchiver.js`
    logs: 'logs', // logs folder    
    },
```

---

Example for **Linux** OS specifying full path 
```js
paths: {
    tweets: '/media/mydrive/twitter-archive/tweets', // saved tweets folder, for use with `twitterArchiver.js`
    ...
```

---

Example for **Windows** OS specifying full path - mind the *double* backslash
```js
paths: {
    tweets: 'z:\\media\\twitter-archive\\tweets\\', // saved tweets folder, for use with `twitterArchiver.js`
    ...
```

## Running project files
Raw Twitter Archiver project has two main files

### `./tweetsArchiver.js` 
#### Run `node tweetsArchiver.js`
Connects to Twitter *stream* API `statuses/sample.json`

Will archive all of the tweets received from the API, by creating (if not existing) new folder with current day date and sub folder with current hour.

For every minute passing in the current hour the archiver will save the tweets in that given minute to a zipped JSON file.

The folder and file naming structure of the saved zip file is as follows:  
`DATE_FOLDER\HOUR\HOUR-MINUTE-TIMESTAMP-RANDOM_INT-NUMBER_OF_TWEETS.zip`

The zip file contains one JSON file which is an array of objects where each object is a raw tweet as received from the stream.

I found it the most valuable structure when consuming this type of data.
The decision to zip is since the data is text and text zip ratio is very high and can save substantial amount of disk space.

#### Options
Currently Raw Twitter Archiver will create paths (when needed) and tweets by minute zip files, but also have a configuration option that
after a period of 24 hours (a new day after midnight) it will create a new daily archive from the `DATE_FOLDER` that will be named
`DATE_FOLDER-tweets.zip` and MD5 file `DATE_FOLDER-tweets.md5` and will be saved in the archives path - then if required by configuration the source folder will be **deleted**

#### Notes
* All zip files are checked for archive integrity after creation, in case of failure it will be logged but will not be retied. The CLI util can recover failed archiving and it is mentioned later on in this document. Cases for such issues are no disk space or limited memory issues.
* `DATE_FOLDER` is in format of `DD-MM-YYYY` which is common among european countries.




### `./trendsGet.js`
#### run `node trendsGet.js`
Will connect to the Twitter *REST* API `trends/place` and will save the hourly trends.
`includes` folder contains a JSON file `countriesIds.json` which supplies for each country [WOEID](http://developer.yahoo.com/geo/geoplanet/) code which is required for the API request to receive current trends for that specific country.
the JSON file is generated from `trends/available` endpoint, for more info - https://dev.twitter.com/rest/reference/get/trends/available

The folder and file naming structure of the trends files is as follows:  
`DATE_FOLDER\HOUR-MIN\COUNTRY_NAME-COUNTRY_CODE-WOEID.json`

#### Notes
* Unlike archiving the tweets stream, in trends there is no option of after 24 hours period to archive the trends folder, altough it can be done via the CLI util mentioned later on this document.


* Twitter `trends/place` REST endpoint has a rate limit of 75 request per 15 min window time.  Currently in `includes/countriesIds.json` file there are 63 countries.  
When requesting the trends for all the countries, there is a delay of 7.5 min between requests, since for every 15 min we will run full 63 countries iteration once, and after 7.5 min another interation of 12 first countries of the JSON list again - reaching the rate limit (63+12 = 75).  
In total we will have about 8 iterations of the top 12 countries of the JSON list and 4 full iterations of all countries per one hour.
Thats why US and UK are placed on top in `includes/countriesIds.json` file.



## CLI util
Under `utils` directory the `dailyArchiveCli.js` file allows to archive specific folders from the designated tweets or trends paths.  
This is in case when you set in your config to archive mode to be true but it failed due to error and you would like to create it or in any case you would like to archive a specific day to be available for download.  
The archived zip file will be saved in the configured archives path.

To run enter the `utils` folder and enter `node dailyArchiveCli.js` and usage examples will be displayed.

With every archive being created
* 7zip integrity check is executed to verify archive zip integrity
* MD5 signature file is created 

The purpose of the MD5 file is for example if you host your archives directory, you will be able after download to verify the MD5 signature, since in such big files it is important to check the file integrity also if you are going to delete the source folder.

## Logs
Under the configured logs directory for each script it will create rotated log files for every day.

## Hosting and data sizes
### Hosting
One of the purpose of this project was to run it on a dedicated server and having my raspberry pi download the archives in an automated way without me having to worry and for any issues i can review the logs.

I use [Digital Ocean](https://m.do.co/c/f285460dce57) cheapest machine a 0.5GB memory and 20GB storage that cost $5 comes preconfigured with node installation.
I have also added 60GB external hard drive for having the machine enough space to generate all the data i need for about a month, then running a web server on my archives folder and downloading all the archives for that month.

### Data Sizes
#### For daily tweets folder / archive
~2GB per day
#### For daily trends folder
~40MB per day

## Twitter terms of service regarding public data sets
Twitter API's [Terms Of Service](https://dev.twitter.com/overview/terms/policy#6._Be_a_Good_Partner_to_Twitter) discourages  users from creating large amounts of raw Twitter data to be available online for download due to variety of reasons such as privacy of their users. The data may be used for research but not shared.
Twitter do allow you to share your data sets of available tweets if you filter out the raw data from specific properties such as users id (refer to their guidelines in the provided link).  
You **MAY NOT** take this as a recommndation or a rule of thumb when creating your archives / data sets and i hold no liablity for any issue you may encounter.  
For further information read Twitter TOS here - https://dev.twitter.com/overview/terms/policy#6._Be_a_Good_Partner_to_Twitter.

## License
MIT Licensed. Copyright (c) Arye Shalev 2017.
