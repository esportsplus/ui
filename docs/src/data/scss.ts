type Node = Record<string, string | Record<string, string>>;


const fontSources = import.meta.glob('/src/fonts/*/scss/index.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

const rootSource = (import.meta.glob('/src/components/root/scss/variables.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>)['/src/components/root/scss/variables.scss'] ?? '';

const themeSources = import.meta.glob('/src/themes/*/*/scss/index.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

const tokenSources = import.meta.glob('/src/tokens/scss/*.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;


function basename(path: string, from: string) {
    let match = path.match(new RegExp(`/${from}/([^/]+)/`));

    return match ? match[1] : path;
}

function block(scss: string, name: string) {
    let start = scss.indexOf('$' + name + ':');

    if (start === -1) {
        return null;
    }

    let open = scss.indexOf('(', start);

    if (open === -1) {
        return null;
    }

    let depth = 0;

    for (let i = open, n = scss.length; i < n; i++) {
        let character = scss[i];

        if (character === '(') {
            depth++;
        }
        else if (character === ')') {
            depth--;

            if (depth === 0) {
                return scss.slice(open + 1, i);
            }
        }
    }

    return null;
}

function pairs(body: string) {
    let depth = 0,
        interpolationDepth = 0,
        key = '',
        mode: 'key' | 'value' = 'key',
        out: [string, string][] = [],
        value = '';

    let flush = () => {
        let k = unquote(key.trim());

        if (k !== '') {
            out.push([k, value.trim()]);
        }

        key = '';
        mode = 'key';
        value = '';
    };

    for (let i = 0, n = body.length; i < n; i++) {
        let character = body[i];

        if (character === '(') {
            depth++;
        }
        else if (character === ')') {
            depth--;
        }

        // Commas inside Sass interpolation belong to the value, not the map.
        if (character === '{') {
            interpolationDepth++;
        }
        else if (character === '}') {
            interpolationDepth--;
        }

        if (depth === 0 && interpolationDepth === 0 && character === ':' && mode === 'key') {
            mode = 'value';
            continue;
        }

        if (depth === 0 && interpolationDepth === 0 && character === ',' && mode === 'value') {
            flush();
            continue;
        }

        if (mode === 'key') {
            key += character;
        }
        else {
            value += character;
        }
    }

    flush();

    return out;
}

function unquote(value: string) {
    return value.replace(/^['"]|['"]$/g, '');
}


const cssValue = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const fonts = () => Object.entries(fontSources).map(([path, source]) => ({
    name: basename(path, 'fonts'),
    source
}));

const map = (scss: string, name: string): Node | null => {
    let body = block(scss, name);

    if (body === null) {
        return null;
    }

    let out: Node = {};

    for (let [key, value] of pairs(body)) {
        if (value.startsWith('(')) {
            out[key] = Object.fromEntries(pairs(value.slice(1, -1)));
        }
        else {
            out[key] = value;
        }
    }

    return out;
};

const themes = () => Object.entries(themeSources).map(([path, source]) => ({
    component: basename(path, path.includes('/dark/') ? 'dark' : 'light'),
    source,
    theme: path.includes('/dark/') ? 'dark' : 'light'
}));


export { cssValue, fonts, map, rootSource, themes, tokenSources };
export type { Node };
