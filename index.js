const Promise = require('bluebird')
const path = require('path')
const format = require('string-format')
const glob = Promise.promisify(require('glob'));
const fs = Promise.promisifyAll(require('fs-extra'))
const crypto = require('crypto')
const mime = require('mime')

const AWS = require('aws-sdk')

var s3 = new AWS.S3();

const bucket = 's3-asset-uploader-testing'

function s3Upload(params) {
    return new Promise(function(fulfill, reject) {
        s3.upload(params, function(err, data) {
            if (err) {
                reject(err)
            }
            else {
                fulfill(true)
            }
        })
    })
}

var self = module.exports = {
    concurrency: 5,
    
    // produce a new filename that includes the hash
    // for example, when filename = 'test.txt', and hash = 'd41d8cd98f00b204e9800998ecf8427e'
    // it will return test.d41d8cd98f00b204e9800998ecf8427e.txt
    generateFilename(originalFilename, hash) {
        var ext = path.extname(originalFilename)
        var filename = path.basename(originalFilename, ext)
        var renamedFile = format('{}.{}{}', filename, hash, ext)

        return renamedFile
    },
    
    hashFileMD5: function(path) {
        return new Promise(function(fulfill, reject) {
            var fd = fs.createReadStream(path)
            var hash = crypto.createHash('md5')
            hash.setEncoding('hex')
            fd.on('end', function() {
                hash.end()
                fulfill(hash.read())
            })
            fd.pipe(hash)
        })
    },

    // use a glob pattern for find asset files
    find(root, pattern) {
        var options = {
            root: root,
            nodir: true
        }
        return glob(pattern, options)
    },

    doesFileNeedUploading(key, hash) {
        return s3.headObject({
            Bucket: bucket,
            Key: key
        }).promise()
        .then((head) => {
            // skip file if the has is unchanged
            if (head.ETag.includes(hash)) {
                return false
            }
            return true
        })
        .catch((e) => {
            if (e.code != 'NotFound') {
                throw e
            }
            return true
        })
    },

    uploadToS3: Promise.coroutine(function* (absolutePath, key, hash) {
        // check if the file already exists

        if (yield self.doesFileNeedUploading(key, hash)) {

            var contentType = mime.lookup(absolutePath)
            var readStream = fs.createReadStream(absolutePath)

            var params = {
                Bucket: bucket,
                Key: key,
                ContentType: contentType,
                Body: readStream
                // Expires: moment().add(10, 'years').toDate(),
                // CacheControl: 'max-age=31536000'
            }
            
            return s3Upload(params)
        }
    }),

    uploadAsset: Promise.coroutine(function* (root, absolutePath) {
        var relativePath = absolutePath.replace(root, '')
        var relativeDir = path.dirname(relativePath)
        var filename = path.basename(absolutePath)
        
        var hash = yield self.hashFileMD5(absolutePath)
        var hashedFilename = self.generateFilename(filename, hash)

        var s3Key = path.join(relativeDir, hashedFilename)
        // remove the leading /
        s3Key = s3Key.substring(1)

        yield self.uploadToS3(absolutePath, s3Key, hash)

        return {
            s3Key: s3Key,
            path: relativePath
        }
        
    }),

    upload: Promise.coroutine(function* (root, pattern, outputManifestPath) {
        var files = yield self.find(root, pattern)
        var manifest = yield Promise.map(files, (path) => self.uploadAsset(root, path))
        .reduce((manifest, asset) => {
            manifest[asset.path] = asset.s3Key
            return manifest
        }, {})
        
        if (outputManifestPath) {
            var json = JSON.stringify(manifest)
            yield fs.writeFileAsync(outputManifestPath, json)
            return manifest
        }
        return manifest
        
    })
}

