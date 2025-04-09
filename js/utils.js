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

async function toggleDarkMode(currentMode) {
    if (!apiUrl) return;

    const url = apiUrl.replace(/\/$/, '') + `/rudder?darkMode=${!currentMode}`;

    try {
        const response = await fetch(url, { method: 'GET' });
        if (response.ok) {
            const data = await response.json();
            return data.darkMode; // Return the updated dark mode state
        } else {
            console.error(`Failed to toggle dark mode: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error toggling dark mode:", error);
    }
}

async function fetchAutoRoute(start, end) {
    const api_url = "https://nautical-hub.skippo.io/aws/autoroute";
    const auth_header = `Basic ${autoApiKey}`;
    const course = `${start.lng},${start.lat};${end.lng},${end.lat}`;

    const params = new URLSearchParams({
      usehydrographica: "true",
      course: course,
      safetydepth: "1.5",
      safetyheight: "6",
      boatspeed: "5"
    });

    try {
      const response = await fetch(`${api_url}?${params.toString()}`, {
        method: 'GET',
        headers: { "Authorization": auth_header }
      });

      if (!response.ok) {
        showError(`Failed to retrieve data: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      showError("Error while fetching route data. Please check your internet connection.");
      return null;
    }
};

function isPhone(){
    return isIphone();
}

function isIphone() {
    return /iPhone/i.test(navigator.userAgent);
}

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}