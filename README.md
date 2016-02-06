# Serverless CORS Plugin

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for CORS ([Cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)).

[![npm version](https://badge.fury.io/js/serverless-cors-plugin.svg)](https://badge.fury.io/js/serverless-cors-plugin)
[![Build Status](https://travis-ci.org/joostfarla/serverless-cors-plugin.svg?branch=develop)](https://travis-ci.org/joostfarla/serverless-cors-plugin)
[![Dependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin)
[![DevDependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin/dev-status.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin#info=devDependencies)

**THIS PLUGIN REQUIRES SERVERLESS V0.2 OR HIGHER!**

## Introduction

This plugins does the following:

* It will add CORS response headers to all resource methods with a CORS-policy
  configured.

* It will add an `OPTIONS` preflight endpoint with the proper headers for all
  resources with a CORS-policy configured.

## Installation

In your project root, run:

```bash
npm install --save serverless-cors-plugin
```

Add the plugin to `s-project.json`:

```json
"plugins": [
  "serverless-cors-plugin"
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
be configured and deployed. Use the `--all` flag to deploy pre-flight OPTIONS endpoints.

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

* Complete tests
* Dynamically set origin headers (#2)
* Add more verbose (debugging) output
* Better support for authenticated requests
* Auto-cleanup removed preflight endpoints

## License

ISC License. See the [LICENSE](LICENSE) file.
