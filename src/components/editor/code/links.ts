// A link within a line.
type Link = { from: number; to: number; url: string };


// Relative paths open only through a handler that knows where they lead.
const PATH = /(?<![\w./-])\.{1,2}\/[\w@.~+/-]*[\w@~+/-]/g;

const TRAILING = /[.,;:!?'"]+$/;

const URL_PATTERN = /\b(?:https?:\/\/|file:\/\/)[^\s<>"'`]+/gi;


// The links of a line: web URLs, and with 'local' also file URLs and relative paths. Punctuation ending a sentence, and
// a closing bracket the link didn't open, are left out.
const linksIn = (text: string, local: boolean): Link[] => {
    let out: Link[] = [];

    if (text.indexOf('://') !== -1) {
        URL_PATTERN.lastIndex = 0;

        for (let match = URL_PATTERN.exec(text); match; match = URL_PATTERN.exec(text)) {
            let url = match[0].replace(TRAILING, '');

            for (let [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
                while (url.endsWith(close) && url.split(open).length < url.split(close).length) {
                    url = url.slice(0, -1).replace(TRAILING, '');
                }
            }

            if (!local && url.slice(0, 7).toLowerCase() === 'file://') {
                continue;
            }

            out.push({ from: match.index, to: match.index + url.length, url });
        }
    }

    if (local && text.indexOf('./') !== -1) {
        PATH.lastIndex = 0;

        for (let match = PATH.exec(text); match; match = PATH.exec(text)) {
            let at = match.index;

            if (!out.some((link) => at >= link.from && at < link.to)) {
                out.push({ from: at, to: at + match[0].length, url: match[0] });
            }
        }
    }

    return out.sort((a, b) => a.from - b.from);
};


export { linksIn };
export type { Link };
