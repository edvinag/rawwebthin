// map.js - Core Map Functionality

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

    await drawRoute(map); // Call the drawRoute function from route.js
    await initializeBoat(map); // Initialize boat handling from boat.js
}

initializeMap();
