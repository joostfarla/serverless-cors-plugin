'use strict';

const path = require('path'),
  chai = require('chai'),
  should = chai.should(),
  chaiAsPromised = require('chai-as-promised'),
  Serverless = require('serverless');

chai.use(chaiAsPromised);

let s, plugin, CorsPlugin;

describe('ServerlessCors', function() {
  beforeEach(function(done) {
    this.timeout(0);

    s = new Serverless();

    s.init().then(function() {
      CorsPlugin = require('..')(s);
      plugin = new CorsPlugin(s);

      s.addPlugin(plugin);
      s.config.projectPath = __dirname;
      s.setProject(new s.classes.Project({
        stages: {
          dev: { regions: { 'eu-west-1': {} }}
        },
        variables: {
          project: 'serverless-project',
          stage: 'dev',
          region: 'eu-west-1'
        }
      }));

      done();
    });
  });

  describe('#getName()', function() {
    it('should return the correct name', function() {
      CorsPlugin.getName().should.equal('com.joostfarla.ServerlessCors');
    });
  });

  describe('#registerHooks()', function() {
    it('should register hooks', function() {
      s.hooks.endpointBuildApiGatewayPre.should.have.length(1);
      s.hooks.endpointBuildApiGatewayPre[0].name.should.equal('bound addCorsHeaders');
      s.hooks.endpointDeployPre.should.have.length(1);
      s.hooks.endpointDeployPre[0].name.should.equal('bound addPreflightRequests');
    });
  });

  describe('#addCorsHeaders()', function() {
    it('should not add any headers when cors is not configured', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        endpoint = s.getProject().getEndpoint('someFunction~GET');

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const headers = endpoint.responses.default.responseParameters;
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Origin');
        done();
      });
    });

    it('should fail when "allowOrigin" setting is missing', function() {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      func.custom.cors = {};

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowOrigin" setting is invalid', function() {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      func.custom.cors = { allowOrigin: true };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowHeaders" setting is invalid', function() {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      func.custom.cors = {
        allowOrigin: '*',
        allowHeaders: 'Value-That-Is-Not-An-Array'
      };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should add an "Access-Control-Allow-Origin" header when "allowOrigin" is set', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        endpoint = s.getProject().getEndpoint('someFunction~GET');

      func.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const headers = endpoint.responses.default.responseParameters;
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Methods');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Headers');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Credentials');
        headers.should.not.contain.key('method.response.header.Access-Control-Expose-Headers');
        headers.should.not.contain.key('method.response.header.Access-Control-Max-Age');
        done();
      });
    });

    it('should add an "Access-Control-Allow-Credentials" header to GET function when "allowCredentials" is set', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        endpoint = s.getProject().getEndpoint('someFunction~GET');

      func.custom.cors = {
        allowOrigin: 'http://function.test',
        allowCredentials: true
      };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const headers = endpoint.responses.default.responseParameters;
        headers['method.response.header.Access-Control-Allow-Credentials'].should.equal('\'true\'');
        done();
      });
    });

    it('should add an "Access-Control-Expose-Headers" header to function when "exposeHeaders" is set', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        endpoint = s.getProject().getEndpoint('someFunction~GET');
      const nonStandardExposedHeader = 'Content-length';
      func.custom.cors = {
        allowOrigin: 'http://function.test',
        exposeHeaders: [nonStandardExposedHeader]
      };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const headers = endpoint.responses.default.responseParameters;
        headers['method.response.header.Access-Control-Expose-Headers'].should.contain(nonStandardExposedHeader);
        done();
      });
    });

    it('should preserve existing headers when cors is configured for function', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        endpoint = s.getProject().getEndpoint('someFunction~GET');

      func.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      endpoint.responses.default.responseParameters = {
        'Some-Header': 'Some-Value'
      };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const headers = endpoint.responses.default.responseParameters;
        headers['Some-Header'].should.equal('Some-Value');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Methods');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Headers');
        done();
      });
    });
  });

  describe('#addPreflightRequests()', function() {
    it('should not add a preflight endpoint when --all flag is not passed', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      plugin.addPreflightRequests({
        options: { all: null, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS');
        should.not.exist(endpoint);
        done();
      });
    });

    it('should not add a preflight endpoint when --all flag is passed but no CORS policy is set', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS');
        should.not.exist(endpoint);
        done();
      });
    });

    it('should add a preflight endpoint when --all flag is passed and CORS policy is set', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      func.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS'),
          headers = endpoint.responses.default.responseParameters;
        endpoint.should.be.an.instanceof(s.classes.Endpoint);
        endpoint.type.should.equal('MOCK');
        headers['method.response.header.Access-Control-Allow-Methods'].should.equal('\'GET\'');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers['method.response.header.Access-Control-Allow-Headers'].should.equal('\'Header-X,Header-Y\'');
        done();
      });
    });

    it('should add a preflight endpoint when --all flag is passed and CORS policy is set on multiple operations', function(done) {
      const funcGet = _bootstrapEndpoint('someFunction', 'GET'),
        funcPost = _bootstrapEndpoint('someFunction', 'POST');

      funcGet.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      funcPost.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS'),
          headers = endpoint.responses.default.responseParameters;
        endpoint.should.be.an.instanceof(s.classes.Endpoint);
        endpoint.type.should.equal('MOCK');
        headers['method.response.header.Access-Control-Allow-Methods'].should.equal('\'GET,POST\'');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers['method.response.header.Access-Control-Allow-Headers'].should.equal('\'Header-X,Header-Y\'');
        done();
      });
    });

    it('should allow setting CORS settings on the project level', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET');

      s.getProject().custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS'),
          headers = endpoint.responses.default.responseParameters;
        endpoint.should.be.an.instanceof(s.classes.Endpoint);
        endpoint.type.should.equal('MOCK');
        headers['method.response.header.Access-Control-Allow-Methods'].should.equal('\'GET\'');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers['method.response.header.Access-Control-Allow-Headers'].should.equal('\'Header-X,Header-Y\'');
        done();
      });
    });

    it('should allow overriding CORS settings on the function level', function(done) {
      const func = _bootstrapEndpoint('someFunction', 'GET'),
        funcOverride = _bootstrapEndpoint('someOtherFunction', 'GET');

      s.getProject().custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      funcOverride.custom.cors = {
        allowHeaders: ['Header-X', 'Header-Y', 'Header-Z']
      };

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction~OPTIONS'),
          endpointOverride = s.getProject().getEndpoint('someOtherFunction~OPTIONS'),
          headers = endpoint.responses.default.responseParameters,
          headersOverride = endpointOverride.responses.default.responseParameters;
        headers['method.response.header.Access-Control-Allow-Methods'].should.equal('\'GET\'');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers['method.response.header.Access-Control-Allow-Headers'].should.equal('\'Header-X,Header-Y\'');
        headersOverride['method.response.header.Access-Control-Allow-Methods'].should.equal('\'GET\'');
        headersOverride['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headersOverride['method.response.header.Access-Control-Allow-Headers'].should.equal('\'Header-X,Header-Y,Header-Z\'');
        done();
      });
    });

    it('should add request mappings for path parameters', function(done) {
      const func = _bootstrapEndpoint('someFunction/{id}/{slug}', 'GET');

      func.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addPreflightRequests({
        options: { all: true, stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
        const endpoint = s.getProject().getEndpoint('someFunction/{id}/{slug}~OPTIONS');
        endpoint.requestParameters['integration.request.path.id'].should.equal('method.request.path.id');
        endpoint.requestParameters['integration.request.path.slug'].should.equal('method.request.path.slug');
        done();
      });
    });
  });
});

function _bootstrapEndpoint(path, method) {
  const func = new s.classes.Function({
    endpoints: [{
      path: path,
      method: method,
      responses: {
        default: {
          statusCode: '200',
          responseParameters: {}
        }
      }
    }]
  });

  s.getProject().setFunction(func);

  return func;
}
