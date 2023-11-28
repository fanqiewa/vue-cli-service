/**
 * 准备ip地址
*/
const url = require('url')
const { chalk } = require('@vue/cli-shared-utils')
const address = require('address')
const defaultGateway = require('default-gateway')

module.exports = function prepareUrls(protocol, host, port, pathname = '/') {
  const formatUrl = hostname =>
    url.format({
      protocol,
      hostname,
      port,
      pathname
    })
  // 命令行窗口输出漂亮的url
  const prettyPrintUrl = hostname =>
    url.format({
      protocol,
      hostname,
      port: chalk.bold(port),
      pathname
    })

  const isUnspecifiedHost = host === '0.0.0.0' || host === '::';
  let prettyHost, lanUrlForConfig;
  let lanUrlForTerminal = chalk.gray('unavailable');
  if (isUnspecifiedHost) { // 未指定主机
    prettyHost = 'localhost';
    try {
      // ipv4 地址
      const result = defaultGateway.v4.sync();
      lanUrlForConfig = address.ip(result && result.interface);
      if (lanUrlForConfig) {
        if (
          /^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(
            lanUrlForConfig
          )
        ) {
          lanUrlForTerminal = prettyPrintUrl(lanUrlForConfig)
        } else {
          lanUrlForConfig = undefined
        }
      }

    } catch (_e) {
      // ignored
    }
  } else {
    prettyHost = host
    lanUrlForConfig = host
    lanUrlForTerminal = prettyPrintUrl(lanUrlForConfig)
  }
  const localUrlForTerminal = prettyPrintUrl(prettyHost)
  const localUrlForBrowser = formatUrl(prettyHost)
  return {
    lanUrlForConfig,
    lanUrlForTerminal,
    localUrlForTerminal,
    localUrlForBrowser
  }
}

