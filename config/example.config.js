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
    filter: {
        enable: false,
        // track are keywords, follow are twitter users ids
        // they can be an array or a json file
        track: ['#bitcoin', '#ethereum'],
        // twitter ids of @binance, @bitfinex, @BittrexExchange
        // array example:
        // follow: ['877807935493033984','886832413','2309637680'],
        // json file example:
        follow: 'config\\followIds.example.json',
    },
    adapters: [
        'examples\\echo\\HashtagsAdapter'
    ],
    archiveMode: false,
    archiveDeleteSrcDir: false,
    streamLogsPrefix: 'twitter-stream',
    trendsLogsPrefix: 'trends'
}

module.exports = config;
