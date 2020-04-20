/*
    TwitArk adapter base (do not modify)
    See adapters examples folder
*/

class Adapter {
    constructor(logger, name = 'Base Adapter') {
        if (!logger) {
            logger = {};
            logger.info = console.log;
            logger.error = console.error;
        }
        // if (!(this instanceof Adapter)) return new Adapter(logger);
        this._logger = logger;
        this._name = name; 
        this._busy = false;
        this._adapterTimeout = this._adapterTimeout || 10000; // Adapter timeout in teardown defaults to 10 seconds
        this.log('INIT ' + this._name);
    }

    init(callback) {
        // Here we run the adapter initialization code
        if (callback && typeof callback === 'function') {
            callback();
        }
    }

    setBusy(isBusy) {
        // Helper function to set busy flag if push has async actions waiting until
        // they are finished when teardown method is called
        if (isBusy) {
            this._busy = true;
        } else {
            this._busy = false;
        }
    }

    log(input) {
        // general log
        this._logger.info(this._name + ' => ' + input);
    }

    error(input) {
        // error log
        this._logger.error(this._name + ' => ' + input);
    }

    push(tweet, pushBulkCallback, any, other, argument, you, need) {
        // Adapter action(s) to handle the tweet
        /*
            This method receives the full tweet.
            The source of the tweet can be from twitter archiver,
            or from Archives reader.

            Archives reader CLI utils send 2nd argument the callback when 
            finishing processing the tweet.
            Rest of the arguments are up to you and your adapter
        */
    }

    pushBulk(meta, readerCallback) {
        /* 
            This method is used for archive reader CLI util, since it reads
            minutes archive array of tweets and should call to `this.push`
            For examples view the adapters examples folder.

            meta argument is an object that have all the info regarding the archive and its tweets.
            const meta = {
                date: the date value of the archive
                hour: the hour value the archive
                minute: the minute value of the archive
                fileName: the archive json file name
                length: number of tweets in the file
                data: array of tweets
            }

            !! readerCallback need to be called in order to process the next archived minute file
        */
        const self = this;
        // note that Array.forEach is NOT asynchronous so we can call the readerCallback() after.
        meta.data.forEach(function(tweet) {
            self.push(tweet);
        });
        readerCallback();
    }

    teardown(callback) {
        /*
            teardown function purpose is to do gracefull shutdown in order to do cleanup
            and/or finish async actions.
            It can be database connection close or file handling or whatever your adapter
            needs to accomplish before closing tweets archiver

            teardown is mostly needed for an adapter that has async actions, exam the sqlite
            adapter example where we call this method.
        */
        const self = this;
        // event driven timeout loop in case adapter is busy with async tasks
        const whileBusy = function() {
            if (self._busy === false) {
                return callback();
            } else {
                setTimeout(whileBusy, 0);
            }
        }
        
        // using this._busy to do gracefull shutdown since we use async actions
        if (this._busy) {
            // we wait 10 seconds before we FORCE to shutdown if adapter async actions are not finished
            setTimeout(function() {
                self.setBusy(false);
                self.log('Adapter not responding after ' + (self._adapterTimeout / 1000) + ' seconds, forcing quit');
            }, self._adapterTimeout);
            
            self.log('Waiting for adapter to finish...');
            // enter the loop
            whileBusy();
        } else {
            // adapter is free call teardown function
            callback();
        }
    }
}

// exam the examples directory for correct export of an implmented adapter(!)
module.exports = Adapter; 
