const qs = require('querystring')
const RuleSet = require('webpack/lib/RuleSet')
const { resolveCompiler } = require('./compiler')

const id = 'vue-loader-plugin'
const NS = 'vue-loader'


class VueLoaderPlugin {
  apply(compiler) {
    if (compiler.hooks) {
      compiler.hooks.compilation.tap(id, compilation => {
        const normalModuleLoader = compilation.hooks.normalModuleLoader
        normalModuleLoader.tap(id, loaderContext => {
          loaderContext[NS] = true
        })
      })
    } else {
      // webpack < 4
      compiler.plugin('compilation', compilation => {
        compilation.plugin('normal-module-loader', loaderContext => {
          loaderContext[NS] = true
        })
      })
    }

    const rawRules = compiler.options.module.rules
    const { rules } = new RuleSet(rawRules)

    let vueRuleIndex = rawRules.findIndex(createMatcher(`foo.vue`))
    if (vueRuleIndex < 0) {
      vueRuleIndex = rawRules.findIndex(createMatcher(`foo.vue.html`))
    }
    const vueRule = rules[vueRuleIndex]

    if (!vueRule) {
      throw new Error(
        `[VueLoaderPlugin Error] No matching rule for .vue files found.\n` +
        `Make sure there is at least one root-level rule that matches .vue or .vue.html files.`
      )
    }

    if (vueRule.oneOf) {
      throw new Error(
        `[VueLoaderPlugin Error] vue-loader 15 currently does not support vue rules with oneOf.`
      )
    }

    const vueUse = vueRule.use
    const vueLoaderUseIndex = vueUse.findIndex(u => {
      return /^vue-loader|(\/|\\|@)vue-loader/.test(u.loader)
    })

    if (vueLoaderUseIndex < 0) {
      throw new Error(
        `[VueLoaderPlugin Error] No matching use for vue-loader is found.\n` +
        `Make sure the rule matching .vue files include vue-loader in its use.`
      )
    }

    const vueLoaderUse = vueUse[vueLoaderUseIndex]
    vueLoaderUse.ident = 'vue-loader-options'
    vueLoaderUse.options = vueLoaderUse.options || {}

    const clonedRules = rules
      .filter(r => r !== vueRule)
      .map(cloneRule)

    const templateCompilerRule = {
      loader: require.resolve('./loaders/templateLoader'),
      resourceQuery: (query) => {
        const parsed = qs.parse(query.slice(1))
        return parsed.vue != null && parsed.type === 'template'
      },
      options: vueLoaderUse.options
    }

    const { is27 } = resolveCompiler(compiler.options.context)
    let jsRulesForRenderFn = []
    if (is27) {
      const matchesJS = createMatcher(`test.js`)
      jsRulesForRenderFn = rules
        .filter((r) => r !== vueRule && matchesJS(r))
        .map(cloneRuleForRenderFn)
    }
    const pitcher = {
      loader: require.resolve('./loaders/pitcher'),
      resourceQuery: query => {
        const parsed = qs.parse(query.slice(1))
        return parsed.vue != null
      },
      options: {
        cacheDirectory: vueLoaderUse.options.cacheDirectory,
        cacheIdentifier: vueLoaderUse.options.cacheIdentifier
      }
    }

    compiler.options.module.rules = [
      pitcher,
      ...jsRulesForRenderFn,
      ...(is27 ? [templateCompilerRule] : []),
      ...clonedRules,
      ...rules
    ]
  }

}
// 创建匹配器
function createMatcher(fakeFile) {
  return (rule, i) => {
    const clone = Object.assign({}, rule)
    delete clone.include
    const normalized = RuleSet.normalizeRule(clone, {}, '')
    return (
      !rule.enforce &&
      normalized.resource &&
      normalized.resource(fakeFile)
    )
  }
}

function cloneRule(rule) {
  const { resource, resourceQuery } = rule
  let currentResource
  const res = Object.assign({}, rule, {
    resource: {
      test: (resource) => {
        currentResource = resource
        return true
      }
    },
    resourceQuery: (query) => {
      const parsed = qs.parse(query.slice(1))
      if (parsed.vue == null) {
        return false
      }
      if (resource && parsed.lang == null) {
        return false
      }
      const fakeResourcePath = `${currentResource}.${parsed.lang}`
      if (resource && !resource(fakeResourcePath)) {
        return false
      }
      if (resourceQuery && !resourceQuery(query)) {
        return false
      }
      return true
    }
  })

  if (rule.rules) {
    res.rules = rule.rules.map(cloneRule)
  }

  if (rule.oneOf) {
    res.oneOf = rule.oneOf.map(cloneRule)
  }

  return res
}

function cloneRuleForRenderFn(rule) {
  const resource = rule.resource
  const resourceQuery = rule.resourceQuery
  let currentResource

  const res = {
    ...rule,
    resource: (resource) => {
      currentResource = resource
      return true
    },
    resourceQuery: (query) => {
      const parsed = qs.parse(query.slice(1))
      if (parsed.vue == null || parsed.type !== 'template') {
        return false
      }
      const fakeResourcePath = `${currentResource}.${parsed.ts ? `ts` : `js`}`
      if (resource && !resource(fakeResourcePath)) {
        return false
      }
      if (resourceQuery && !resourceQuery(query)) {
        return false
      }
      return true
    }
  }

  if (Array.isArray(res.use)) {
    const isThreadLoader = (loader) => loader === 'thread-loader' || /\/node_modules\/thread-loader\//.test(loader)

    res.use = res.use.filter(useEntry => {
      const loader = typeof useEntry === 'string' ? useEntry : useEntry.loader
      return !isThreadLoader(loader)
    })
  }

  if (rule.rules) {
    res.rules = rule.rules.map(cloneRuleForRenderFn)
  }

  if (rule.oneOf) {
    res.oneOf = rule.oneOf.map(cloneRuleForRenderFn)
  }

  return res
}

VueLoaderPlugin.NS = NS;
module.exports = VueLoaderPlugin;