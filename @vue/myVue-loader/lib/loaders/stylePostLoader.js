/**
 * 处理style标签
 */
const qs = require('querystring')
const { resolveCompiler } = require('../compiler')

module.exports = function (source, inMap) {
  const query = qs.parse(this.resourceQuery.slice(1))
  const { compiler } = resolveCompiler(this.rootContext, this)
  const { code, map, errors } = compiler.compileStyle({
    source,
    filename: this.resourcePath,
    id: `data-v-${query.id}`,
    map: inMap,
    scoped: !!query.scoped,
    isProd: query.prod != null,
    trim: true
  })

  if (errors.length) {
    this.callback(errors[0])
  } else {
    this.callback(null, code, map)
  }
}
