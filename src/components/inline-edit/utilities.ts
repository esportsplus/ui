const PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);


function safe(href: string) {
    try {
        return PROTOCOLS.has(new URL(href, location.href).protocol);
    }
    catch {
        return false;
    }
}


export { safe };
