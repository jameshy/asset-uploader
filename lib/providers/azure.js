'use strict'

const Promise = require('bluebird')
const optional = require('optional')

module.exports = class AzureProvider {

    constructor(containerName) {
        if (!containerName) {
            throw new Error('you must provide a container name')
        }

        const azure = optional('azure-storage')

        if (!azure) {
            throw new Error('attempting to use AzureProvider, but the azure-storage module is not installed, try `npm install azure-storage`')
        }

        this.containerName = containerName
        this.blobService = azure.createBlobService()
    }

    doesFileNeedUploading(key, hash) {
        return new Promise((fulfill, reject) => {
            return this.blobService.getBlobProperties(this.containerName, key, function(err, blob, response) {
                if (err) {
                    if (err.code == 'NotFound') {
                        fulfill(true)
                    }
                    else {
                        reject(err)
                    }
                }
                else {
                    // the server provides us with a base64 encoded hash
                    var contentMd5 = response.headers['content-md5']

                    // encode our hash as base64
                    var encoded = new Buffer(hash, 'hex').toString('base64')
                    
                    // return comparison
                    fulfill(contentMd5 != encoded)
                }
            })
        })
    }

    upload(key, hash, readStream, contentType) {
        var self = this
        return Promise.coroutine(function*() {
            if (yield self.doesFileNeedUploading(key, hash)) {

                var options = {
                    // i don't think this is needed for https, and doesn't seem to work anyway for http
                    // transactionalContentMD5: new Buffer(hash, 'ascii').toString('base64'),
                    contentSettings: {
                        contentType: contentType,
                    }
                }
                
                return new Promise((fulfill, reject) => {
                    var blob = self.blobService.createWriteStreamToBlockBlob(self.containerName, key, options, function(err, result, response) {
                        if (err) {
                            reject(err)
                        }
                        else {
                            fulfill()
                        }
                    })

                    readStream.pipe(blob)
                })
            }
        })()
    }
}

