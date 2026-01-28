(() => {
    let timeSinceLastClickOnMap = 0;

    const buildPopupEl = (autoRouteValue) => {
        const root = document.createElement('div');
        root.style.padding = '5px';

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gap = '10px';
        grid.style.justifyItems = 'center';

        const mkBtn = ({ id, bg, iconClass, label, labelColor }) => {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.alignItems = 'center';

            const btn = document.createElement('button');
            btn.id = id;
            btn.type = 'button';
            btn.style.border = 'none';
            btn.style.borderRadius = '50%';
            btn.style.width = '40px';
            btn.style.height = '40px';
            btn.style.cursor = 'pointer';
            btn.style.backgroundColor = bg;
            btn.style.color = 'white';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.fontSize = '18px';

            const icon = document.createElement('i');
            icon.className = iconClass;
            btn.appendChild(icon);

            const text = document.createElement('span');
            text.textContent = label;
            text.style.marginTop = '5px';
            text.style.fontSize = '12px';
            text.style.color = labelColor;

            wrap.appendChild(btn);
            wrap.appendChild(text);
            return wrap;
        };

        grid.appendChild(mkBtn({ id: 'pinButton', bg: '#007bff', iconClass: 'fa fa-map-pin', label: 'New', labelColor: '#007bff' }));
        grid.appendChild(mkBtn({ id: 'addButton', bg: '#28a745', iconClass: 'fa fa-plus', label: 'Add', labelColor: '#28a745' }));
        root.appendChild(grid);

        const toggleWrap = document.createElement('div');
        toggleWrap.style.marginTop = '15px';
        toggleWrap.style.display = 'flex';
        toggleWrap.style.flexDirection = 'column';
        toggleWrap.style.alignItems = 'center';

        const toggleLabel = document.createElement('label');
        toggleLabel.textContent = 'Auto Route';
        toggleLabel.style.fontSize = '12px';
        toggleLabel.style.marginBottom = '5px';

        const switchLabel = document.createElement('label');
        switchLabel.className = 'switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'modeToggle';
        input.checked = Boolean(autoRouteValue);

        const slider = document.createElement('span');
        slider.className = 'slider';

        switchLabel.appendChild(input);
        switchLabel.appendChild(slider);

        const style = document.createElement('style');
        style.textContent = `
            .switch { position: relative; display: inline-block; width: 50px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
            .slider:before { position: absolute; content: ''; height: 20px; width: 20px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
            .switch input:checked + .slider { background-color: #28a745; }
            .switch input:checked + .slider:before { transform: translateX(26px); }
        `;

        toggleWrap.appendChild(toggleLabel);
        toggleWrap.appendChild(switchLabel);
        toggleWrap.appendChild(style);
        root.appendChild(toggleWrap);

        return root;
    };

    const popPopup = (map, routeApi, lngLat) => {
        const el = buildPopupEl(autoRoute);

        const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: true, offset: 12 })
            .setLngLat(lngLat)
            .setDOMContent(el)
            .addTo(map);

        const latlng = { lat: lngLat.lat, lng: lngLat.lng };

        const addBtn = el.querySelector('#addButton');
        const pinBtn = el.querySelector('#pinButton');
        const toggle = el.querySelector('#modeToggle');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                routeApi.addPointToRoute(latlng, autoRoute);
                popup.remove();
            });
        }

        if (pinBtn) {
            pinBtn.addEventListener('click', () => {
                routeApi.newRoute(latlng, autoRoute);
                popup.remove();
            });
        }

        if (toggle) {
            toggle.addEventListener('change', (ev) => {
                autoRoute = Boolean(ev.target.checked);
                setStoredBoolean('autoRoute', autoRoute);
            });
        }
    };

    function createPopup(map, routeApi) {
        if (!routeApi || typeof routeApi.newRoute !== 'function' || typeof routeApi.addPointToRoute !== 'function') {
            throw new Error('createPopup(map, routeApi) requires the route API returned by initializeRoute(map).');
        }

        if (typeof isPhone === 'function' && isPhone()) {
            map.on('click', (e) => {
                if (Date.now() - timeSinceLastClickOnMap < 200) {
                    popPopup(map, routeApi, e.lngLat);
                }
                timeSinceLastClickOnMap = Date.now();
            });
        }

        map.on('dblclick', (e) => {
            popPopup(map, routeApi, e.lngLat);
        });
    }

    window.createPopup = createPopup;
})();
