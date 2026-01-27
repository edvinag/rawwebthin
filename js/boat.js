// ./js/boat.js
// Boat tracking for Mapbox GL JS.
// Requires:
// - mapboxgl (global)
// - fetchBoatData() (global, from ./js/utils.js)
//
// Exposes:
// - window.initializeBoat(map, options) -> controller with stop(), start(), destroy(), setFollowBoat(), setIntervalMs()

(() => {
    const DEFAULTS = {
        intervalMs: 500,
        boatIconUrl: 'assets/boat.png',
        targetIconUrl: 'assets/target.png',
        courseOffsetDeg: 0,
        darkCircleRadiusPx: 100,
        followBoat: () => Boolean(window.followboat),
        maxPathPoints: 5000,
        minMoveMeters: 0,
        debug: false
    };

    const LAYER_IDS = {
        pathSource: 'boat-path-source',
        pathLayer: 'boat-path-layer',
        refLineSource: 'boat-refline-source',
        refLineLayer: 'boat-refline-layer',
        darkCircleSource: 'boat-darkcircle-source',
        darkCircleLayer: 'boat-darkcircle-layer'
    };

    const waitForMapLoad = (map) => new Promise((resolve) => {
        if (map && map.isStyleLoaded && map.isStyleLoaded()) {
            resolve();
            return;
        }
        map.once('load', () => resolve());
    });

    const ensureSource = (map, id, data) => {
        if (map.getSource(id)) return;
        map.addSource(id, { type: 'geojson', data });
    };

    const ensureLineLayer = (map, sourceId, layerId, paint) => {
        if (map.getLayer(layerId)) return;
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint
        });
    };

    const ensureCircleLayer = (map, sourceId, layerId, paint) => {
        if (map.getLayer(layerId)) return;
        map.addLayer({
            id: layerId,
            type: 'circle',
            source: sourceId,
            paint
        });
    };

    const setSourceData = (map, id, data) => {
        const src = map.getSource(id);
        if (src && src.setData) src.setData(data);
    };

    const removeLayerIfExists = (map, id) => {
        if (map.getLayer(id)) map.removeLayer(id);
    };

    const removeSourceIfExists = (map, id) => {
        if (map.getSource(id)) map.removeSource(id);
    };

    const isFiniteNumber = (n) => typeof n === 'number' && Number.isFinite(n);

    const normalizeLngLat = (lngLat) => {
        if (!Array.isArray(lngLat) || lngLat.length !== 2) return null;
        const [lng, lat] = lngLat;
        if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) return null;
        if (lat < -90 || lat > 90) return null;
        return [lng, lat];
    };

    // Haversine distance in meters
    const distanceMeters = (a, b) => {
        const aN = normalizeLngLat(a);
        const bN = normalizeLngLat(b);
        if (!aN || !bN) return Infinity;

        const [lng1, lat1] = aN;
        const [lng2, lat2] = bN;

        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371000;

        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const la1 = toRad(lat1);
        const la2 = toRad(lat2);

        const s1 = Math.sin(dLat / 2);
        const s2 = Math.sin(dLng / 2);

        const h = (s1 * s1) + (Math.cos(la1) * Math.cos(la2) * s2 * s2);
        const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
        return R * c;
    };

    const createMarkerElement = (className, imageUrl) => {
        const root = document.createElement('div');
        root.className = className;

        const img = document.createElement('div');
        img.className = `${className}__img`;
        img.style.backgroundImage = `url('${imageUrl}')`;
        img.style.backgroundRepeat = 'no-repeat';
        img.style.backgroundPosition = 'center';
        img.style.backgroundSize = 'contain';

        root.appendChild(img);
        return { root, img };
    };

    const safeGet = (obj, path) => {
        try {
            return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
        } catch {
            return undefined;
        }
    };

    class BoatTracker {
        constructor(map, options = {}) {
            this.map = map;
            this.config = { ...DEFAULTS, ...options };

            this.ids = { ...LAYER_IDS };

            this.boatPath = [];
            this._timer = null;
            this._stopped = true;
            this._destroyed = false;
            this._inFlight = false;

            this._lastBoatLngLat = null;
            this._lastRefLngLat = null;
            this._lastDarkMode = null;
            this._lastCourse = null;
            this._lastPopupHtml = null;

            this._followBoatOverride = null;
        }

        async init() {
            if (this._destroyed) throw new Error('BoatTracker: cannot init after destroy().');
            await waitForMapLoad(this.map);
            this._ensureSourcesAndLayers();
            this._createMarkers();
            await this._updateOnce();
            this.start();
            return this._controller();
        }

        start() {
            if (this._destroyed) return;
            if (!this._stopped) return;

            this._stopped = false;
            this._scheduleNextTick(0);
        }

        stop() {
            this._stopped = true;
            if (this._timer) {
                window.clearTimeout(this._timer);
                this._timer = null;
            }
        }

        destroy() {
            if (this._destroyed) return;
            this.stop();
            this._destroyed = true;

            if (this.boatMarker) this.boatMarker.remove();
            if (this.refMarker) this.refMarker.remove();

            // Remove layers first, then sources.
            removeLayerIfExists(this.map, this.ids.pathLayer);
            removeLayerIfExists(this.map, this.ids.refLineLayer);
            removeLayerIfExists(this.map, this.ids.darkCircleLayer);

            removeSourceIfExists(this.map, this.ids.pathSource);
            removeSourceIfExists(this.map, this.ids.refLineSource);
            removeSourceIfExists(this.map, this.ids.darkCircleSource);
        }

        setFollowBoat(value) {
            this._followBoatOverride = Boolean(value);
        }

        setIntervalMs(ms) {
            const n = Number(ms);
            if (!Number.isFinite(n) || n <= 0) return;
            this.config.intervalMs = n;
        }

        _controller() {
            return {
                start: () => this.start(),
                stop: () => this.stop(),
                destroy: () => this.destroy(),
                setFollowBoat: (value) => this.setFollowBoat(value),
                setIntervalMs: (ms) => this.setIntervalMs(ms)
            };
        }

        _ensureSourcesAndLayers() {
            // Path
            ensureSource(this.map, this.ids.pathSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [] },
                properties: {}
            });

            ensureLineLayer(this.map, this.ids.pathSource, this.ids.pathLayer, {
                'line-width': 3,
                'line-opacity': 0.8,
                'line-color': '#00aa00'
            });

            // Ref line
            ensureSource(this.map, this.ids.refLineSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [] },
                properties: {}
            });

            ensureLineLayer(this.map, this.ids.refLineSource, this.ids.refLineLayer, {
                'line-width': 4,
                'line-opacity': 0.5,
                'line-color': '#ff0000',
                'line-dasharray': [2, 2]
            });

            // Dark circle
            ensureSource(this.map, this.ids.darkCircleSource, {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: {}
            });

            ensureCircleLayer(this.map, this.ids.darkCircleSource, this.ids.darkCircleLayer, {
                'circle-radius': this.config.darkCircleRadiusPx,
                'circle-color': '#000000',
                'circle-opacity': 0.4
            });

            this.map.setLayoutProperty(this.ids.darkCircleLayer, 'visibility', 'none');
        }

        _createMarkers() {
            const boatMarkerEl = createMarkerElement('boat-marker', this.config.boatIconUrl);
            this.boatEl = boatMarkerEl.root;
            this.boatRotEl = boatMarkerEl.img;

            this.boatPopup = new mapboxgl.Popup({ offset: 18, closeButton: false });

            this.boatMarker = new mapboxgl.Marker({ element: this.boatEl })
                .setLngLat(this.map.getCenter().toArray())
                .setPopup(this.boatPopup)
                .addTo(this.map);

            const refMarkerEl = createMarkerElement('ref-marker', this.config.targetIconUrl);
            this.refEl = refMarkerEl.root;

            const center = this.map.getCenter();
            this.refMarker = new mapboxgl.Marker({ element: this.refEl })
                .setLngLat([center.lng + 0.01, center.lat + 0.01])
                .addTo(this.map);
        }

        _scheduleNextTick(delayMs) {
            if (this._destroyed || this._stopped) return;
            const delay = Math.max(0, delayMs);
            this._timer = window.setTimeout(() => this._tick(), delay);
        }

        async _tick() {
            if (this._destroyed || this._stopped) return;

            // Avoid overlapping updates if a request runs long.
            if (this._inFlight) {
                this._scheduleNextTick(this.config.intervalMs);
                return;
            }

            this._inFlight = true;
            try {
                await this._updateOnce();
            } catch (err) {
                console.error('BoatTracker update failed:', err);
            } finally {
                this._inFlight = false;
                this._scheduleNextTick(this.config.intervalMs);
            }
        }

        _shouldFollowBoat() {
            if (this._followBoatOverride !== null) return this._followBoatOverride;
            return Boolean(this.config.followBoat());
        }

        _pushPathPoint(lngLat) {
            const last = this.boatPath.length ? this.boatPath[this.boatPath.length - 1] : null;

            if (last && this.config.minMoveMeters > 0) {
                const moved = distanceMeters(last, lngLat);
                if (moved < this.config.minMoveMeters) return;
            }

            this.boatPath.push(lngLat);

            const maxPoints = this.config.maxPathPoints;
            if (Number.isFinite(maxPoints) && maxPoints > 0 && this.boatPath.length > maxPoints) {
                this.boatPath.splice(0, this.boatPath.length - maxPoints);
            }
        }

        async _updateOnce() {
            const boatData = await fetchBoatData();
            if (!boatData) throw new Error('fetchBoatData() returned no data.');

            const latitude = safeGet(boatData, 'data.gps.location.latitude');
            const longitude = safeGet(boatData, 'data.gps.location.longitude');
            const course = safeGet(boatData, 'data.gps.course');
            const reflocation = safeGet(boatData, 'settings.controller.reflocation');
            const darkMode = Boolean(safeGet(boatData, 'settings.rudder.darkMode'));

            const boatLngLat = normalizeLngLat([longitude, latitude]);
            const refLngLat = normalizeLngLat([reflocation?.longitude, reflocation?.latitude]);

            if (!boatLngLat) {
                if (this.config.debug) console.warn('BoatTracker: invalid boat coordinates', { latitude, longitude });
                return;
            }

            if (!refLngLat) {
                if (this.config.debug) console.warn('BoatTracker: invalid ref coordinates', { reflocation });
            }

            // External hooks (optional)
            if (typeof window.updateGoalMarker === 'function') {
                const goalIndex = safeGet(boatData, 'settings.route.goalIndex');
                window.updateGoalMarker(goalIndex, this.map);
            }

            if (typeof window.updateDarkModeControl === 'function') {
                window.updateDarkModeControl();
            }

            if (this._shouldFollowBoat()) {
                this.map.easeTo({ center: boatLngLat, duration: 250 });
            }

            this._pushPathPoint(boatLngLat);

            setSourceData(this.map, this.ids.pathSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: this.boatPath },
                properties: {}
            });

            if (refLngLat) {
                setSourceData(this.map, this.ids.refLineSource, {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [boatLngLat, refLngLat] },
                    properties: {}
                });
            }

            setSourceData(this.map, this.ids.darkCircleSource, {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: boatLngLat },
                properties: {}
            });

            if (this._lastDarkMode !== darkMode) {
                this.map.setLayoutProperty(this.ids.darkCircleLayer, 'visibility', darkMode ? 'visible' : 'none');
                this._lastDarkMode = darkMode;
            }

            if (!this._lastBoatLngLat || this._lastBoatLngLat[0] !== boatLngLat[0] || this._lastBoatLngLat[1] !== boatLngLat[1]) {
                this.boatMarker.setLngLat(boatLngLat);
                this._lastBoatLngLat = boatLngLat;
            }

            if (refLngLat && (!this._lastRefLngLat || this._lastRefLngLat[0] !== refLngLat[0] || this._lastRefLngLat[1] !== refLngLat[1])) {
                this.refMarker.setLngLat(refLngLat);
                this._lastRefLngLat = refLngLat;
            }

            if (isFiniteNumber(course) && course !== this._lastCourse) {
                const angle = course + this.config.courseOffsetDeg;
                this.boatRotEl.style.transform = `rotate(${angle}deg)`;
                this._lastCourse = course;
            }

            const popupHtml = this._buildPopupHtml({ latitude, longitude, course });
            if (popupHtml !== this._lastPopupHtml) {
                this.boatPopup.setHTML(popupHtml);
                this._lastPopupHtml = popupHtml;
            }
        }

        _buildPopupHtml({ latitude, longitude, course }) {
            const lat = isFiniteNumber(latitude) ? latitude.toFixed(6) : String(latitude);
            const lng = isFiniteNumber(longitude) ? longitude.toFixed(6) : String(longitude);
            const crs = isFiniteNumber(course) ? course.toFixed(1) : String(course);

            return [
                '<b>Boat Location</b>',
                `Latitude: ${lat}`,
                `Longitude: ${lng}`,
                `Course: ${crs}`
            ].join('<br>');
        }
    }

    async function initializeBoat(map, options = {}) {
        const tracker = new BoatTracker(map, options);
        return tracker.init();
    }

    window.initializeBoat = initializeBoat;
})();
