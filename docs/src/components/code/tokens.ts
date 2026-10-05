type Token = { kind: string; text: string };


const CALL = /\s*\(/y;

const KEYWORDS = new Set([
    'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
    'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in',
    'instanceof', 'interface', 'keyof', 'let', 'new', 'of', 'private', 'protected',
    'public', 'readonly', 'return', 'satisfies', 'static', 'switch', 'throw', 'try',
    'type', 'typeof', 'var', 'void', 'while', 'yield'
]);

const VALUES = new Set(['true', 'false', 'null', 'undefined', 'this', 'super']);

// Keep comments and strings intact, and preserve every source character as text.
const PATTERN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:n)?\b|[a-zA-Z_$][\w$]*|[{}()[\];,.?:]|[+*/%=!<>|&~^-]+/g;


function call(source: string, index: number) {
    CALL.lastIndex = index;

    return CALL.test(source);
}


const tokenize = (source: string): Token[] => {
    let tokens: Token[] = [],
        end = 0;

    for (let match of source.matchAll(PATTERN)) {
        let text = match[0],
            kind = '';

        if (match.index > end) {
            tokens.push({ kind: '', text: source.slice(end, match.index) });
        }

        if (text.startsWith('//') || text.startsWith('/*')) {
            kind = 'comment';
        }
        else if (/^['"`]/.test(text)) {
            kind = 'string';
        }
        else if (KEYWORDS.has(text)) {
            kind = 'keyword';
        }
        else if (VALUES.has(text) || /^\d/.test(text)) {
            kind = 'value';
        }
        else if (/^[a-zA-Z_$]/.test(text) && call(source, match.index + text.length)) {
            kind = 'function';
        }
        else if (/^[{}()[\];,.?:+*/%=!<>|&~^-]/.test(text)) {
            kind = 'punctuation';
        }

        tokens.push({ kind, text });
        end = match.index + text.length;
    }

    if (end < source.length) {
        tokens.push({ kind: '', text: source.slice(end) });
    }

    return tokens;
};


export { tokenize };
