'use strict'
const Promise = require('bluebird')
const path = require('path')
const format = require('string-format')
const glob = Promise.promisify(require('glob'));
const fs = Promise.promisifyAll(require('fs-extra'))
const crypto = require('crypto')
const mime = require('mime')


const S3Provider = require('./providers/s3')

function Resolver(manifestPath) {
    if (!new.target) {
        return new Resolver(manifestPath)
    }

    // parse the json
    var contents = fs.readFileSync(manifestPath)
    var manifest = JSON.parse(contents)

    this.resolve = function(path) {
        return manifest[path]
    }


    return this

}

module.exports = class {
    constructor(provider) {
        this.concurrency = 5
        this.Resolver = Resolver
        this.provider = provider
        if (!provider) {
            throw new Error('no provider')
        }
    }

    static get Providers() {
        return {
            S3: S3Provider
        }
    }

    // produce a new filename that includes the hash
    // for example, when filename = 'test.txt', and hash = 'd41d8cd98f00b204e9800998ecf8427e'
    // it will return test.d41d8cd98f00b204e9800998ecf8427e.txt
    generateFilename(originalFilename, hash) {
        var ext = path.extname(originalFilename)
        var filename = path.basename(originalFilename, ext)
        var renamedFile = format('{}.{}{}', filename, hash, ext)

        return renamedFile
    }

    hashFileMD5(path) {
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
    }

    findAssets(root, pattern) {
        var options = {
            root: root,
            nodir: true
        }
        return glob(pattern, options)
    }

    uploadAsset(root, absolutePath) {
        var self = this
        return Promise.coroutine(function*() {
            var relativePath = absolutePath.replace(root, '')
            var relativeDir = path.dirname(relativePath)
            var filename = path.basename(absolutePath)
            
            var hash = yield self.hashFileMD5(absolutePath)
            var hashedFilename = self.generateFilename(filename, hash)

            // determine key name with the hashed filename
            var s3Key = path.join(relativeDir, hashedFilename)

            var contentType = mime.lookup(absolutePath)
            var readStream = fs.createReadStream(absolutePath)

            yield* self.provider.upload(s3Key, hash, readStream, contentType)

            return {
                s3Key: s3Key,
                path: relativePath
            }
        })()
    }

    * upload(root, pattern, outputManifestPath) {
        var files = yield this.findAssets(root, pattern)
        var manifest = yield Promise.map(files, (path) => this.uploadAsset(root, path))
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
        
    }
}

