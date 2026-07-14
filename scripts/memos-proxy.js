var https = require('https');
var url = require('url');

var ECHO_API = 'https://m.081531.xyz/api/echo/query';
var PREFIX = '/__ech0';

function proxyEch0(req, res) {
  var body = '';
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    var options = {
      hostname: 'm.081531.xyz',
      port: 443,
      path: '/api/echo/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    var proxyReq = https.request(options, function (proxyRes) {
      res.writeHead(proxyRes.statusCode || 502, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', function () {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: 'Ech0 proxy unavailable' }));
      } else {
        res.end();
      }
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

hexo.extend.filter.register('server_middleware', function (app) {
  app.use(function (req, res, next) {
    if (req.url.indexOf(PREFIX) !== 0) return next();
    if (req.method !== 'POST') return next();
    proxyEch0(req, res);
  });
});
