'use strict'
const { spawn } = require('child_process')
const { businessArray } = require('./pages.config')
const program = require('commander')
const { bgGreen, bgRed, red, cyan, black } = require('chalk')
const ora = require('ora')
const rimraf = require('rimraf')
const path = require('path')

const { ERROR, SUCCESS } = {
  ERROR: bgRed(' ERROR '),
  SUCCESS: bgGreen(black(' SUCCESS '))
}

program
  .option('-a, --all', '打包所有模块')
  .parse(process.argv)

if (program.args.length === 0 && !program.all) {
  console.log(ERROR, red('请输入需要打包的模块名称或全部打包[--all]'))
  process.exit(0)
}

async function run (arr) {
  const chunkArr = businessArray.map(j => j.chunk)
  for (const i of arr) {
    if (chunkArr.includes(i)) {
      await build(i, businessArray[chunkArr.indexOf(i)].root)
    } else {
      console.log(ERROR, red(`模块:${i.chunk}不存在`))
      process.exit(0)
    }
  }
}

function build (projectName, root = false) {
  const spinner = ora(`开始打包:${projectName}`)
  spinner.start()
  return new Promise(resolve => {
    const build = spawn(
      'vue-cli-service',
      ['build', '--no-clean'],
      {
        env: {
          ...process.env,
          PROJECT_NAME: projectName,
          IS_ROOT: root ? 1 : 0
        },
        shell: true
      }
    )
    let out = ''
    let err = ''
    build.stdout.on('data', (data) => {
      // console.log(greenBright(data.toString()))
      out += data
    })

    build.stderr.on('data', (data) => {
      // console.log(ERROR, red(data.toString()))
      if (data !== '-  Building for production...') {
        err += data
      }
    })

    build.on('close', (code) => {
      spinner.stop()
      if (!out && err) {
        process.stdout.write(Buffer.from(err))
        // console.log(ERROR, red(err))
      } else {
        process.stdout.write(Buffer.from(out))
        // console.log(greenBright(out))
        console.log(SUCCESS, cyan(`\n    🎉${projectName}打包结束`))
        resolve(out)
      }
    })
  })
}

const pages = businessArray.map(i => i.chunk)

if (program.all) {
  rm(path.resolve(__dirname, '../dist'))
    .then(() => {
      run(program.all ? pages : program.args)
        .catch(err => {
          throw err
        })
    })
    .catch(err => {
      throw new Error(err)
    })
} else {
  const dirs = []
  program.args.forEach(item => {
    if (businessArray[pages.indexOf(item)].root) {
      dirs.push(rm(path.resolve(__dirname, `../dist`)))
    } else {
      dirs.push(rm(path.resolve(__dirname, `../dist/${item}`)))
    }
  })
  Promise.all(dirs)
    .then(() => {
      run(program.all ? pages : program.args)
        .catch(err => {
          throw err
        })
    })
    .catch(err => {
      throw new Error(err)
    })
}

function rm (path) {
  return new Promise((resolve, reject) => {
    rimraf(path, err => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

