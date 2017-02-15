# Serverless CORS Plugin

A Serverless Plugin for the [Serverless Framework](http://www.serverless.com) which
adds support for CORS ([Cross-origin resource sharing](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)).

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-cors-plugin.svg)](https://badge.fury.io/js/serverless-cors-plugin)
[![Build Status](https://travis-ci.org/joostfarla/serverless-cors-plugin.svg?branch=develop)](https://travis-ci.org/joostfarla/serverless-cors-plugin)
[![Dependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin)
[![DevDependencies Status](https://david-dm.org/joostfarla/serverless-cors-plugin/dev-status.svg)](https://david-dm.org/joostfarla/serverless-cors-plugin#info=devDependencies)

**THIS PLUGIN IS NOT COMPATIBLE WITH SERVERLESS V1.0 OR HIGHER!**

Serverless has [native CORS support](https://serverless.com/framework/docs/providers/aws/events/apigateway/#enabling-cors) since v1.0.

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

To find the best compatible (major) version, use the table below:

Serverless version | Plugin version
---|:---
v0.1 | v0.1
v0.2-v0.3 | v0.2
v0.4 | v0.3
v0.5 | v0.4

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
configuration to `s-project.json` instead of `s-function.json` to apply the CORS-policy
project-wide.

Run `endpoint deploy` and the CORS headers will dynamically be configured and deployed.
Use the `-a` / `--all` flag to deploy pre-flight OPTIONS endpoints.

*Caution: you will probably notice some warnings on missing `stage` and `region`
template variables. These can be ignored until the [issue](https://github.com/joostfarla/serverless-cors-plugin/issues/19#issuecomment-200816508) is fixed.*

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

* Dynamically set origin headers (#2)
* Add more verbose (debugging) output
* Better support for authenticated requests

## License

ISC License. See the [LICENSE](LICENSE) file.
