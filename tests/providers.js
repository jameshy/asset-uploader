require('./lib')

const assetUploader = require('../lib')


describe('Providers', function() {

    describe('S3', function() {
        it('should exist', function() {
            expect(assetUploader.Providers).to.have.any.keys('S3')
        })
    })

    describe('Azure', function() {
        it('should exist', function() {
            expect(assetUploader.Providers).to.have.any.keys('Azure')
        })
    })
})
