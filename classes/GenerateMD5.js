var fs = require('fs');
var crypto = require('crypto');

module.exports = GenerateMD5;

function GenerateMD5(archiveFile, cb) {
    var hash = crypto.createHash('md5');
    var input = fs.createReadStream(archiveFile);

    input.on('readable', () => {
        var data = input.read();
        if (data)
            hash.update(data);
        else {
            var calculatedMd5Hash = hash.digest('hex');
            var md5Filename = archiveFile.substr(0, archiveFile.lastIndexOf('.'));
            if (md5Filename.length === 0) {
                return cb('MD5 creation failed because archive file has no extension');
            }
            fs.writeFile(md5Filename + '.md5', calculatedMd5Hash, function (err) {
                if (err) {
                    return cb('MD5 creation failed [i/o] error');
                }
                cb(undefined, `MD5 file created [${md5Filename}.md5]`);
            });
        }
    });
    input.on('error', () => {
        return cb(`[${archiveFile}] MD5 read stream returned error`);
    });
}
