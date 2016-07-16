require('./lib')

const temp = require("temp").track()
const assetUploader = require('../')
const fs = require('fs-extra')


describe('Uploader', function() {

    it('should produce hashed filenames correctly', function() {
        assetUploader.generateFilename(
            'test.txt',
            'd41d8cd98f00b204e9800998ecf8427e'
        )
        .should.equal('test.d41d8cd98f00b204e9800998ecf8427e.txt')

        assetUploader.generateFilename(
            'extension-less',
            'd41d8cd98f00b204e9800998ecf8427e'
        )
        .should.equal('extension-less.d41d8cd98f00b204e9800998ecf8427e')
    })

    it('should find assets that match a glob', function*() {
        var assetDir = temp.mkdirSync()
        
        fs.ensureFileSync(assetDir + '/a.txt')
        fs.ensureFileSync(assetDir + '/subdir/a.txt')
        fs.ensureFileSync(assetDir + '/subdir/b.txt')

       var assets = yield assetUploader.find(assetDir, '/subdir/*.txt')

       var expected = [
           assetDir + '/subdir/a.txt',
           assetDir + '/subdir/b.txt'
       ]
       assets.should.deep.equal(expected)
    })

    it('should upload assets', function*() {
        // create mock directory with some assets
        var assetDir = temp.mkdirSync()

        fs.ensureFileSync(assetDir + '/subdir/a.txt')
        fs.ensureFileSync(assetDir + '/subdir/b.txt')

        yield assetUploader.upload(assetDir, '/**/*')
    })
})
