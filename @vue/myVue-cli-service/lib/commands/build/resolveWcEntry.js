const fs = require('fs')
const path = require('path')

const camelizeRE = /-(\w)/g
const camelize = str => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
}

const hyphenateRE = /\B([A-Z])/g
const hyphenate = str => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
}

const createElement = (prefix, component, file, isAsync) => {
  const { camelName, kebabName } = exports.fileToComponentName(prefix, component)

  return isAsync
    ? `window.customElements.define('${kebabName}', wrap(Vue, () => import('~root/${file}?shadow')))\n`
    : `import ${camelName} from '~root/${file}?shadow'\n` +
        `window.customElements.define('${kebabName}', wrap(Vue, ${camelName}))\n`
}

exports.fileToComponentName = (prefix, file) => {
  const basename = path.basename(file).replace(/\.(jsx?|vue)$/, '')
  const camelName = camelize(basename)
  const kebabName = `${prefix ? `${prefix}-` : ``}${hyphenate(basename)}`
  return {
    basename,
    camelName,
    kebabName
  }
}

exports.resolveEntry = (prefix, libName, files, isAsync) => {
  const filePath = path.resolve(__dirname, 'entry-wc.js')
  const elements =
    prefix === ''
      ? [createElement('', libName, files[0])]
      : files.map(file => createElement(prefix, file, file, isAsync)).join('\n')

  const content = `
import './setPublicPath'
import Vue from 'vue'
import wrap from '@vue/web-component-wrapper'

// runtime shared by every component chunk
import 'css-loader/dist/runtime/api.js'
import 'vue-style-loader/lib/addStylesShadow'
import 'vue-loader/lib/runtime/componentNormalizer'

${elements}`.trim()
  fs.writeFileSync(filePath, content)
  return filePath
}
