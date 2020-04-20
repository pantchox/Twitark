/* 
    Twitark json adapter example
    Issues: consume to much memoery, should be writing a jsonp to a file as stream mode
*/
const fs = require('fs');
const path = require('path');
const Adapter = require('../../Adapter');

// Extend the base adapter
class JSONAdapter extends Adapter {
    constructor(logger) {
        super(logger, 'JSON adapter');
    }

    init(callback) {
        this._JSONData = [];
        super.init(callback);
    }

    push(tweet) {
        // tweet should be only in english and not a retweet 
        if (tweet.lang === 'en' && !tweet.retweeted_status) {
            const tweetObj = {};
            if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
                const hashtags = tweet.entities.hashtags.map(function(hashtag) {
                    return '#' + hashtag.text;
                });
                tweetObj.hashtags = hashtags;
                tweetObj.text = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.text;
                this._JSONData.push(tweetObj);
                this.log(JSON.stringify(tweetObj));
            }
        }
    }

    teardown(callback) {
        const resultFileName = path.join(__dirname, `/${Date.now()}_data.json`);
        this.log(`teardown! writing data to json file - ${resultFileName}`);
        const self = this;
        fs.writeFile(resultFileName, JSON.stringify(this._JSONData, null, 2) , 'utf-8', err => {
            err ? self.err(err) : self.log('done.');
            callback(); // must be called in order to finish the teardown phase
        });
    }
}

module.exports = function(logger) {
    return new JSONAdapter(logger);
}
