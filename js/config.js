// config.js - Configuration and constants

var boatIcon = L.icon({
    iconUrl: 'assets/boat.png', // Adjusted path
    iconSize: new L.Point(19, 26),
    iconAnchor: new L.Point(9, 13),
    popupAnchor: [0, -15]
});

// URL Handling
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

const storedUrl = localStorage.getItem('boatDataUrl') || '';
const urlParam = getUrlParameter('url');

if (urlParam) {
    localStorage.setItem('boatDataUrl', urlParam);
}

const apiUrl = urlParam || storedUrl;
