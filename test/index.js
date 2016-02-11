'use strict';

const path = require('path'),
  chai = require('chai'),
  should = chai.should(),
  chaiAsPromised = require('chai-as-promised'),
  SERVERLESS_PATH = path.join(process.cwd(), 'node_modules', 'serverless', 'lib'),
  Serverless = require(path.join(SERVERLESS_PATH, 'Serverless')),
  utils = require(path.join(SERVERLESS_PATH, 'utils'));

chai.use(chaiAsPromised);

const CorsPlugin = require('..')(
  require(path.join(SERVERLESS_PATH, 'ServerlessPlugin')),
  SERVERLESS_PATH
);

let s, plugin;

describe('ServerlessCors', function() {
  before(function() {
    this.timeout(0);

    s = new Serverless();
    plugin = new CorsPlugin(s);
    s.addPlugin(plugin);
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
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
        let endpoint = s.state.getEndpoints({ paths: [ endpointPath ] })[0],
          headers = endpoint.responses.default.responseParameters;

        headers.should.not.contain.key('method.response.header.Access-Control-Allow-Origin');
        done();
      });
    });

    it('should fail when "allowOrigin" setting is missing', function() {
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = {};

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowOrigin" setting is invalid', function() {
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = { allowOrigin: true };

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should fail when "allowHeaders" setting is invalid', function() {
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = {
        allowOrigin: '*',
        allowHeaders: 'Value-That-Is-Not-An-Array'
      };

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
      }).should.be.rejected;
    });

    it('should add an "Access-Control-Allow-Origin" header when "allowOrigin" is set', function(done) {
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
        let headers = obj.endpoint.responses.default.responseParameters;
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
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = {
        allowOrigin: 'http://function.test',
        allowCredentials: true
      };

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
        let headers = obj.endpoint.responses.default.responseParameters;
        headers['method.response.header.Access-Control-Allow-Credentials'].should.equal('\'true\'');
        done();
      });
    });

    it('should preserve existing headers when cors is configured for function', function(done) {
      let endpointPath = 'someComponent/someFunction@resource~GET',
        obj = _bootstrapEndpoint('someComponent/someFunction@resource~GET');

      obj.function.custom.cors = {
        allowOrigin: '*',
        allowHeaders: ['Header-X', 'Header-Y']
      };

      obj.endpoint.responses.default.responseParameters = {
        'Some-Header': 'Some-Value'
      };

      plugin.addCorsHeaders({
        options: { path: endpointPath }
      }).then(function(evt) {
        let headers = obj.endpoint.responses.default.responseParameters;
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
  let obj = {},
    parsed = utils.parseSPath(path);

  obj.component = new s.classes.Component(s, {
    sPath: parsed.component
  });

  obj.function = new s.classes.Function(s, {
    sPath: parsed.component + '/' + parsed.function
  });

  obj.endpoint = new s.classes.Endpoint(s, {
    sPath: parsed.component + '/' + parsed.function + '@' + parsed.urlPath + '~' + parsed.urlMethod
  });

  s.state.setAsset(obj.component);
  s.state.setAsset(obj.function);
  s.state.setAsset(obj.endpoint);

  return obj;
}
