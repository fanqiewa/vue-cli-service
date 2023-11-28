const fs = require('fs')
const path = require('path')
const { resolveCompiler } = require('./compiler')

const cache = new Map()

exports.setDescriptor = function setDescriptor(filename, entry) {
  cache.set(cleanQuery(filename), entry)
}

function cleanQuery(str) {
  const i = str.indexOf('?')
  return i > 0 ? str.slice(0, i) : str
}