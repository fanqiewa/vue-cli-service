const path = require('path')
const hash = require('hash-sum')
const qs = require('querystring')
const plugin = require('./plugin')
const selectBlock = require('./select')
const loaderUtils = require('loader-utils')
const { attrsToQuery } = require('./codegen/utils')
const genStylesCode = require('./codegen/styleInjection')
const { genHotReloadCode } = require('./codegen/hotReload')
const genCustomBlocksCode = require('./codegen/customBlocks')
const componentNormalizerPath = require.resolve('./runtime/componentNormalizer')
const { NS } = require('./plugin')
const { resolveCompiler } = require('./compiler')
const { setDescriptor } = require('./descriptorCache')

let errorEmitted = false;

module.exports = function (source) {
  const loaderContext = this;

  if (!errorEmitted && !loaderContext['thread-loader'] && !loaderContext[NS]) {
    // webpack.config.js没有配置vue-loader
    loaderContext.emitError(
      new Error(
        `vue-loader was used without the corresponding plugin. ` +
        `Make sure to include VueLoaderPlugin in your webpack config.`
      )
    )
    errorEmitted = true
  }

  const stringifyRequest = (r) => loaderUtils.stringifyRequest(loaderContext, r)

  const {
    mode,
    target,
    request,
    minimize,
    sourceMap,
    rootContext,
    resourcePath,
    resourceQuery = ''
  } = loaderContext

  const rawQuery = resourceQuery.slice(1)
  const inheritQuery = `&${rawQuery}`
  const incomingQuery = qs.parse(rawQuery)
  const options = loaderUtils.getOptions(loaderContext) || {}

  const isServer = target === 'node'
  const isShadow = !!options.shadowMode
  const isProduction =
    mode === 'production' ||
    options.productionMode ||
    minimize ||
    process.env.NODE_ENV === 'production'

  const filename = path.basename(resourcePath)
  const context = rootContext || process.cwd()
  const sourceRoot = path.dirname(path.relative(context, resourcePath))

  const { compiler, templateCompiler } = resolveCompiler(context, loaderContext)

  // 将vue内容解析成ast
  const descriptor = compiler.parse({
    source,
    compiler: options.compiler || templateCompiler,
    filename,
    sourceRoot,
    needMap: sourceMap
  })

  setDescriptor(resourcePath, descriptor)

  // 原始的（相对短的）文件路径 e.g. src\Hello.vue
  const rawShortFilePath = path
    .relative(context, resourcePath)
    .replace(/^(\.\.[\/\\])+/, '')
  const shortFilePath = rawShortFilePath.replace(/\\/g, '/')
  const id = hash(
    isProduction
      ? shortFilePath + '\n' + source.replace(/\r\n/g, '\n')
      : shortFilePath
  )

  if (incomingQuery.type) {
    return selectBlock(
      descriptor,
      id,
      options,
      loaderContext,
      incomingQuery,
      !!options.appendExtension
    )
  }

  const hasScoped = descriptor.styles.some((s) => s.scoped)
  const hasFunctional =
    descriptor.template && descriptor.template.attrs.functional
  const needsHotReload =
    !isServer &&
    !isProduction &&
    (descriptor.script || descriptor.scriptSetup || descriptor.template) &&
    options.hotReload !== false

  // script
  let scriptImport = `var script = {}`
  // let isTS = false
  const { script, scriptSetup } = descriptor

  if (script || scriptSetup) {
    const src = (script && !scriptSetup && script.src) || resourcePath
    const attrsQuery = attrsToQuery((scriptSetup || script).attrs, 'js')
    const query = `?vue&type=script${attrsQuery}${inheritQuery}`
    const request = stringifyRequest(src + query)
    scriptImport =
      `import script from ${request}\n` + `export * from ${request}` // support named exports
  }

  // template
  let templateImport = `var render, staticRenderFns`
  let templateRequest
  if (descriptor.template) {
    const src = descriptor.template.src || resourcePath
    const idQuery = `&id=${id}`
    const scopedQuery = hasScoped ? `&scoped=true` : ``
    const attrsQuery = attrsToQuery(descriptor.template.attrs)
    // const tsQuery =
    // options.enableTsInTemplate !== false && isTS ? `&ts=true` : ``
    const query = `?vue&type=template${idQuery}${scopedQuery}${attrsQuery}${inheritQuery}`
    const request = (templateRequest = stringifyRequest(src + query))
    templateImport = `import { render, staticRenderFns } from ${request}`
  }

  // styles
  let stylesCode = ``
  if (descriptor.styles.length) {
    stylesCode = genStylesCode(
      loaderContext,
      descriptor.styles,
      id,
      resourcePath,
      stringifyRequest,
      needsHotReload,
      isServer || isShadow, // needs explicit injection?
      isProduction
    )
  }


  let code =
    `
${templateImport}
${scriptImport}
${stylesCode}

/* normalize component */
import normalizer from ${stringifyRequest(`!${componentNormalizerPath}`)}
var component = normalizer(
  script,
  render,
  staticRenderFns,
  ${hasFunctional ? `true` : `false`},
  ${/injectStyles/.test(stylesCode) ? `injectStyles` : `null`},
  ${hasScoped ? JSON.stringify(id) : `null`},
  ${isServer ? JSON.stringify(hash(request)) : `null`}
  ${isShadow ? `,true` : ``}
)
  `.trim() + `\n`


  if (descriptor.customBlocks && descriptor.customBlocks.length) {
    code += genCustomBlocksCode(
      descriptor.customBlocks,
      resourcePath,
      resourceQuery,
      stringifyRequest
    )
  }

  if (needsHotReload) {
    code += `\n` + genHotReloadCode(id, hasFunctional, templateRequest)
  }
  if (!isProduction) {
    code += `\ncomponent.options.__file = ${JSON.stringify(
      rawShortFilePath.replace(/\\/g, '/')
    )}`
  } else if (options.exposeFilename) {
    code += `\ncomponent.options.__file = ${JSON.stringify(filename)}`
  }

  code += `\nexport default component.exports`
  return code
}

module.exports.VueLoaderPlugin = plugin