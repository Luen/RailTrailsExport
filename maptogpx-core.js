const STATUS_INTRO_PATTERN =
    /^(this trail is not yet open|note:\s*this trail is partially open)/i

const TRACK_TYPE_NAMES = {
    current: 'Rail Trail',
    on_road: 'Potential Route (Dashed Line)',
    possible_trail: 'Potential Trail',
    former_railway: 'Former Railway',
    temp_closed: 'Temporarily Closed',
    other_trail: 'Other Trail',
}

const GPX_NS =
    'xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"'

const EARTH_RADIUS_KM = 6371
const COORD_PRECISION = 6

function sanitizeInput(input) {
    if (input == null) {
        return ''
    }
    return String(input).replace(/[&<>"']/g, function (c) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;',
        }[c]
    })
}

function xmlTag(tag, attrs, inner) {
    const attrString = Object.keys(attrs || {})
        .map(function (key) {
            return key + '="' + attrs[key] + '"'
        })
        .join(' ')
    const open = attrString
        ? '<' + tag + ' ' + attrString + '>'
        : '<' + tag + '>'
    return inner == null
        ? open.replace('>', '/>')
        : open + inner + '</' + tag + '>'
}

function getTrailName(doc) {
    const stat = doc.querySelector('span.statIcn')
    if (stat) {
        let ancestor = stat.parentElement
        while (ancestor && ancestor !== doc.body) {
            const directH2 = ancestor.querySelector(':scope > h2')
            if (directH2) {
                return directH2.textContent.trim()
            }
            ancestor = ancestor.parentElement
        }

        const trailSection = stat.closest('div, section, article, main')
        if (trailSection) {
            const h2 = trailSection.querySelector('h2')
            if (h2) {
                return h2.textContent.trim()
            }
        }
    }

    const title = doc.querySelector('title')
    if (title) {
        return title.textContent
            .trim()
            .replace(/\s*[–-]\s*Rail Trails Australia\s*$/i, '')
    }

    return 'Trail GPX'
}

function getMetaValue(doc, label) {
    const spans = doc.querySelectorAll('span.statIcn')
    for (let i = 0; i < spans.length; i++) {
        if (spans[i].textContent.trim() === label + ':') {
            const value = spans[i].nextElementSibling
            return value ? value.textContent.trim() : ''
        }
    }
    return ''
}

function getIntroParagraph(doc) {
    const paragraphs = doc.querySelectorAll('.custDtlRtCont p')
    let fallback = ''

    for (let i = 0; i < paragraphs.length; i++) {
        const text = paragraphs[i].textContent.trim()
        if (text.length <= 50) {
            continue
        }
        if (!fallback) {
            fallback = text
        }
        if (!STATUS_INTRO_PATTERN.test(text)) {
            return text
        }
    }

    return fallback
}

function normalizeDescriptionPart(text) {
    return text.trim().replace(/[.!?]+\s*$/, '')
}

function getMetaLength(doc) {
    const length = getMetaValue(doc, 'Length')
    return length && length !== 'km' ? length : ''
}

function getTrailDescription(doc) {
    const parts = []
    const intro = getIntroParagraph(doc)
    if (intro) {
        parts.push(intro)
    }

    const metaFields = [
        { label: 'Location', value: getMetaValue(doc, 'Location') },
        { label: 'Length', value: getMetaLength(doc) },
        { label: 'Surface', value: getMetaValue(doc, 'Surface') },
        { label: 'Start / End', value: getMetaValue(doc, 'Start / End') },
    ]

    metaFields.forEach(function (field) {
        if (field.value) {
            parts.push(field.label + ': ' + field.value)
        }
    })

    return (
        parts.map(normalizeDescriptionPart).filter(Boolean).join('. ') ||
        'GPX file generated from trail paths'
    )
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = Math.PI / 180
    const dLat = (lat2 - lat1) * toRad
    const dLng = (lng2 - lng1) * toRad
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * toRad) *
            Math.cos(lat2 * toRad) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function coordsKey(lat, lng) {
    return lat.toFixed(COORD_PRECISION) + ',' + lng.toFixed(COORD_PRECISION)
}

function filterValidPaths(trailPaths) {
    return (trailPaths || []).filter(function (path) {
        return path && Array.isArray(path.data) && path.data.length > 0
    })
}

function normalizeElevationProfile(trailElevations, trailElevationsDist) {
    const elevations = trailElevations || []
    if (elevations.length === 0) {
        return { elevations: [], dists: [] }
    }

    let dists = trailElevationsDist
    if (!dists || dists.length !== elevations.length) {
        dists = []
        let cumulative = 0
        elevations.forEach(function (entry, index) {
            if (index === 0) {
                dists.push(0)
                return
            }
            cumulative += entry.dist || 0
            dists.push(cumulative)
        })
    }

    return { elevations: elevations, dists: dists }
}

function interpolateElevationAtDistance(km, elevations, dists) {
    if (elevations.length === 0) {
        return null
    }

    if (km <= dists[0]) {
        return elevations[0].elev
    }

    const lastIndex = dists.length - 1
    if (km >= dists[lastIndex]) {
        return elevations[lastIndex].elev
    }

    for (let i = 1; i < dists.length; i++) {
        if (km <= dists[i]) {
            const span = dists[i] - dists[i - 1]
            const t = span === 0 ? 0 : (km - dists[i - 1]) / span
            return (
                elevations[i - 1].elev +
                t * (elevations[i].elev - elevations[i - 1].elev)
            )
        }
    }

    return elevations[lastIndex].elev
}

function buildElevationInterpolator(trailElevations, trailElevationsDist) {
    const profile = normalizeElevationProfile(
        trailElevations,
        trailElevationsDist,
    )

    if (profile.elevations.length === 0) {
        return function () {
            return null
        }
    }

    return function getElevationAtDistance(cumulativeKm) {
        return interpolateElevationAtDistance(
            cumulativeKm,
            profile.elevations,
            profile.dists,
        )
    }
}

function getTrackName(pathType) {
    if (pathType && TRACK_TYPE_NAMES[pathType]) {
        return TRACK_TYPE_NAMES[pathType]
    }
    if (pathType) {
        return pathType.charAt(0).toUpperCase() + pathType.slice(1)
    }
    return 'Trail'
}

function markerLng(marker) {
    return marker.lng !== undefined ? marker.lng : marker.long
}

function isValidPoint(point) {
    return point && point.lat != null && point.lng != null
}

function buildTrackSegments(trailPaths) {
    const segments = []
    let previousKey = null

    filterValidPaths(trailPaths).forEach(function (path) {
        const points = []
        path.data.forEach(function (point) {
            if (!isValidPoint(point)) {
                return
            }
            const key = coordsKey(point.lat, point.lng)
            if (key === previousKey) {
                return
            }
            points.push(point)
            previousKey = key
        })
        if (points.length > 0) {
            segments.push({ points: points })
        }
    })

    return segments
}

function assignDistances(segments) {
    let cumulativeKm = 0
    let previousPoint = null
    const positionedSegments = []

    segments.forEach(function (segment) {
        const points = []
        segment.points.forEach(function (point) {
            if (previousPoint) {
                cumulativeKm += haversineKm(
                    previousPoint.lat,
                    previousPoint.lng,
                    point.lat,
                    point.lng,
                )
            }
            points.push({
                lat: point.lat,
                lng: point.lng,
                distanceKm: cumulativeKm,
            })
            previousPoint = point
        })
        positionedSegments.push({ points: points })
    })

    return positionedSegments
}

function buildMetadataXml(trailName, trailDescription, trailUrl) {
    return (
        '<metadata>' +
        xmlTag('name', {}, sanitizeInput(trailName)) +
        xmlTag('desc', {}, sanitizeInput(trailDescription)) +
        xmlTag(
            'link',
            { href: sanitizeInput(trailUrl) },
            'Rail Trails Australia',
        ) +
        xmlTag('author', {}, 'Trail Exporter') +
        '</metadata>'
    )
}

function buildWaypointXml(marker) {
    if (!marker.lat || markerLng(marker) === undefined) {
        return ''
    }

    let body = xmlTag('name', {}, sanitizeInput(marker.des_plain || 'Waypoint'))
    if (marker.elevation) {
        body += xmlTag('ele', {}, marker.elevation.replace(' m', ''))
    }
    if (marker.des) {
        body += xmlTag('desc', {}, sanitizeInput(marker.des))
    }

    return xmlTag('wpt', { lat: marker.lat, lon: markerLng(marker) }, body)
}

function buildTrackPointXml(point, elevation) {
    let body = ''
    if (elevation != null) {
        body += xmlTag('ele', {}, elevation.toFixed(2))
    }
    return xmlTag('trkpt', { lat: point.lat, lon: point.lng }, body || null)
}

function buildTrackXml(trailName, segments, getElevationAtDistance) {
    let body = xmlTag('name', {}, sanitizeInput(trailName))

    segments.forEach(function (segment) {
        let segBody = ''
        segment.points.forEach(function (point) {
            const elevation = getElevationAtDistance(point.distanceKm)
            segBody += buildTrackPointXml(point, elevation)
        })
        if (segBody) {
            body += '<trkseg>' + segBody + '</trkseg>'
        }
    })

    return body ? '<trk>' + body + '</trk>' : ''
}

function createGPX(options) {
    const segments = assignDistances(
        buildTrackSegments(options.trailPaths || []),
    )
    const getElevationAtDistance =
        options.getElevationAtDistance ||
        function () {
            return null
        }

    const parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Trail GPX Exporter" ' + GPX_NS + '>',
        buildMetadataXml(
            options.trailName,
            options.trailDescription,
            options.trailUrl || '',
        ),
    ]

    ;(options.trailMarkers || []).forEach(function (marker) {
        const waypoint = buildWaypointXml(marker)
        if (waypoint) {
            parts.push(waypoint)
        }
    })

    const track = buildTrackXml(
        options.trailName,
        segments,
        getElevationAtDistance,
    )
    if (track) {
        parts.push(track)
    }

    parts.push('</gpx>')
    return parts.join('')
}

function getFilename(trailName) {
    return (
        trailName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '') +
        '.gpx'
    )
}

function exportTrailGpx(options) {
    const trailPaths = filterValidPaths(options.trailPaths)
    if (trailPaths.length === 0) {
        return null
    }

    const doc = options.document
    const trailName = getTrailName(doc)

    return {
        gpxContent: createGPX({
            trailName: trailName,
            trailDescription: getTrailDescription(doc),
            trailPaths: trailPaths,
            trailMarkers: options.trailMarkers || [],
            getElevationAtDistance: buildElevationInterpolator(
                options.trailElevations,
                options.trailElevationsDist,
            ),
            trailUrl: options.trailUrl || '',
        }),
        filename: getFilename(trailName),
    }
}

function isExporterLandingPage(location) {
    const host = (location.hostname || '').toLowerCase()
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.local') ||
        host === 'railtrails.luenwarneke.com'
    )
}

function getExportFailureMessage(location) {
    if (isExporterLandingPage(location)) {
        return (
            'This bookmarklet exports GPX files from railtrails.org.au trail pages.\n\n' +
            'To install it, drag the green "RailTrails GPX Exporter" link to your bookmarks bar, ' +
            'or create a new bookmark and paste the bookmarklet code as the URL.\n\n' +
            'Then open a trail page on www.railtrails.org.au and click the bookmarklet there.'
        )
    }

    return 'No trail paths found. Open a trail page on www.railtrails.org.au with the map loaded, then try again.'
}

function downloadGpxResult(result) {
    const blob = new Blob([result.gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(function () {
        URL.revokeObjectURL(url)
    }, 0)
}

module.exports = {
    sanitizeInput,
    getTrailName,
    getMetaValue,
    getIntroParagraph,
    getTrailDescription,
    buildElevationInterpolator,
    getTrackName,
    createGPX,
    exportTrailGpx,
    isExporterLandingPage,
    getExportFailureMessage,
    TRACK_TYPE_NAMES,
}
