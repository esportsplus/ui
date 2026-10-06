const REGEXP_CHARACTERS = /[$()*+.?[\\\]^{|}]/g;


function escape(text: string) {
    return text.replace(REGEXP_CHARACTERS, '\\$&');
}

// One pattern as an expression: '*' and '?' stay within a path segment, '**' as a whole segment spans any number of
// them, '{a,b}' matches either side.
function source(pattern: string) {
    let depth = 0,
        out = '';

    for (let i = 0, n = pattern.length; i < n; i++) {
        let c = pattern[i];

        if (c === '*') {
            if (pattern[i + 1] !== '*') {
                out += '[^/]*';
                continue;
            }

            let start = i === 0 || pattern[i - 1] === '/';

            i++;

            if (start && i + 1 === n) {
                out += '.*';
            }
            else if (start && pattern[i + 1] === '/') {
                out += '(?:.*/)?';
                i++;
            }
            else {
                out += '[^/]*';
            }
        }
        else if (c === '/' && pattern.slice(i) === '/**') {
            // The folder itself as well as what's inside, so excluding 'dist/**' leaves no empty folder behind.
            out += '(?:/.*)?';
            break;
        }
        else if (c === '?') {
            out += '[^/]';
        }
        else if (c === '{') {
            depth++;
            out += '(?:';
        }
        else if (c === '}' && depth) {
            depth--;
            out += ')';
        }
        else if (c === ',' && depth) {
            out += '|';
        }
        else {
            out += escape(c);
        }
    }

    // An unclosed '{' leaves no alternatives to read, so the pattern is taken as a plain name.
    return depth ? escape(pattern) : out;
}


// A test for paths like 'src/index.ts', true when any pattern matches the whole path; null when there are none.
export default (patterns: string[]) => {
    if (!patterns.length) {
        return null;
    }

    let expression = new RegExp(`^(?:${patterns.map(source).join('|')})$`);

    return (path: string) => expression.test(path);
};
