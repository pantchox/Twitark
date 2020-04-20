/* 
    Twitark hashtags echo adapter example
*/

var Adapter = require('../../Adapter');

// Extend the base adapter
class HashTagsAdapter extends Adapter {
    constructor(logger) {
        super(logger, 'HashTags Adapter');
    }

    push(tweet) {
        // echo only if tweet includes entities type of hashtags
        if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
            const hashtags = tweet.entities.hashtags.map(function(hashtag) {
                return '#' + hashtag.text;
            });
            // echo the hashtags
            this.log(hashtags.join(' '));
        }
    }
}

module.exports = function(logger) {
    return new HashTagsAdapter(logger);
}
