
const {
  info,
  error,
  hasProjectYarn,
  hasProjectPnpm,
  openBrowser,
  IpcMessenger
} = require('@vue/cli-shared-utils')

const defaults = {
  host: '0.0.0.0',
  port: 8080,
  https: false
}
module.exports = (api /* PluginAPI */, options) => {
  api.registerCommand('serve', {
    description: 'start development server',
    usage: 'vue-cli-service serve [options] [entry]',
    options: {
      '--open': `open browser on server start`,
      '--copy': `copy url to clipboard on server start`,
      '--stdin': `close when stdin ends`,
      '--mode': `specify env mode (default: development)`,
      '--host': `specify host (default: ${defaults.host})`,
      '--port': `specify port (default: ${defaults.port})`,
      '--https': `use https (default: ${defaults.https})`,
      '--public': `specify the public network URL for the HMR client`,
      '--skip-plugins': `comma-separated list of plugin names to skip for this run`
    }
  }, async function serve(args) {
    // e.g. npm run serve

    info('Starting development server...');

    const isInContainer = checkInContainer();
    // 是否为production模式
    const isProduction = process.env.NODE_ENV === 'production';

    const url = require('url')
    const { chalk } = require('@vue/cli-shared-utils')
    const webpack = require('webpack')
    const WebpackDevServer = require('webpack-dev-server')
    const portfinder = require('portfinder')
    const prepareURLs = require('../util/prepareURLs')
    const prepareProxy = require('../util/prepareProxy')
    const launchEditorMiddleware = require('launch-editor-middleware')
    const validateWebpackConfig = require('../util/validateWebpackConfig')
    const isAbsoluteUrl = require('../util/isAbsoluteUrl')

    // 设置chainWebpack
    api.chainWebpack(webpackConfig => {
      if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
        // 设置devtool
        webpackConfig
          .devtool('eval-cheap-module-source-map')
        
        // 添加热更新插件
        webpackConfig
          .plugin('hmr')
            .use(require('webpack/lib/HotModuleReplacementPlugin'))

        webpackConfig
          .output
            .globalObject(`(typeof self !== 'undefined' ? self : this)`)

        // 添加编译进度插件（在控制台输入编译进度）
        if (!process.env.VUE_CLI_TEST && options.devServer.progress !== false) {
          webpackConfig
            .plugin('progress')
            .use(require('webpack/lib/ProgressPlugin'))
        }
      }
    });

    // 解析webpack config
    const webpackConfig = api.resolveWebpackConfig();

    validateWebpackConfig(webpackConfig, api, options);

    const projectDevServerOptions = Object.assign(
      webpackConfig.devServer || {},
      options.devServer
    );

      // e.g. --dashboard
    if (args.dashboard) {
      // 添加ui仪表盘插件
      const DashboardPlugin = require('../webpack/DashboardPlugin')
      ;(webpackConfig.plugins = webpackConfig.plugins || []).push(new DashboardPlugin({
        type: 'serve'
      }))
    }

    const entry = args._[0];
    if (entry) {
      webpackConfig.entry = {
        app: api.resolve(entry)
      }
    }

    const useHttps = args.https || projectDevServerOptions.https || defaults.https;
    // 协议
    const protocol = useHttps ? 'https' : 'http';
    // 域名
    const host = args.host || process.env.HOST || projectDevServerOptions.host || defaults.host
    portfinder.basePort = args.port || process.env.PORT || projectDevServerOptions.port || defaults.port
    // 端口
    const port = await portfinder.getPortPromise();
    // devServer public
    const rawPublicUrl = args.public || projectDevServerOptions.public;
    const publicUrl = rawPublicUrl
      ? /^[a-zA-Z]+:\/\//.test(rawPublicUrl)
        ? rawPublicUrl
        : `${protocol}://${rawPublicUrl}`
      : null;
    // urls对象
    const urls = prepareURLs(
      protocol,
      host,
      port,
      isAbsoluteUrl(options.publicPath) ? '/' : options.publicPath
    );

    // 本地浏览器运行的url
    const localUrlForBrowser = publicUrl || urls.localUrlForBrowser;
    
    // 代理设置
    const proxySettings = prepareProxy(
      projectDevServerOptions.proxy,
      api.resolve('public')
    );

    if (!isProduction) {
      // websocket Path
      // '/sockjs.node'
      const sockPath = projectDevServerOptions.sockPath || '/sockjs-node';
      // websocket Url
      // '?http://localhost:8080&sockPath=/sockjs.node'
      const sockjsUrl = publicUrl
        ? `?${publicUrl}&sockPath=${sockPath}`
        : isInContainer
          ? ``
          : `?` + url.format({
            protocol,
            port,
            hostname: urls.lanUrlForConfig || 'localhost'
          }) + `&sockPath=${sockPath}`;
      const devClients = [
        // webpack-dev-server/client 
        require.resolve(`webpack-dev-server/client`) + sockjsUrl,
        // hot
        require.resolve(projectDevServerOptions.hotOnly
          ? 'webpack/hot/only-dev-server'
          : 'webpack/hot/dev-server')
      ];
      if (process.env.APPVEYOR) {
        devClients.push(`webpack/hot/poll?500`);
      }
      // 注入客户端websoket
      addDevClientToEntry(webpackConfig, devClients);
    }

    // 创建编译器
    const compiler = webpack(webpackConfig);

    // 处理编译报错
    compiler.hooks.failed.tap('vue-cli-service serve', msg => {
      error(msg);
      process.exit(1);
    });

    // 创建服务
    const server = new WebpackDevServer(compiler, Object.assign({
      logLevel: 'silent', // 打印日志等级 分为warn、silent...  设置为silent沉默模式，即webpackDevServer将不输出任何信息
      clientLogLevel: 'silent',
      historyApiFallback: {
        disableDotRule: true,
        rewrites: genHistoryApiFallbackRewrites(options.publicPath, options.pages)
      },
      contentBase: api.resolve('public'), // html所在的目录 
      watchContentBase: !isProduction,
      hot: !isProduction,
      injectClient: false,
      compress: isProduction,
      publicPath: options.publicPath,
      overlay: isProduction
        ? false
        : { warnings: false, errors: true }
    }, projectDevServerOptions, {
      https: useHttps,
      proxy: proxySettings,
      // 前置特性
      before(app, server) {
        // 添加路由拦截，在编辑器中打开文件
        app.use('/__open-in-editor', launchEditorMiddleware(() => console.log(
          `To specify an editor, specify the EDITOR env variable or ` +
          `add "editor" field to your Vue project config.\n`
        )));
        // 允许其他插件注册middlewares, e.g. PWA
        api.service.devServerConfigFns.forEach(fn => fn(app, server))
        
        // 应用项目的middlewares
        projectDevServerOptions.before && projectDevServerOptions.before(app, server)
      },
      open: false
    }));

    ['SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, () => {
        server.close(() => {
          process.exit(0);
        });
      })
    });

    if (args.stdin) {
      // 监听shell输入
      process.stdin.on('end', () => {
        server.close(() => {
          process.exit(0)
        })
      })

      process.stdin.resume()
    }

    if (process.env.VUE_CLI_TEST) {
      // 测试环境输入close
      process.stdin.on('data', data => {
        if (data.toString() === 'close') {
          console.log('got close signal!')
          server.close(() => {
            process.exit(0)
          })
        }
      })
    }

    return new Promise((resolve, reject) => {
      let isFirstCompile = true;
      compiler.hooks.done.tap('vue-cli-service serve', stats => {
        if (stats.hasErrors) {
          return;
        }

        let copied = "";
        if (isFirstCompile && args.copy) {
          try {
            require('clipboardy').writeSync(localUrlForBrowser)
            copied = chalk.dim('(copied to clipboard)')
          } catch (_) {
            //
          }
        }

        const networkUrl = publicUrl
          ? publicUrl.replace(/([^/])$/, "$1/")
          : urls.lanUrlForTerminal;

        console.log()
        console.log(`  App running at:`)
        console.log(`  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`)
        if (!isInContainer) {
          console.log(`  - Network: ${chalk.cyan(networkUrl)}`)
        } else {
          console.log()
          console.log(chalk.yellow(`  It seems you are running Vue CLI inside a container.`))
          if (!publicUrl && options.publicPath && options.publicPath !== '/') {
            console.log()
            console.log(chalk.yellow(`  Since you are using a non-root publicPath, the hot-reload socket`))
            console.log(chalk.yellow(`  will not be able to infer the correct URL to connect. You should`))
            console.log(chalk.yellow(`  explicitly specify the URL via ${chalk.blue(`devServer.public`)}.`))
            console.log()
          }
          console.log(chalk.yellow(`  Access the dev server via ${chalk.cyan(
            `${protocol}://localhost:<your container's external mapped port>${options.publicPath}`
          )}`))
        }
        console.log();

        if (isFirstCompile) {
          isFirstCompile = false;

          if (!isProduction) {
            const buildCommand = hasProjectYarn(api.getCwd()) ? `yarn build` : hasProjectPnpm(api.getCwd()) ? `pnpm run build` : `npm run build`
            console.log(`  Note that the development build is not optimized.`)
            console.log(`  To create a production build, run ${chalk.cyan(buildCommand)}.`)
          } else {
            console.log(`  App is served in production mode.`)
            console.log(`  Note this is for preview or E2E testing only.`)
          }
          console.log()
          
          if (args.open || projectDevServerOptions.open) {
            const pageUri = (projectDevServerOptions.openPage && typeof projectDevServerOptions.openPage === 'string')
              ? projectDevServerOptions.openPage
              : ''
            openBrowser(localUrlForBrowser + pageUri)
          }
          
          if (args.dashboard) {
            const ipc = new IpcMessenger()
            ipc.send({
              vueServe: {
                url: localUrlForBrowser
              }
            })
          }

          resolve({
            server,
            url: localUrlForBrowser
          });
        } else if (process.env.VUE_CLI_TEST) {
          console.log('App updated')
        }
      });

      server.listen(port, host, err => {
        if (err) {
          reject(err);
        }
      });
    });
  });
}

// 添加客户端websoket入口文件
function addDevClientToEntry(config, devClient) {
  const { entry } = config;
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    Object.keys(entry).forEach((key) => {
      entry[key] = devClient.concat(entry[key]);
    });
  } else if (typeof entry === 'function') {
    config.entry = entry(devClient);
  } else {
    config.entry = devClient.concat(entry);
  }
}

// 检查是否在容器内
function checkInContainer() {
  if ('CONESANDBOX_SSE' in process.env) {
    return true;
  }
  const fs = require('fs');
  if (fs.existsSync(`/proc/1/cgroup`)) {
    const content = fs.readFileSync(`/proc/1/cgroup`, 'utf-8')
    return /:\/(lxc|docker|kubepods(\.slice)?)\//.test(content)
  }
}

function genHistoryApiFallbackRewrites(baseUrl, pages = {}) {
  const path = require('path');
  const multiPageRewrites = Object
    .keys(pages)
    .sort((a, b) => b.length - a.length)
    .map(name => ({
      from: new RegExp(`^/${name}`),
      to: path.posix.join(baseUrl, pages[name].filename || `${name}.html`)
    }));
  return [
    ...multiPageRewrites,
    { from: /./, to: path.posix.join(baseUrl, 'index.html') }
  ];
}

// 设置默认模式 apply.defaultModes
module.exports.defaultModes = {
  serve: 'development'
}
