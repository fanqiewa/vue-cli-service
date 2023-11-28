const path = require('path')
const hash = require('hash-sum')
const { semver, matchesPluginId } = require('@vue/cli-shared-utils')


class PluginAPI {

  constructor(id, service) {
    this.id = id;
    this.service = service;
  }

  getCwd() {
    return this.service.context;
  }

  // 解析路径
  resolve(_path) {
    return path.resolve(this.service.context, _path);
  }

  // 注册命令
  registerCommand(name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts;
      opts = null;
    }
    this.service.commands[name] = { fn, opts: opts || {}};
  }

  // 添加chainWebpack
  // chainWebpack：允许对内部的webpack配置进行更细粒度的修改
  chainWebpack(fn) {
    this.service.webpackChainFns.push(fn);
  }

  // 解析webpack config
  resolveWebpackConfig(chainableConfig) {
    return this.service.resolveWebpackConfig(chainableConfig);
  }

  // 解析链表webpack config
  resolveChainableWebpackConfig() {
    return this.service.resolveChainableWebpackConfig();
  }
  
  // 缓存配置
  genCacheConfig (id, partialIdentifier, configFiles = []) {
    const fs = require('fs')
    // 缓存路径
    const cacheDirectory = this.resolve(`node_modules/.cache/${id}`)

    const fmtFunc = conf => {
      if (typeof conf === 'function') {
        return conf.toString().replace(/\r\n?/g, '\n')
      }
      return conf
    }

    const variables = {
      partialIdentifier,
      'cli-service': require('../package.json').version,
      'cache-loader': require('cache-loader/package.json').version,
      env: process.env.NODE_ENV,
      test: !!process.env.VUE_CLI_TEST,
      config: [
        fmtFunc(this.service.projectOptions.chainWebpack),
        fmtFunc(this.service.projectOptions.configureWebpack)
      ]
    }

    if (!Array.isArray(configFiles)) {
      configFiles = [configFiles]
    }

    // lock文件
    configFiles = configFiles.concat([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ])

    const readConfig = file => {
      const absolutePath = this.resolve(file)
      if (!fs.existsSync(absolutePath)) {
        return
      }

      if (absolutePath.endsWith('.js')) {
        try {
          return JSON.stringify(require(absolutePath))
        } catch (e) {
          return fs.readFileSync(absolutePath, 'utf-8')
        }
      } else {
        return fs.readFileSync(absolutePath, 'utf-8')
      }
    }

    variables.configFiles = configFiles.map(file => {
      const content = readConfig(file)
      return content && content.replace(/\r\n?/g, '\n')
    })

    const cacheIdentifier = hash(variables)
    return { cacheDirectory, cacheIdentifier }
  }
}

module.exports = PluginAPI;