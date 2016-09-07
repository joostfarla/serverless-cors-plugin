'use strict';

/**
 * Serverless CORS Plugin
 */
module.exports = function(S) {
  const _ = require('lodash'),
    path = require('path'),
    Joi = require('joi'),
    Promise = require('bluebird'),
    SError = require(S.getServerlessPath('Error'));

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
        endpoint = S.getProject().getEndpoint(evt.options.name),
        populatedEndpoint = endpoint.toObjectPopulated({
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

        if (!_.isUndefined(policy.exposeHeaders)) {
          response.responseParameters['method.response.header.Access-Control-Expose-Headers'] = '\'' + policy.exposeHeaders + '\'';
        }

        // Set allow-credentials header on all GET responses as these will not be preflighted
        if (populatedEndpoint.method === 'GET' && !_.isUndefined(policy.allowCredentials)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + policy.allowCredentials + '\'';
        }
      });

      endpoint.fromObject(populatedEndpoint);

      return Promise.resolve(evt);
    }

    addPreflightRequests(evt) {
      const _this = this,
        endpoints = S.getProject().getAllEndpoints(),
        pathParamRegex = /{([^}]+)}/g,
        paths = _.map(
          _.uniqBy(endpoints, 'path'),
          endpoint => endpoint.path
        );

      // Only deploy prefight endpoints when 'all' flag is used.
      if (evt.options.all !== true) {
        return Promise.resolve(evt);
      }

      _.each(paths, function(path) {
        let policy, func, preflightEndpoint, response, pathParam,
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
          method: 'OPTIONS',
          type: 'MOCK',
          requestParameters: {},
          requestTemplates: {
            'application/json': '{"statusCode": 200}'
          },
          responses: {
            default: {
              statusCode: "200",
              responseParameters: {},
              responseModels: {},
              responseTemplates: {
                "application/json": ""
              }
            }
          }
        }, func);

        while ((pathParam = pathParamRegex.exec(path)) !== null) {
          preflightEndpoint.requestParameters['integration.request.path.' + pathParam[1]] = 'method.request.path.' + pathParam[1];
        }

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
     * - Function must first be populated, in case cors settings are in templates
     */

    _isCorsEnabled(endpoint, stage, region) {
      const options = {
        stage: stage,
        region: region
      };

      return !_.isUndefined(S.getProject().toObjectPopulated(options).custom.cors) ||
        !_.isUndefined(endpoint.getFunction().toObjectPopulated(options).custom.cors);
    }

    /**
     * Get endpoint's CORS policy
     * - Function must first be populated, in case cors settings are in templates
     */

    _getEndpointPolicy(endpoint, stage, region) {
      const options = {
        stage: stage,
        region: region
      };

      const policy = _.merge({},
        S.getProject().toObjectPopulated(options).custom.cors,
        endpoint.getFunction().toObjectPopulated(options).custom.cors
      );

      const schema = Joi.object().keys({
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
