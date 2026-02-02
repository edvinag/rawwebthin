const FollowBoatHeadingControl = function () {};

FollowBoatHeadingControl.prototype.onAdd = function (map) {
    this._map = map;

    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Follow boat heading';

    button.innerHTML = `
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none'
            stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
            <polygon points='12 2 19 21 12 17 5 21 12 2'></polygon>
        </svg>
    `;

    const updateState = () => {
        button.classList.toggle('activeFollowHeading', followHeading);
    };

    button.onclick = () => {
        if (followHeading) {
            followHeading = false;
        } else {
            followBoat = true;
            followHeading = true;
        }

        setStoredBoolean('followBoat', followBoat);
        setStoredBoolean('followHeading', followHeading);

        const boatBtn = document.querySelector('.mapboxgl-ctrl-group button[title="Follow boat"]');
        if (boatBtn) {
            boatBtn.classList.toggle('activeFollowBoat', followBoat);
        }

        updateState();
    };

    updateState();

    container.appendChild(button);
    return container;
};

FollowBoatHeadingControl.prototype.onRemove = function () {
    this._map = undefined;
};
