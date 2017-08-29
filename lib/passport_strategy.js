'use strict';

/* eslint-disable no-underscore-dangle */

const _ = require('lodash');
const uuid = require('uuid');
const url = require('url');
const assert = require('assert');
const OpenIdConnectError = require('./open_id_connect_error');
const Client = require('./client');

function verified(err, user, info) {
  const add = info || {};
  if (err) {
    this.error(err);
  } else if (!user) {
    this.fail(add);
  } else {
    this.success(user, add);
  }
}

/**
 * @name constructor
 * @api public
 */
function OpenIDConnectStrategy(options, verify) {
  console.log('In OpenIDConnectStrategy constructor');
  const opts = (() => {
    if (options instanceof Client) return { client: options };
    return options;
  })();

  const client = opts.client;

  assert.equal(client instanceof Client, true);
  assert.equal(typeof verify, 'function');

  assert(client.issuer && client.issuer.issuer, 'client must have an issuer with an identifier');
  console.log('The client has an issuer with an identifier.  Moving on...');

  this._client = client;
  this._issuer = client.issuer;
  this._verify = verify;
  this._key = opts.sessionKey || `oidc:${url.parse(this._issuer.issuer).hostname}`;
  this._params = opts.params || {};
  const params = this._params;

  this.name = url.parse(client.issuer.issuer).hostname;

  if (!params.response_type) params.response_type = _.get(client, 'response_types[0]', 'code');
  if (!params.redirect_uri) params.redirect_uri = _.get(client, 'redirect_uris[0]');
  if (!params.scope) params.scope = 'openid';
}

OpenIDConnectStrategy.prototype.authenticate = function authenticate(req, options) {
  console.log('In OpenIDConnectStrategy authenticate, options:', options);
  const client = this._client;
  try {
    if (!req.session) throw new Error('authentication requires session support when using state, max_age or nonce');
    const reqParams = client.callbackParams(req);
    const sessionKey = this._key;

    /* start authentication request */
    console.log('start authentication request');
    if (_.isEmpty(reqParams)) {
      // provide options object with extra authentication parameters
      const opts = _.defaults({}, options, this._params, {
        state: uuid()
      });

      if (!opts.nonce && opts.response_type.includes('id_token')) {
        opts.nonce = uuid();
      }

      req.session[sessionKey] = _.pick(opts, 'nonce', 'state', 'max_age');
      this.redirect(client.authorizationUrl(opts));
      return;
    }
    /* end authentication request */
    console.log('end authentication request');

    /* start authentication response */
    console.log('start authentication response');
    const session = req.session[sessionKey];
    const state = _.get(session, 'state');
    const maxAge = _.get(session, 'max_age');
    const nonce = _.get(session, 'nonce');

    try {
      delete req.session[sessionKey];
    } catch (err) {}

    const opts = _.defaults({}, options, {
      redirect_uri: this._params.redirect_uri
    });

    const checks = { state, nonce, max_age: maxAge };

    console.log(
      `Calling authorization callback with, redirect_uri: ${opts.redirect_uri}, reqParams: ${JSON.stringify(
        reqParams
      )}, checks: ${JSON.stringify(checks)}`
    );
    let callback = client.authorizationCallback(opts.redirect_uri, reqParams, checks).then(tokenset => {
      console.log('received tokenset:', tokenset);
      const result = { tokenset };
      return result;
    });

    const loadUserinfo = this._verify.length > 2 && client.issuer.userinfo_endpoint;

    if (loadUserinfo) {
      console.log('Add userinfo request to promise');
      callback = callback.then(result => {
        console.log('Got result from userinfo request, tokenset:', result.tokenset);
        if (result.tokenset.access_token) {
          const userinfoRequest = client.userinfo(result.tokenset);
          console.log('Making userinfo request...');
          return userinfoRequest.then(userinfo => {
            console.log('received userinfo:', userinfo);
            result.userinfo = userinfo;
            return result;
          });
        }

        return result;
      });
    }

    callback
      .then(result => {
        console.log('calling _verify');
        if (loadUserinfo) {
          this._verify(result.tokenset, result.userinfo, verified.bind(this));
        } else {
          this._verify(result.tokenset, verified.bind(this));
        }
      })
      .catch(error => {
        console.log('Error in authenticate:', error);
        if (
          error instanceof OpenIdConnectError &&
          error.error !== 'server_error' &&
          !error.error.startsWith('invalid')
        ) {
          this.fail(error);
        } else {
          this.error(error);
        }
      });
    /* end authentication response */
  } catch (err) {
    console.log('Got error in try/catch:', err);
    this.error(err);
  }
};

module.exports = OpenIDConnectStrategy;
