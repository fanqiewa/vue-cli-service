const fs = require('fs')
const path = require('path')
const debug = require('debug')
const merge = require('webpack-merge')
const Config = require('webpack-chain')
const PluginAPI = require('./PluginAPI')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')
const defaultsDeep = require('lodash.defaultsdeep')
const { chalk, warn, error, isPlugin, resolvePluginId, loadModule, resolvePkg } = require('@vue/cli-shared-utils')

const { defaults, validate } = require('./options')

module.exports = class Service {
  constructor (context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
    process.VUE_CLI_SERVICE = this;
    this.initialized = false; // 是否正在初始化
    this.context = context;
    this.inlineOptions = inlineOptions;
    this.webpackChainFns = [];
    this.webpackRawConfigFns = [];
    this.devServerConfigFns = [];
    // e.g. { build, help, inspect, lint, serve }
    this.commands = {};

    this.pkgContext = context;
    this.pkg = this.resolvePkg(pkg);

    this.plugins = this.resolvePlugins(plugins, useBuiltIn);

    this.pluginsToSkip = new Set();

    this.modes = this.plugins.reduce((modes, { apply: { defaultModes }}) => {
      return Object.assign(modes, defaultModes)
    }, {})
  }
  // 解析package.json
  resolvePkg(inlinePkg, context = this.context) {
    if (inlinePkg) {
      return inlinePkg;
    }
    const pkg = resolvePkg(context);
    // 自定义package.json文件路径
    if (pkg.vuePlugins && pkg.vuePlugins.resolveFrom) {
      this.pkgContext = path.resolve(context, pkg.vuePlugins.resolveFrom);
      return this.resolvePkg(null, this.pkgContext);
    }
    return pkg;
  }

  // 运行初始化
  init(mode = process.env.VUE_CLI_MODE) {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.mode = mode;

    if (mode) {
      this.loadEnv(mode);
    }

    this.loadEnv();

    const userOptions = this.loadUserOptions();
    // 深度克隆
    this.projectOptions = defaultsDeep(userOptions, defaults());

    // 在控制台输出已配置的options vue.config
    debug('vue:project-config' /* name 命名空间 */)(this.projectOptions /* 参数 */);

    // 应用插件 this.commands = { serve, ... }
    // e.g. 
    // vue-cli-service自带的：
    // .commands/serve、build、inspect、help
    // ./config/base、css、prod、app
    // package.json中注入的依赖:
    // @vue/cli-plugin-babel、@vue/cli-plugin-eslint
    this.plugins.forEach(({ id, apply }) => {
      if (this.pluginsToSkip.has(id)) return;
      apply(new PluginAPI(id, this), this.projectOptions);
    });

    // chainWebpack 一个函数，可以链式修改webpack config
    if (this.projectOptions.chainWebpack) {
      this.webpackChainFns.push(this.projectOptions.chainWebpack)
    }
    // configureWebpack 相当于配置webpack.config.js
    if (this.projectOptions.configureWebpack) {
      this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
    }
  }

  // 加载env文件
  loadEnv(mode) {
    const logger = debug('vue:env');
    // e.g. .env.development
    const basePath = path.resolve(this.context, `.env${mode ? `.${mode}` : ``}`);
    // e.g. .env.development.local
    const localPath = `${basePath}.local`;

    const load = envPath => {
      try {
        const env = dotenv.config({ path: envPath, debug: process.env.DEBUG });
        // 读取env文件
        dotenvExpand(env);
        logger(envPath, env);
      } catch (err) {

        if (err.toString().indexOf('ENOENT') < 0) {
          error(err);
        }
      }
    }
    
    load(localPath);
    load(basePath);

    if (mode) {

      const shouldForceDefaultEnv = (
        process.env.VUE_CLI_TEST &&
        !process.env.VUE_CLI_TEST_TESTING_ENV
      );
      const defaultNodeEnv = (mode === 'production' || mode === 'test')
        ? mode
        : 'development';
      if (shouldForceDefaultEnv || process.env.NODE_ENV == null) {
        process.env.NODE_ENV = defaultNodeEnv; // 设置NODE_ENV
      }
      if (shouldForceDefaultEnv || process.env.BABEL_ENV == null) {
        process.env.BABEL_ENV = defaultNodeEnv; // 设置BABEL_ENV
      }
    }
  }

  // 设置跳过插件
  setPluginsToSkip(args) {
    const skipPlugins = args['skip-plugins'];
    const pluginsToSkip = skipPlugins
      ? new Set(skipPlugins.split(',').map(id => resolvePluginId(id)))
      : new Set();
    
    this.pluginsToSkip = pluginsToSkip;
  }

  // 解析插件
  resolvePlugins(inlinePlugins, useBuiltIn) {
    const idToPlugin = id => ({
      // 匹配 `.` 开头的id
      id: id.replace(/^.\//, 'built-in'),
      apply: require(id)
    });
    let plugins;

    // e.g.
    /*
      [
        {
          id: 'built-in: commands/server',
          apply: require('.commands/server')
        },
      ]
    */
    const builtInPlugins = [
      './commands/serve',
      './commands/build',
      './commands/inspect',
      './commands/help',

      './config/base',
      './config/css',
      './config/prod',
      './config/app'
    ].map(idToPlugin);

    if (inlinePlugins) {
      plugins = useBuiltIn !== false
        ? builtInPlugins.concat(inlinePlugins)
        : inlinePlugins;
    } else {
      // 项目plugin，cli-plugin
      // devDependencies && dependencies
      const projectPlugins = Object.keys(this.pkg.devDependencies || {})
        .concat(Object.keys(this.pkg.dependencies || {}))
        .filter(isPlugin)
        .map(id => {
          if (this.pkg.optionalDependencies &&
            id in this.pkg.optionalDependencies
          ) {
            let apply = () => {};
            try {
              apply = require(id);
            } catch (e) {
              warn(`Optional dependency ${id} is not installed.`);
            }

            return { id, apply }
          } else {
            return idToPlugin(id);
          }
        })
      plugins = builtInPlugins.concat(projectPlugins);
    }

    // 本地的plugins package.json配置vuePlugins
    if (this.pkg.vuePlugins && this.pkg.vuePlugins.service) {
      const files = this.pkg.vuePlugins.service;
      if (!Array.isArray(files)) {
        throw new Error(`Invalid type for option 'vuePlugins.service', expected 'array' but got ${typeof files}.`);
      }
      plugins = plugins.concat(files.map(file => ({
        id: `local:${file}`,
        apply: loadModule(`./${file}`, this.pkgContext)
      })))
    }
    return plugins;
  }

  // 运行服务 入口
  async run(name, args = {}, rawArgv = []) {
    const mode = args.mode || (name === 'build' && args.watch ? 'development' : this.modes[name]);

    this.setPluginsToSkip(args);

    this.init(mode);

    args._ = args._ || [];
    let command = this.commands[name];
    if (!command && name) {
      error(`command "${name}" does not exit.`);
      process.exit(1);
    }
    if (!command || args.help || args.h) {
      command = this.commands.help;
    } else {
      args._.shift();
      rawArgv.shift();
    }
    const { fn } = command;
    // 运行终端输入的命令 e.g. serve
    return fn(args, rawArgv);
  }

  // 解析chainable config
  resolveChainableWebpackConfig() {
    const chainableConfig = new Config();
    // 默认7个
    this.webpackChainFns.forEach(fn => fn(chainableConfig));
    return chainableConfig;
  }

  // 解析webpack config
  resolveWebpackConfig(chainableConfig = this.resolveChainableWebpackConfig()) {
    if (!this.initialized) {
      throw new Error('Service must call init() before calling resolveWebpackConfig().')
    }
    let config = chainableConfig.toConfig();
    const original = config;
    this.webpackRawConfigFns.forEach(fn => {
      if (typeof fn === 'function') {
        const res = fn(config);
        if (res) config = merge(config, res);
      } else if (fn) {
        config = merge(config, fn);
      }
    });

    // 配置了configureWebpack，则config !== original
    if (config !== original) {
      cloneRuleNames(
        config.module && config.module.rules,
        original.module && original.module.rules
      )
    }

    const target = process.env.VUE_CLI_BUILD_TARGET;
    if (
      !process.env.VUE_CLI_TEST &&
      (target && target !== 'app') &&
      config.output.publicPath !== this.projectOptions.publicPath
    ) {
      throw new Error(
        `Do not modify webpack output.publicPath directly. ` +
        `Use the "publicPath" option in vue.config.js instead.`
      )
    }

    if (
      !process.env.VUE_CLI_ENTRY_FILES &&
      typeof config.entry !== 'function'
    ) {
      let entryFiles;
      if (typeof config.entry === 'string') {
        entryFiles = [config.entry];
      } else if (Array.isArray(config.entry)) {
        entryFiles = config.entry;
      } else {
        entryFiles = Object.values(config.entry || []).reduce((allEntries, curr) => {
          return allEntries.concat(curr)
        }, []);
      }

      entryFiles = entryFiles.map(file => path.resolve(this.context, file));
      process.env.VUE_CLI_ENTRY_FILES = JSON.stringify(entryFiles);
    }

    return config;
  }

  // 加载vue.config.js
  loadUserOptions() {
    let fileConfig, pkgConfig, resolved, resolvedFrom;
    // es模式
    const esm = this.pkg.type && this.pkg.type === 'module';

    const possibleConfigPaths = [
      process.env.VUE_CLI_SERVICE_CONFIG_PATH,
      './vue.config.js',
      './vue.config.cjs'
    ];

    let fileConfigPath;
    for (const p of possibleConfigPaths) {
      const resolvedPath = p && path.resolve(this.context, p);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        fileConfigPath = resolvedPath;
        break;
      }
    }

    if (fileConfigPath) {
      if (esm && fileConfigPath === './vue.config.js') {
        throw new Error(`Please rename ${chalk.bold('vue.config.js')} to ${chalk.bold('vue.config.cjs')} when ECMAScript modules is enabled`)
      }

      try {
        fileConfig = loadModule(fileConfigPath, this.context);
        
        if (typeof fileConfig === 'function') {
          fileConfig = fileConfig();
        }

        if (!fileConfig || typeof fileConfig !== 'object') {
          error(
            `Error loading ${chalk.bold(fileConfigPath)}: should export an object or a function that returns object.`
          );
          fileConfig = null;
        }
      } catch (e) {
        error(`Error loading ${chalk.bold(fileConfigPath)}:`);
        throw e;
      }
    }

    pkgConfig = this.pkg.vue;
    if (pkgConfig && typeof pkgConfig !== 'object') {
      error(
        `Error loading vue-cli config in ${chalk.bold(`package.json`)}: ` +
        `the "vue" field should be an object.`
      );
      pkgConfig = null;
    }

    if (fileConfig) {
      if (pkgConfig) {
        warn(
          `"vue" field in package.json ignored ` +
          `due to presence of ${chalk.bold('vue.config.js')}.`
        )
        warn(
          `You should migrate it into ${chalk.bold('vue.config.js')} ` +
          `and remove it from package.json.`
        )
      }
      resolved = fileConfig
      resolvedFrom = 'vue.config.js'
    } else if (pkgConfig) {
      resolved = pkgConfig;
      resolvedFrom = '"vue" field in package.json';
    } else {
      resolved = this.inlineOptions || {};
      resolvedFrom = 'inline options';
    }

    if (resolved.css && typeof resolved.css.modules !== 'undefined') {
      if (typeof resolved.css.requireModuleExtension !== 'undefined') {
        warn(
          `You have set both "css.modules" and "css.requireModuleExtension" in ${chalk.bold('vue.config.js')}, ` +
          `"css.modules" will be ignored in favor of "css.requireModuleExtension".`
        )
      } else {
        warn(
          `"css.modules" option in ${chalk.bold('vue.config.js')} ` +
          `is deprecated now, please use "css.requireModuleExtension" instead.`
        )
        resolved.css.requireModuleExtension = !resolved.css.modules
      }
    }

    // 格式化一些配置
    ensureSlash(resolved, 'publicPath');
    if (typeof resolved.publicPath === 'string') {
      resolved.publicPath = resolved.publicPath.replace(/^\.\//, '');
    }
    removeSlash(resolved, 'outputDir');

    validate(resolved, msg => {
      error(
        `Invalid options in ${chalk.bold(resolvedFrom)}: ${msg}`
      );
    });

    return resolved;
  }
}

function ensureSlash(config, key) {
  const val = config[key];
  if (typeof val === 'string') {
    config[key] = val.replace(/([^/])$/, '$1');
  }
}

function removeSlash(config, key) {
  if (typeof config[key] === 'string') {
    config[key] = config[key].replace(/\/$/g, '');
  }
}

function cloneRuleNames (to, from) {
  if (!to || !from) {
    return
  }
  from.forEach((r, i) => {
    if (to[i]) {
      Object.defineProperty(to[i], '__ruleNames', {
        value: r.__ruleNames
      })
      cloneRuleNames(to[i].oneOf, r.oneOf)
    }
  })
}