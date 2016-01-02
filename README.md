# Serverless CORS Plugin

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for CORS ([Cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)).

[![npm version](https://badge.fury.io/js/serverless-cors-plugin.svg)](https://badge.fury.io/js/serverless-cors-plugin)
[![Build Status](https://travis-ci.org/joostfarla/serverless-cors-plugin.svg?branch=develop)](https://travis-ci.org/joostfarla/serverless-cors-plugin)
[![Dependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin)
[![DevDependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin/dev-status.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin#info=devDependencies)

## Introduction

This plugins does the following:

* It will add an `Access-Control-Allow-Origin` header to all resource methods with
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

The `allowOrigin` property is required, the other headers are optional. You can also add this
configuration to `s-module.json` instead of `s-function.json` to apply the CORS-policy
to all functions within the module.

Run `endpoint deploy` and the CORS headers and preflight endpoints will dynamically
be configured and deployed.

## Options

These are all options you can use:

Option | Type | Example
---|:---|:---
`allowOrigin` | String | `"*"`
`allowHeaders` | Array | `["Content-Type", "X-Api-Key"]`
`allowCredentials` | Boolean | `true`
`exposeHeaders` | Array | `["Content-Type", "X-Api-Key"]`
`maxAge` | Number | `3600`

For more information, read the [CORS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS).

## Roadmap

* Refactor & complete tests when [serverless/serverless#441](https://github.com/serverless/serverless/issues/441)
  is fixed.
* Add more verbose (debugging) output
* Better support for authenticated requests
* Auto-cleanup removed preflight endpoints

## License

ISC License. See the [LICENSE](LICENSE) file.
