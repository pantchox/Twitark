var util = require('util');
var inherits = require('util').inherits;  
var EventEmitter = require('events').EventEmitter;

module.exports = Jobber;

function Jobber(jobsArray) {
    if (!(this instanceof Jobber)) return new Jobber(jobsArray);
    this._started = false;
    this._initError = false;
    this._jobsCounter = 0;

    EventEmitter.call(this);
    this._originalJobsArray = Object.assign([],jobsArray);
    this._jobsArray = Object.assign([],this._originalJobsArray);
    
    // check if job array empty or else
    if (!util.isArray(this._jobsArray) || this._jobsArray.length === 0) {
        this._initError = true;
        this.emit('err', 'Jobber init array is empty or not array!');
        return;
    }
}

inherits(Jobber, EventEmitter);

Jobber.prototype.summary = function summary() {
    var self = this;
    var totalTime = (Date.now() - self._started) / 60
    var jobsSummary = {
        time: totalTime,
        total: self._originalJobsArray.length,
        dispatched: self._jobsCounter
    };
    return jobsSummary;
}

Jobber.prototype.start = function start() {
    var self = this;

    if (self._initError) {
        this.emit('err', 'Jobber init array is empty or not array!');
        return;
    }

    if (self._started) {
        return;
    }
    self._started = Date.now();
    self._currentJob = self._jobsArray.shift();
    self._jobsCounter++;
    self.emit('run', self._currentJob, self._jobsCounter, self._originalJobsArray);
}

Jobber.prototype.stop = function stop() {
    var self = this;
    var jobsSummary = self.summary();
    self.emit('finished', jobsSummary);
}

Jobber.prototype.nextJob = function nextJob() {
    var self = this;

    if (self._jobsArray.length > 0) {
        self._currentJob = self._jobsArray.shift();
        self._jobsCounter++;
        self.emit('run', self._currentJob, self._jobsCounter, self._originalJobsArray);
    } else {
        var jobsSummary = self.summary();
        self.emit('finished', jobsSummary);
    }
}

// message in the resetJob ONLY for recurring data
Jobber.prototype.resetJob = function resetJob(message) {
    var self = this;
    self.emit('run', self._currentJob, self._jobsCounter, self._originalJobsArray, message);
} 

Jobber.prototype.restart = function restart() {
    var self = this;
    self._jobsArray = Object.assign([],self._originalJobsArray);
    self._jobsCounter = 0;
    self._started = false;
    self.start();
}

/* Jobber example, TODO remove from here to unit test */
/*var myJobs = new Jobber([1,2,3,4,5]);

myJobs.on('err', function(error){
    console.log('Jobs Error: ', error);
});

myJobs.on('run', function(currentJob, counter){
    //console.log('current job value: ', currentJob);
    //console.log('current job COUNTER value: ', counter);
    var randomBool = Math.random() >= 0.5;
    if (!randomBool) {
        // job failed...
        console.log('Job',currentJob, 'failed!');
        myJobs.resetJob();
        return;
    }
    console.log('Job',currentJob, 'success!');
    myJobs.nextJob();
    
});

myJobs.on('finished', function(jobsSummary) {
    console.log('Jobs finished - summary', jobsSummary);
});

myJobs.start();
*/
