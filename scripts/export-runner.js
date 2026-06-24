module.exports =
    'if (window.__railTrailsGpxExportRunning) {\n' +
    '        return\n' +
    '    }\n' +
    '    window.__railTrailsGpxExportRunning = true\n' +
    '\n' +
    '    const result = exportTrailGpx({\n' +
    '        trailPaths: window.trail_paths || [],\n' +
    '        trailMarkers: window.trail_markers || [],\n' +
    '        trailElevations: window.trail_elevations || [],\n' +
    '        trailElevationsDist: window.trail_elevations_dist || [],\n' +
    '        document: document,\n' +
    '        trailUrl: window.location.href,\n' +
    '    })\n' +
    '\n' +
    '    if (!result) {\n' +
    '        alert(getExportFailureMessage(window.location))\n' +
    '        return\n' +
    '    }\n' +
    '\n' +
    '    downloadGpxResult(result)\n'
