# Rail Trails Export

A bookmarklet that downloads trail map data from [railtrails.org.au](https://www.railtrails.org.au) as a GPX file.

## Usage

1. Open [railtrails.luenwarneke.com](https://railtrails.luenwarneke.com).
2. Drag the green **RailTrails GPX Exporter** button to your bookmarks bar.
3. Go to a trail page on [railtrails.org.au](https://www.railtrails.org.au/trails/) and open the map.
4. Click the bookmarklet in your bookmarks bar to download the GPX file.

The GPX file includes the trail name, description, elevation data, waypoints, and a link back to the trail page.

Alternatively, create a new bookmark with this as the url:

```javascript
javascript:(function()%7Bvar 
s%3Ddocument.createElement('script')%3Bs.src%3D'https%3A%2F%2Frailtrails.luenwarneke.com%2Fmaptogpx.js'%3Bdocument.body.appendChild(s)%7D)();
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later

### Setup

```bash
npm install
```

### Commands

```bash
npm run build   # Build maptogpx.js from maptogpx-core.js
npm test        # Run tests (builds first)
npm run serve   # Local dev server with automatic rebuilds
```

### Local testing

1. Run `npm run serve` and open the URL shown in the terminal.
2. On localhost, the page loads the bookmarklet from your machine instead of production.
3. Drag the bookmarklet to your bookmarks bar, then test it on a [railtrails.org.au](https://www.railtrails.org.au/trails/) trail page.

### Deploying

Upload the built [`maptogpx.js`](maptogpx.js) to `https://railtrails.luenwarneke.com/maptogpx.js`. Purge the Cloudflare cache after deploying so users receive the update.

### Project layout

| File | Purpose |
|------|---------|
| [`maptogpx-core.js`](maptogpx-core.js) | Core GPX export logic (testable module) |
| [`maptogpx.js`](maptogpx.js) | Bookmarklet bundle (generated) |
| [`scripts/build.js`](scripts/build.js) | Builds the browser bundle from core |
| [`scripts/dev.js`](scripts/dev.js) | Local dev server with automatic rebuilds |
| [`test/fixtures/`](test/fixtures/) | Fixture data for different trail types |
| [`test/maptogpx.test.js`](test/maptogpx.test.js) | Automated tests |
| [`index.html`](index.html) | Landing page; swaps bookmarklet URLs on localhost |

### Tests

Fixtures cover common trail page scenarios (open, partially open, potential, temporarily closed). Run with `npm test`.

### Data sources

The bookmarklet reads data already loaded on the trail page:

- `window.trail_paths` — path geometry
- `window.trail_elevations` / `window.trail_elevations_dist` — elevation profile
- `window.trail_markers` — map waypoints
- Page DOM — trail name, description, and metadata

No external APIs are called.
