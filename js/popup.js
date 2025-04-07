// popup.js - Handles the Popup Display

function createPopup(map) {
    map.on('dblclick', function (e) {
        const popup = L.popup()
            .setLatLng(e.latlng)
            .setContent(`
                <div style="padding: 5px;">
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                        justify-items: center;
                    ">
                        <!-- Button 1: Pin Icon -->
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <button id="pinButton" style="
                                border: none;
                                border-radius: 50%;
                                width: 40px;
                                height: 40px;
                                cursor: pointer;
                                background-color: #007bff;
                                color: white;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 18px;
                            ">
                                <i class="fa fa-map-pin"></i>
                            </button>
                            <span style="margin-top: 5px; font-size: 12px; color: #007bff;">New</span>
                        </div>

                        <!-- Button 2: Plus Icon -->
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <button id="addButton" style="
                                border: none;
                                border-radius: 50%;
                                width: 40px;
                                height: 40px;
                                cursor: pointer;
                                background-color: #28a745;
                                color: white;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 18px;
                            ">
                                <i class="fa fa-plus"></i>
                            </button>
                            <span style="margin-top: 5px; font-size: 12px; color: #28a745;">Add</span>
                        </div>
                    </div>

                    <!-- Toggle Switch -->
                    <div style="
                        margin-top: 15px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    ">
                        <label style="font-size: 12px; margin-bottom: 5px;">Auto Route</label>
                        <label class="switch">
                            <input type="checkbox" id="modeToggle" ${autoRoute ? 'checked' : ''} ">
                            <span class="slider"></span>
                        </label>
                    </div>
                    
                    <style>
                        .switch {
                            position: relative;
                            display: inline-block;
                            width: 50px;
                            height: 24px;
                        }

                        .switch input {
                            opacity: 0;
                            width: 0;
                            height: 0;
                        }

                        .slider {
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: #ccc;
                            transition: .4s;
                            border-radius: 24px;
                        }

                        .slider:before {
                            position: absolute;
                            content: "";
                            height: 20px;
                            width: 20px;
                            left: 2px;
                            bottom: 2px;
                            background-color: white;
                            transition: .4s;
                            border-radius: 50%;
                        }

                        input:checked + .slider {
                            background-color: #28a745;
                        }

                        input:checked + .slider:before {
                            transform: translateX(26px);
                        }
                    </style>
                </div>
            `)
            .openOn(map);


        document.getElementById('addButton').addEventListener('click', () => {
            addPointToRoute(e.latlng, map, autoRoute); // Pass autoRoute state
            map.closePopup();  // Close the popup
        });

        document.getElementById('pinButton').addEventListener('click', () => {
            newRoute(e.latlng, map, autoRoute); // Pass autoRoute state
            map.closePopup();  // Close the popup
        });

        // Toggle switch event listener
        document.getElementById('modeToggle').addEventListener('change', function () {
            autoRoute = this.checked;
            setStoredBoolean('autoRoute', autoRoute); // Store the new state in localStorage
        });
    });
}