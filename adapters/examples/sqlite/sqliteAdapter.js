
/*
    TwitArk sqlite adapter example code
    Note:Inserting will use transactions feature of Sqlite which is similar to do a batch insert which is faster
    And can keep up with twitter
*/
const Adapter = require('../../Adapter');
const sqlite3 = require('sqlite3');

const INSERT_QUERY = 'INSERT INTO tweets(time, entity, entity_type, tweet, tweet_id, tweet_time, tweet_lang, retweet, user_id, user_name, user_lang) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)';

class SqliteAdapter extends Adapter {
    constructor(logger) {
        super(logger, 'Sqlite Adapter');
    }

    init(callback) {
        const self = this;
        // Bulk insert transction chunks, from archive reader
        self._chunk = [];
        self._chunkMaxSize = 1000;
        self._totalTweets = 0;
        self._totalEntities = 0;
        
        // Init and Connect database
        self._db = new sqlite3.Database(
            __dirname + '/twitter.db',
            sqlite3.OPEN_READWRITE,
            (err) => {
                if (err) {
                    self.error('Sqlite database adapter could not connect!');
                } else {
                    self.log('Sqlite database connected!');
                    self._db.configure('busyTimeout', 10000); 
                }
                return callback(err);
            }
        );
    }

    insertEntity(entityList, tweet, tweet_text, entity_type, key = 'text') {
        const self = this;
        entityList.forEach(entity => {
            const values = [
                tweet.created_at, // tweet time creation
                entity[key], // entity name
                entity_type, // hashtag/mention/link/symbol
                tweet_text, // tweet content
                tweet.id_str, // tweet id
                tweet.timestamp_ms, // tweet time
                tweet.lang, // tweet language
                tweet.retweeted_status ? true : false, // is retweet
                tweet.user.id_str, // tweet user id
                tweet.user.name, // tweet user name
                tweet.user.lang || 'und' // tweet user language
            ];

            // Inserting to our transaction prepared statement handler
            self._dbTransaction.run(values);
        });
    }

    processTweet(tweet) {
        const self = this;
        let text = tweet.text;
        let entities = tweet.entities;
        
        // checking if tweet is truncated then get the full tweet data
        if (tweet.extended_tweet) {
            text = tweet.extended_tweet.full_text;
            entities = tweet.extended_tweet.entities;
        }

        var numEntities = 0;
        // insert hashtags
        if (entities && entities.hashtags && entities.hashtags.length > 0) {
            self.insertEntity(entities.hashtags, tweet, text, 'hashtag');
            numEntities += entities.hashtags.length;
        } 
        // insert mentions
        if (entities && entities.user_mentions && entities.user_mentions.length > 0) {
            self.insertEntity(entities.user_mentions, tweet, text, 'mention', 'screen_name');
            numEntities += entities.user_mentions.length;
        }
        // insert symbols
        if (entities && entities.symbols && entities.symbols.length > 0) {
            self.insertEntity(entities.symbols, tweet, text, 'symbol');
            numEntities += entities.symbols.length;
        }
        // insert links
        if (entities && entities.urls && entities.urls.length > 0) {
            self.insertEntity(entities.urls, tweet, text, 'link', 'expanded_url');
            numEntities += entities.urls.length;
        }

        if (numEntities > 0) {
            // self.log(`Tweet  #${tweet.id_str} added with ${numEntities} entities`);
            self._totalEntities += numEntities;
        }
    }

    runTransaction(pushBulkCallback) {
        const self = this;
        // Start a transaction dump of tweets inserts
        self.setBusy(true); // important if the process is stopped for teardown cleanup
        self._db.serialize();
        self._db.run('begin transaction');
        
        // Set a transaction prepared statement handler with our insert query template
        self._dbTransaction = self._db.prepare(INSERT_QUERY);
        
        // Iterate the chunk and insert it to the database
        for (const tweet of self._chunk) {
            self.processTweet(tweet);
        }

        // Commit the transaction to save to database
        self._db.run('commit');
        
        // Set our chunk to new empty array for the next transaction dump
        const chunkLength = self._chunk.length;
        self._totalTweets += chunkLength;
        self._chunk = [];
        self._dbTransaction.finalize(() => {
            // Transaction finished and if we are called by archive reader call the callback
            self.setBusy(false);
            self.log(`Inserted [${chunkLength}] tweets`)
            if (pushBulkCallback) {
                pushBulkCallback()
            }
        });
    }

    push(tweet) {
        const self = this;
        // Adding tweets to our chunk until threshold size is met
        if (self._chunk.length < self._chunkMaxSize) {
            self._chunk.push(tweet);
            return;
        }

        // We have met our threshold, write tweets to DB
        this.runTransaction();
    }

    pushBulk(meta, readerCallback) {
        /*
            method used by archive reader
            each bulk push is a full minute tweets
        */
        // here we will just set the chunk to a whole minute tweets (ignoring the original threshold)
        // then when the transaction finished we run the archive reader callback
        const self = this;
        self._chunk = meta.data;
        self.runTransaction(readerCallback);
    }

    teardown(callback) {
        const self = this;
        self.log('Stopping!')
        // create a teardown function to be passed to super
        const lastTransactionAndClose = () => {
            const closeDB = () => setTimeout(() => {
                    self._db.close(err => {
                        self.log(`Processed [${self._totalTweets}] tweets with total of [${self._totalEntities}] entities`);
                        err ? 
                            self.error('Sqlite close connection failed! -' + err) :
                            self.log('Sqlite client closed');
                        callback(err);
                    });
            }, 0);

            // Last chunk leftovers if exists insert to DB before closing
            if (self._chunk.length > 0) {
                return self.runTransaction(closeDB);
            }
            // no more data
            closeDB();
        };

        // call base teardown (handle async gracefull shutdown of adapter)
        super.teardown(lastTransactionAndClose);
    }
}

module.exports = function(logger) {
    return new SqliteAdapter(logger);
}
