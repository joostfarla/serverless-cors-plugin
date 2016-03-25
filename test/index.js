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
      CorsPlugin.getName().should.equal('ServerlessCors');
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
      const func = _bootstrapEndpoint('someFunction'),
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
      const func = _bootstrapEndpoint('someFunction');

      func.custom.cors = {};

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowOrigin" setting is invalid', function() {
      const func = _bootstrapEndpoint('someFunction');

      func.custom.cors = { allowOrigin: true };

      plugin.addCorsHeaders({
        options: { name: 'someFunction~GET', stage: 'dev', region: 'eu-west-1' }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowHeaders" setting is invalid', function() {
      const func = _bootstrapEndpoint('someFunction');

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
      const func = _bootstrapEndpoint('someFunction'),
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
      const func = _bootstrapEndpoint('someFunction'),
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

    it('should preserve existing headers when cors is configured for function', function(done) {
      const func = _bootstrapEndpoint('someFunction'),
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
        let headers = endpoint.responses.default.responseParameters;
        headers['Some-Header'].should.equal('Some-Value');
        headers['method.response.header.Access-Control-Allow-Origin'].should.equal('\'*\'');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Methods');
        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Headers');
        done();
      });
    });
  });

  describe('#addPreflightRequests()', function() {
    // @todo complete tests
  });
});

function _bootstrapEndpoint(path) {
  const func = new s.classes.Function({
    endpoints: [{
      path: path,
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
