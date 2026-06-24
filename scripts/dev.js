const { spawn } = require('child_process')
const path = require('path')

const rootDir = path.join(__dirname, '..')

const watchBuild = spawn(
    process.execPath,
    [
        '--watch-path=maptogpx-core.js',
        '--watch-path=scripts/build.js',
        '--watch-path=scripts/export-runner.js',
        '--watch-path=index.html',
        'scripts/build.js',
    ],
    { cwd: rootDir, stdio: 'inherit' },
)

// cmd.exe is required on Windows; spawning npx.cmd directly fails on Node 24+.
function spawnServe() {
    if (process.platform === 'win32') {
        return spawn('cmd.exe', ['/d', '/s', '/c', 'npx serve .'], {
            cwd: rootDir,
            stdio: 'inherit',
        })
    }

    return spawn('npx', ['serve', '.'], {
        cwd: rootDir,
        stdio: 'inherit',
    })
}

const serve = spawnServe()

function shutdown(code) {
    watchBuild.kill()
    serve.kill()
    process.exit(code ?? 0)
}

process.on('SIGINT', function () {
    shutdown(0)
})
process.on('SIGTERM', function () {
    shutdown(0)
})

watchBuild.on('exit', function (code) {
    if (code !== null && code !== 0) {
        shutdown(code)
    }
})

serve.on('exit', function (code) {
    if (code !== null && code !== 0) {
        shutdown(code)
    }
})
