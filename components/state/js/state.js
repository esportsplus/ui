let classname = '--active';


function shared(elements, filter, key, state) {
    if (!elements) {
        return;
    }
    else if (!Array.isArray(elements)) {
        elements = [elements];
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        if (!filter || filter(elements[i])) {
            elements[i].classList[key](classname);
        }
    }
}


const activate = (elements, filter) => {
    shared(elements, filter, 'add', 'activated');
};

const active = (element) => {
    return element && element.classList.contains(classname);
};

const deactivate = (elements, filter) => {
    shared(elements, filter, 'remove', 'deactivated');
};

const toggle = (elements, filter) => {
    shared(elements, filter, 'toggle', 'toggled');
};


export default Object.freeze({ active, activate, deactivate, toggle });
