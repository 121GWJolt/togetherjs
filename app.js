#!/usr/bin/env node

var express = require('express');
var connect = require('connect');
var app = express();

// Gzip output
app.use(connect.compress())
app.use(express.staticCache());
app.use(function(req, resp, next) {
  // Expire all other resources in three hours
  resp.setHeader('Cache-Control', 'public, max-age=10800');
  return next();
});

app.use(express.static(__dirname + '/public'));
app.use(express.errorHandler());
app.disable('x-powered-by');


// 404 Routing
app.get('*', function(req, res){
  res.status(404).sendfile('public/errors/404.html');
});

app.listen(process.env.PORT || 3000);
