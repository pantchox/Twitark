
/*
    TwitArk sqlite adapter example code
*/
var util = require('util');
var Adapter = require('../../Adapter'); // mandatory require
var path = require('path');
var async = require('async');
var knexConfig = {
    client: 'sqlite3',
    debug: false,
    useNullAsDefault: true,
    connection: {filename: __dirname + '/twitter.db'}, multipleStatements: true
}

function SqliteAdapter(logger) {
    this._name = 'Sqlite Adapter';
    Adapter.apply(this, arguments);
}

// Extend the base adapter
util.inherits(SqliteAdapter, Adapter);

SqliteAdapter.prototype.init = function(cb) {
    this.chunk = [];
    this.chunkLimit = 50;
    var knex = require('knex')(knexConfig);
    this._client = knex;
    // call base init
    SqliteAdapter.super_.prototype.init.call(this, cb);
}

SqliteAdapter.prototype.iterateEntity = function(entityList, tweet, tweet_text, suffix, key = 'text', callback) {
    var entityListStructured = entityList.map(function(entity, idx) {
        return {
            entity: suffix + entity[key],
            tweet: tweet_text,
            tweet_id: tweet.id_str,
            tweet_time: tweet.timestamp_ms,
            retweet: tweet.retweeted_status ? true : false,
            tweet_lang: tweet.lang,
            user_id: tweet.user.id_str,
            user_name: tweet.user.name,
            user_lang: tweet.user.lang
        };
    });
    return entityListStructured;
}

SqliteAdapter.prototype.push = function(tweet, pushBulk_cb, isLast) {
    var self = this;
    self.setBusy(true); // async processing in progress
    var text = tweet.text;
    var entities = tweet.entities;
    // checking if tweet is truncated then get the full tweet data
    if (tweet.extended_tweet) {
        text = tweet.extended_tweet.full_text;
        entities = tweet.extended_tweet.extended_entities;
    }

    var tweetEntitiesData = [];
    // insert hashtags
    if (entities && entities.hashtags && entities.hashtags.length > 0) {
        tweetEntitiesData = tweetEntitiesData.concat(self.iterateEntity(entities.hashtags, tweet, text, '#', 'text'));
    } 
    // insert mentions
    if (entities && entities.user_mentions && entities.user_mentions.length > 0) {
        tweetEntitiesData = tweetEntitiesData.concat(self.iterateEntity(entities.user_mentions, tweet, text, '@', 'screen_name'));
    }
    // insert symbols
    if (entities && entities.symbols && entities.symbols.length > 0) {
        tweetEntitiesData = tweetEntitiesData.concat(self.iterateEntity(entities.symbols, tweet, text, '$', text));
    }
    // insert urls
    if (entities && entities.urls && entities.urls.length > 0) {
        tweetEntitiesData = tweetEntitiesData.concat(self.iterateEntity(entities.urls, tweet, text, '*', 'expanded_url'));
    }

    if (pushBulk_cb) {
        // bulk insert received from archive reader
        // here we check the chunk buffer passed its capcity so we bulk push it to the DB
        self.chunk = self.chunk.concat(tweetEntitiesData);
        if (self.chunk.length > self.chunkLimit || (self.chunk.length > 0 && isLast)) {
            self._client.batchInsert('tweets', self.chunk, self.chunk.length)
            .then(function(ids) {
                self.log('Chunk Push (' + self.chunk.length + ')');
                // clear chunk buffer
                self.chunk = [];
                self.setBusy(false);
                pushBulk_cb();
            })
            .catch(function(e){
                self.error('Insert error: ' + e.message);
            });
        } else {
            self.setBusy(false);
            pushBulk_cb();
        }
    } else {
        // normal push received from twitter archiver
        if (tweetEntitiesData.length > 0) {
            var tweetEntitiesDataList = tweetEntitiesData.map(function(te) {return te.entity;});
            self._client.batchInsert('tweets', tweetEntitiesData, tweetEntitiesData.length)
            .then(function(ids) {
                self.log('Insert success: ' + tweetEntitiesDataList.join(', '));
                self.setBusy(false);
            })
            .catch(function(e){
                self.error('Insert error: ' + e.message);
            });
        }
    }
}

SqliteAdapter.prototype.pushBulk = function(meta, reader_cb) {
    // method used by archive reader
    // each bulk push is a full minute tweets
    var self = this;
    async.eachOfSeries(meta.data, function(tweet, idx, async_cb) {
        self.push(tweet, async_cb, idx + 1 === meta.data.length);
    }, function(err) {
        if (err) {
            self.error('Push bulk error: ' + err);
        } else {
            self.log('Push bulk success [' + meta.fileName + '][' + meta.date + ']');
        }
        reader_cb();
    });
}

SqliteAdapter.prototype.teardown = function(cb) {
    // note you must call cb() in this part before calling the base teardown
    var self = this;
    var closeDB = function() {
        cb();
        self._client.destroy(function(){
            self.log('Sqlite knex client closed');
            // cb(); // bug in knex
        });
    }

    // call base teardown (handle async gracefull shutdown of adapter)
    SqliteAdapter.super_.prototype.teardown.call(this, closeDB);
}

module.exports = function(logger) {
    return new SqliteAdapter(logger);
}
