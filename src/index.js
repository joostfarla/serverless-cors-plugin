'use strict';

/**
 * Serverless CORS Plugin
 */
module.exports = function(SPlugin, serverlessPath) {
  const _ = require('lodash'),
    path = require('path'),
    Joi = require('joi'),
    Promise = require('bluebird'),
    SError = require(path.join(serverlessPath, 'ServerlessError')),
    SUtils = require(path.join(serverlessPath, 'utils'));

  class ServerlessCors extends SPlugin {
    static getName() {
      return 'com.joostfarla.' + ServerlessCors.name;
    }

    registerHooks() {
      this.S.addHook(this.addCorsHeaders.bind(this), {
        action: 'endpointBuildApiGateway',
        event: 'pre'
      });

      this.S.addHook(this.addPreflightRequests.bind(this), {
        action: 'endpointDeploy',
        event: 'pre'
      });

      return Promise.resolve();
    }

    addCorsHeaders(evt) {
      let policy,
        endpoint = this.S.state.getEndpoints({ paths: [evt.options.path] })[0];

      // Skip preflight requests or when CORS is not enabled
      if (endpoint.method === 'OPTIONS' || !this._isCorsEnabled(endpoint)) {
        return Promise.resolve(evt);
      }

      try {
        policy = this._getEndpointPolicy(endpoint);
      } catch (err) {
        return Promise.reject(err);
      }

      // Set allow-origin header on all responses
      _.each(endpoint.responses, function(response) {
        if (!response.responseParameters) {
          response.responseParameters = {};
        }

        response.responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + policy.allowOrigin + '\'';

        // Set allow-credentials header on all GET responses as these will not be preflighted
        if (endpoint.method === 'GET' && !_.isUndefined(policy.allowCredentials)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + policy.allowCredentials + '\'';
        }
      });

      return Promise.resolve(evt);
    }

    addPreflightRequests(evt) {
      let _this = this,
        endpoints = _this.S.state.getEndpoints(),
        paths = _.map(
          _.uniqBy(endpoints, 'path'),
          endpoint => endpoint.path
        );

      // Only deploy prefight endpoints when 'all' flag is used.
      if (evt.options.all !== true) {
        return Promise.resolve(evt);
      }

      _.each(paths, function(path) {
        let policy, module, preflightEndpoint, response,
          allowMethods = [];

        _.each(_.filter(endpoints, { 'path': path }), function(endpoint) {
          if (!_this._isCorsEnabled(endpoint)) {
            return;
          }

          // @todo handle different configurations within same path
          policy = _this._getEndpointPolicy(endpoint);
          module = _this.S.state.getModules({
            component: endpoint._config.component,
            module: endpoint._config.module
          })[0];

          allowMethods.push(endpoint.method);
        });

        if (allowMethods.length === 0) {
          return Promise.resolve(evt);
        }

        preflightEndpoint = new _this.S.classes.Endpoint(_this.S, {
          component:      module._config.component,
          module:         module.name,
          endpointPath:   path,
          endpointMethod: 'OPTIONS',
          type:           'MOCK'
        });

        if (preflightEndpoint.responses[400]) {
          delete preflightEndpoint.responses[400];
        }

        response = preflightEndpoint.responses.default;

        response.responseParameters = {
          'method.response.header.Access-Control-Allow-Methods': '\'' + allowMethods + '\'',
          'method.response.header.Access-Control-Allow-Origin': '\'' + policy.allowOrigin + '\''
        };

        if (!_.isUndefined(policy.allowHeaders)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Headers'] = '\'' + policy.allowHeaders + '\'';
        }

        if (!_.isUndefined(policy.allowCredentials)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + policy.allowCredentials + '\'';
        }

        if (!_.isUndefined(policy.exposeHeaders)) {
          response.responseParameters['method.response.header.Access-Control-Expose-Headers'] = '\'' + policy.exposeHeaders + '\'';
        }

        if (!_.isUndefined(policy.maxAge)) {
          response.responseParameters['method.response.header.Access-Control-Max-Age'] = '\'' + policy.maxAge + '\'';
        }

        module.endpoints.push(preflightEndpoint);
      });

      return Promise.resolve(evt);
    }

    _isCorsEnabled(endpoint) {
      return !_.isUndefined(endpoint.getFunction().getModule().custom.cors) ||
        !_.isUndefined(endpoint.getFunction().custom.cors);
    }

    _getEndpointPolicy(endpoint) {
      let policy = _.merge({},
        endpoint.getFunction().getModule().custom.cors,
        endpoint.getFunction().custom.cors
      );

      let schema = Joi.object().keys({
        allowOrigin: Joi.string().required(),
        allowHeaders: Joi.array().min(1).items(Joi.string().regex(/^[\w-]+$/)),
        allowCredentials: Joi.boolean(),
        exposeHeaders: Joi.array().min(1).items(Joi.string().regex(/^[\w-]+$/)),
        maxAge: Joi.number()
      });

      Joi.validate(policy, schema, function(err) {
        if (err) {
          throw new SError(
            err.message,
            SError.errorCodes.INVALID_PROJECT_SERVERLESS
          );
        }
      });

      return policy;
    }
  }

  return ServerlessCors;
}
