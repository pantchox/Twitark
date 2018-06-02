### Sqlite example adapter
## What does it do?
This adapter will insert database rows of tweets entities such as:
 - hashtags (e.g: #opensource)
 - mentions (e.g: @github)
 - symbols (e.g: $TWTR)
 - links (e.g: https://bit.ly/2GUU1di) 

This will allow you to query top entities count by time
## Setup
* Run `npm install`
* Create the sqlite file database with `node createDB.js`
* Add in TwitArk enviroment config file, under adapters the adapter name including path with no extension:
In linux/mac systems:
```javascript
...
 adapters: [
        'examples/sqlite/sqliteAdapter'
    ],
...

```
In windows systems (mind the double back slash):
```javascript
...
 adapters: [
        'examples\\sqlite\\sqliteAdapter'
    ],
...

```
* Run main archiver file `tweetsArchiver.js`, the Sqlite adapter should also log its actions

## Querying
Run `node topResults.js <entity> <minutes>` where:
- entity - 'hashtags' / 'mentions' / 'symbols' / 'links'
- minutes (optional) - number of last minutes to query, if not specified will query the whole database

Examples:
- `node topResults.js hashtags 10` - return top hashtags in the last 10 minutes
- `node topResults.js symbols 1440` - return top symbols in the last 24 hours
- `node topResults.js links` - return all time top links (query the whole database)

## Notes

- `topResults.js` and `createDB.js` uses `sqlite3` package and `sqliteAdapter` uses `knex` package (which uses `sqlite3` under the hood) to do IO queries to the local sqlite database.

Why? because i wanted to tests different packages with sqlite.

- This adapter can be used with `archiveReader.js` util as well, for already saved archives.
