const qs = require('querystring')
const loaderUtils = require('loader-utils')
const { resolveCompiler } = require('../compiler')
const { getDescriptor } = require('../descriptorCache')
const { resolveScript } = require('../resolveScript')

module.exports = function (source) {
  const loaderContext = this
  const filename = this.resourcePath
  const ctx = this.rootContext
  const query = qs.parse(this.resourceQuery.slice(1))

  const options = loaderUtils.getOptions(loaderContext) || {}
  const { id } = query
  const isServer = loaderContext.target === 'node'
  const isProduction =
    options.productionMode ||
    loaderContext.minimize ||
    process.env.NODE_ENV === 'production'
  const isFunctional = query.functional

  const compilerOptions = Object.assign(
    {
      outputSourceRange: true
    },
    options.compilerOptions,
    {
      scopeId: query.scoped ? `data-v-${id}` : null,
      comments: query.comments
    }
  )

  const { compiler, templateCompiler } = resolveCompiler(ctx, loaderContext)

  const descriptor = getDescriptor(filename, options, loaderContext)
  const script = resolveScript(descriptor, id, options, loaderContext)

  const finalOptions = {
    source,
    filename: this.resourcePath,
    compiler: options.compiler || templateCompiler,
    compilerOptions,
    transpileOptions: options.transpileOptions,
    transformAssetUrls: options.transformAssetUrls || true,
    isProduction,
    isFunctional,
    optimizeSSR: isServer && options.optimizeSSR !== false,
    prettify: options.prettify,
    bindings: script ? script.bindings : undefined
  }

  const compiled = compiler.compileTemplate(finalOptions)

  // tips
  if (compiled.tips && compiled.tips.length) {
    compiled.tips.forEach((tip) => {
      loaderContext.emitWarning(typeof tip === 'object' ? tip.msg : tip)
    })
  }

  // errors
  if (compiled.errors && compiled.errors.length) {
    const generateCodeFrame =
      (templateCompiler && templateCompiler.generateCodeFrame) ||
      compiler.generateCodeFrame
    if (generateCodeFrame && finalOptions.compilerOptions.outputSourceRange) {
      loaderContext.emitError(
        `\n\n  Errors compiling template:\n\n` +
          compiled.errors
            .map(({ msg, start, end }) => {
              const frame = generateCodeFrame(source, start, end)
              return `  ${msg}\n\n${pad(frame)}`
            })
            .join(`\n\n`) +
          '\n'
      )
    } else {
      loaderContext.emitError(
        `\n  Error compiling template:\n${pad(compiled.source)}\n` +
          compiled.errors.map((e) => `  - ${e}`).join('\n') +
          '\n'
      )
    }
  }

  const { code } = compiled

  return code + `\nexport { render, staticRenderFns }`
}

function pad(source) {
  return source
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join('\n')
}
