module.exports = function validateWebpackConfig (
  webpackConfig,
  api,
  options,
  target = 'app'
) {
  const singleConfig = Array.isArray(webpackConfig)
    ? webpackConfig[0]
    : webpackConfig;

  const actualTargetDir = singleConfig.output.path;

  if (actualTargetDir !== api.resolve(options.outputDir)) {
    throw new Error(
      `\n\nConfiguration Error: ` +
      `Avoid modifying webpack output.path directly. ` +
      `Use the "outputDir" option instead.\n`
    );
  }

  if (actualTargetDir === api.service.context) {
    throw new Error(
      `\n\nConfiguration Error: ` +
      `Do not set output directory to project root.\n`
    )
  }

  if (target === 'app' && singleConfig.output.publicPath !== options.publicPath) {
    throw new Error(
      `\n\nConfiguration Error: ` +
      `Avoid modifying webpack output.publicPath directly. ` +
      `Use the "publicPath" option instead.\n`
    )
  }
}