const FollowBoatControl = function () {};

FollowBoatControl.prototype.onAdd = function (map) {
    this._map = map;

    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Follow boat';

    button.innerHTML = `
        <svg width='18' height='18' viewBox='0 0 24 24' fill='none'
            stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
            <circle cx='12' cy='12' r='7'></circle>
            <circle cx='12' cy='12' r='2'></circle>
            <line x1='12' y1='1' x2='12' y2='5'></line>
            <line x1='12' y1='19' x2='12' y2='23'></line>
            <line x1='1' y1='12' x2='5' y2='12'></line>
            <line x1='19' y1='12' x2='23' y2='12'></line>
        </svg>
    `;

    button.onclick = () => {
        followBoat = !followBoat;
        setStoredBoolean('followBoat', followBoat);
        button.classList.toggle('activeFollowBoat', followBoat);

        if (!followBoat) {
            followHeading = false;
            setStoredBoolean('followHeading', followHeading);

            const headingBtn = document.querySelector('.mapboxgl-ctrl-group button.activeFollowHeading');
            if (headingBtn) {
                headingBtn.classList.remove('activeFollowHeading');
            }
        }
    };

    container.appendChild(button);
    return container;
};

FollowBoatControl.prototype.onRemove = function () {
    this._map = undefined;
};
