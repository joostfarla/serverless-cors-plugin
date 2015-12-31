# serverless-cors-plugin

[![NPM](https://nodei.co/npm/serverless-cors-plugin.png)](https://nodei.co/npm/serverless-cors-plugin/)

## Introduction

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for CORS ([Cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)).

This plugins does the following:

* It will add a `Access-Control-Allow-Origin` header to all resource methods with
  a CORS-policy configured.

* It will add an `OPTIONS` preflight endpoint with the proper headers for all
  resources with a CORS-policy configured. The following headers will be returned
  (if configured): `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` and
  `Access-Control-Allow-Methods` (the last one will be set automatically, based
  on the methods which have a CORS-policy configured).

## Installation

Make sure you have a `package.json` file in your `plugins` dir. If it's not there, run `npm init` to generate one.

From your `plugins` dir, run:

```bash
npm install --save serverless-cors-plugin
```

Add the plugin to `s-project.json`:

```json
"plugins": [
  {
    "path": "serverless-cors-plugin"
  }
]
```

## Usage

Add the following properties to `s-function.json` to configure a CORS-policy:

```json
"custom": {
  "cors": {
    "allowOrigin": "*",
    "allowHeaders": ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key"]
  }
}
```

The `allowOrigin` property is required, the rest is optional. You can also add this
configuration to `s-module.json` instead of `s-function.json` to apply the CORS-policy
to all functions within the module.

Run `endpoint deploy` and the CORS headers and preflight endpoints will dynamically
be configured and deployed.

## Roadmap

* Remove duplicate code when [serverless/serverless#441](https://github.com/serverless/serverless/issues/441)
  is fixed.
* Add support for other CORS headers:
  * Access-Control-Allow-Credentials
  * Access-Control-Expose-Headers
  * Access-Control-Max-Age
* Add support for authentication
* Add more verbose (debugging) output
* Improve validation
* Improve docs
* Auto-cleanup removed preflight endpoints

## License

ISC License. See the [LICENSE](LICENSE) file.
