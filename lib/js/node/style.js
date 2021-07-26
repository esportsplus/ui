const style = (elements, style) => {
    if (!elements || !style) {
        return;
    }
    else if (!Array.isArray(elements)) {
        elements = [elements];
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        let assign = {},
            current = elements[i].style;

        for (let key in style) {
            if (current[key] === style[key]) {
                continue;
            }

            assign[key] = style[key];
        }

        if (Object.keys(assign).length) {
            Object.assign(current, assign);
        }
    }
};


export default style;
