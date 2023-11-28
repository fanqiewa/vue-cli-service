const { semver, loadModule } = require('@vue/cli-shared-utils')

// 获取vue版本号
module.exports = function getVueMajor (cwd) {
  const vue = loadModule('vue', cwd)
  const vueMajor = vue ? semver.major(vue.version) : 2
  return vueMajor
}
