const text = (elements, text) => {
    if (!elements) {
        return;
    }
    else if (!Array.isArray(elements)) {
        elements = [elements];
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        if (elements[i].text !== text) {
            elements[i].textContent = text;
        }
    }
};


export default text;
