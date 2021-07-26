const siblings = (element, filter) => {
    let filtered = [],
        siblings = Array.from(element.parentNode.children);

    siblings.splice(siblings.indexOf(element), 1);

    if (filter) {
        for (let i = 0, n = siblings.length; i < n; i++) {
            let sibling = siblings[i];

            if (filter(sibling)) {
                filtered.push(sibling);
            }
        }
    }

    return filter ? filtered : siblings;
};


export default siblings;
