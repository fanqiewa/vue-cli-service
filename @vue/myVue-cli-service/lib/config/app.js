
const fs = require('fs')
const path = require('path')

function ensureRelative (outputDir, _path) {
  if (path.isAbsolute(_path)) {
    return path.relative(outputDir, _path)
  } else {
    return _path
  }
}

module.exports = (api, options) => {
  api.chainWebpack(webpackConfig => {
    if (process.env.VUE_CLI_BUILD_TARGET && process.env.VUE_CLI_BUILD_TARGET !== 'app') {
      return
    }

    const isProd = process.env.NODE_ENV === 'production'
    const isLegacyBundle = process.env.VUE_CLI_MODERN_MODE && !process.env.VUE_CLI_MODERN_BUILD
    const outputDir = api.resolve(options.outputDir)

    const getAssetPath = require('../util/getAssetPath')
    const outputFilename = getAssetPath(
      options,
      `js/[name]${isLegacyBundle ? `-legacy` : ``}${isProd && options.filenameHashing ? '.[contenthash:8]' : ''}.js`
    )
    webpackConfig
      .output
        .filename(outputFilename)
        .chunkFilename(outputFilename)

    if (process.env.NODE_ENV !== 'test') {
      // 设置代码切割
      webpackConfig
        .optimization.splitChunks({
          cacheGroups: {
            vendors: {
              name: `chunk-vendors`, 
              test: /[\\/]node_modules[\\/]/, // 提取node_modules依赖
              priority: -10,
              chunks: 'initial'
            },
            common: {
              name: `chunk-common`,
              minChunks: 2, // 提取公共依赖
              priority: -20,
              chunks: 'initial', // 只对静态导入的进行切割
              reuseExistingChunk: true // 缓存chunk
            }
          }
        })
    }

    const resolveClientEnv = require('../util/resolveClientEnv')

    const chunkSorters = require('html-webpack-plugin/lib/chunksorter')
    const depSort = chunkSorters.dependency
    chunkSorters.auto = chunkSorters.dependency = (chunks, ...args) => {
      try {
        return depSort(chunks, ...args)
      } catch (e) {
        return chunks.sort((a, b) => {
          if (a.id === 'app') {
            return 1
          } else if (b.id === 'app') {
            return -1
          } else if (a.entry !== b.entry) {
            return b.entry ? -1 : 1
          }
          return 0
        })
      }
    }

    const htmlOptions = {
      title: api.service.pkg.name,
      templateParameters: (compilation, assets, pluginOptions) => {
        let stats
        return Object.assign({
          get webpack () {
            return stats || (stats = compilation.getStats().toJson())
          },
          compilation: compilation,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            files: assets,
            options: pluginOptions
          }
        }, resolveClientEnv(options, true /* raw */))
      }
    }

    // 移动html
    if (options.indexPath !== 'index.html') {
      webpackConfig
        .plugin('move-index')
        .use(require('../webpack/MovePlugin'), [
          path.resolve(outputDir, 'index.html'),
          path.resolve(outputDir, options.indexPath)
        ])
    }

    if (isProd) {
      Object.assign(htmlOptions, {
        minify: {
          removeComments: true,
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          removeScriptTypeAttributes: true
        }
      })

      webpackConfig
        .plugin('named-chunks')
          .use(require('webpack/lib/NamedChunksPlugin'), [chunk => {
            if (chunk.name) {
              return chunk.name
            }

            const hash = require('hash-sum')
            const joinedHash = hash(
              Array.from(chunk.modulesIterable, m => m.id).join('_')
            )
            return `chunk-` + joinedHash
          }])
    }

    const HTMLPlugin = require('html-webpack-plugin')
    const PreloadPlugin = require('@vue/preload-webpack-plugin')
    const multiPageConfig = options.pages // 多页面配置
    const htmlPath = api.resolve('public/index.html')
    const defaultHtmlPath = path.resolve(__dirname, 'index-default.html')
    const publicCopyIgnore = ['.DS_Store']

    if (!multiPageConfig) {
      htmlOptions.template = fs.existsSync(htmlPath)
        ? htmlPath
        : defaultHtmlPath

      publicCopyIgnore.push({
        glob: path.relative(api.resolve('public'), api.resolve(htmlOptions.template)),
        matchBase: false
      })

      webpackConfig
        .plugin('html')
          .use(HTMLPlugin, [htmlOptions])

      if (!isLegacyBundle) {
        webpackConfig
          .plugin('preload')
            .use(PreloadPlugin, [{
              rel: 'preload',
              include: 'initial',
              fileBlacklist: [/\.map$/, /hot-update\.js$/]
            }])

        webpackConfig
          .plugin('prefetch')
            .use(PreloadPlugin, [{
              rel: 'prefetch',
              include: 'asyncChunks'
            }])
      }
    } else {
      webpackConfig.entryPoints.clear()

      const pages = Object.keys(multiPageConfig)
      const normalizePageConfig = c => typeof c === 'string' ? { entry: c } : c

      pages.forEach(name => {
        const pageConfig = normalizePageConfig(multiPageConfig[name])
        const {
          entry,
          template = `public/${name}.html`,
          filename = `${name}.html`,
          chunks = ['chunk-vendors', 'chunk-common', name]
        } = pageConfig

        const customHtmlOptions = {}
        for (const key in pageConfig) {
          if (
            !['entry', 'template', 'filename', 'chunks'].includes(key)
          ) {
            customHtmlOptions[key] = pageConfig[key]
          }
        }

        const entries = Array.isArray(entry) ? entry : [entry]
        webpackConfig.entry(name).merge(entries.map(e => api.resolve(e)))

        const hasDedicatedTemplate = fs.existsSync(api.resolve(template))
        const templatePath = hasDedicatedTemplate
          ? template
          : fs.existsSync(htmlPath)
            ? htmlPath
            : defaultHtmlPath

        publicCopyIgnore.push({
          glob: path.relative(api.resolve('public'), api.resolve(templatePath)),
          matchBase: false
        })

        const pageHtmlOptions = Object.assign(
          {},
          htmlOptions,
          {
            chunks,
            template: templatePath,
            filename: ensureRelative(outputDir, filename)
          },
          customHtmlOptions
        )

        webpackConfig
          .plugin(`html-${name}`)
            .use(HTMLPlugin, [pageHtmlOptions])
      })

      if (!isLegacyBundle) {
        pages.forEach(name => {
          const filename = ensureRelative(
            outputDir,
            normalizePageConfig(multiPageConfig[name]).filename || `${name}.html`
          )
          webpackConfig
            .plugin(`preload-${name}`)
              .use(PreloadPlugin, [{
                rel: 'preload',
                includeHtmlNames: [filename],
                include: {
                  type: 'initial',
                  entries: [name]
                },
                fileBlacklist: [/\.map$/, /hot-update\.js$/]
              }])

          webpackConfig
            .plugin(`prefetch-${name}`)
              .use(PreloadPlugin, [{
                rel: 'prefetch',
                includeHtmlNames: [filename],
                include: {
                  type: 'asyncChunks',
                  entries: [name]
                }
              }])
        })
      }
    }

    if (options.crossorigin != null || options.integrity) {
      webpackConfig
        .plugin('cors')
          .use(require('../webpack/CorsPlugin'), [{
            crossorigin: options.crossorigin,
            integrity: options.integrity,
            publicPath: options.publicPath
          }])
    }

    const publicDir = api.resolve('public')
    if (!isLegacyBundle && fs.existsSync(publicDir)) {
      webpackConfig
        .plugin('copy')
          .use(require('copy-webpack-plugin'), [[{
            from: publicDir,
            to: outputDir,
            toType: 'dir',
            ignore: publicCopyIgnore
          }]])
    }
  })
}