const got = require('got');

/*
 * url {String}
 * options {Object}
 * options.headers {Object}
 * options.body {String|Object}
 * options.query {Object}
 * options.timeout {Number}
 * options.retries {Number}
 * options.followRedirect {Boolean}
 */
module.exports.get = function get(url, options) {
  console.log(`GET REQUEST: ${url} ${JSON.stringify(options)}`);
  return new Promise((resolve, reject) => {
    got.get(url, options).then(response => {
      console.log(`GOT GET RESPONSE: ${JSON.stringify(response)}`);
      resolve(response);
    }).catch(error, {
      console.log(`GOT GET ERROR: ${error}`);
      reject(error);
    });
  });
};

module.exports.post = function post(url, options) {
  console.log(`POST REQUEST: ${url} ${JSON.stringify(options)}`);
  return got.post(url, options).then(response => console.log(`GOT GET RESPONSE: ${response}`));
};

module.exports.HTTPError = got.HTTPError;
