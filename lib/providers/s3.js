'use strict'


const Promise = require('bluebird')
const optional = require('optional')


module.exports = class S3Provider {

    constructor(bucket) {
        if (!bucket) {
            throw new Error('you must provide a bucket name')
        }

        const AWS = optional('aws-sdk')

        if (!AWS) {
            throw new Error('attempting to use S3Provider, but the aws-sdk module is not installed, try `npm install aws-sdk`')
        }

        this.bucket = bucket
        this.s3 = new AWS.S3()
    }

    doesFileNeedUploading(key, hash) {
        return this.s3.headObject({
            Bucket: this.bucket,
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
    }

    upload(key, hash, readStream, contentType) {
        var self = this

        return Promise.coroutine(function*() {
            if (yield self.doesFileNeedUploading(key, hash)) {
                var params = {
                    Bucket: self.bucket,
                    Key: key,
                    ContentType: contentType,
                    Body: readStream,
                    CacheControl: 'max-age=31536000'
                }
                return new Promise(function(fulfill, reject) {
                    self.s3.upload(params, function(err, data) {
                        if (err) {
                            reject(err)
                        }
                        else {
                            fulfill(true)
                        }
                    })
                })
            }
        })()
        
    }
}

