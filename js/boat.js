// ./js/boat.js
// Minimal boat tracker for Mapbox GL JS.
//
// Responsibilities:
// - Create and update a boat marker with heading
// - Draw traveled path, reference line, and dark mode circle
// - Poll boat data at a fixed interval (no overlapping requests)
// - Expose a small lifecycle API (start / stop / destroy)
//
// Requirements:
// - mapboxgl (global)
// - fetchBoatData() (global)
//
// Public API:
// - window.initializeBoat(map, options) -> { start, stop, destroy }

(() => {
    // IDs for all Mapbox sources and layers used by this feature
    const IDS = {
        pathSource: "boat-path-source",
        pathLayer: "boat-path-layer",
        refSource: "boat-refline-source",
        refLayer: "boat-refline-layer",
        darkSource: "boat-darkcircle-source",
        darkLayer: "boat-darkcircle-layer"
    };

    // Add a GeoJSON source if it does not already exist
    const ensureSource = (map, id, data) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
    };

    // Add a layer if it does not already exist
    const ensureLayer = (map, layer) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
    };

    // Safely update GeoJSON source data
    const setData = (map, id, data) => {
        const src = map.getSource(id);
        if (src && src.setData) src.setData(data);
    };

    // Create a marker element with a rotatable child element
    // Rotation is applied to the child to avoid clobbering Mapbox transforms
    const markerEl = (className, imageUrl) => {
        const root = document.createElement("div");
        root.className = className;

        const img = document.createElement("div");
        img.className = `${className}__img`;
        img.style.backgroundImage = `url('${imageUrl}')`;
        img.style.backgroundRepeat = "no-repeat";
        img.style.backgroundPosition = "center";
        img.style.backgroundSize = "contain";

        root.appendChild(img);
        return { root, img };
    };

    function initializeBoat(map, options = {}) {
        // Runtime configuration with sensible defaults
        const config = {
            intervalMs: 500,
            boatIconUrl: "./assets/boat.png",
            targetIconUrl: "./assets/target.png",
            courseOffsetDeg: 0,
            darkCircleRadiusPx: 100,
            followBoat: () => Boolean(window.followboat),
            maxPathPoints: 5000,
            ...options
        };

        // Stores the traveled path as [lng, lat] points
        const path = [];

        // --- Path layer ----------------------------------------------------
        ensureSource(map, IDS.pathSource, {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.pathLayer,
            type: "line",
            source: IDS.pathSource,
            paint: {
                "line-width": 3,
                "line-opacity": 0.8,
                "line-color": "#00aa00"
            }
        });

        // --- Reference line (boat -> target) -------------------------------
        ensureSource(map, IDS.refSource, {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.refLayer,
            type: "line",
            source: IDS.refSource,
            paint: {
                "line-width": 4,
                "line-opacity": 0.5,
                "line-color": "#ff0000",
                "line-dasharray": [2, 2]
            }
        });

        // --- Dark mode circle ----------------------------------------------
        ensureSource(map, IDS.darkSource, {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0, 0] },
            properties: {}
        });

        ensureLayer(map, {
            id: IDS.darkLayer,
            type: "circle",
            source: IDS.darkSource,
            paint: {
                "circle-radius": config.darkCircleRadiusPx,
                "circle-color": "#000000",
                "circle-opacity": 0.4
            }
        });

        map.setLayoutProperty(IDS.darkLayer, "visibility", "none");

        // --- Markers -------------------------------------------------------
        const boat = markerEl("boat-marker", config.boatIconUrl);
        const boatPopup = new mapboxgl.Popup({ offset: 18, closeButton: false });

        const boatMarker = new mapboxgl.Marker({ element: boat.root })
            .setLngLat(map.getCenter().toArray())
            .setPopup(boatPopup)
            .addTo(map);

        const ref = markerEl("ref-marker", config.targetIconUrl);
        const c = map.getCenter();

        const refMarker = new mapboxgl.Marker({ element: ref.root })
            .setLngLat([c.lng + 0.01, c.lat + 0.01])
            .addTo(map);

        // --- Polling state -------------------------------------------------
        let timer = null;
        let stopped = false;
        let destroyed = false;
        let inFlight = false;

        // Schedule next update without overlapping requests
        const schedule = () => {
            if (destroyed || stopped) return;
            timer = window.setTimeout(() => tick(), config.intervalMs);
        };

        // Single update step (fetch + render)
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

                const refLngLat = (Number.isFinite(refloc?.longitude) && Number.isFinite(refloc?.latitude))
                    ? [refloc.longitude, refloc.latitude]
                    : null;

                // Optionally keep the map centered on the boat
                if (config.followBoat()) {
                    map.easeTo({ center: boatLngLat, duration: 250 });
                }

                // Update path with a fixed maximum length
                path.push(boatLngLat);
                if (path.length > config.maxPathPoints) {
                    path.splice(0, path.length - config.maxPathPoints);
                }

                setData(map, IDS.pathSource, {
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: path },
                    properties: {}
                });

                // Update reference line and marker
                if (refLngLat) {
                    setData(map, IDS.refSource, {
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: [boatLngLat, refLngLat] },
                        properties: {}
                    });
                    refMarker.setLngLat(refLngLat);
                }

                // Update dark mode circle
                setData(map, IDS.darkSource, {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: boatLngLat },
                    properties: {}
                });

                map.setLayoutProperty(
                    IDS.darkLayer,
                    "visibility",
                    darkMode ? "visible" : "none"
                );

                // Update boat marker position and heading
                boatMarker.setLngLat(boatLngLat);
                if (Number.isFinite(course)) {
                    boat.img.style.transform = `rotate(${course + config.courseOffsetDeg}deg)`;
                }

                // Update popup content
                boatPopup.setHTML(
                    `<b>Boat Location</b><br>
                     Latitude: ${loc.latitude}<br>
                     Longitude: ${loc.longitude}<br>
                     Course: ${course}`
                );
            } catch (err) {
                console.error("Boat tick failed:", err);
            } finally {
                inFlight = false;
                schedule();
            }
        };

        // Stop polling updates
        const stop = () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
            timer = null;
        };

        // Start polling updates
        const start = () => {
            if (destroyed) return;
            stopped = false;
            tick();
        };

        // Fully remove markers, layers, and sources
        const destroy = () => {
            if (destroyed) return;
            destroyed = true;
            stop();

            boatMarker.remove();
            refMarker.remove();

            if (map.getLayer(IDS.pathLayer)) map.removeLayer(IDS.pathLayer);
            if (map.getLayer(IDS.refLayer)) map.removeLayer(IDS.refLayer);
            if (map.getLayer(IDS.darkLayer)) map.removeLayer(IDS.darkLayer);

            if (map.getSource(IDS.pathSource)) map.removeSource(IDS.pathSource);
            if (map.getSource(IDS.refSource)) map.removeSource(IDS.refSource);
            if (map.getSource(IDS.darkSource)) map.removeSource(IDS.darkSource);
        };

        // Start immediately
        tick();

        return { start, stop, destroy };
    }

    window.initializeBoat = initializeBoat;
})();
