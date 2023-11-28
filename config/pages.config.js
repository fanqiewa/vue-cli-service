/**
 * 多模块入口配置
 */
const businessArray = [
  {
    /* 入口工程 */
    chunk: 'digital',
    chunkName: '首页',
    root: true
  },
  {
    /* 微银行模块 */
    chunk: 'microbank',
    chunkName: '微银行模块'
  },
  {
    /* 资产负债模块 */
    chunk: 'balance',
    chunkName: '资产负债模块'
  },
]

/** 以下的配置若看不懂请勿修改 **/

const pages = {}
const aliasConfig = []

if (process.env.NODE_ENV === 'production') {
  const pagesArr = businessArray.map(i => i.chunk)
  if (pagesArr.includes(process.env.PROJECT_NAME)) {
    compile(businessArray[pagesArr.indexOf(process.env.PROJECT_NAME)])
  }
} else {
  businessArray.forEach(v => {
    if (pages.hasOwnProperty(v.chunk)) {
      throw new Error('pages配置存在同名模块，请修改')
    }
    compile(v)
  })
}

function compile(v) {
  pages[v.chunk] = {
    // page 的入口
    entry: `src/pages/${v.chunk}/main.js`,
    // 模板来源
    template: 'public/index.html',
    // 在 dist/index.html 的输出
    filename: process.env.NODE_ENV === 'production' ? 'index.html' : v.root ? 'index.html' : `${v.chunk}/index.html`,
    // 当使用 title 选项时，
    // template 中的 title 标签需要是 <title><%= htmlWebpackPlugin.options.title %></title>
    title: v.chunkName || '',
    // 在这个页面中包含的块，默认情况下会包含
    // 提取出来的通用 chunk 和 vendor chunk。
    chunks: ['chunk-vendors', 'chunk-common', v.chunk],
    favicon: 'public/favicon.ico'
  }
  aliasConfig.push({
    name: v.chunk,
    path: `src/pages/${v.chunk}`
  })
}

module.exports = {
  businessArray,
  pages,
  aliasConfig
}
