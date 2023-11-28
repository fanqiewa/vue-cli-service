const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin');

const resolve = dir => {
  return path.join(__dirname, dir)
}

// 项目部署基础
// 默认情况下，我们假设你的应用将被部署在域的根目录下,
// 例如：https://www.my-app.com/
// 默认：'/'
// 如果您的应用程序部署在子路径中，则需要在这指定子路径
// 例如：https://www.foobar.com/my-app/
// 需要将它改为'/my-app/'
// iview-admin线上演示打包路径： https://file.iviewui.com/admin-dist/
const BASE_URL = process.env.NODE_ENV === 'production'
  ? '/admin'
  : '/admin'


module.exports = {
  // publicPath: BASE_URL,
  outputDir: './dist', // 构建输出目录
  // assetsDir: 'assets', // 静态资源目录 (js, css, img, fonts)
  // 指定生成的 index.html 的输出路径 (相对于 outputDir)。也可以是一个绝对路径。
  // indexPath: './dist/index.html',

  // 如果你不需要使用eslint，把lintOnSave设为false即可
  lintOnSave: false,

  chainWebpack: config => {
    config.resolve.alias
      .set('@', resolve('src')) // key,value自行定义，比如.set('@@', resolve('src/components'))
      .set('_c', resolve('src/components'))
  },

  // 设为false打包时不生成.map文件
  // 这里写你调用接口的基础路径，来解决跨域，如果设置了代理，那你本地开发环境的axios的baseUrl要写为 '' ，即空字符串
  devServer: {
    historyApiFallback: true,
    hot: true,
    inline: true,
    writeToDisk: true,
    
    stats: { colors: true },
    // public: 'http://localhost:8080/admin',
    // public: 'http://192.168.1.102:8080/admin',
    // host: '127.0.0.1',
    proxy: {
      // 匹配代理的url
      '/api': {
        context: '/api',

        // 目标服务器地址
        target: 'http://127.0.0.1:8000/',
        // 路径重写
        pathRewrite: { '^/api': '/api' },
        //开启代理：在本地会创建一个虚拟服务端
        changeOrigin: true
      },
      
    }
  },
  productionSourceMap: false
}
