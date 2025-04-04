// map.js - Core Map Functionality

var boatPath = [];
var pathPolyline = null;
var routePolyline = null;

async function initializeMap() {
    var map = L.map('map');

    L.tileLayer('https://{s}.eniro.no/geowebcache/service/tms1.0.0/nautical2x/{z}/{x}/{y}.png?c=crc&v=20200602', {
        maxZoom: 17,
        minZoom: 3,
        noWrap: true,
        tileSize: 256,
        tms: true,
        zoomOffset: 0,
        attribution: '© Eniro',
        subdomains: ['map01', 'map02', 'map03', 'map04']
    }).addTo(map);

    var boatMarker = null;

    async function updateBoatPosition() {
        const boatData = await fetchBoatData();
        const { latitude, longitude } = boatData.data.gps.location;
        const course = boatData.data.gps.course;

        boatPath.push([latitude, longitude]);

        if (pathPolyline) {
            pathPolyline.setLatLngs(boatPath);
        } else {
            pathPolyline = L.polyline(boatPath, { color: 'green', weight: 3, opacity: 0.8 }).addTo(map);
        }

        if (boatMarker) {
            boatMarker.setLatLng([latitude, longitude]);
            boatMarker.setIconAngle(course);
        } else {
            boatMarker = L.marker([latitude, longitude], { icon: boatIcon }).addTo(map);
            boatMarker.setIconAngle(course);
            boatMarker.bindPopup(`<b>Boat Location</b><br>Latitude: ${latitude}<br>Longitude: ${longitude} <br>Course: ${course}`);
            map.setView([latitude, longitude], 16);
        }

        boatMarker.getPopup().setContent(`<b>Boat Location</b><br>Latitude: ${latitude}<br>Longitude: ${longitude}`);
    }

    async function drawRoute() {
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

    await drawRoute();
    await updateBoatPosition();

    setInterval(updateBoatPosition, 500);
}

initializeMap();
