// 默认配置
const defaults = {
  clean: true,
  target: 'app',
  formats: 'commonjs,umd,umd-min',
  'unsafe-inline': true
}

const buildModes = {
  lib: 'library',
  wc: 'web component',
  'wc-async': 'web component (async)'
}

// 修改配置
const modifyConfig = (config, fn) => {
  if (Array.isArray(config)) {
    config.forEach(c => fn(c))
  } else {
    fn(config)
  }
}

module.exports = (api, options) => {
  // 注册命令 - build
  api.registerCommand('build', {
    description: 'build for production',
    usage: 'vue-cli-service build [options] [entry|pattern]',
    options: {
      '--mode': `specify env mode (default: production)`,
      '--dest': `specify output directory (default: ${options.outputDir})`,
      '--modern': `build app targeting modern browsers with auto fallback`,
      '--no-unsafe-inline': `build app without introducing inline scripts`,
      '--target': `app | lib | wc | wc-async (default: ${defaults.target})`,
      '--inline-vue': 'include the Vue module in the final bundle of library or web component target',
      '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
      '--name': `name for lib or web-component mode (default: "name" in package.json or entry filename)`,
      '--filename': `file name for output, only usable for 'lib' target (default: value of --name)`,
      '--no-clean': `do not remove the dist directory before building the project`,
      '--report': `generate report.html to help analyze bundle content`,
      '--report-json': 'generate report.json to help analyze bundle content',
      '--skip-plugins': `comma-separated list of plugin names to skip for this run`,
      '--watch': `watch for changes`,
      '--stdin': `close when stdin ends`
    }
  }, async (args, rawArgs) => {
    // 注入默认配置参数
    for (const key in defaults) {
      if (args[key] == null) {
        args[key] = defaults[key];
      }
    }
    args.entry = args.entry || args._[0];
    if (args.target !== 'app') {
      // e.g. --target lib 
      // 默认入口为src/App.vue
      args.entry = args.entry || 'src/App.vue'
    }

    process.env.VUE_CLI_BUILD_TARGET = args.target;
    if (args.modern && args.target === 'app') {
      // --modern 现代版本，面向ES Modules
      process.env.VUE_CLI_MODERN_MODE = true
      if (!process.env.VUE_CLI_MODERN_BUILD) {
        await build(Object.assign({}, args, {
          modernBuild: false,
          keepAlive: true
        }), api, options)
        const { execa } = require('@vue/cli-shared-utils')
        const cliBin = require('path').resolve(__dirname, '../../../bin/vue-cli-service.js')
        await execa('node', [cliBin, 'build', ...rawArgs], {
          stdio: 'inherit',
          env: {
            VUE_CLI_MODERN_BUILD: true
          }
        })
      } else {
        // execa
        await build(Object.assign({}, args, {
          modernBuild: true,
          clean: false
        }), api, options)
      }
      delete process.env.VUE_CLI_MODERN_MODE
    } else {
      if (args.modern) {
        const { warn } = require('@vue/cli-shared-utils')
        warn(
          `Modern mode only works with default target (app). ` +
          `For libraries or web components, use the browserslist ` +
          `config to specify target browsers.`
        )
      }
      await build(args, api, options);
    }
    delete process.env.VUE_CLI_BUILD_TARGET;
  });
}

async function build(args, api, options) {
  const fs = require('fs-extra')
  const path = require('path')
  const webpack = require('webpack')
  const { chalk } = require('@vue/cli-shared-utils')
  const formatStats = require('./formatStats')
  const validateWebpackConfig = require('../../util/validateWebpackConfig')
  const {
    log,
    done,
    info,
    logWithSpinner,
    stopSpinner
  } = require('@vue/cli-shared-utils')

  log();
  // e.g. production
  const mode = api.service.mode;
  if (args.target === 'app') {
    const bundleTag = args.modern
      ? args.modernBuild
        ? `modern bundle `
        : `legacy bundle `
      : ``;
    // 输出打包日志
    logWithSpinner(`building ${bundleTag}for ${mode}...`);
  } else {
    const buildMode = buildModes[args.target]
    if (buildMode) {
      const additionalParams = buildMode === 'library' ? ` (${args.formats})` : ``
      logWithSpinner(`Building for ${mode} as ${buildMode}${additionalParams}...`)
    } else {
      throw new Error(`Unknown build target: ${args.target}`)
    }
  }

  if (args.dest) {
    // 重写输出路径
    options.outputDir = args.dest
  }

  // 输出位置
  const targetDir = api.resolve(options.outputDir);
  const isLegacyBuild = args.target === 'app' && args.modern && !args.modernBuild;

  // 根据target解析不同的webpack config
  let webpackConfig;
  if (args.target === 'lib') {
    webpackConfig = require('./resolveLibConfig')(api, args, options)
  } else if (
    args.target === 'wc' ||
    args.target === 'wc-async'
  ) {
    webpackConfig = require('./resolveWcConfig')(api, args, options)
  } else {
    webpackConfig = require('./resolveAppConfig')(api, args, options);
  }

  // 校验webpack config
  validateWebpackConfig(webpackConfig, api, options, args.target);

  if (args.watch) {
    modifyConfig(webpackConfig, config => {
      config.watch = true
    })
  }

  if (args.stdin) {
    process.stdin.on('end', () => {
      process.exit(0)
    })
    process.stdin.resume()
  }

  if (args.dashboard) {
    const DashboardPlugin = require('../../webpack/DashboardPlugin')
    modifyConfig(webpackConfig, config => {
      config.plugins.push(new DashboardPlugin({
        type: 'build',
        modernBuild: args.modernBuild,
        keepAlive: args.keepAlive
      }))
    })
  }

  if (args.report || args['report-json']) {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    modifyConfig(webpackConfig, config => {
      const bundleName = args.target !== 'app'
        ? config.output.filename.replace(/\.js$/, '-')
        : isLegacyBuild ? 'legacy-' : ''
      config.plugins.push(new BundleAnalyzerPlugin({
        logLevel: 'warn',
        openAnalyzer: false,
        analyzerMode: args.report ? 'static' : 'disabled',
        reportFilename: `${bundleName}report.html`,
        statsFilename: `${bundleName}report.json`,
        generateStatsFile: !!args['report-json']
      }))
    })
  }

  // 清除输出目录
  if (args.clean) {
    await fs.remove(targetDir);
  }

  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      // 编译完成
      stopSpinner(false);
      if (err) {
        return reject(err);
      }

      if (stats.hasErrors()) {
        return reject(`Build failed with errors.`);
      }

      if (!args.silent) {
        // 目标位置
        const targetDirShort = path.relative(
          api.service.context,
          targetDir
        );
        log(formatStats(stats, targetDirShort, api));
        if (args.target === "app" && !isLegacyBuild) {
          if (!args.watch) {
            done(`Build complete. The ${chalk.cyan(targetDirShort)} directory is ready to be deployed.`);
            info(`Check out deployment instructions at ${chalk.cyan(`https://cli.vuejs.org/guide/deployment.html`)}\n`);
          }
        }
      }

      if (process.env.VUE_CLI_TEST) {
        console.log('Build complete.');
      }

      resolve();
    })
  })
}

module.exports.defaultModes = {
  build: 'production'
}
