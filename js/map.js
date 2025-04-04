var boatIcon = L.icon({
    iconUrl: 'assets/boat.png', // Adjusted path
    iconSize: new L.Point(19, 26),
    iconAnchor: new L.Point(9, 13),
    popupAnchor: [0, -15]
});

var boatPath = [];  // Store the boat's path coordinates
var pathPolyline = null;  // Reference to the drawn polyline

// Helper function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Get the URL from query parameter or localStorage
const storedUrl = localStorage.getItem('boatDataUrl') || '';
const urlParam = getUrlParameter('url');

if (urlParam) {
    localStorage.setItem('boatDataUrl', urlParam);  // Store the URL in localStorage
}

const apiUrl = urlParam || storedUrl;  // Use the URL parameter if available, otherwise fallback to localStorage

async function fetchBoatData() {
    const response = await fetch(apiUrl.replace(/\/$/, '') + '/all');
    const data = await response.json();
    return data;
}

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

        // Add current position to boatPath array
        boatPath.push([latitude, longitude]);

        // Draw or update the path polyline
        if (pathPolyline) {
            pathPolyline.setLatLngs(boatPath);  // Update the polyline with the new path
        } else {
            pathPolyline = L.polyline(boatPath, { color: 'green', weight: 3, opacity: 0.8}).addTo(map);
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

    await updateBoatPosition();

    setInterval(updateBoatPosition, 500);
}

initializeMap();
