// ./js/boat.js
// Handles boat positioning and path management for Mapbox GL JS.
// Requires:
// - mapboxgl (loaded from CDN)
// - fetchBoatData() available globally from ./js/utils.js

(() => {
    const ensureSource = (map, id, data) => {
        if (map.getSource(id)) return;
        map.addSource(id, { type: 'geojson', data });
    };

    const setSourceData = (map, id, data) => {
        const src = map.getSource(id);
        if (src) src.setData(data);
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

    const createElMarker = (className, imageUrl) => {
        const el = document.createElement('div');
        el.className = className;
        el.style.backgroundImage = `url('${imageUrl}')`;
        return el;
    };

    async function initializeBoat(map, options = {}) {
        if (typeof fetchBoatData !== 'function') {
            throw new Error('fetchBoatData() not found. Load ./js/utils.js before ./js/boat.js');
        }

        const config = {
            intervalMs: 500,
            boatIconUrl: 'assets/boat.png',
            targetIconUrl: 'assets/target.png',
            courseOffsetDeg: 0,
            darkCircleRadiusPx: 100,
            followBoat: () => Boolean(window.followboat),
            ...options
        };

        const ids = {
            pathSource: 'boat-path-source',
            pathLayer: 'boat-path-layer',
            refLineSource: 'boat-refline-source',
            refLineLayer: 'boat-refline-layer',
            darkCircleSource: 'boat-darkcircle-source',
            darkCircleLayer: 'boat-darkcircle-layer'
        };

        const boatPath = [];

        // Path
        ensureSource(map, ids.pathSource, {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {}
        });

        ensureLineLayer(map, ids.pathSource, ids.pathLayer, {
            'line-width': 3,
            'line-opacity': 0.8,
            'line-color': '#00aa00'
        });

        // Ref line
        ensureSource(map, ids.refLineSource, {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {}
        });

        ensureLineLayer(map, ids.refLineSource, ids.refLineLayer, {
            'line-width': 4,
            'line-opacity': 0.5,
            'line-color': '#ff0000',
            'line-dasharray': [2, 2]
        });

        // Dark circle
        ensureSource(map, ids.darkCircleSource, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
        });

        ensureCircleLayer(map, ids.darkCircleSource, ids.darkCircleLayer, {
            'circle-radius': config.darkCircleRadiusPx,
            'circle-color': '#000000',
            'circle-opacity': 0.4
        });

        map.setLayoutProperty(ids.darkCircleLayer, 'visibility', 'none');

        // Markers
        const boatEl = createElMarker('boat-marker', config.boatIconUrl);
        const boatPopup = new mapboxgl.Popup({ offset: 18, closeButton: false });

        const boatMarker = new mapboxgl.Marker({ element: boatEl })
            .setLngLat(map.getCenter().toArray())
            .setPopup(boatPopup)
            .addTo(map);

        const refEl = createElMarker('ref-marker', config.targetIconUrl);
        const refMarker = new mapboxgl.Marker({ element: refEl })
            .setLngLat([map.getCenter().lng + 0.01, map.getCenter().lat + 0.01])
            .addTo(map);

        const updateBoatPosition = async () => {
            const boatData = await fetchBoatData();

            const { latitude, longitude } = boatData.data.gps.location;
            const course = boatData.data.gps.course;
            const reflocation = boatData.settings.controller.reflocation;
            const darkMode = Boolean(boatData.settings.rudder.darkMode);

            if (typeof window.updateGoalMarker === 'function') {
                window.updateGoalMarker(boatData.settings.route.goalIndex, map);
            }

            if (typeof window.updateDarkModeControl === 'function') {
                window.updateDarkModeControl();
            }

            const boatLngLat = [longitude, latitude];
            const refLngLat = [reflocation.longitude, reflocation.latitude];

            if (config.followBoat()) {
                map.easeTo({ center: boatLngLat, duration: 250 });
            }

            boatPath.push(boatLngLat);

            setSourceData(map, ids.pathSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: boatPath },
                properties: {}
            });

            setSourceData(map, ids.refLineSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [boatLngLat, refLngLat] },
                properties: {}
            });

            setSourceData(map, ids.darkCircleSource, {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: boatLngLat },
                properties: {}
            });

            map.setLayoutProperty(
                ids.darkCircleLayer,
                'visibility',
                darkMode ? 'visible' : 'none'
            );

            boatMarker.setLngLat(boatLngLat);
            refMarker.setLngLat(refLngLat);

            boatEl.style.transform = `rotate(${course + config.courseOffsetDeg}deg)`;

            boatPopup.setHTML(
                `<b>Boat Location</b><br>
                 Latitude: ${latitude}<br>
                 Longitude: ${longitude}<br>
                 Course: ${course}`
            );
        };

        await updateBoatPosition();
        const timer = window.setInterval(updateBoatPosition, config.intervalMs);

        return {
            stop: () => window.clearInterval(timer)
        };
    }

    window.initializeBoat = initializeBoat;
})();
