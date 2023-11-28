const { exit } = require('./exit')

exports.validate = (obj, schema, cb) => {
  require('@hapi/joi').validate(obj, schema, {}, err => {
    if (err) {
      cb(err.message);
      if (process.env.VUE_CLI_TEST) {
        throw err;
      } else {
        exit(1);
      }
    }
  })
}