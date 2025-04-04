// route.js - Handles route fetching and rendering

var routePolyline = null;

// Fetch route data from the server
async function fetchRouteData() {
    const response = await fetch(apiUrl.replace(/\/$/, '') + '/route');
    const data = await response.json();
    return data;
}

// Render the route on the map
async function drawRoute(map) {
    const routeData = await fetchRouteData();

    if (routeData.geometry.type === "LineString") {
        const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        if (routePolyline) {
            routePolyline.setLatLngs(coordinates);
        } else {
            routePolyline = L.polyline(coordinates, { color: 'blue', weight: 4, opacity: 0.7 }).addTo(map);
        }
    }
}
