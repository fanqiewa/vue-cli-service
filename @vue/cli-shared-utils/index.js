[
  'env',
  'exit',
  'ipc',
  'logger',
  'module',
  'object',
  'openBroser',
  'pkg',
  'pluginResolution',
  'launch',
  'request',
  'spinner',
  'validate'
].forEach(m => {
  Object.assign(exports, require(`./lib/${m}`));
})

exports.chalk = require('chalk');
exports.execa = require('execa');
// semver 是 语义化版本（Semantic Versioning）规范 的一个实现，目前是由 npm 的团队维护，实现了版本和版本范围的解析、计算、比较。
exports.semver = require('semver');

Object.defineProperty(exports, 'installedBrowsers', {
  enumerable: true,
  get () {
    return exports.getInstalledBrowsers();
  }
})