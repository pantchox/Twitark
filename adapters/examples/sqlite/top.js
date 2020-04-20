// Query Sqlite database for top results
const path = require('path');
const sqlite3 = require('sqlite3');
const {Table} = require('console-table-printer');

// Consts
const ENTITIES = ['hashtag', 'mention', 'link', 'symbol'];
const ENTITIES_PREFIXES = ['#', '@', '', '$'];

// Process CMD arguments
const entityType = process.argv[2];
const minutes = process.argv[3] || null;
const entityPrefixIdx = ENTITIES.indexOf(entityType);

// Check valid argument input else show help
const filename = path.basename(__filename);
if (entityPrefixIdx === -1) {
    console.log('Please enter a valid query input');
    console.log(`
    Usage:
    node ${filename} <entity> <minutes> where:
    - entity: 'hashtag' / 'mention' / 'link' / 'symbol'
    - minutes (optional) - number of last minutes to query, if not specified will query the whole database

    Examples:
    - 'node ${filename} hashtag 10' - return top hashtags in the last 10 minutes
    - 'node ${filename} symbol 1440' - return top symbols in the last 24 hours
    - 'node ${filename} link' - return all time top links (query the whole database)
    `)
    process.exit(1);
}

let minutesSQL = '';

if (minutes) {
    minutesSQL = `AND time >= datetime('now', '-${minutes} minutes')`;
}

const querySQL = `SELECT entity, COUNT(*) as countit
FROM tweets
WHERE entity_type = '${entityType}' ${minutesSQL}
GROUP BY entity
ORDER BY countit DESC
LIMIT 10;
`;

const db = new sqlite3.Database('twitter.db', sqlite3.OPEN_READONLY, (err) => {
    // Sqlite might be busy writing so we set a "BUSY" timeout for 10 seconds 
    // waiting for it to be available for reading
    db.configure('busyTimeout', 10000);
    if (err) {
        console.log('Error reading database:', err);
    } else {
        db.all(querySQL, (err, rows) => {
            db.close();
            // some error happend while querying
            if (err) {
                console.log('Error in querying', err);
                return;
            }

            // no results
            if (rows.length === 0) {
                console.log('No Results');
                return;
            }

            // iterate and show results
            const topEntities = rows.map((row, idx) => ({
                rank: idx + 1,
                entity: ENTITIES_PREFIXES[entityPrefixIdx] + row.entity,
                count: row.countit
            }));

            const entitiesTable = new Table({
                columns: [
                    {name: 'rank', alignment: 'left'},
                    {name: 'entity', alignment: 'left'},
                    {name: 'count', alignment: 'left'}
                ]
            });
            entitiesTable.addRows(topEntities)
            entitiesTable.printTable();
        });
    }
});

