const fs = require('fs')
const path = require('path')
// 读取package.json文件
const readPkg = require('read-pkg')

// 解析package.json文件
exports.resolvePkg = function (context) {
  if (fs.existsSync(path.join(context, 'package.json'))) {
    return readPkg.sync({ cwd: context });
  }
  return {};
}