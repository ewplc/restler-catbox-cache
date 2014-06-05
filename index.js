var Catbox = require('catbox'),
    url = require('url'),
    http = require('http');

// Based on http://jsperf.com/hashing-strings
function hash(str) {
  if (typeof str !== 'string') {
    str = JSON.stringify(str);
  }
  var res = 0, len = str.length;
  for (var i = 0; i < len; i++) {
    res = ~~(res * 31 + str.charCodeAt(i));
  }
  return Math.abs(res).toString(16);
}

// http://jsperf.com/cloning-an-object
function clone(obj) {
  var target = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      target[i] = obj[i];
    }
  }
  return target;
}

function CachedClientRequest() {
  this.end = function(){}
}
require('util').inherits(CachedClientRequest, require('events').EventEmitter);

function CachedMessage(statusCode, headers, body) {
  this.setEncoding = function(){};
  this.headers = headers;
  this.statusCode = statusCode;

  var self = this;
  process.nextTick(function(){
    //console.log('request.emit("data", ', body, ');');
    self.emit('data', body);
    process.nextTick(function(){
      //console.log('request.emit("end");');
      self.emit('end');
    });
  });
}
require('util').inherits(CachedMessage, require('events').EventEmitter);

module.exports = function restlerCached(policy) {
  if(global.restler_catbox_cache_ran) return require('restler');
  var _httpRequest = http.request;
  http.request = function(options, callback) {
    if(options.method == 'GET') {
      var request = new CachedClientRequest();

      var _o = clone(options);
      _o.protocol = 'http';
      _o.pathname = _o.path;

      var key = 'get' + hash(url.format(_o));

      policy.getOrGenerate(
        key,
        function get(cb){
          var realRequest = _httpRequest(options, function(message){
            var cacheObj = {
              body: '',
              headers: [],
              statusCode: 0
            };
            var body = '';
            message.setEncoding('binary');
            message.on('data', function(chunk) {
              body += chunk;
            });
            message.on('end', function() {
              cacheObj.body = body;
              cacheObj.headers = message.headers;
              cacheObj.statusCode = message.statusCode;
              cb(null, cacheObj, 60 * 60 * 1000);
            });
          });
          realRequest.end();
        },
        function complete(err, value, cached, report){
          var message = new CachedMessage(value.statusCode, value.headers, value.body);
          request.emit('response', message);
        }
      );

      return request;
    }
    return _httpRequest(options, callback);
  }
  global.restler_catbox_cache_ran = true;

  return require('restler');
}