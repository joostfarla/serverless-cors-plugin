# Changelog

## 0.4.3

* Fix compatibility with model plugin

## 0.4.2

* Add request parameter mapping(s) for preflighted endpoint

## 0.4.1

* Allow setting CORS configuration on project level

## 0.4.0

* Made compatible with Serverless v0.5
* Completed tests

## 0.3.2

* Support templating

## 0.3.1

* Fix mock endpoint type

## 0.3.0

* Added support for component-level policies
* Reflect module concept removal in Serverless v0.4

## 0.2.1

* Fix internal server error due to missing request template

## 0.2.0

* Made compatible with Serverless v0.2

## 0.1.2

* Always add `Access-Control-Allow-Credentials` when `allowCredentials` is set.
* Allow numeric characters in header names.

## 0.1.1

* Added support for `allowCredentials`, `exposeHeaders` and `maxAge`.
* Added validation for configuration options.

## 0.1.0

* [BC break] Options `allow.origin` and `allow.headers` have been replaced by `allowOrigin` and `allowHeaders`.
* Option `allowOrigin` is now required.
* Added test suite
