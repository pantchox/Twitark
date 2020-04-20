// create Sqlite database for Sqlite adapter example
const sqlite3 = require('sqlite3');

const schema = `CREATE TABLE IF NOT EXISTS tweets (
    time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    entity TEXT NOT NULL,
    entity_type VARCHAR(7) NOT NULL,
    tweet TEXT NOT NULL,
    tweet_id TEXT NOT NULL,
    tweet_time TEXT NOT NULL,
    tweet_lang VARCHAR(4) NOT NULL,
    retweet BOOLEAN DEFAULT FALSE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_lang VARCHAR(4) NOT NULL
);`

const db = new sqlite3.Database('twitter.db', err => {
    if (err) {
        console.log('Error creating database:', err);
    } else {
        db.run(schema, err => {
            if (err) {
                console.log('Error running table creation', err);
            } else {
                db.close();
            }
            console.log('Sqlite database `twitter.db` created (or already exists)');
        });
    }
});
