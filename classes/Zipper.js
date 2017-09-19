var fs = require('fs');
var path = require('path');
var zipTest = require('node-7z');
var archiver = require('archiver');
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;

module.exports = Zipper;

function Zipper(zipPath, zipFileName, options, cb) {
    if (!(this instanceof Zipper)) return new Zipper(zipPath, zipFileName, options, cb);

    this._zipPath = zipPath;
    this._zipFileName = zipFileName;
    this._callback = cb;

    if (options && options.type) {
        if (options.type === 'memzip') {
            this._insideZipFileName = options.insideZipFileName;
            this._fileData = options.fileData;
            this._action = 'memzip';
        } else if (options.type === 'dirzip') {
            this._sourcePath = options.sourcePath;
            this._insideZipFilePath = options.insideZipFilePath || '';
            this._action = 'dirzip';
        } else {
            return this._callback('Zipper error! options.type is invalid');
        }
        this._testArchive = false || options.testArchive;
        this._testArchiveByShell = true || options.testArchiveByShell;

        this._preArchive();
    } else {
        return this._callback('Zipper error! options or options.type is not set');
    }
}

Zipper.prototype._preArchive = function _preArchive() {
    var self = this;
    mkdirp(self._zipPath, function (err) {
        if (err) {
            return self._callback(err);
        }

        self._archive(self._action);
    });
}

Zipper.prototype._archive = function _archive(actionType) {
    var self = this;
    var compressLevel;
    if (actionType === 'memzip') {
        compressLevel = 9;
    } else if (actionType === 'dirzip') {
        compressLevel = 0; // no need, also its faster
    } else {
        return this._callback('Zipper error! internal error should not happen');
    }

    var fullFileName = path.join(self._zipPath, self._zipFileName);
    var output = fs.createWriteStream(fullFileName);
    var archive = archiver('zip', {
        level: compressLevel
    });

    output.on('close', function () {
        if (self._testArchive && !self._testArchiveByShell) {
            var archiveTest = new zipTest({
                y: true,
                ssc: true
            });
            archiveTest.test(fullFileName)
                .progress(function () {})
                .then(function () {
                    self._callback(undefined, archive.pointer());
                })
                .catch(function (err) {
                    self._callback(err);
                });
        } else if (self._testArchive && self._testArchiveByShell) {
            var archiveTestShell = spawn('7z', ['t', '-y', '-ssc', fullFileName]);
            archiveTestShell.stdout.on('data', (data) => {
                // this event is somehow mandatory since the spwan executable is expacting to pipe out data
                //console.log(`stdout: ${data}`);
            });
            archiveTestShell.on('close', (code) => {
                if (code === 0) {
                    self._callback(undefined, archive.pointer());
                } else {
                    self._callback('Archive shell integrity check failed');
                }
            });
        } else {
            self._callback(undefined, archive.pointer());
        }
    });

    archive.on('error', function (err) {
        self._callback(err);
    });

    archive.pipe(output);
    if (actionType === 'memzip') {
        archive.append(self._fileData, {
            name: self._insideZipFileName
        });
    } else if (actionType === 'dirzip') {
        archive.directory(self._sourcePath, self._insideZipFilePath);
    }
    archive.finalize();
}
