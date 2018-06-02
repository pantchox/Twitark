/* 
    Twitark hashtags echo adapter example
*/

var util = require('util');
var Adapter = require('../../Adapter');

function HashtagsAdapter(logger) {
    this._name = 'Hashtags adapter';
    Adapter.apply(this, arguments);
}

// Extend the base adapter
util.inherits(HashtagsAdapter, Adapter);

HashtagsAdapter.prototype.push = function(tweet) {
    if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
        var hashtags = tweet.entities.hashtags.map(function(hashtag) {
            return '#' + hashtag.text;
        });
        // echo the hashtags
        this.log(hashtags.join(' '));
    }
}

module.exports = function(logger) {
    return new HashtagsAdapter(logger);
}
