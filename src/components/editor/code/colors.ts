import type { Language, Token } from './syntax';


// A CSS color literal within a line; 'value' is its text.
type ColorLiteral = { from: number; to: number; value: string };

type Rgba = { a: number; b: number; g: number; r: number };


const FUNCTIONS = new Set(['color', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'rgb', 'rgba']);

// Arguments are kept to characters a style attribute can hold as is.
const FUNCTION = /\b(?:rgba?|hsla?|hwb|oklab|oklch|lab|lch)\([\w\s.,%/+-]*\)/gi;

// A color function token's arguments, held to the same characters: the literal ends up in a style attribute.
const FUNCTION_ARGUMENTS = /^\([\w\s.,%/+-]*\)$/;

const HEX = /(?<![\w&#$])#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])/gi;

const HEX_VALUE = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

const NAMED = new Set((
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
    'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen'
).split(' '));

// A named color right after a property's colon, inside an HTML attribute.
const STYLE_NAMED = /:\s*([a-z]+)\b/gi;


function alpha(value: string | undefined) {
    if (value === undefined || value === 'none') {
        return 1;
    }

    return clampUnit(value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value));
}

function channel(value: string) {
    if (value === 'none') {
        return 0;
    }

    return Math.round(Math.min(255, Math.max(0, value.endsWith('%') ? parseFloat(value) * 2.55 : parseFloat(value))));
}

function clampUnit(value: number) {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

function degrees(value: string) {
    let number = parseFloat(value);

    if (value.endsWith('turn')) {
        return number * 360;
    }

    if (value.endsWith('grad')) {
        return number * 0.9;
    }

    if (value.endsWith('rad')) {
        return (number * 180) / Math.PI;
    }

    return number;
}

function hex(color: Rgba) {
    let pair = (n: number) => n.toString(16).padStart(2, '0'),
        a = Math.round(color.a * 255);

    return ('#' + pair(color.r) + pair(color.g) + pair(color.b) + (a < 255 ? pair(a) : '')).toUpperCase();
}

function hsl(color: Rgba) {
    let r = color.r / 255,
        g = color.g / 255,
        b = color.b / 255,
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        l = (max + min) / 2,
        d = max - min,
        h = 0,
        s = 0;

    if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
    }

    return { h: Math.round(h), l: Math.round(l * 100), s: Math.round(s * 100) };
}

function parseHex(value: string): Rgba | null {
    if (!HEX_VALUE.test(value)) {
        return null;
    }

    let digits = value.slice(1),
        full = digits.length <= 4 ? [...digits].map((c) => c + c).join('') : digits,
        byte = (i: number) => parseInt(full.slice(i, i + 2), 16);

    return { a: full.length === 8 ? byte(6) / 255 : 1, b: byte(4), g: byte(2), r: byte(0) };
}

function parts(literal: string) {
    let open = literal.indexOf('(');

    return literal.slice(open + 1, -1).trim().split(/\s*[\s,/]\s*/).filter(Boolean);
}

function round(value: number) {
    return Number(value.toFixed(2));
}

// Literals inside one string token, found by pattern.
function scan(text: string, from: number, to: number, named: boolean, out: ColorLiteral[]) {
    let slice = text.slice(from, to);

    if (slice.indexOf('#') !== -1) {
        HEX.lastIndex = 0;

        for (let match = HEX.exec(slice); match; match = HEX.exec(slice)) {
            out.push({ from: from + match.index, to: from + match.index + match[0].length, value: match[0] });
        }
    }

    if (slice.indexOf('(') !== -1) {
        FUNCTION.lastIndex = 0;

        for (let match = FUNCTION.exec(slice); match; match = FUNCTION.exec(slice)) {
            out.push({ from: from + match.index, to: from + match.index + match[0].length, value: match[0] });
        }
    }

    if (named && slice.indexOf(':') !== -1) {
        STYLE_NAMED.lastIndex = 0;

        for (let match = STYLE_NAMED.exec(slice); match; match = STYLE_NAMED.exec(slice)) {
            if (NAMED.has(match[1].toLowerCase())) {
                let start = from + match.index + match[0].length - match[1].length;

                out.push({ from: start, to: start + match[1].length, value: match[1] });
            }
        }
    }
}


// The color literals of a line, given its tokens: CSS values in stylesheets (and styles embedded in HTML), and hex or
// color functions in any string literal.
const colorLiterals = (text: string, tokens: readonly Token[], language: Language): ColorLiteral[] => {
    let out: ColorLiteral[] = [],
        stylesheet = language === 'css' || language === 'scss' || language === 'html';

    for (let i = 0, n = tokens.length; i < n; i++) {
        let { from, kind, to } = tokens[i];

        if (kind === 'color') {
            let value = text.slice(from, to);

            if (HEX_VALUE.test(value)) {
                out.push({ from, to, value });
            }
        }
        else if (kind === 'string') {
            scan(text, from, to, language === 'html', out);
        }
        else if (stylesheet && kind === 'keyword') {
            let value = text.slice(from, to);

            if (NAMED.has(value.toLowerCase()) && text[from - 1] !== '-' && text[to] !== '-') {
                out.push({ from, to, value });
            }
        }
        else if (stylesheet && kind === 'function' && text[to] === '(' && FUNCTIONS.has(text.slice(from, to).toLowerCase())) {
            let close = text.indexOf(')', to),
                nested = text.indexOf('(', to + 1);

            if (close !== -1 && (nested === -1 || nested > close) && FUNCTION_ARGUMENTS.test(text.slice(to, close + 1))) {
                out.push({ from, to: close + 1, value: text.slice(from, close + 1) });
            }
        }
    }

    return out.sort((a, b) => a.from - b.from);
};

// A picked hex color written in the literal's own notation where it has one: hex keeps its case, rgb() and hsl()
// keep commas or spaces; any other notation becomes hex.
const formatColor = (literal: string, value: string) => {
    let color = parseHex(value);

    if (!color) {
        return literal;
    }

    if (literal.startsWith('#')) {
        let out = hex(color);

        return literal === literal.toLowerCase() ? out.toLowerCase() : out;
    }

    let name = literal.slice(0, Math.max(0, literal.indexOf('('))).toLowerCase(),
        comma = literal.includes(','),
        a = round(color.a);

    if (name === 'rgb' || name === 'rgba') {
        if (comma) {
            return a < 1 || name === 'rgba' ? `rgba(${color.r}, ${color.g}, ${color.b}, ${a})` : `rgb(${color.r}, ${color.g}, ${color.b})`;
        }

        return `${name}(${color.r} ${color.g} ${color.b}${a < 1 ? ` / ${a}` : ''})`;
    }

    if (name === 'hsl' || name === 'hsla') {
        let { h, l, s } = hsl(color);

        if (comma) {
            return a < 1 || name === 'hsla' ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;
        }

        return `${name}(${h} ${s}% ${l}%${a < 1 ? ` / ${a}` : ''})`;
    }

    return hex(color);
};

// Hex, rgb() and hsl() literals as '#RRGGBB' or '#RRGGBBAA'; null for notations that need the browser to resolve.
const toHex = (literal: string) => {
    let value = literal.trim();

    if (value.startsWith('#')) {
        let color = parseHex(value);

        return color ? hex(color) : null;
    }

    let name = value.slice(0, Math.max(0, value.indexOf('('))).toLowerCase(),
        args = parts(value);

    if ((name === 'rgb' || name === 'rgba') && args.length >= 3) {
        return hex({ a: alpha(args[3]), b: channel(args[2]), g: channel(args[1]), r: channel(args[0]) });
    }

    if ((name === 'hsl' || name === 'hsla') && args.length >= 3) {
        let h = ((degrees(args[0]) % 360) + 360) % 360,
            s = clampUnit(parseFloat(args[1]) / 100),
            l = clampUnit(parseFloat(args[2]) / 100),
            f = (n: number) => {
                let k = (n + h / 30) % 12;

                return Math.round((l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
            };

        return hex({ a: alpha(args[3]), b: f(4), g: f(8), r: f(0) });
    }

    return null;
};


export { colorLiterals, formatColor, toHex };
export type { ColorLiteral };
