const path = require('path')
const { resolveEntry, fileToComponentName } = require('./resolveWcEntry')

module.exports = (api, { target, entry, name, 'inline-vue': inlineVue }) => {
  process.env.VUE_CLI_CSS_SHADOW_MODE = true

  const { log, error } = require('@vue/cli-shared-utils')
  const abort = msg => {
    log()
    error(msg)
    process.exit(1)
  }

  const cwd = api.getCwd()
  const vueMajor = require('../../util/getVueMajor')(cwd)
  if (vueMajor === 3) {
    abort(`Vue 3 support of the web component target is still under development.`)
  }

  // 是否为异步
  const isAsync = /async/.test(target)

  // 基于glob文件生成动态条目
  const resolvedFiles = require('globby').sync(entry.split(','), { cwd: api.resolve('.') })

  if (!resolvedFiles.length) {
    abort(`entry pattern "${entry}" did not match any files.`)
  }
  let libName
  let prefix
  if (resolvedFiles.length === 1) {
    libName = name || fileToComponentName('', resolvedFiles[0]).kebabName
    prefix = ''
    if (libName.indexOf('-') < 0) {
      // 构建单个web组件时必须包含连字符。
      abort(`--name must contain a hyphen when building a single web component.`)
    }
  } else {
    libName = prefix = (name || api.service.pkg.name)
    if (!libName) {
      abort(`--name is required when building multiple web components.`)
    }
  }

  const dynamicEntry = resolveEntry(prefix, libName, resolvedFiles, isAsync)

  function genConfig (minify, genHTML) {
    const config = api.resolveChainableWebpackConfig()

    config.module
      .rule('js')
        .exclude
          .add(/vue-wc-wrapper/)

    if (!minify) {
      config.optimization.minimize(false)
    }

    config
      .plugin('web-component-options')
        .use(require('webpack').DefinePlugin, [{
          'process.env.CUSTOM_ELEMENT_NAME': JSON.stringify(libName)
        }])

    config.module
      .rule('vue')
        .use('vue-loader')
          .tap(options => {
            options.shadowMode = true
            return options
          })

    if (genHTML) {
      config
        .plugin('demo-html')
          .use(require('html-webpack-plugin'), [{
            template: path.resolve(__dirname, `./demo-wc.html`),
            inject: false,
            filename: 'demo.html',
            libName,
            vueMajor,
            components:
              prefix === ''
                ? [libName]
                : resolvedFiles.map(file => {
                  return fileToComponentName(prefix, file).kebabName
                })
          }])
    }

    // 设置别名
    config.resolve
      .alias
        .set('~root', api.resolve('.'))

    const rawConfig = api.resolveWebpackConfig(config)

    rawConfig.externals = [
      ...(Array.isArray(rawConfig.externals) ? rawConfig.externals : [rawConfig.externals]),
      { ...(inlineVue || { vue: 'Vue' }) }
    ].filter(Boolean)

    const entryName = `${libName}${minify ? `.min` : ``}`
    rawConfig.entry = {
      [entryName]: dynamicEntry
    }

    Object.assign(rawConfig.output, {
      jsonpFunction: libName.replace(/-\w/g, c => c.charAt(1).toUpperCase()) + '_jsonp',
      filename: `${entryName}.js`,
      chunkFilename: `${libName}.[name]${minify ? `.min` : ``}.js`,
      publicPath: ''
    })

    return rawConfig
  }

  return [
    genConfig(false, true),
    genConfig(true, false)
  ]
}
