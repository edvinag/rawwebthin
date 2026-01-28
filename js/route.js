// ./js/route.js
// Mapbox GL JS version of the Leaflet route editor.
//
// Responsibilities:
// - Draw or update the route line from server data
// - Show draggable route point markers (custom icon)
// - Update route line live while dragging a specific point (by index)
// - Push the full route to the server on dragend
// - Optional goal marker (circle) that follows a chosen route index
//
// Requirements:
// - mapboxgl (global)
// - fetchRouteData(), fetchAutoRoute(), pushRouteData() (global)
// - updateRouteIndex(index) (global, if you use it)
// - isPhone() (global, optional)
//
// Public API:
// - window.initializeRoute(map, options) -> { drawRoute, newRoute, addPointToRoute, updateGoalMarker, destroy }

(() => {
    const IDS = {
        routeSource: 'route-source',
        routeLayer: 'route-layer',
        goalSource: 'route-goal-source',
        goalLayer: 'route-goal-layer'
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

    const markerEl = (className, imageUrl, sizePx) => {
        const root = document.createElement('div');
        root.className = className;
        root.style.width = `${sizePx}px`;
        root.style.height = `${sizePx}px`;
        root.style.backgroundImage = `url('${imageUrl}')`;
        root.style.backgroundRepeat = 'no-repeat';
        root.style.backgroundPosition = 'center';
        root.style.backgroundSize = 'contain';
        root.style.cursor = 'pointer';
        return root;
    };

    function initializeRoute(map, options = {}) {
        const config = {
            routeColor: '#214F5D',
            routeWidth: 5,
            routeOpacity: 0.8,
            markerIconUrl: 'assets/route-marker.png',
            markerSizePx: 15,
            goalRadiusPx: 6,
            ...options
        };

        // State
        let routeMarkers = [];
        let goalLngLat = null;
        let destroyed = false;

        // Coordinates in Mapbox order: [lng, lat]
        let routeCoords = [];

        // --- Route line source/layer ---------------------------------------
        ensureSource(map, IDS.routeSource, {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.routeLayer,
            type: 'line',
            source: IDS.routeSource,
            paint: {
                'line-color': config.routeColor,
                'line-width': config.routeWidth,
                'line-opacity': config.routeOpacity
            }
        });

        // --- Goal marker (circle layer) ------------------------------------
        ensureSource(map, IDS.goalSource, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.goalLayer,
            type: 'circle',
            source: IDS.goalSource,
            paint: {
                'circle-radius': config.goalRadiusPx,
                'circle-opacity': 0.9
            }
        });

        map.setLayoutProperty(IDS.goalLayer, 'visibility', 'none');

        const renderRouteLine = () => {
            setData(map, IDS.routeSource, {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: routeCoords },
                properties: {}
            });
        };

        const clearMarkers = () => {
            routeMarkers.forEach((m) => m.remove());
            routeMarkers = [];
        };

        const wireTapOrDblClick = (el, index) => {
            if (typeof updateRouteIndex !== 'function') return;

            if (typeof isPhone === 'function' && isPhone()) {
                let lastTapTs = null;
                el.addEventListener('click', () => {
                    const now = Date.now();
                    if (lastTapTs && now - lastTapTs < 200) updateRouteIndex(index);
                    lastTapTs = now;
                });
                return;
            }

            el.addEventListener('dblclick', (e) => {
                e.preventDefault();
                updateRouteIndex(index);
            });
        };

        // Update line visually while dragging one marker (uses index)
        const updateRoutePolyline = (index, lngLat) => {
            if (!routeCoords[index]) return;
            routeCoords[index] = [lngLat.lng, lngLat.lat];
            renderRouteLine();

            // If your goal is pinned to this index, keep it synced
            if (goalLngLat && goalLngLat.__index === index) {
                setData(map, IDS.goalSource, {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: routeCoords[index] },
                    properties: {}
                });
            }
        };

        // Push full route on dragend (no index)
        const pushRouteOnDragEnd = () => {
            const data = {
                geometry: {
                    type: 'LineString',
                    coordinates: routeCoords.map((c) => [c[0], c[1]])
                }
            };
            pushRouteData(data, true);
        };

        const addMarker = (lngLatLike, index) => {
            const lng = Array.isArray(lngLatLike) ? lngLatLike[0] : lngLatLike.lng;
            const lat = Array.isArray(lngLatLike) ? lngLatLike[1] : lngLatLike.lat;
            const lngLat = { lng, lat };

            const el = markerEl('route-marker', config.markerIconUrl, config.markerSizePx);
            wireTapOrDblClick(el, index);

            const marker = new mapboxgl.Marker({ element: el, draggable: true })
                .setLngLat([lngLat.lng, lngLat.lat])
                .addTo(map);

            marker.on('drag', () => {
                const pos = marker.getLngLat();
                updateRoutePolyline(index, pos);
            });

            marker.on('dragend', () => {
                const pos = marker.getLngLat();
                updateRoutePolyline(index, pos);
                pushRouteOnDragEnd();
            });

            routeMarkers.push(marker);
            return marker;
        };

        // Render the route on the map with draggable markers
        const drawRoute = async () => {
            const routeData = await fetchRouteData();
            if (!routeData || routeData.geometry?.type !== 'LineString') return;

            // Server is usually [lng, lat]. Keep it that way for Mapbox.
            routeCoords = routeData.geometry.coordinates.map((c) => [c[0], c[1]]);

            clearMarkers();

            routeCoords.forEach((coord, index) => {
                addMarker(coord, index);
            });

            renderRouteLine();
        };

        const addPointToRoute = async (lngLatLike, isAutoRoute = false, keepIndex = true) => {
            if (!routeCoords.length) return;

            const lng = Array.isArray(lngLatLike) ? lngLatLike[0] : lngLatLike.lng;
            const lat = Array.isArray(lngLatLike) ? lngLatLike[1] : lngLatLike.lat;
            const next = { lng, lat };

            if (isAutoRoute) {
                const last = routeMarkers[routeMarkers.length - 1]?.getLngLat();
                if (!last) return;

                const newCoordinates = await fetchAutoRoute({ lat: last.lat, lng: last.lng }, { lat: next.lat, lng: next.lng });
                const coords = newCoordinates?.geometry?.coordinates;

                if (Array.isArray(coords) && coords.length > 1) {
                    coords.slice(1).forEach((c) => {
                        const coord = [c[0], c[1]];
                        routeCoords.push(coord);
                        addMarker(coord, routeMarkers.length);
                    });
                    renderRouteLine();
                }
            } else {
                const coord = [next.lng, next.lat];
                routeCoords.push(coord);
                addMarker(coord, routeMarkers.length);
                renderRouteLine();
            }

            pushRouteData(
                {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: routeCoords.map((c) => [c[0], c[1]]) },
                    properties: {}
                },
                keepIndex
            );
        };

        const newRoute = async (lngLatLike, isAutoRoute = false) => {
            clearMarkers();
            routeCoords = [];

            // Keep your existing behavior: first point = boat position
            const first = {
                lng: boatPosition.longitude,
                lat: boatPosition.latitude
            };

            routeCoords.push([first.lng, first.lat]);
            addMarker([first.lng, first.lat], 0);
            renderRouteLine();

            await addPointToRoute(lngLatLike, isAutoRoute, false);
        };

        const updateGoalMarker = (index) => {
            if (index < 0 || index >= routeMarkers.length) return;

            const pos = routeMarkers[index].getLngLat();
            goalLngLat = { lng: pos.lng, lat: pos.lat, __index: index };

            setData(map, IDS.goalSource, {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] },
                properties: {}
            });

            map.setLayoutProperty(IDS.goalLayer, 'visibility', 'visible');
        };

        const destroy = () => {
            if (destroyed) return;
            destroyed = true;

            clearMarkers();

            if (map.getLayer(IDS.routeLayer)) map.removeLayer(IDS.routeLayer);
            if (map.getLayer(IDS.goalLayer)) map.removeLayer(IDS.goalLayer);

            if (map.getSource(IDS.routeSource)) map.removeSource(IDS.routeSource);
            if (map.getSource(IDS.goalSource)) map.removeSource(IDS.goalSource);
        };

        return { drawRoute, newRoute, addPointToRoute, updateGoalMarker, destroy };
    }

    window.initializeRoute = initializeRoute;
})();
