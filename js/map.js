// map.js - Core Map Functionality

let darkModeControlContainer; // Declare a global variable for the control container
let followBoatControlContainer; // Declare a global variable for the follow boat control container

async function initializeMap() {
    const map = L.map('map');

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

    const DarkModeControl = L.Control.extend({
        options: { position: 'bottomleft' },

        onAdd: function (map) {
            darkModeControlContainer = L.DomUtil.create('div', 'leaflet-control-darkmode'); // Store in global variable

            Object.assign(darkModeControlContainer.style, {
                backgroundColor: 'transparent',
                backgroundSize: "30px 30px",
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                backgroundImage: "url(assets/off.png)" // Default state
            });

            darkModeControlContainer.addEventListener('click', async (e) => {await toggleDarkMode(darkMode);});

            darkModeControlContainer.title = "Dark Mode";

            return darkModeControlContainer;
        }
    });
    map.addControl(new DarkModeControl());

    const followBoatControl = L.Control.extend({
        options: { position: 'bottomright' },

        onAdd: function (map) {
            followBoatControlContainer = L.DomUtil.create('div', 'leaflet-control-followboat');
            Object.assign(followBoatControlContainer.style, {
                backgroundColor: 'transparent',
                backgroundSize: "30px 30px",
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                backgroundImage: followboat ? "url(assets/followboat_on.png)" : "url(assets/followboat_off.png)"
            });

            followBoatControlContainer.addEventListener('click', () => {
                followboat = !followboat;
                setStoredBoolean('followboat', followboat); // Store the new state in localStorage
                followBoatControlContainer.style.backgroundImage = followboat ? "url(assets/followboat_on.png)" : "url(assets/followboat_off.png)";
            });

            followBoatControlContainer.title = "Follow Boat";

            return followBoatControlContainer;
        }
    });
    map.addControl(new followBoatControl());

    map.doubleClickZoom.disable();
    createPopup(map);

    await drawRoute(map);
    await initializeBoat(map);
}

function updateDarkModeControl() {
    if (darkModeControlContainer) {
        darkModeControlContainer.style.backgroundImage = darkMode ? "url(assets/off.png)" : "url(assets/on.png)";
    }
}

initializeMap();
