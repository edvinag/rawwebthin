// utils.js - Helper functions for fetching data

async function fetchBoatData() {
    const response = await fetch(apiUrl.replace(/\/$/, '') + '/all');
    const data = await response.json();
    return data;
}

async function fetchRouteData() {
    const response = await fetch(apiUrl.replace(/\/$/, '') + '/route');
    const data = await response.json();
    return data;
}
