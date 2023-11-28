
var path = require('path');
var webpack = require('webpack');


// var obj =
// {
//   mode: 'development',
//   entry: {
//     main: './src/main.js',
//   },
//   output: {
//     filename: '[name][chunkhash:8].js',
//     path: path.resolve(__dirname, 'dist')
//   },
//   module: {
//     rules: [
//       { test: /\.ts$/, use: 'ts-loader' }
//     ]
//   },
// }

// // 创建编译器
// var compiler = webpack(obj);


module.exports =
{
  mode: 'production',
  entry: {
    index: "./src/index.js",
  },
  output: {
    filename: '[name][chunkhash:8].js',
    path: path.resolve(__dirname, 'dist')
  },
  optimization: {
    splitChunks: {
      minSize: 30000, // 最小尺寸，30000
      minChunks: 1, // 最小 chunk ，默认1
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'cache-loader'
      },
    ]
  },
  devServer: {
    historyApiFallback: true,
    hot: true,
    inline: true,
    writeToDisk: true,
    stats: { colors: true },
    // public: 'http://localhost:8080/admin',
    // public: 'http://192.168.1.102:8080/admin',
    host: '0.0.0.0',
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
}

