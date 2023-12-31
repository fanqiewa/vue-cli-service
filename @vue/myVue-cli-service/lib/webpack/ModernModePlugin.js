const fs = require('fs-extra')
const path = require('path')

const safariFix = `!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();`

class ModernModePlugin {
  constructor ({ targetDir, isModernBuild, unsafeInline, jsDirectory }) {
    this.targetDir = targetDir
    this.isModernBuild = isModernBuild
    this.unsafeInline = unsafeInline
    this.jsDirectory = jsDirectory
  }

  apply (compiler) {
    if (!this.isModernBuild) {
      this.applyLegacy(compiler)
    } else {
      this.applyModern(compiler)
    }
  }

  // legacy模式
  applyLegacy (compiler) {
    const ID = `vue-cli-legacy-bundle`
    compiler.hooks.compilation.tap(ID, compilation => {
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(ID, async (data, cb) => {
        await fs.ensureDir(this.targetDir)
        const htmlName = path.basename(data.plugin.options.filename)
        const htmlPath = path.dirname(data.plugin.options.filename)
        const tempFilename = path.join(this.targetDir, htmlPath, `legacy-assets-${htmlName}.json`)
        await fs.mkdirp(path.dirname(tempFilename))
        await fs.writeFile(tempFilename, JSON.stringify(data.body))
        cb()
      })
    })
  }

  // noModule 现代版本浏览器，面向ES Modules
  applyModern (compiler) {
    const ID = `vue-cli-modern-bundle`
    compiler.hooks.compilation.tap(ID, compilation => {
      // html-webpack-plugin data为html文件内容
      compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(ID, async (data, cb) => {
        data.body.forEach(tag => {
          if (tag.tagName === 'script' && tag.attributes) {
            tag.attributes.type = 'module'
          }
        })

        data.head.forEach(tag => {
          if (tag.tagName === 'link' &&
              tag.attributes.rel === 'preload' &&
              tag.attributes.as === 'script') {
            tag.attributes.rel = 'modulepreload'
          }
        })

        const htmlName = path.basename(data.plugin.options.filename)
        const htmlPath = path.dirname(data.plugin.options.filename)
        const tempFilename = path.join(this.targetDir, htmlPath, `legacy-assets-${htmlName}.json`)
        const legacyAssets = JSON.parse(await fs.readFile(tempFilename, 'utf-8'))
          .filter(a => a.tagName === 'script' && a.attributes)
        legacyAssets.forEach(a => { a.attributes.nomodule = '' })

        if (this.unsafeInline) {
          data.body.push({
            tagName: 'script',
            closeTag: true,
            innerHTML: safariFix
          })
        } else {
          const safariFixPath = path.join(this.jsDirectory, 'safari-nomodule-fix.js')
          const fullSafariFixPath = path.join(compilation.options.output.publicPath, safariFixPath)
          compilation.assets[safariFixPath] = {
            source: function () {
              return new Buffer(safariFix)
            },
            size: function () {
              return Buffer.byteLength(safariFix)
            }
          }
          data.body.push({
            tagName: 'script',
            closeTag: true,
            attributes: {
              src: fullSafariFixPath
            }
          })
        }

        data.body.push(...legacyAssets)
        await fs.remove(tempFilename)
        cb()
      })

      compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(ID, data => {
        data.html = data.html.replace(/\snomodule="">/g, ' nomodule>')
      })
    })
  }
}

ModernModePlugin.safariFix = safariFix
module.exports = ModernModePlugin
