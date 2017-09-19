var config = {
    type: 'example',
    twitterAPI: {
        consumerKey: '',
        consumerSecret: '',
        accessToken: '',
        accessTokenSecret: '',
        timeoutMs: 60 * 1000
    },
    paths: {
        tweets: 'tweets',
        trends: 'trends',
        archives: 'archives',
        logs: 'logs'
    },
    archiveMode: false,
    archiveDeleteSrcDir: false,
    streamLogsPrefix: 'twitter-stream',
    trendsLogsPrefix: 'trends'
}

module.exports = config;
