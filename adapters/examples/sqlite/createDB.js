// create sqlite database for sqlite adapter example
var fs = require('fs');
var sqlite3 = require('sqlite3');

var schema = `CREATE TABLE IF NOT EXISTS tweets (
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    entity TEXT NOT NULL,
    tweet TEXT NOT NULL,
    tweet_id TEXT NOT NULL,
    tweet_time TEXT NOT NULL,
    tweet_lang VARCHAR(4) NOT NULL,
    retweet BOOLEAN DEFAULT FALSE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_lang VARCHAR(4) NOT NULL
);`

var db = new sqlite3.Database('twitter.db', function(err) {
    if (err) {
        console.log('Error creating database:', err);
    } else {
        db.run(schema, function(err) {
            if (err) {
                console.log('Error running table creation', err);
            } else {
                db.close();
            }
            console.log('Sqlite database `twitter.db` created (or already exists)');
        });
    }
});

