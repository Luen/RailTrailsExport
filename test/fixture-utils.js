const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const core = require('../maptogpx-core')

const fixtureDir = path.join(__dirname, 'fixtures')

function listFixtures() {
    return fs
        .readdirSync(fixtureDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
}

function loadFixture(name) {
    const fileName = name.endsWith('.json') ? name : name + '.json'
    const filePath = path.join(fixtureDir, fileName)
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function exportFromFixture(fixture) {
    const dom = new JSDOM(fixture.html, { url: fixture.sourceUrl })
    return core.exportTrailGpx({
        trailPaths: fixture.trailPaths,
        trailMarkers: fixture.trailMarkers,
        trailElevations: fixture.trailElevations,
        trailElevationsDist: fixture.trailElevationsDist,
        document: dom.window.document,
        trailUrl: fixture.sourceUrl,
    })
}

module.exports = {
    fixtureDir,
    listFixtures,
    loadFixture,
    exportFromFixture,
}
