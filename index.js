'use strict';

/**
 * Serverless CORS Plugin
 */
module.exports = function(SPlugin, serverlessPath) {
  const _ = require('lodash'),
    path = require('path'),
    Promise = require('bluebird'),
    SUtils = require(path.join(serverlessPath, 'utils'));

  class ServerlessCors extends SPlugin {
    constructor(S, config) {
      super(S, config);
    }

    static getName() {
      return 'com.serverless.' + ServerlessCors.name;
    }

    registerHooks() {
      this.S.addHook(this._addCorsHeaders.bind(this), {
        action: 'endpointBuildApiGateway',
        event:  'pre'
      });

      this.S.addHook(this._addPreflightRequests.bind(this), {
        action: 'endpointDeploy',
        event:  'post'
      });

      return Promise.resolve();
    }

    _addCorsHeaders(evt) {
      let responseParameters = {},
        options = this._getEndpointPolicy(evt.endpoint);

      // Skip when no CORS policy is defined
      if (!options.allow) {
        return Promise.resolve(evt);
      }

      // Capture region object for preflight endpoints
      this.context = evt.region;

      if (options.allow.origin) {
        responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + options.allow.origin + '\'';
      }

      // Skip when no response headers have to be set
      if (_.size(responseParameters) === 0) {
        return Promise.resolve(evt);
      }

      // Set appropriate headers on the response
      _.each(evt.endpoint.responses, function(response) {
        response.responseParameters = _.merge(
          responseParameters, response.responseParameters
        );
      });

      return Promise.resolve(evt);
    }

    _addPreflightRequests(evt) {
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

    _getEndpointPolicy(endpoint) {
      return _.merge({},
        endpoint.module.custom.cors,
        endpoint.function.custom.cors
      );
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
      evt.preflightEndpoints = paths.reduce(function(result, path) {
        let endpoints = _.filter(evt.endpoints, { path: path });

        _.forEach(endpoints, function(endpoint) {
          let options = _this._getEndpointPolicy(endpoint);
          let resource = _.findWhere(evt.resources, { path: '/' + path });

          // Do nothing when no CORS policy or no API resource is found
          if (!options.allow || !resource) {
            return result;
          }

          if (!result[path]) {
            result[path] = {
              path: path,
              resource: resource,
              allow: options.allow // @todo handle conflicts with endpoints within same path
            };
          }

          if (!result[path].allow.methods) {
            result[path].allow.methods = [];
          }

          result[path].allow.methods.push(endpoint.method);
        });

        return result;
      }, {});

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
          'method.response.header.Access-Control-Allow-Origin': false,
          'method.response.header.Access-Control-Allow-Headers': false
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
          'method.response.header.Access-Control-Allow-Methods': '\'' + endpoint.allow.methods.join(',') + '\''
        }
      };

      if (endpoint.allow.origin) {
        params.responseParameters['method.response.header.Access-Control-Allow-Origin'] = '\'' + endpoint.allow.origin + '\'';
      }

      if (endpoint.allow.headers) {
        params.responseParameters['method.response.header.Access-Control-Allow-Headers'] = '\'' + endpoint.allow.headers + '\'';
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

  // Export Plugin Class
  return ServerlessCors;
}
