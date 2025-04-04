// route.js - Handles route fetching and rendering

var routePolyline = null;
var routeMarkers = []; // Store the route circle markers
const routeColor = '#214F5D'; // Your desired color for all route elements

var circleIcon = new L.Icon({
    iconUrl: 'assets/route-marker.png',
    shadowUrl: null,
    iconSize: new L.Point(15, 15)
});

// Fetch route data from the server
async function fetchRouteData() {
    const response = await fetch(apiUrl.replace(/\/$/, '') + '/route');
    const data = await response.json();
    return data;
}

// Render the route on the map with circle markers
async function drawRoute(map) {
    const routeData = await fetchRouteData();

    if (routeData.geometry.type === "LineString") {
        const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        // Clear previous markers
        routeMarkers.forEach(marker => map.removeLayer(marker));
        routeMarkers = [];
        
        // Create a circle marker for each point in the route
        coordinates.forEach((point, index) => {
            const circleMarker = L.marker(point, {
                icon: circleIcon, // Use the circle icon
                draggable: false, // Make it non-draggable
            }).addTo(map);

            circleMarker.bindPopup(`<b>Route Point ${index + 1}</b><br>Latitude: ${point[0]}<br>Longitude: ${point[1]}`);
            routeMarkers.push(circleMarker);
        });

        // Draw or update the route polyline
        if (routePolyline) {
            routePolyline.setLatLngs(coordinates);
            routePolyline.setStyle({ color: routeColor }); // Update polyline color
        } else {
            routePolyline = L.polyline(coordinates, { color: routeColor, weight: 5, opacity: 0.8 }).addTo(map);
        }
    }
}
