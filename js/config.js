// config.js - Configuration and constants

function getStoredOrParam(key) {
    const urlParams = new URLSearchParams(window.location.search);
    const paramValue = urlParams.get(key);
    if (paramValue) {
        localStorage.setItem(key, paramValue);
    }
    return paramValue || localStorage.getItem(key) || '';
}

function getStoredBoolean(key, defaultValue) {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return defaultValue;
    return storedValue === 'true';
}

function setStoredBoolean(key, value) {
    localStorage.setItem(key, value.toString());
}

function getStoredInt(key, defaultValue) {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return defaultValue;
    return parseInt(storedValue, 10);
}

function setStoredInt(key, value) {
    localStorage.setItem(key, value.toString());
}

function getStoredDouble(key, defaultValue) {
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) return defaultValue;
    return parseFloat(storedValue);
}

function setStoredDouble(key, value) {
    localStorage.setItem(key, value.toString());
}

const apiUrl = getStoredOrParam('boatDataUrl');
const autoUrl = getStoredOrParam('autoUrl');
const autoApiKey = getStoredOrParam('autoApiKey');
const mapboxAccessToken = getStoredOrParam('mapboxAccessToken');
let autoRoute = getStoredBoolean('autoRoute', true);
let followBoat = getStoredBoolean('followboat', false);
