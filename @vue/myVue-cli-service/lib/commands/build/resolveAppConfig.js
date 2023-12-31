
// config
module.exports = (api, args, options) => {
  // 设置webpack entry
  if (args.entry && !options.pages) {
    api.configureWebpack(config => {
      config.entry = { app: api.resolve(args.entry) }
    })
  }

  const config = api.resolveChainableWebpackConfig();
  const targetDir = api.resolve(args.dest || options.outputDir);

  if (args.dest && config.plugins.has('copy')) {
    config.plugin('copy').tap(pluginArgs => {
      pluginArgs[0][0].to = targetDir
      return pluginArgs
    })
  }

  if (args.modern) {
    const ModernModePlugin = require('../../webpack/ModernModePlugin')
    if (!args.modernBuild) {
      config
        .plugin('modern-mode-legacy')
        .use(ModernModePlugin, [{
          targetDir,
          isModernBuild: false,
          unsafeInline: args['unsafe-inline']
        }])
    } else {
      config
        .plugin('modern-mode-modern')
        .use(ModernModePlugin, [{
          targetDir,
          isModernBuild: true,
          unsafeInline: args['unsafe-inline'],
          jsDirectory: require('../../util/getAssetPath')(options, 'js')
        }])
    }
  }

  return api.resolveWebpackConfig(config)
}