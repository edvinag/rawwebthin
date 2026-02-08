(() => {
    const IDS = {
        pathSource: 'boat-path-source',
        pathLayer: 'boat-path-layer',
        refSource: 'boat-refline-source',
        refLayer: 'boat-refline-layer',
        darkSource: 'boat-darkcircle-source',
        darkLayer: 'boat-darkcircle-layer'
    };

    const ensureSource = (map, id, data) => {
        if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
    };

    const ensureLayer = (map, layer) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
    };

    const setData = (map, id, data) => {
        const src = map.getSource(id);
        if (src && src.setData) src.setData(data);
    };

    const markerEl = (className, imageUrl) => {
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

    function initializeBoat(map, options = {}) {
        const config = {
            intervalMs: 500,
            boatIconUrl: './assets/boat.png',
            targetIconUrl: './assets/target.png',
            courseOffsetDeg: 0,
            darkCircleRadiusPx: 100,
            followBoat: () => followBoat,
            followHeading: () => followHeading,
            maxPathPoints: 5000,
            ...options
        };

        const path = [];

        ensureSource(map, IDS.pathSource, {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.pathLayer,
            type: 'line',
            source: IDS.pathSource,
            paint: {
                'line-width': 3,
                'line-opacity': 0.8,
                'line-color': '#00aa00'
            }
        });

        ensureSource(map, IDS.refSource, {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.refLayer,
            type: 'line',
            source: IDS.refSource,
            paint: {
                'line-width': 4,
                'line-opacity': 0.5,
                'line-color': '#ff0000',
                'line-dasharray': [2, 2]
            }
        });

        ensureSource(map, IDS.darkSource, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.darkLayer,
            type: 'circle',
            source: IDS.darkSource,
            paint: {
                'circle-radius': config.darkCircleRadiusPx,
                'circle-color': '#000000',
                'circle-opacity': 0.4
            }
        });

        map.setLayoutProperty(IDS.darkLayer, 'visibility', 'none');

        const boat = markerEl('boat-marker', config.boatIconUrl);
        const boatPopup = new mapboxgl.Popup({ offset: 18, closeButton: false });

        const boatMarker = new mapboxgl.Marker({ element: boat.root })
            .setLngLat(map.getCenter().toArray())
            .setPopup(boatPopup)
            .addTo(map);

        const ref = markerEl('ref-marker', config.targetIconUrl);
        const c = map.getCenter();

        const refMarker = new mapboxgl.Marker({ element: ref.root })
            .setLngLat([c.lng + 0.01, c.lat + 0.01])
            .addTo(map);

        let lastCourse = null;

        const applyBoatRotation = () => {
            if (!Number.isFinite(lastCourse)) return;

            if (config.followHeading()) {
                boat.img.style.transform = 'rotate(0deg)';
                return;
            }

            const bearing = map.getBearing();
            const angle = lastCourse + config.courseOffsetDeg - bearing;
            boat.img.style.transform = `rotate(${angle}deg)`;
        };

        map.on('rotate', () => applyBoatRotation());

        let timer = null;
        let stopped = false;
        let destroyed = false;
        let inFlight = false;

        let lastPosition = null;

        const getPosition = () => lastPosition;

        const schedule = () => {
            if (destroyed || stopped) return;
            timer = window.setTimeout(() => tick(), config.intervalMs);
        };

        const tick = async () => {
            if (destroyed || stopped || inFlight) return schedule();
            inFlight = true;

            try {
                const data = await fetchBoatData();

                const loc = data?.data?.gps?.location;
                const course = data?.data?.gps?.course;
                const refloc = data?.settings?.controller?.reflocation;
                const darkMode = Boolean(data?.settings?.rudder?.darkMode);

                const boatLngLat = (Number.isFinite(loc?.longitude) && Number.isFinite(loc?.latitude))
                    ? [loc.longitude, loc.latitude]
                    : null;

                if (!boatLngLat) return;

                lastPosition = { lng: boatLngLat[0], lat: boatLngLat[1] };
                window.boatPosition = { longitude: boatLngLat[0], latitude: boatLngLat[1] };

                const refLngLat = (Number.isFinite(refloc?.longitude) && Number.isFinite(refloc?.latitude))
                    ? [refloc.longitude, refloc.latitude]
                    : null;

                if (Number.isFinite(course)) lastCourse = course;

                const shouldFollowHeading = config.followHeading() && Number.isFinite(lastCourse);
                const shouldFollowCenter = config.followBoat() || shouldFollowHeading;

                if (shouldFollowCenter || shouldFollowHeading) {
                    map.easeTo({
                        center: shouldFollowCenter ? boatLngLat : map.getCenter().toArray(),
                        bearing: shouldFollowHeading ? lastCourse + config.courseOffsetDeg : map.getBearing(),
                        duration: 250
                    });
                }

                path.push(boatLngLat);
                if (path.length > config.maxPathPoints) {
                    path.splice(0, path.length - config.maxPathPoints);
                }

                setData(map, IDS.pathSource, {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: path },
                    properties: {}
                });

                if (refLngLat) {
                    setData(map, IDS.refSource, {
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: [boatLngLat, refLngLat] },
                        properties: {}
                    });
                    refMarker.setLngLat(refLngLat);
                }

                setData(map, IDS.darkSource, {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: boatLngLat },
                    properties: {}
                });

                map.setLayoutProperty(IDS.darkLayer, 'visibility', darkMode ? 'visible' : 'none');

                boatMarker.setLngLat(boatLngLat);

                applyBoatRotation();

                boatPopup.setHTML(
                    `<b>Boat Location</b><br>
                     Latitude: ${loc.latitude}<br>
                     Longitude: ${loc.longitude}<br>
                     Course: ${course}`
                );
            } catch (err) {
                console.error('Boat tick failed:', err);
            } finally {
                inFlight = false;
                schedule();
            }
        };

        const stop = () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
            timer = null;
        };

        const start = () => {
            if (destroyed) return;
            stopped = false;
            tick();
        };

        const destroy = () => {
            if (destroyed) return;
            destroyed = true;
            stop();

            map.off('rotate', applyBoatRotation);

            boatMarker.remove();
            refMarker.remove();

            if (map.getLayer(IDS.pathLayer)) map.removeLayer(IDS.pathLayer);
            if (map.getLayer(IDS.refLayer)) map.removeLayer(IDS.refLayer);
            if (map.getLayer(IDS.darkLayer)) map.removeLayer(IDS.darkLayer);

            if (map.getSource(IDS.pathSource)) map.removeSource(IDS.pathSource);
            if (map.getSource(IDS.refSource)) map.removeSource(IDS.refSource);
            if (map.getSource(IDS.darkSource)) map.removeSource(IDS.darkSource);

            lastPosition = null;
        };

        tick();

        return { start, stop, destroy, getPosition };
    }

    window.initializeBoat = initializeBoat;
})();
