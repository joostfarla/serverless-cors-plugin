'use strict';

/**
 * Serverless CORS Plugin
 */
module.exports = function(S) {
  const _ = require('lodash'),
    path = require('path'),
    Joi = require('joi'),
    Promise = require('bluebird'),
    SError = require(S.getServerlessPath('ServerlessError')),
    project = S.getProject();

  class ServerlessCors extends S.classes.Plugin {
    static getName() {
      return 'com.joostfarla.' + ServerlessCors.name;
    }

    registerHooks() {
      S.addHook(this.addCorsHeaders.bind(this), {
        action: 'endpointBuildApiGateway',
        event: 'pre'
      });

      S.addHook(this.addPreflightRequests.bind(this), {
        action: 'endpointDeploy',
        event: 'pre'
      });

      return Promise.resolve();
    }

    addCorsHeaders(evt) {
      let policy,
        endpoint = project.getEndpoint(evt.options.name),
        populatedEndpoint = endpoint.getPopulated({
          stage: evt.options.stage,
          region: evt.options.region
        });

      // Skip preflight requests or when CORS is not enabled
      if (populatedEndpoint.method === 'OPTIONS' || !this._isCorsEnabled(endpoint, evt.options.stage, evt.options.region)) {
        return Promise.resolve(evt);
      }

      try {
        policy = this._getEndpointPolicy(endpoint, evt.options.stage, evt.options.region);
      } catch (err) {
        return Promise.reject(err);
      }

      // Set allow-origin header on all responses
      _.each(populatedEndpoint.responses, function(response) {
        if (!response.responseParameters) {
          response.responseParameters = {};
        }

        response.responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + policy.allowOrigin + '\'';

        // Set allow-credentials header on all GET responses as these will not be preflighted
        if (populatedEndpoint.method === 'GET' && !_.isUndefined(policy.allowCredentials)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + policy.allowCredentials + '\'';
        }
      });

      endpoint.set(populatedEndpoint);

      return Promise.resolve(evt);
    }

    addPreflightRequests(evt) {
      let _this = this,
        endpoints = project.getAllEndpoints(),
        paths = _.map(
            _.uniqBy(endpoints, 'path'),
            endpoint => endpoint.path
    );

      // Only deploy prefight endpoints when 'all' flag is used.
      if (evt.options.all !== true) {
        return Promise.resolve(evt);
      }

      _.each(paths, function(path) {
        let policy, func, preflightEndpoint, response,
          allowMethods = [];

        _.each(_.filter(endpoints, { 'path': path }), function(endpoint) {
          if (!_this._isCorsEnabled(endpoint, evt.options.stage, evt.options.region)) {
            return;
          }

          // @todo handle different configurations within same path
          policy = _this._getEndpointPolicy(endpoint, evt.options.stage, evt.options.region);
          func = endpoint.getFunction();

          allowMethods.push(endpoint.method);
        });

        if (allowMethods.length === 0) {
          return Promise.resolve(evt);
        }

        preflightEndpoint = new S.classes.Endpoint({
          path: path,
          method: 'OPTIONS'
        }, func);

        preflightEndpoint.type = 'MOCK';
        preflightEndpoint.requestTemplates = {
          'application/json': '{"statusCode": 200}'
        };

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

        func.setEndpoint(preflightEndpoint);
      });

      return Promise.resolve(evt);
    }

    /**
     * Check CORS is enabled on function
     * - Function must first be populated
     **/

    _isCorsEnabled(endpoint, stage, region) {
      return !_.isUndefined(endpoint.getFunction().toObjectPopulated({stage, region}).custom.cors);
    }

    _getEndpointPolicy(endpoint, stage, region) {
      let policy = endpoint.getFunction().toObjectPopulated({stage, region}).custom.cors;
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
