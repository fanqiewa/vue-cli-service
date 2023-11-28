/**
 * 准备prox代理
 */
const fs = require('fs')
const url = require('url')
const path = require('path')
const { chalk } = require('@vue/cli-shared-utils')
const address = require('address')

const defaultConfig = {
  logLevel: 'silent',
  secure: false,
  changeOrigin: true,
  ws: true,
  xfwd: true
}

module.exports = function prepareProxy(proxy, appPublicFolder) {
  if (!proxy) {
    return undefined;
  }

  if (Array.isArray(proxy) || (typeof proxy !== 'object' && typeof proxy !== 'string')) {
    console.log(
      chalk.red(
        'When specified, "proxy" in package.json must be a string or an object.'
      )
    )
    console.log(
      chalk.red('Instead, the type of "proxy" was "' + typeof proxy + '".')
    )
    console.log(
      chalk.red(
        'Either remove "proxy" from package.json, or make it an object.'
      )
    )
    process.exit(1)
  }

  // 匹配路径是否可代理
  function mayProxy(pathname) {
    const maybePublicPath = path.resolve(appPublicFolder, pathname.slice(1))
    const isPublicFileRequest = fs.existsSync(maybePublicPath) && fs.statSync(maybePublicPath).isFile()
    const isWdsEndpointRequest = pathname.startsWith('/sockjs-node') // used by webpackHotDevClient
    return !(isPublicFileRequest || isWdsEndpointRequest)
  }

  function createProxyEntry(target, usersOnProxyReq, context) {
    if (typeof target === 'string' && process.platform === 'win32') {
      target = resolveLoopback(target);
    }
    return {
      target,
      context(pathname, req) {
        if (!mayProxy(pathname)) {
          return false
        }
        if (context) {
          //  e.g. /api
          return pathname.match(context)
        } else {
          // not a static request
          if (req.method !== 'GET') {
            return true
          }
          return (
            req.headers.accept &&
            req.headers.accept.indexOf('text/html') === -1
          )
        }
      },
      onProxyReq(proxyReq, req, res) {
        if (usersOnProxyReq) {
          // 自定义代理拦截
          usersOnProxyReq(proxyReq, req, res)
        }
        if (!proxyReq.agent && proxyReq.getHeader('origin')) {
          proxyReq.setHeader('origin', target) // 设置来源
        }
      },
      onError: onProxyError(target)
    }
  }

  if (typeof proxy === 'string') {
    // TODO
  }

  return Object.keys(proxy).map(context => {
    const config = proxy[context];
    if (!config.hasOwnProperty('target')) {
      // 代理地址没有target
      console.log(
        chalk.red(
          'When `proxy` in package.json is an object, each `context` object must have a ' +
            '`target` property specified as a url string'
        )
      )
      process.exit(1);
    }
    const entry = createProxyEntry(config.target, config.onProxyReq, context);
    return Object.assign({}, defaultConfig, config, entry);
  });
}

function resolveLoopback(proxy) {
  const o = url.parse(proxy);
  o.host = undefined;
  if (o.hostname !== 'localhost') {
    return proxy;
  }

  try {
    if (!address.ip()) {
      o.hostname = '127.0.0.1';
    }
  } catch (_ignored) {
    o.hostname = '127.0.0.1';
  }
  return url.format(o);
}

// 代理出错
function onProxyError(proxy) {
  return (err, req, res) => {
    const host = req.headers && req.headers.host
    console.log(
      chalk.red('Proxy error:') +
        ' Could not proxy request ' +
        chalk.cyan(req.url) +
        ' from ' +
        chalk.cyan(host) +
        ' to ' +
        chalk.cyan(proxy) +
        '.'
    )
    console.log(
      'See https://nodejs.org/api/errors.html#errors_common_system_errors for more information (' +
        chalk.cyan(err.code) +
        ').'
    )
    console.log()

    if (res.writeHead && !res.headersSent) {
      res.writeHead(500)
    }
    res.end(
      'Proxy error: Could not proxy request ' +
        req.url +
        ' from ' +
        host +
        ' to ' +
        proxy +
        ' (' +
        err.code +
        ').'
    )
  }
}