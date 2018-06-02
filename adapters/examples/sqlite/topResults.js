// Query Sqlite database for top results
var sqlite3 = require('sqlite3');

var entities = ['hashtags', 'symbols', 'mentions', 'links'];
var entitiesMap = ['#', '$', '@', '*'];
var entityType = process.argv[2];
var minutes = process.argv[3] || null;
var entityPrefix = entities.indexOf(entityType);
if (entityPrefix === -1) {
    console.log(entities.indexOf(entityType));
    console.log('Invalid entity selection');
    console.log(`
    Usage:
    node topResults.js <entity> <minutes> where:
    - entity - 'hashtags' / 'mentions' / 'symbols' / 'links'
    - minutes (optional) - number of last minutes to query, if not specified will query the whole database

    Examples:
    - 'node topResults.js hashtags 10' - return top hashtags in the last 10 minutes
    - 'node topResults.js symbols 1440' - return top symbols in the last 24 hours
    - 'node topResults.js links' - return all time top links (query the whole database)
    `)
    process.exit(1);
}

var minutesSQL = '';

if (minutes) {
    minutesSQL = `AND time >= datetime('now', '-${minutes} minutes')`;
}

var querySQL = `SELECT entity, COUNT(*) as countit
FROM tweets
WHERE entity LIKE '${entitiesMap[entityPrefix]}%' ${minutesSQL}
GROUP BY entity
ORDER BY countit DESC;
`;

var db = new sqlite3.Database('twitter.db', sqlite3.OPEN_READONLY, function(err) {
    if (err) {
        console.log('Error reading database:', err);
    } else {
        db.all(querySQL, function(err, rows) {
            if (err) {
                console.log('Error in querying', err);
            } else {
                rows.forEach(function(row) {
                    console.log(row.entity, row.countit);
                })
            }
            db.close();
        });
    }
});

