// example hash tags echo adapter
function Adapter(logger) {
    if (!(this instanceof Adapter)) return new Adapter(logger);
    this._logger = logger;
    this._logger.info('INIT EchoAdapter');
}

Adapter.prototype.log = function(input) {
    this._logger.info(input);    
}

Adapter.prototype.push = function(tweet) {
    if (tweet.entities && tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
        var hashtags = tweet.entities.hashtags.map(function(hashtag) {
            return '#' + hashtag.text;
        });
        this.log(hashtags.join(' '));
    }    
}

module.exports = function(logger) {
    return new Adapter(logger);
}

