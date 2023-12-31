const qs = require('querystring')
const loaderUtils = require('loader-utils')
const hash = require('hash-sum')
const selfPath = require.resolve('../index')
const templateLoaderPath = require.resolve('./templateLoader')
const stylePostLoaderPath = require.resolve('./stylePostLoader')
const { resolveCompiler } = require('../compiler')

const isESLintLoader = (l) => /(\/|\\|@)eslint-loader/.test(l.path)
const isNullLoader = (l) => /(\/|\\|@)null-loader/.test(l.path)
const isCSSLoader = (l) => /(\/|\\|@)css-loader/.test(l.path)
const isCacheLoader = (l) => /(\/|\\|@)cache-loader/.test(l.path)
const isPitcher = (l) => l.path !== __filename
const isPreLoader = (l) => !l.pitchExecuted
const isPostLoader = (l) => l.pitchExecuted

const dedupeESLintLoader = (loaders) => {
  const res = []
  let seen = false
  loaders.forEach((l) => {
    if (!isESLintLoader(l)) {
      res.push(l)
    } else if (!seen) {
      seen = true
      res.push(l)
    }
  })
  return res
}

const shouldIgnoreCustomBlock = (loaders) => {
  const actualLoaders = loaders.filter((loader) => {
    // vue-loader
    if (loader.path === selfPath) {
      return false
    }

    // cache-loader
    if (isCacheLoader(loader)) {
      return false
    }

    return true
  })
  return actualLoaders.length === 0
}

module.exports = (code) => code

// loader-runner pitch 拦截所有vue请求
module.exports.pitch = function (remainingRequest) {
  const options = loaderUtils.getOptions(this)
  const { cacheDirectory, cacheIdentifier } = options
  const query = qs.parse(this.resourceQuery.slice(1))

  let loaders = this.loaders

  if (query.type) {
    if (/\.vue$/.test(this.resourcePath)) {
      loaders = loaders.filter((l) => !isESLintLoader(l))
    } else {
      loaders = dedupeESLintLoader(loaders)
    }
  }

  // remove self
  loaders = loaders.filter(isPitcher)

  if (loaders.some(isNullLoader)) {
    return
  }

  const genRequest = (loaders) => {
    const seen = new Map()
    const loaderStrings = []

    loaders.forEach((loader) => {
      const identifier =
        typeof loader === 'string' ? loader : loader.path + loader.query
      const request = typeof loader === 'string' ? loader : loader.request
      if (!seen.has(identifier)) {
        seen.set(identifier, true)
        loaderStrings.push(request)
      }
    })

    return loaderUtils.stringifyRequest(
      this,
      '-!' +
        [...loaderStrings, this.resourcePath + this.resourceQuery].join('!')
    )
  }

  if (query.type === `style`) {
    const cssLoaderIndex = loaders.findIndex(isCSSLoader)
    if (cssLoaderIndex > -1) {
      const afterLoaders = loaders.slice(0, cssLoaderIndex + 1)
      const beforeLoaders = loaders.slice(cssLoaderIndex + 1)
      const request = genRequest([
        ...afterLoaders,
        stylePostLoaderPath,
        ...beforeLoaders
      ])
      return query.module
        ? `export { default } from  ${request}; export * from ${request}`
        : `export * from ${request}`
    }
  }

  if (query.type === `template`) {
    const path = require('path')
    const cacheLoader =
      cacheDirectory && cacheIdentifier
        ? [
            `${require.resolve('cache-loader')}?${JSON.stringify({
              cacheDirectory: (path.isAbsolute(cacheDirectory)
                ? path.relative(process.cwd(), cacheDirectory)
                : cacheDirectory
              ).replace(/\\/g, '/'),
              cacheIdentifier: hash(cacheIdentifier) + '-vue-loader-template'
            })}`
          ]
        : []

    const preLoaders = loaders.filter(isPreLoader)
    const postLoaders = loaders.filter(isPostLoader)
    const { is27 } = resolveCompiler(this.rootContext, this)

    const request = genRequest([
      ...cacheLoader,
      ...postLoaders,
      ...(is27 ? [] : [templateLoaderPath + `??vue-loader-options`]),
      ...preLoaders
    ])

    return `export * from ${request}`
  }

  if (query.type === `custom` && shouldIgnoreCustomBlock(loaders)) {
    return ``
  }

  const request = genRequest(loaders)
  return `import mod from ${request}; export default mod; export * from ${request}`
}
