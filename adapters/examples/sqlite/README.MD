### Sqlite Example Adapter
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
        'examples/sqlite/SqliteAdapter'
    ],
...

```
In windows systems (mind the double back slash):
```javascript
...
 adapters: [
        'examples\\sqlite\\SqliteAdapter'
    ],
...

```
* Run main archiver and the Sqlite adapter should log its actions

## Querying
Run `node top.js <entity_type> <minutes>` where:
- entity_type - 'hashtag' / 'mention' / 'symbol' / 'link'
- minutes (optional) - number of last minutes to query, if not specified will query the whole database

Examples:
- `node top.js hashtag 10` - return top hashtags in the last 10 minutes
- `node top.js symbol 1440` - return top symbols in the last 24 hours
- `node top.js link` - return all time top links (query the whole database)

#### Example output of all time mention entity
```bash
$ node top.js mention
┌──────┬──────────────────┬───────┐
│ rank │ entity           │ count │
├──────┼──────────────────┼───────┤
│ 1    │ @BTS_twt         │ 45    │
│ 2    │ @realDonaldTrump │ 40    │
│ 3    │ @Sportsbetio_TR  │ 19    │
│ 4    │ @OfficialMonstaX │ 15    │
│ 5    │ @RippleXrpie     │ 15    │
│ 6    │ @M78AKH          │ 12    │
│ 7    │ @LORAFRIMANEE    │ 11    │
│ 8    │ @zeusyeet        │ 11    │
│ 9    │ @yumyumfattime   │ 10    │
│ 10   │ @ziyaselcuk      │ 10    │A
└──────┴──────────────────┴───────┘
```

## Notes
- The Sqlite inserts are in general very slow, since on each insert they create a transaction. An option to make it fast is custom transaction where inside of it you batch insert the data and then "commit" the inserts, some kind of batch processing.
- This adapter can be used with TwitArk archive reader util, for already saved archives, for "replay".
For more info about archive reader, refer to the TwitArk documentation https://github.com/pantchox/Twitark