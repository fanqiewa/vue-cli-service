const { chalk } = require('@vue/cli-shared-utils')

const rules = [
  {
    type: 'cant-resolve-loader',
    re: /Can't resolve '(.*loader)'/,
    msg: (e, match) => (
      `Failed to resolve loader: ${chalk.yellow(match[1])}\n` +
      `You may need to install it.`
    )
  }
]

exports.transformer = error => {
  if (error.webpackError) {
    const message = typeof error.webpackError === 'string'
      ? error.webpackError
      : error.webpackError.message || ''
    for (const { re, msg, type } of rules) {
      const match = message.match(re)
      if (match) {
        return Object.assign({}, error, {
          type,
          shortMessage: msg(error, match)
        })
      }
    }
    if (!error.message) {
      return Object.assign({}, error, {
        type: 'unknown-webpack-error',
        shortMessage: message
      })
    }
  }
  return error
}

exports.formatter = errors => {
  errors = errors.filter(e => e.shortMessage)
  if (errors.length) {
    return errors.map(e => e.shortMessage)
  }
}