
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const LRU = require('lru-cache')
const semver = require('semver')

let _hasYarn;
const _yarnProjects = new LRU({
  max: 10,
  maxAge: 1000
})

exports.hasYarn = () => {
  if (process.env.VUE_CLI_TEST) {
    return true;
  }

  if (_hasYarn != null) {
    return _hasYarn;
  }
  try {
    execSync("yarn --version", { stdio: "ignore" });
    return (_hasYarn = true);
  } catch (e) {
    return (_hasYarn = false);
  }
}

exports.hasProjectYarn = (cwd) => {
  if (_yarnProjects.has(cwd)) {
    return checkYarn(_yarnProjects.get(cwd));
  }

  const lockFile = path.join(cwd, "yarn.lock");
  const result = fs.existsSync(lockFile);
  _yarnProjects.set(cwd, result);
  return checkYarn(result);
}

function checkYarn(result) {
  if (result && !exports.hasYarn()) throw new Error(`The project seems to require yarn but it's not installed.`);
  return result;
}
