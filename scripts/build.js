const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const corePath = path.join(rootDir, 'maptogpx-core.js')
const exportRunner = require('./export-runner')

function readCoreSource() {
    let core = fs.readFileSync(corePath, 'utf8')
    core = core.replace(/\r\n/g, '\n')
    return core.replace(/\nmodule\.exports\s*=\s*\{[\s\S]*$/, '\n')
}

function wrapBundle(core, runner) {
    return ';(function () {\n' + core + '\n' + runner + '\n})()\n'
}

fs.writeFileSync(
    path.join(rootDir, 'maptogpx.js'),
    wrapBundle(readCoreSource(), exportRunner),
)
console.log('Built maptogpx.js')
