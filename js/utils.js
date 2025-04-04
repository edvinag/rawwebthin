// utils.js - Helper functions for fetching and pushing data

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

async function updateRouteIndex(index) {
    const data = await fetch(apiUrl.replace(/\/$/, '') + `/route?goalIndex=${index}`);
    const routeData = await data.json();
    return routeData;
}

async function pushRouteData(data, keepIndex, goalIndex = null) {
    if (!apiUrl) return; // Ensure apiUrl is defined

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
        }
        return response.ok; // Return success status for further handling
    } catch (error) {
        console.error("Error pushing data to server:", error);
    }
}
