// boat.js - Handles Boat Positioning and Path Management

var boatPath = [];
var boatPosition = null;
var pathPolyline = null;
var boatMarker = null;
var refLine = null;  // Polyline for the line between the boat and reflocation
var refLocationMarker = null; // Marker for the end of the refLine
var darkMode = false; // Default dark mode state

var targetIcon = new L.Icon({
    iconUrl: 'assets/target.png',
    shadowUrl: null,
    iconSize: new L.Point(30, 30)
});

async function initializeBoat(map) {
    async function updateBoatPosition() {
        const boatData = await fetchBoatData();
        boatPosition = boatData.data.gps.location;
        const { latitude, longitude } = boatData.data.gps.location;
        const course = boatData.data.gps.course;
        const reflocation = boatData.settings.controller.reflocation;
        darkMode = boatData.settings.rudder.darkMode; // Update dark mode state

        updateGoalMarker(boatData.settings.route.goalIndex, map);
        updateDarkModeControl();
        if (map._loaded && followboat) {
            map.setView([latitude, longitude]);
        }
        
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
        }

        // Draw or update the dotted line between boat and reflocation
        const refLocationCoords = [reflocation.latitude, reflocation.longitude];
        if (refLine) {
            refLine.setLatLngs([[latitude, longitude], refLocationCoords]);
        } else {
            refLine = L.polyline([[latitude, longitude], refLocationCoords], {
                color: 'red', weight: 4, opacity: 0.5, dashArray: '5, 5'
            }).addTo(map);
        }

        // Place or update the black point at the end of refLocationCoords and fill it
        if (refLocationMarker) {
            refLocationMarker.setLatLng(refLocationCoords);
        } else {
            refLocationMarker = L.marker(refLocationCoords, {
                icon: targetIcon
            }).addTo(map);
        }

        boatMarker.getPopup().setContent(`<b>Boat Location</b><br>Latitude: ${latitude}<br>Longitude: ${longitude}`);
    }

    await updateBoatPosition();
    setInterval(updateBoatPosition, 500);
}
