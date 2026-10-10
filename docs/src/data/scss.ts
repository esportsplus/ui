type Node = Record<string, string | Record<string, string>>;

type Tree = { [key: string]: string | Tree };


// Sass line comments, which would otherwise read as part of the next key.
const LINE_COMMENT = /\/\/[^\n]*/g;

// A palette reference in '$themes'.
const PALETTE_REFERENCE = /^map\.get\(\$color,\s*'([^']+)'\)$/;

const SURROUNDING_QUOTES = /^['"]|['"]$/g;

// The weights the root derives from every palette color and weighted theme role.
const WEIGHTS = ['300', '400', '500'];

// Theme roles written as one color that the theme weights; the rest stay single colors.
const WEIGHTED_ROLES = ['primary', 'text'];

const fontSources = import.meta.glob('../../../src/css-utilities/font/*/*.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>;

const tokenSources = Object.fromEntries(
    Object.entries(import.meta.glob('../../../src/tokens/scss/*.scss', { eager: true, import: 'default', query: '?raw' }) as Record<string, string>)
        .map(([path, source]) => [path.slice(path.lastIndexOf('/') + 1, -'.scss'.length), source])
);


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

function nest(body: string): Tree {
    let out: Tree = {};

    for (let [key, value] of pairs(body)) {
        out[key] = value.startsWith('(') ? nest(value.slice(1, -1)) : value;
    }

    return out;
}

function unquote(value: string) {
    return value.replace(SURROUNDING_QUOTES, '');
}


const cssValue = (name: string) => getComputedStyle(document.body).getPropertyValue(name).trim();

// One source per family, its index first, so a face kept in a partial still lists after the family's own.
const fonts = () => {
    let grouped = new Map<string, string[]>();

    for (let path of Object.keys(fontSources).sort((a, b) => Number(b.endsWith('/index.scss')) - Number(a.endsWith('/index.scss')) || a.localeCompare(b))) {
        let dir = path.slice(0, path.lastIndexOf('/')),
            group = grouped.get(dir) ?? [];

        group.push(fontSources[path]);
        grouped.set(dir, group);
    }

    return Array.from(grouped.values(), (sources) => ({ source: sources.join('\n') }));
};

const map = (scss: string | undefined, name: string): Node | null => {
    if (scss === undefined) {
        return null;
    }

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

// '$themes' read as mode, then role, then the role's one color. Palette references read as the palette's variables, and
// a weighted role lists the weights the theme derives from its color.
const themes = (scss: string | undefined) => {
    let out = tree(scss, 'themes') as Record<string, Record<string, Record<string, string> | string>>;

    for (let roles of Object.values(out)) {
        for (let [role, value] of Object.entries(roles)) {
            if (typeof value !== 'string') {
                continue;
            }

            let match = value.match(PALETTE_REFERENCE),
                written = match ? `var(--color-${match[1]})` : value;

            roles[role] = WEIGHTED_ROLES.includes(role)
                ? Object.fromEntries(WEIGHTS.map((weight) => [weight, weight === '400' ? written : `derived from ${role}`]))
                : written;
        }
    }

    return out;
};

// A mode's theme variables: one per weight, or the role's own name when it is a single color.
const themeTokens = (roles: Record<string, Record<string, string> | string>) => Object.entries(roles).flatMap(([role, value]) =>
    typeof value === 'string'
        ? [{ name: `--color-${role}`, role, value, weight: '' }]
        : Object.entries(value).map(([weight, written]) => ({ name: `--color-${role}-${weight}`, role, value: written, weight }))
);

// A map read to any depth.
const tree = (scss: string | undefined, name: string) => {
    let body = scss === undefined ? null : block(scss, name);

    return body === null ? {} : nest(body.replace(LINE_COMMENT, ''));
};


export { cssValue, fonts, map, themes, themeTokens, tokenSources, WEIGHTS };
