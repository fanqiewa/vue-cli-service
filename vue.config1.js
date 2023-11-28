const path = require('path')
const resolve = dir => path.join(__dirname, dir)
const { pages, aliasConfig } = require('./config/pages.config')
const webpack =  require('webpack')


// 开发环境，只运行当前开发的场景模块
const { VUE_MODULE,  PROJECT_NAME } = process.env
let page = {
  digital: pages.digital
}
if (VUE_MODULE) {
  VUE_MODULE.split('|').forEach(item => {
    page[item] = pages[item]
  })
}

// 获取机器信息
const os = require('os')
const SYS_RELEASE = os.release()
const SYS_TYPE = os.type()
const SYS_PLATFORM = os.platform()
const osLength = os.cpus().length

module.exports = {
  pages: VUE_MODULE ? page : pages,
  // publicPath: NODE_ENV === 'production' ? IS_ROOT === '1' ? '/digital' : `/${PROJECT_NAME}/` : '/',
  publicPath: '/',
  outputDir: `dist/${PROJECT_NAME}`,
  lintOnSave: true,
  // webpack配置
  chainWebpack: (config) => {
    config.resolve.alias
      .set('@', resolve('src'))
      .set('assets', resolve('src/assets'))
      .set('components', resolve('src/components'))
      .set('utils', resolve('src/utils'))
    aliasConfig.forEach(item => {
      config.resolve.alias
        .set(`@${item.name}`, resolve(item.path))
    })

    config.output.chunkFilename(`js/[name].[chunkhash:8].js`)
  },
  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.js$/,
          use: [
            {
              loader: 'thread-loader',
              options: {
                workers: osLength
              }
            }
          ],
        }
      ]
    },
    plugins: [
      // 定义全局变量
      new webpack.DefinePlugin({
        PROCESSENV: JSON.stringify({
          SYS_RELEASE,
          SYS_TYPE,
          SYS_PLATFORM
        })
      }),
    ]
  },
  // vue-loader 配置项
  // 生产环境是否生成 sourceMap 文件
  productionSourceMap: false,
  // css相关配置
  css: {
   // 是否使用css分离插件 ExtractTextPlugin
   extract: true,
   // 开启 CSS source maps?
   sourceMap: false,
   // css预设器配置项,向CSS相关的loader传递选项
   // (支持 css-loader postcss-loader sass-loader less-loader stylus-loader)
   // 如loaderOptions: { css: {}, less: {} }
   loaderOptions: {
    less: {
      lessOptions: {
        javascriptEnabled: true,
      },
    }
   },
   // 启用 CSS modules for all css / pre-processor files.
   requireModuleExtension: true
  },
  // 是否为 Babel 或 TypeScript 使用 thread-loader
  parallel: 3,
  // 是否启用dll
  // PWA 插件相关配置
  // see https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-pwa
  pwa: {},
  // webpack-dev-server 相关配置
  devServer: {
  //  host: 'localhost', // 本地ip
  //  port: 8080, // 端口号
   open: false, // 运行时是否自动在浏览器打开
   https: false, // 是否为https协议
   hot: true,
   hotOnly: false,
  },
  // 第三方插件配置
  pluginOptions: {
   // ...
  }
 }