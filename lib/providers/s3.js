'use strict'

const AWS = require('aws-sdk')
const Promise = require('bluebird')


module.exports = class S3Provider {

    constructor(bucket) {
        if (!bucket) {
            throw new Error('you must provide a bucket name')
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

    * upload(key, hash, readStream, contentType) {
        var self = this
        

        if (yield this.doesFileNeedUploading(key, hash)) {
            var params = {
                Bucket: this.bucket,
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
        
    }
}

