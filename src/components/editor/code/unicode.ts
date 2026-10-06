// A character worth a warning: invisible, a bidirectional control, or a letter passing for ASCII.
type Suspect = { code: number; from: number; kind: 'bidi' | 'confusable' | 'invisible'; to: number };


const ASCII = /^[\x00-\x7f]*$/;

const BIDI: Record<number, string> = {
    0x061c: 'arabic letter mark',
    0x200e: 'left-to-right mark',
    0x200f: 'right-to-left mark',
    0x202a: 'left-to-right embedding',
    0x202b: 'right-to-left embedding',
    0x202c: 'pop directional formatting',
    0x202d: 'left-to-right override',
    0x202e: 'right-to-left override',
    0x2066: 'left-to-right isolate',
    0x2067: 'right-to-left isolate',
    0x2068: 'first strong isolate',
    0x2069: 'pop directional isolate'
};

// Letters from other scripts drawn like an ASCII letter, with the letter they pass for.
const CONFUSABLES: Record<number, string> = {
    0x0391: 'A', 0x0392: 'B', 0x0395: 'E', 0x0396: 'Z', 0x0397: 'H', 0x0399: 'I', 0x039a: 'K', 0x039c: 'M',
    0x039d: 'N', 0x039f: 'O', 0x03a1: 'P', 0x03a4: 'T', 0x03a5: 'Y', 0x03a7: 'X', 0x03bf: 'o', 0x03c1: 'p',
    0x0405: 'S', 0x0406: 'I', 0x0408: 'J', 0x0410: 'A', 0x0412: 'B', 0x0415: 'E', 0x041a: 'K', 0x041c: 'M',
    0x041d: 'H', 0x041e: 'O', 0x0420: 'P', 0x0421: 'C', 0x0422: 'T', 0x0425: 'X', 0x0430: 'a', 0x0435: 'e',
    0x043e: 'o', 0x0440: 'p', 0x0441: 'c', 0x0443: 'y', 0x0445: 'x', 0x0455: 's', 0x0456: 'i', 0x0458: 'j',
    0x04bb: 'h', 0x04cf: 'l', 0x0501: 'd', 0x051b: 'q', 0x051d: 'w'
};

const IDENTIFIER = /[\p{L}\p{N}_$]+/gu;

const INVISIBLE: Record<number, string> = {
    0x00a0: 'no-break space',
    0x00ad: 'soft hyphen',
    0x034f: 'combining grapheme joiner',
    0x115f: 'hangul choseong filler',
    0x1160: 'hangul jungseong filler',
    0x180e: 'mongolian vowel separator',
    0x2000: 'en quad',
    0x2001: 'em quad',
    0x2002: 'en space',
    0x2003: 'em space',
    0x2004: 'three-per-em space',
    0x2005: 'four-per-em space',
    0x2006: 'six-per-em space',
    0x2007: 'figure space',
    0x2008: 'punctuation space',
    0x2009: 'thin space',
    0x200a: 'hair space',
    0x200b: 'zero width space',
    0x200c: 'zero width non-joiner',
    0x200d: 'zero width joiner',
    0x2028: 'line separator',
    0x2029: 'paragraph separator',
    0x202f: 'narrow no-break space',
    0x205f: 'medium mathematical space',
    0x2060: 'word joiner',
    0x2061: 'function application',
    0x2062: 'invisible times',
    0x2063: 'invisible separator',
    0x2064: 'invisible plus',
    0x3000: 'ideographic space',
    0x3164: 'hangul filler',
    0xfeff: 'zero width no-break space',
    0xffa0: 'halfwidth hangul filler'
};


function hex(code: number) {
    return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}


// What a suspect character is, for its hover.
const describeSuspect = (suspect: Pick<Suspect, 'code' | 'kind'>) => {
    let { code, kind } = suspect;

    if (kind === 'bidi') {
        return `${hex(code)} ${BIDI[code] ?? 'bidirectional control'}: a bidirectional control character, which can make the text read in a different order than it runs.`;
    }

    if (kind === 'invisible') {
        return `${hex(code)} ${INVISIBLE[code] ?? 'invisible character'}: an invisible character.`;
    }

    let script = code >= 0x0370 && code <= 0x03ff ? 'Greek' : code >= 0x0400 && code <= 0x052f ? 'Cyrillic' : 'non-ASCII';

    return `${hex(code)} ${String.fromCodePoint(code)}: a ${script} letter that looks like the ASCII '${CONFUSABLES[code] ?? '?'}'.`;
};

// The suspect characters of a line, in order. Confusables only count in an identifier that is otherwise ASCII, so text
// written in another script stays quiet.
const suspects = (text: string): Suspect[] => {
    let out: Suspect[] = [];

    if (ASCII.test(text)) {
        return out;
    }

    for (let i = 0, n = text.length; i < n; i++) {
        let code = text.charCodeAt(i);

        if (code < 0x80) {
            continue;
        }

        if (code in INVISIBLE) {
            out.push({ code, from: i, kind: 'invisible', to: i + 1 });
        }
        else if (code in BIDI) {
            out.push({ code, from: i, kind: 'bidi', to: i + 1 });
        }
    }

    IDENTIFIER.lastIndex = 0;

    for (let match = IDENTIFIER.exec(text); match; match = IDENTIFIER.exec(text)) {
        let word = match[0],
            ascii = false,
            found: number[] = [],
            foreign = false;

        for (let i = 0, n = word.length; i < n; i++) {
            let code = word.charCodeAt(i);

            if (code < 0x80) {
                ascii ||= (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
            }
            else if (code in CONFUSABLES) {
                found.push(i);
            }
            else {
                foreign = true;
                break;
            }
        }

        if (!ascii || foreign) {
            continue;
        }

        for (let i = 0, n = found.length; i < n; i++) {
            let from = match.index + found[i];

            out.push({ code: text.charCodeAt(from), from, kind: 'confusable', to: from + 1 });
        }
    }

    return out.sort((a, b) => a.from - b.from);
};


export { describeSuspect, suspects };
export type { Suspect };
