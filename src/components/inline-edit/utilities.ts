const INLINE_LINE_BREAKS = /\s*\n\s*/g;

const NON_BREAKING_SPACES = / /g;

const PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);


function safe(href: string) {
    try {
        return PROTOCOLS.has(new URL(href, location.href).protocol);
    }
    catch {
        return false;
    }
}


export { INLINE_LINE_BREAKS, NON_BREAKING_SPACES, safe };
