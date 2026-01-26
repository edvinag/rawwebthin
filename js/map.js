// map.js - Core Map Functionality

let darkModeControlContainer;
let followBoatControlContainer;

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
    return await res.json();
}

function logSources(style) {
    const sources = style && style.sources ? style.sources : {};
    const rows = Object.entries(sources).map(([name, src]) => ({
        name,
        type: src && src.type,
        hasTiles: !!(src && Array.isArray(src.tiles) && src.tiles.length),
        hasUrl: !!(src && typeof src.url === 'string'),
        tiles0: src && Array.isArray(src.tiles) && src.tiles[0] ? src.tiles[0] : '',
        url: src && typeof src.url === 'string' ? src.url : '',
        scheme: src && src.scheme ? src.scheme : '',
        tileSize: src && src.tileSize ? src.tileSize : '',
        minzoom: src && Number.isFinite(src.minzoom) ? src.minzoom : '',
        maxzoom: src && Number.isFinite(src.maxzoom) ? src.maxzoom : ''
    }));
    console.table(rows);
}

async function resolveVectorSourceToTileConfig(source) {
    if (!source || source.type !== 'vector') return null;

    if (Array.isArray(source.tiles) && source.tiles.length > 0) {
        return {
            tiles: source.tiles,
            scheme: source.scheme,
            tileSize: source.tileSize,
            minzoom: source.minzoom,
            maxzoom: source.maxzoom
        };
    }

    if (typeof source.url === 'string' && source.url.length > 0) {
        const tileJson = await fetchJson(source.url);
        return {
            tiles: tileJson.tiles,
            scheme: tileJson.scheme || source.scheme,
            tileSize: tileJson.tileSize || source.tileSize,
            minzoom: tileJson.minzoom ?? source.minzoom,
            maxzoom: tileJson.maxzoom ?? source.maxzoom
        };
    }

    return null;
}

function makeDefaultStyleFn() {
    return (properties, zoom, geometryDimension) => {
        if (geometryDimension === 1) return { radius: 3, fill: true, fillOpacity: 0.8, weight: 0 };
        if (geometryDimension === 2) return { weight: 1, opacity: 0.9 };
        return { weight: 1, fill: true, fillOpacity: 0.15 };
    };
}

async function createSkippoVectorLayer(map) {
    const styleUrl = 'https://mapresources.skippo.cloud/20250829/style/light.json';
    const style = await fetchJson(styleUrl);

    console.log('Loaded style:', styleUrl);
    logSources(style);

    const requiredTileSubstring = 's57_'; // force S57 nautical, not OSM
    const candidates = [];

    for (const [name, src] of Object.entries(style.sources || {})) {
        if (!src || src.type !== 'vector') continue;
        candidates.push({ name, src });
    }

    if (!candidates.length) throw new Error('No vector sources found in style.sources');

    let chosen = null;

    for (const candidate of candidates) {
        const tileCfg = await resolveVectorSourceToTileConfig(candidate.src);
        if (!tileCfg || !Array.isArray(tileCfg.tiles) || tileCfg.tiles.length === 0) continue;

        const hay = JSON.stringify(tileCfg.tiles);
        if (!hay.includes(requiredTileSubstring)) continue;

        chosen = { name: candidate.name, source: candidate.src, tileCfg };
        break;
    }

    if (!chosen) {
        throw new Error(`No vector source matched "${requiredTileSubstring}". Check console.table for available sources/urls.`);
    }

    const tileUrl = chosen.tileCfg.tiles[0];

    const tileSize = Number(chosen.tileCfg.tileSize || 512);
    const scheme = String(chosen.tileCfg.scheme || 'xyz').toLowerCase();
    const minzoom = Number.isFinite(chosen.tileCfg.minzoom) ? chosen.tileCfg.minzoom : 0;
    const maxzoom = Number.isFinite(chosen.tileCfg.maxzoom) ? chosen.tileCfg.maxzoom : 14;

    const tms = scheme === 'tms';
    const zoomOffset = tileSize === 512 ? -1 : 0;
    const mapMaxZoom = maxzoom + (zoomOffset < 0 ? 1 : 0);

    console.log('Chosen vector source:', chosen.name);
    console.log('Tile config:', { tileUrl, tileSize, scheme, tms, zoomOffset, minzoom, maxzoom, mapMaxZoom });

    const defaultStyleFn = makeDefaultStyleFn();

    const layer = L.vectorGrid.protobuf(tileUrl, {
        rendererFactory: L.canvas.tile,
        tms,
        tileSize,
        zoomOffset,
        minZoom: minzoom,
        maxNativeZoom: maxzoom,
        maxZoom: mapMaxZoom,
        interactive: false,
        vectorTileLayerStyles: {}
    });

    layer.on('load', () => {
        const names = layer.getDataLayerNames();
        if (!Array.isArray(names) || names.length === 0) return;

        const styles = {};
        names.forEach((n) => {
            styles[n] = defaultStyleFn;
        });
        layer.setStyle(styles);

        console.log('MVT layers:', names);
    });

    layer.on('tileerror', (e) => {
        console.log('MVT tile error:', e);
        if (e && e.tile && e.tile.src) console.log('MVT tile URL:', e.tile.src);
    });

    layer.addTo(map);

    return { layer, mapMaxZoom };
}

async function initializeMap() {
    const map = L.map('map', { minZoom: 3 });

    const mapLat = getStoredDouble('mapLat', 50);
    const mapLng = getStoredDouble('mapLng', 10);

    let mapMaxZoom = 14;

    try {
        const res = await createSkippoVectorLayer(map);
        mapMaxZoom = res.mapMaxZoom;
        map.setMaxZoom(mapMaxZoom);
    } catch (err) {
        console.error(err);
        alert(`Failed to initialize Skippo MVT layer: ${err.message}`);
    }

    const storedZoom = getStoredInt('zoom', 13);
    const startZoom = Math.min(storedZoom, mapMaxZoom);

    map.setView([mapLat, mapLng], startZoom);

    map.on('zoomend', () => setStoredInt('zoom', map.getZoom()));
    map.on('moveend', () => {
        setStoredDouble('mapLat', map.getCenter().lat);
        setStoredDouble('mapLng', map.getCenter().lng);
    });

    const DarkModeControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: () => {
            darkModeControlContainer = L.DomUtil.create('div', 'leaflet-control-darkmode');

            Object.assign(darkModeControlContainer.style, {
                backgroundColor: 'transparent',
                backgroundSize: '30px 30px',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                backgroundImage: 'url(assets/off.png)'
            });

            darkModeControlContainer.addEventListener('click', async () => {
                await toggleDarkMode(darkMode);
            });

            darkModeControlContainer.title = 'Dark Mode';
            return darkModeControlContainer;
        }
    });
    map.addControl(new DarkModeControl());

    const FollowBoatControl = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: () => {
            followBoatControlContainer = L.DomUtil.create('div', 'leaflet-control-followboat');

            Object.assign(followBoatControlContainer.style, {
                backgroundColor: 'transparent',
                backgroundSize: '30px 30px',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                backgroundImage: followboat ? 'url(assets/followboat_on.png)' : 'url(assets/followboat_off.png)'
            });

            followBoatControlContainer.addEventListener('click', () => {
                followboat = !followboat;
                setStoredBoolean('followboat', followboat);
                followBoatControlContainer.style.backgroundImage = followboat
                    ? 'url(assets/followboat_on.png)'
                    : 'url(assets/followboat_off.png)';
            });

            followBoatControlContainer.title = 'Follow Boat';
            return followBoatControlContainer;
        }
    });
    map.addControl(new FollowBoatControl());

    map.doubleClickZoom.disable();
    createPopup(map);

    await drawRoute(map);
    await initializeBoat(map);
}

function updateDarkModeControl() {
    if (darkModeControlContainer) {
        darkModeControlContainer.style.backgroundImage = darkMode ? 'url(assets/off.png)' : 'url(assets/on.png)';
    }
}

initializeMap();
