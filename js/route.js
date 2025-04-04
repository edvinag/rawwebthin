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

// Push updated route data to the server
async function pushRouteData(data, keepIndex, goalIndex = null) {
    if (!apiUrl) return;

    let url = apiUrl.replace(/\/$/, '') + `/route?keepIndex=${keepIndex}`;
    if (goalIndex !== null) url += `&goalIndex=${goalIndex}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error(`Error pushing data to server: ${response.statusText}`);
        } else {
            console.log("Route data successfully pushed to server.");
        }
    } catch (error) {
        console.error("Error pushing data to server:", error);
    }
}

// Render the route on the map with draggable markers
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
                icon: circleIcon,
                draggable: true,
            }).addTo(map);

            circleMarker.bindPopup(`<b>Route Point ${index + 1}</b><br>Latitude: ${point[0]}<br>Longitude: ${point[1]}`);
            
            // Update the polyline visually during dragging
            circleMarker.on('drag', updateRoutePolyline);

            // Push data to the server only when dragging ends
            circleMarker.on('dragend', pushRouteOnDragEnd);
            
            routeMarkers.push(circleMarker);
        });

        // Draw or update the route polyline
        if (routePolyline) {
            routePolyline.setLatLngs(coordinates);
            routePolyline.setStyle({ color: routeColor });
        } else {
            routePolyline = L.polyline(coordinates, { color: routeColor, weight: 5, opacity: 0.8 }).addTo(map);
        }
    }
}

// Update the polyline visually when markers are dragged
function updateRoutePolyline() {
    const newCoordinates = routeMarkers.map(marker => marker.getLatLng());

    if (routePolyline) {
        routePolyline.setLatLngs(newCoordinates);
    }
}

// Push updated data to the server when dragging ends
function pushRouteOnDragEnd() {
    const newCoordinates = routeMarkers.map(marker => marker.getLatLng());

    const data = {
        geometry: {
            type: "LineString",
            coordinates: newCoordinates.map(latLng => [latLng.lng, latLng.lat])
        }
    };

    // Adjust keepIndex and goalIndex as needed
    pushRouteData(data, true);
}
