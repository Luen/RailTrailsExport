# Rail Trails Export

Download map data from [railtrails.org.au](https://www.railtrails.org.au) as a GPX file, including trail metadata and per-point elevation.

## Usage

Open [`index.html`](index.html) and drag the bookmarklet to your bookmarks bar. On a trail page with the map loaded, click it to download a GPX file.

When hosted in production, the bookmarklet loads from `https://railtrails.luenwarneke.com`. When served locally (`localhost`), it automatically loads from your local server instead.

Production bookmarklet URL:

```javascript
javascript:(function()%7Bvar s%3Ddocument.createElement('script')%3Bs.src%3D'https%3A%2F%2Frailtrails.luenwarneke.com%2Fmaptogpx.js'%3Bdocument.body.appendChild(s)%7D)();
```

The GPX file includes:

- Trail name and description (intro paragraph plus location, length, surface, and start/end where available)
- A link back to the trail page
- One track per trail with a segment (`<trkseg>`) for each path on the map
- Elevation for each track point (interpolated from the site's elevation profile)
- Waypoints for map markers (with elevation when available)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later

### Setup

```bash
npm install
```

### Project layout

| File | Purpose |
|------|---------|
| [`maptogpx-core.js`](maptogpx-core.js) | Core GPX export logic (testable module) |
| [`maptogpx.js`](maptogpx.js) | Download bookmarklet bundle (generated) |
| [`scripts/build.js`](scripts/build.js) | Builds the browser bundle from core |
| [`scripts/dev.js`](scripts/dev.js) | Local dev server with automatic rebuilds |
| [`test/fixtures/`](test/fixtures/) | Fixture data for different trail types |
| [`test/maptogpx.test.js`](test/maptogpx.test.js) | Automated tests |
| [`index.html`](index.html) | Landing page; swaps bookmarklet URLs on localhost |

### Commands

```bash
# Build browser bundles from maptogpx-core.js
npm run build

# Run tests (builds first)
npm test

# Build and serve locally (rebuilds maptogpx.js on file changes)
npm run serve
```

Edit [`maptogpx-core.js`](maptogpx-core.js), then run `npm run build` before testing locally or deploying.

### Local testing

1. Run `npm run serve`.
2. Open the URL printed by `serve` (port may vary).
3. The page detects `localhost` and shows a green dev notice. The bookmarklet loads `/maptogpx.js` from your machine.
4. Drag the bookmarklet to your bookmarks bar.
5. On a [railtrails.org.au](https://www.railtrails.org.au/trails/) trail page, click it to download the GPX file.

### Deploying

Upload the built [`maptogpx.js`](maptogpx.js) to `https://railtrails.luenwarneke.com/maptogpx.js` so bookmarklet users receive updates.

## Tests

Tests use fixture data representing common trail page scenarios:

| Fixture | Trail type | Example source |
|---------|------------|----------------|
| [`trail-potential.json`](test/fixtures/trail-potential.json) | Trail potential (not yet open) | [Irwin Track Rail Trail](https://www.railtrails.org.au/trails/irwin-track-rail-trail/) |
| [`trail-open.json`](test/fixtures/trail-open.json) | Open trail | [Murray to Mountains Rail Trail](https://www.railtrails.org.au/trails/murray-to-mountains-rail-trail/) |
| [`trail-partially-open.json`](test/fixtures/trail-partially-open.json) | Partially open (mixed path types) | [Waranga (Rushworth) Rail Trail](https://www.railtrails.org.au/trails/murchison-to-rushworth-rail-trail/) |
| [`trail-temp-closed.json`](test/fixtures/trail-temp-closed.json) | Open trail with temporarily closed sections | [Great Victorian Rail Trail](https://www.railtrails.org.au/trails/great-victorian-rail-trail/) |

```bash
npm test
```

## Data sources

The bookmarklet reads data already loaded on the trail page by railtrails.org.au:

- `window.trail_paths` — path geometry (`lat`/`lng` per point, plus path `type`)
- `window.trail_elevations` — elevation profile samples
- `window.trail_elevations_dist` — cumulative distances along the elevation profile
- `window.trail_markers` — map waypoints
- Page DOM — trail name, description, and metadata fields

No external APIs are called.
