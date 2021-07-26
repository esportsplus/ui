let parser = new DOMParser();


function createFragment() {
    return document.createDocumentFragment();
}


const html = (string) => {
    let children = Array.from( parser.parseFromString(string, 'text/html').body.children ),
        fragment = createFragment();

    for (let i = 0, n = children.length; i < n; i++) {
        fragment.append(children[i]);
    }

    return fragment;
};


export default html;
