'use strict'
const stream = require('stream')

function isReadableStream(obj) {
    return obj instanceof stream.Stream &&
        typeof (obj._read === 'function') &&
        typeof (obj._readableState === 'object');
}


module.exports = class S3 {

    constructor() {
    }

    * upload(key, hash, readStream, contentType) {
        
        expect(key).to.be.a('string')
        expect(hash).to.be.a('string')

        if (!isReadableStream(readStream)) {
            throw new Error('not a ReadStream')
        }
        expect(contentType).to.be.a('string')
    }
}

