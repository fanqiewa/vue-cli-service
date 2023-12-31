/**
 * 获取options
 */
'use strict';

const parseQuery = require('./parseQuery');

function getOptions(loaderContext) {
  const query = loaderContext.query;

  if (typeof query === 'string' && query !== '') {
    return parseQuery(loaderContext.query);
  }

  if (!query || typeof query !== 'object') {
    return null;
  }

  return query;
}

module.exports = getOptions;
