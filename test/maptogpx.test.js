const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')

const core = require('../maptogpx-core')
const {
    loadFixture,
    exportFromFixture,
    listFixtures,
} = require('./fixture-utils')

const fixtureFiles = listFixtures()

function countMatches(xml, pattern) {
    return (xml.match(pattern) || []).length
}

function extractTrackElevationsBySegment(gpx) {
    const segments = []
    const segmentMatches = gpx.matchAll(/<trkseg>([\s\S]*?)<\/trkseg>/g)
    for (const match of segmentMatches) {
        const elevations = []
        const elevationMatches = match[1].matchAll(/<ele>([\d.]+)<\/ele>/g)
        for (const elevationMatch of elevationMatches) {
            elevations.push(parseFloat(elevationMatch[1]))
        }
        segments.push(elevations)
    }
    return segments
}

describe('maptogpx-core', () => {
    it('sanitizes XML special characters', () => {
        assert.equal(
            core.sanitizeInput('Tom & Jerry <trail> "quotes"'),
            'Tom &amp; Jerry &lt;trail&gt; &quot;quotes&quot;',
        )
    })

    it('sanitizes null and undefined as empty strings', () => {
        assert.equal(core.sanitizeInput(null), '')
        assert.equal(core.sanitizeInput(undefined), '')
    })

    it('maps known path types to GPX track names', () => {
        assert.equal(
            core.getTrackName('on_road'),
            'Potential Route (Dashed Line)',
        )
        assert.equal(core.getTrackName('possible_trail'), 'Potential Trail')
        assert.equal(core.getTrackName('former_railway'), 'Former Railway')
        assert.equal(core.getTrackName('current'), 'Rail Trail')
        assert.equal(core.getTrackName('temp_closed'), 'Temporarily Closed')
        assert.equal(core.getTrackName('other_trail'), 'Other Trail')
    })

    it('joins description parts with periods', () => {
        const html =
            '<div><span class="statIcn">Location:</span><span>Millaa Millaa</span></div>' +
            '<div><span class="statIcn">Length:</span><span>7 km</span></div>' +
            '<div class="custDtlRtCont"><p>A scenic trail on the Atherton Tablelands with rainforest views and creek crossings.</p></div>'
        const doc = new JSDOM(html).window.document
        const description = core.getTrailDescription(doc)
        assert.match(description, /crossings\. Location:/)
        assert.match(description, /Millaa Millaa\. Length:/)
    })

    it('skips status-only intro paragraphs', () => {
        const html =
            '<div class="custDtlRtCont">' +
            '<p>Note: This trail is partially open – completion in 2025.</p>' +
            '<p>The open section offers lake views and good interpretive signage along a compacted gravel surface.</p>' +
            '</div>'
        const doc = new JSDOM(html).window.document
        assert.match(
            core.getIntroParagraph(doc),
            /open section offers lake views/,
        )
    })

    it('finds trail name near metadata icons', () => {
        const html =
            '<h2>Nearby Trails</h2>' +
            '<div><h2>Irwin Track Rail Trail</h2>' +
            '<span class="statIcn">Location:</span><span>Millaa Millaa</span></div>'
        const doc = new JSDOM(html).window.document
        assert.equal(core.getTrailName(doc), 'Irwin Track Rail Trail')
    })

    it('interpolates elevation along profile distance', () => {
        const getElevation = core.buildElevationInterpolator(
            [
                { elev: 100, dist: 0 },
                { elev: 200, dist: 1 },
            ],
            [0, 1],
        )

        assert.equal(getElevation(0), 100)
        assert.equal(getElevation(1), 200)
        assert.equal(getElevation(0.5), 150)
    })

    it('returns install instructions on the exporter landing page', () => {
        const message = core.getExportFailureMessage({
            hostname: 'localhost',
        })
        assert.match(message, /drag the green/)
        assert.match(message, /bookmarks bar/)
        assert.match(message, /railtrails\.org\.au/)
        assert.doesNotMatch(message, /^No trail paths found!$/)
    })

    it('detects local and production landing hosts', () => {
        assert.equal(
            core.isExporterLandingPage({ hostname: 'localhost' }),
            true,
        )
        assert.equal(
            core.isExporterLandingPage({ hostname: '127.0.0.1' }),
            true,
        )
        assert.equal(
            core.isExporterLandingPage({ hostname: 'dev.local' }),
            true,
        )
        assert.equal(
            core.isExporterLandingPage({
                hostname: 'railtrails.luenwarneke.com',
            }),
            true,
        )
        assert.equal(
            core.isExporterLandingPage({
                hostname: 'www.railtrails.org.au',
            }),
            false,
        )
    })

    it('returns trail-page hint when export fails elsewhere', () => {
        const message = core.getExportFailureMessage({
            hostname: 'www.railtrails.org.au',
        })
        assert.match(message, /No trail paths found/)
        assert.match(message, /map loaded/)
    })

    it('returns null when no valid trail paths are available', () => {
        const dom = new JSDOM('<html><body><h2>Empty Trail</h2></body></html>')
        const result = core.exportTrailGpx({
            trailPaths: [],
            trailMarkers: [],
            trailElevations: [],
            document: dom.window.document,
            trailUrl: 'https://example.com/trails/empty/',
        })
        assert.equal(result, null)
    })

    it('ignores path segments without point data', () => {
        const dom = new JSDOM('<html><body><h2>Broken Trail</h2></body></html>')
        const result = core.exportTrailGpx({
            trailPaths: [{ type: 'current' }, { type: 'on_road', data: [] }],
            trailMarkers: [],
            trailElevations: [],
            document: dom.window.document,
            trailUrl: 'https://example.com/trails/broken/',
        })
        assert.equal(result, null)
    })

    it('writes metadata links with href attribute', () => {
        const gpx = core.createGPX({
            trailName: 'Test Trail',
            trailDescription: 'A test trail',
            trailPaths: [
                {
                    type: 'current',
                    data: [{ lat: -37, lng: 145 }],
                },
            ],
            trailMarkers: [],
            getElevationAtDistance: function () {
                return null
            },
            trailUrl: 'https://www.railtrails.org.au/trails/test/',
        })
        assert.ok(
            gpx.includes(
                '<link href="https://www.railtrails.org.au/trails/test/">Rail Trails Australia</link>',
            ),
        )
        assert.equal(countMatches(gpx, /<trk>/g), 1)
        assert.equal(countMatches(gpx, /<trkseg>/g), 1)
    })

    for (const fixtureFile of fixtureFiles) {
        const fixture = loadFixture(fixtureFile)

        describe(fixture.label, () => {
            it('exports valid GPX metadata and tracks', () => {
                const result = exportFromFixture(fixture)
                const expect = fixture.expect
                const gpx = result.gpxContent

                assert.ok(gpx.startsWith('<?xml version="1.0"'))
                assert.ok(gpx.includes('</gpx>'))
                assert.equal(result.filename, expect.filename)
                assert.equal(
                    core.getTrailName(new JSDOM(fixture.html).window.document),
                    expect.trailName,
                )
                assert.ok(gpx.includes('<name>' + expect.trailName + '</name>'))
                assert.ok(
                    gpx.includes(
                        '<link href="' +
                            fixture.sourceUrl +
                            '">Rail Trails Australia</link>',
                    ),
                )

                for (const text of expect.descriptionContains) {
                    assert.ok(
                        gpx.includes(text),
                        'expected description to include: ' + text,
                    )
                }

                if (expect.descriptionExcludes) {
                    for (const text of expect.descriptionExcludes) {
                        assert.ok(
                            !gpx.includes(text),
                            'expected description to exclude: ' + text,
                        )
                    }
                }

                assert.equal(countMatches(gpx, /<wpt /g), expect.waypointCount)
                assert.equal(
                    countMatches(gpx, /<trkpt /g),
                    expect.trackPointCount,
                )
                assert.equal(countMatches(gpx, /<trk>/g), expect.trkCount)
                assert.equal(countMatches(gpx, /<trkseg>/g), expect.trksegCount)

                if (expect.allTrackPointsHaveElevation) {
                    const waypointEleCount = (
                        fixture.trailMarkers || []
                    ).filter((marker) => marker.elevation).length
                    assert.equal(
                        countMatches(gpx, /<trkpt /g),
                        countMatches(gpx, /<ele>/g) - waypointEleCount,
                        'every track point should include elevation',
                    )

                    const segments = extractTrackElevationsBySegment(gpx)
                    for (const elevations of segments) {
                        for (let i = 1; i < elevations.length; i++) {
                            assert.ok(
                                Math.abs(elevations[i] - elevations[i - 1]) <
                                    60,
                                'segment elevations should not spike between neighbours',
                            )
                        }
                    }
                }
            })
        })
    }
})

describe('browser bundle', () => {
    it('maptogpx.js is generated from maptogpx-core.js', () => {
        const bundle = fs.readFileSync(
            path.join(__dirname, '..', 'maptogpx.js'),
            'utf8',
        )
        assert.ok(bundle.includes('function exportTrailGpx'))
        assert.ok(bundle.includes('window.trail_elevations_dist'))
        assert.ok(bundle.includes('getExportFailureMessage'))
        assert.ok(bundle.includes('__railTrailsGpxExportRunning'))
        assert.ok(!bundle.includes('previewGpxResult'))
        assert.ok(!bundle.includes('module.exports'))
    })
})
