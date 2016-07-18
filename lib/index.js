'use strict'
const Promise = require('bluebird')
const path = require('path')
const format = require('string-format')
const glob = Promise.promisify(require('glob'));
const fs = Promise.promisifyAll(require('fs-extra'))
const crypto = require('crypto')
const mime = require('mime')

const S3Provider = require('./providers/s3')
const AzureProvider = require('./providers/azure')

// creates an object that wraps a manifest file (for lookup purposes)
function Resolver(manifestPath) {
    // if 'new' wasn't used, return a new object anyway
    if (!new.target) {
        return new Resolver(manifestPath)
    }

    // load the manifest file
    var contents = fs.readFileSync(manifestPath)
    var manifest = JSON.parse(contents)

    // lookup an asset in the manifest, and return it's result
    // if the asset is not found, return the requested path
    this.resolve = function(path) {
        var result = manifest[path]
        return result || path
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

    /* public */

    // provides access to inbuilt providers
    static get Providers() {
        return {
            S3: S3Provider,
            Azure: AzureProvider
        }
    }

    // upload all assets inside 'root' diirectory, that match 'pattern'
    // optionally writing the manifest to 'outputManifestPath'
    upload(root, pattern, outputManifestPath) {
        var self = this
        root = path.resolve(root)
        
        return Promise.coroutine(function*() {
            var files = yield self._findAssets(root, pattern)
            var manifest = yield Promise.map(files, (path) => self._uploadAsset(root, path))
            .reduce((manifest, asset) => {
                manifest[asset.path] = asset.key
                return manifest
            }, {})
            
            if (outputManifestPath) {
                var json = JSON.stringify(manifest)
                yield fs.writeFileAsync(outputManifestPath, json)
                return manifest
            }
            return manifest
        })()
    }

    /* private */

    // produces a new filename that includes the hash
    // for example, when filename = 'test.txt', and hash = 'd41d8cd98f00b204e9800998ecf8427e'
    // it will return test.d41d8cd98f00b204e9800998ecf8427e.txt
    _generateFilename(originalFilename, hash) {
        var ext = path.extname(originalFilename)
        var filename = path.basename(originalFilename, ext)
        var renamedFile = format('{}.{}{}', filename, hash, ext)

        return renamedFile
    }

    // returns the md5 hash of a files contents
    _hashFileMD5(path) {
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

    // find files matching a minimatch 'pattern', within 'root'
    // for example '**/*.js' will find all .js files within 'root'
    // see https://github.com/isaacs/node-glob for more information
    _findAssets(root, pattern) {
        var options = {
            root: root,
            nodir: true
        }
        return glob(pattern, options)
    }

    // upload an individual asset
    _uploadAsset(root, absolutePath) {
        var self = this
        return Promise.coroutine(function*() {
            var relativePath = absolutePath.replace(root, '')
            var relativeDir = path.dirname(relativePath)
            var filename = path.basename(absolutePath)
            
            var hash = yield self._hashFileMD5(absolutePath)
            var hashedFilename = self._generateFilename(filename, hash)

            // determine storage key using hashed filename
            var key = path.join(relativeDir, hashedFilename)
            
            // remove leading '/' character
            var withoutLeadingSlash = key.substring(1)

            var contentType = mime.lookup(absolutePath)
            var readStream = fs.createReadStream(absolutePath)

            yield self.provider.upload(withoutLeadingSlash, hash, readStream, contentType)
            return {
                key: key,
                path: relativePath
            }
        })()
    }
}

