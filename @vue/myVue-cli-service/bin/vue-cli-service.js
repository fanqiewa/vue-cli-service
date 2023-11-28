
const { semver, error } = require('@vue/cli-shared-utils');
// 版本号
const requiredVersion = require('../package.json').engines.node;

// 判断vue-cli-service需要的node版本号是否正确
if (!semver.satisfies(process.version, requiredVersion, { includePrerelease: true })) {
  error(
    `Yor are using Node ${process.version}, but vue-cli-service ` +
    `requires Node ${requiredVersion}.\nPlease upgrade your Node version.`
  )
  process.exit(1);
}

// 创建服务
const Service = require('../lib/Service');
const service = new Service(process.env.VUE_CLI_CONTEXT || process.cwd());

const rawArgv = process.argv.slice(2);

// minimist 解析命令行参数
const args = require('minimist')(rawArgv, {
  boolean: [
    // build可以输入的参数
    'modern',
    'report',
    'report-json',
    'inline-vue',
    'watch',

    // serve可以输入的参数
    'open',
    'copy',
    'https',

    // inspect可以输入的从参数
    'verbose'
  ]
});

const command = args._[0];

service.run(command, args, rawArgv).catch(err => {
  error(err);
  process.exit(1);
})