require('./lib')

const fs = require('fs-extra')
const path = require('path')
const temp = require("temp").track()

const MockProvider = require('./lib/mockprovider')
const AssetUploader = require('../')


const provider = new MockProvider()
const assetUploader = new AssetUploader(provider)


describe('Asset Uploader', function() {
    this.timeout(40000)

    it('should produce hashed filenames correctly', function() {
        assetUploader._generateFilename(
            'test.txt',
            'd41d8cd98f00b204e9800998ecf8427e'
        )
        .should.equal('test.d41d8cd98f00b204e9800998ecf8427e.txt')

        assetUploader._generateFilename(
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

       var assets = yield assetUploader._findAssets(assetDir, '/subdir/*.txt')

       var expected = [
           assetDir + '/subdir/a.txt',
           assetDir + '/subdir/b.txt'
       ]
       assets.should.deep.equal(expected)
    })

    it('should upload assets', function*() {
        var assetDir = temp.mkdirSync()

        var testFiles = [
            '/subdir/a.txt',
            '/subdir/b.txt',
        ]

        // create test asset files
        testFiles.forEach((path) => fs.ensureFileSync(assetDir + path))
        
        // upload asset files
        var manifest = yield assetUploader.upload(assetDir, '/**/*')

        // assert the manifest matches our test files
        testFiles.should.deep.equal(Object.keys(manifest))
    })

    it('should write a manifest file', function*() {
        var assetDir = temp.mkdirSync()

        var testFiles = [
            '/subdir/a.txt',
            '/subdir/b.txt',
        ]

        // create test asset files
        testFiles.forEach((path) => fs.ensureFileSync(assetDir + path))
        
        // upload asset files and write manifest file
        var manifestPath = temp.path({suffix: 'manifest.json'})
        
        // pass an extra argument to upload(), so it writes a manifest file
        var manifest = yield assetUploader.upload(assetDir, '/**/*', manifestPath)

        // load manifest file
        var contents = yield fs.readFileAsync(manifestPath)

        // it should have the same contents as the returned manifest object
        expect(contents.toString('utf8')).to.equal(JSON.stringify(manifest))

        // remove temp file
        return fs.remove(manifestPath)

    })

    it('should resolve correctly', function() {
        var manifestPath = path.join(__dirname, 'fixtures/manifest.json')

        var resolver = assetUploader.Resolver(manifestPath)

        expect(resolver.resolve('/subdir/a.txt')).to.equal('subdir/a.d41d8cd98f00b204e9800998ecf8427e.txt')
        expect(resolver.resolve('/subdir/b.txt')).to.equal('subdir/b.d41d8cd98f00b204e9800998ecf8427e.txt')
    })
})
