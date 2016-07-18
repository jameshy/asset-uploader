# asset-uploader

Library for uploading web assets to Amazon S3 or Azure Storage to support a "Never expire" policy.

It uploads files in a directory, changing their name to a hashed version, and provides a JSON lookup file.

For example, a directory containing 1 file "/css/styles.css":

It will generate an md5 hash of the file, and upload it as "/css/styles.\<hash>.css".

This will then be written to a manifest JSON file as:
```
{
    "/css/styles.css": "/css/styles.d41d8cd98f00b204e9800998ecf8427e.css"
}
```

Later you can use the manifest file when generating HTML.

## Usage
### Uploading assets and generating a manifest.json

```js
const AssetUploader = require('asset-uploader')

const provider = new assetUploader.Providers.S3('bucket-name')
const assetUploader = new AssetUploader(provider)

yield assetUploader.upload('./assets', '/**/*', './manifest.json')
```

### Lookup assets when running in production
```js
var resolver = new assetUploader.Resolver('./manifest.json')
resolver.resolve('/css/styles.css')
// returns '/css/styles.d41d8cd98f00b204e9800998ecf8427e.css'
