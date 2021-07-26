import html from './html.js';


const template = (fn, values) => {
    if (typeof fn !== 'function' || !values) {
        return;
    }

    if (!Array.isArray(values)) {
        values = [values];
    }

    let string = '';

    for (let i = 0, n = values.length; i < n; i++) {
        string += fn(values[i]) || '';
    }

    return html(string);
};


export default template;
