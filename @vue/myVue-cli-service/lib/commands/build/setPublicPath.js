if (typeof window !== 'undefined') {
  var currentScript = window.document.currentScript
  if (process.env.NEED_CURRENTSCRIPT_POLYFILL) {
    var getCurrentScript = require('@soda/get-current-script')
    currentScript = getCurrentScript()

    if (!('currentScript' in document)) {
      Object.defineProperty(document, 'currentScript', { get: getCurrentScript })
    }
  }

  var src = currentScript && currentScript.src.match(/(.+\/)[^/]+\.js(\?.*)?$/)
  if (src) {
    __webpack_public_path__ = src[1] // eslint-disable-line
  }
}

export default null