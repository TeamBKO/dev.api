"use strict";
const { fdir } = require("fdir");
const express = require("express");
const router = express.Router();
const routeDir = "/routes";

const routes = new fdir()
  .withFullPaths()
  .withMaxDepth(2)
  .exclude((dir) => dir.startsWith("models"))
  .filter((path) => !path.endsWith("index.js"))
  .crawl(__dirname)
  .sync();

routes.forEach((r) => {
  const split = r.split(routeDir);
  const pathWithFilename = split[split.length - 1];
  const path = pathWithFilename.substr(0, pathWithFilename.lastIndexOf("/"));

  const route = require(r);

  if (route) {
    const method = route.method.toLowerCase();
    if (route.middleware && route.middleware.legnth) {
      router[method](path.concat(route.path), route.middleware, route.handler);
    } else {
      router[method](path.concat(route.path), route.handler);
    }
  }
});

module.exports = router;
