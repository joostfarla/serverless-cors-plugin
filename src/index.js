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
        event: 'post'
      });
    }

    addCorsHeaders(evt) {
      let policy,
        responseParameters = {};

      // Capture region object for preflight endpoints
      this.context = evt.region;

      // Skip when CORS is not enabled
      if (!this._isCorsEnabled(evt.endpoint)) {
        return Promise.resolve(evt);
      }

      try {
        policy = this._getEndpointPolicy(evt.endpoint);
      } catch (err) {
        return Promise.reject(err);
      }

      // Set allow-origin header on all responses
      _.each(evt.endpoint.responses, function(response) {
        if (!response.responseParameters) {
          response.responseParameters = {};
        }

        response.responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + policy.allowOrigin + '\'';

        // Set allow-credentials header on all GET responses as these will not be preflighted
        if (evt.endpoint.method === 'GET' && !_.isUndefined(policy.allowCredentials)) {
          response.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + policy.allowCredentials + '\'';
        }
      });

      return Promise.resolve(evt);
    }

    addPreflightRequests(evt) {
      let config = {
        region: this.context.region,
        accessKeyId: this.S._awsAdminKeyId,
        secretAccessKey: this.S._awsAdminSecretKey,
      };

      this.ApiGateway = require(path.join(serverlessPath, 'utils', 'aws', 'ApiGateway'))(config);

      evt = {
        deployed: evt.endpoints,
        stage: evt.stage
      };

      return this._getApiResources(evt)
        .bind(this)
        .then(this._getEndpoints)
        .then(this._createPreflightEndpoints)
        .then(this._deployPreflightEndpoints)
        .then(this._deployApi);
    }

    _isCorsEnabled(endpoint) {
      return !_.isUndefined(endpoint.module.custom.cors) || !_.isUndefined(endpoint.function.custom.cors);
    }

    _getEndpointPolicy(endpoint) {
      let policy = _.merge({},
        endpoint.module.custom.cors,
        endpoint.function.custom.cors
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

    _getApiResources(evt) {
      let params = {
        restApiId: this.context.restApiId,
        limit: 500
      };

      return this.ApiGateway.getResourcesPromised(params)
        .then(function(response) {
          evt.resources = response.items;
          return evt;
        });
    }

    _getEndpoints(evt) {
      return SUtils.getEndpoints(this.S._projectRootPath)
        .then(function(endpoints) {
          evt.endpoints = endpoints;
          return evt;
        });
    }

    _createPreflightEndpoints(evt) {
      let _this = this;
      let paths = _.uniq(_.pluck(evt.deployed, 'path'));

      // Remove leading slashes
      paths = _.map(paths, path => _.trimLeft(path, '/'));

      // Generate method objects
      // @todo how do we handle hard-specified OPTIONS requests?
      try {
        evt.preflightEndpoints = paths.reduce(function(result, path) {
          let endpoints = _.filter(evt.endpoints, { path: path });

          _.forEach(endpoints, function(endpoint) {
            let policy,
              resource = _.findWhere(evt.resources, { path: '/' + path });

            // Skip when resource is not found or CORS is not enabled
            if (!resource || !_this._isCorsEnabled(endpoint)) {
              return;
            }

            policy = _this._getEndpointPolicy(endpoint);

            if (!result[path]) {
              // @todo handle conflicts with endpoints within same path
              result[path] = _.merge(policy, {
                path: path,
                resource: resource
              });
            }

            if (!result[path].allowMethods) {
              result[path].allowMethods = [];
            }

            result[path].allowMethods.push(endpoint.method);
          });

          return result;
        }, {});
      } catch (err) {
        return Promise.reject(err);
      }

      return Promise.resolve(evt);
    }

    _deployPreflightEndpoints(evt) {
      return Promise.resolve(_.values(evt.preflightEndpoints))
        .mapSeries(this._createEndpoint.bind(this))
        .then(() => { return evt; });
    }

    _createEndpoint(endpoint) {
      return this._removeEndpointMethod(endpoint)
        .bind(this)
        .then(this._createEndpointMethod)
        .then(this._createEndpointIntegration)
        .then(this._createEndpointMethodResponse)
        .then(this._createEndpointIntegrationResponse);
    }

    _removeEndpointMethod(endpoint) {
      let params = {
        httpMethod: 'OPTIONS',
        resourceId: endpoint.resource.id,
        restApiId: this.context.restApiId
      };

      return this.ApiGateway.deleteMethodPromised(params)
        .catch(function(err) {
          // Do nothing, it probably doesn't exist
        })
        .then(() => { return endpoint; });
    }

    _createEndpointMethod(endpoint) {
      let params = {
        authorizationType: 'none',
        httpMethod: 'OPTIONS',
        resourceId: endpoint.resource.id,
        restApiId: this.context.restApiId
      };

      return this.ApiGateway.putMethodPromised(params)
        .then(method => { return endpoint; });
    }

    _createEndpointIntegration(endpoint) {
      var params = {
        httpMethod: 'OPTIONS',
        resourceId: endpoint.resource.id,
        restApiId: this.context.restApiId,
        type: 'MOCK',
        requestTemplates: {
          'application/json': '{"statusCode": 200}'
        }
      };

      return this.ApiGateway.putIntegrationPromised(params)
        .then(integration => { return endpoint; });
    }

    _createEndpointMethodResponse(endpoint) {
      var params = {
        httpMethod: 'OPTIONS',
        resourceId: endpoint.resource.id,
        restApiId: this.context.restApiId,
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Origin': true,
          'method.response.header.Access-Control-Allow-Headers': false,
          'method.response.header.Access-Control-Allow-Credentials': false,
          'method.response.header.Access-Control-Expose-Headers': false,
          'method.response.header.Access-Control-Max-Age': false
        }
      };

      return this.ApiGateway.putMethodResponsePromised(params)
        .then(methodResponse => { return endpoint; });
    }

    _createEndpointIntegrationResponse(endpoint) {
      var params = {
        httpMethod: 'OPTIONS',
        resourceId: endpoint.resource.id,
        restApiId: this.context.restApiId,
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Methods': '\'' + endpoint.allowMethods + '\''
        }
      };

      params.responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + endpoint.allowOrigin + '\'';

      if (!_.isUndefined(endpoint.allowHeaders)) {
        params.responseParameters['method.response.header.Access-Control-Allow-Headers'] = '\'' + endpoint.allowHeaders + '\'';
      }

      if (!_.isUndefined(endpoint.allowCredentials)) {
        params.responseParameters['method.response.header.Access-Control-Allow-Credentials'] = '\'' + endpoint.allowCredentials + '\'';
      }

      if (!_.isUndefined(endpoint.exposeHeaders)) {
        params.responseParameters['method.response.header.Access-Control-Expose-Headers'] = '\'' + endpoint.exposeHeaders + '\'';
      }

      if (!_.isUndefined(endpoint.maxAge)) {
        params.responseParameters['method.response.header.Access-Control-Max-Age'] = '\'' + endpoint.maxAge + '\'';
      }

      return this.ApiGateway.putIntegrationResponsePromised(params)
        .then(integrationResponse => { return endpoint; });
    }

    _deployApi(evt) {
      let params = {
        restApiId: this.context.restApiId,
        stageName: evt.stage,
        description: evt.description || 'Serverless deployment',
        stageDescription: evt.stage,
        variables: {
          functionAlias: evt.stage
        }
      };

      return this.ApiGateway.createDeploymentPromised(params)
        .then(deployment => { return evt; });
    }
  }

  return ServerlessCors;
}
