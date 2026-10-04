import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';


// Node strips types but resolves specifiers exactly, while the library imports extensionless and through the
// tsconfig aliases. Tests import this first, then load the sources with dynamic 'import()' so the hook applies.
const ROOT = new URL('../', import.meta.url).href;

const ALIASES = [
    ['@esportsplus/ui/components/', new URL('src/components/', ROOT)],
    ['~/', new URL('src/', ROOT)]
];

const EXTENSION = /\.\w+$/;

const RELATIVE = /^\.\.?\//;


function locate(url) {
    for (let suffix of ['.ts', '/index.ts']) {
        let candidate = new URL(url.href + suffix);

        if (existsSync(candidate)) {
            return candidate.href;
        }
    }
}


registerHooks({
    resolve(specifier, context, next) {
        let parent = context.parentURL ?? '';

        if (parent.startsWith(ROOT) && parent.endsWith('.ts')) {
            let url = RELATIVE.test(specifier) ? new URL(specifier, parent) : undefined;

            for (let [alias, target] of ALIASES) {
                if (specifier.startsWith(alias)) {
                    url = new URL(specifier.slice(alias.length), target);
                }
            }

            let href = url && !EXTENSION.test(url.pathname) && locate(url);

            if (href) {
                return next(href, context);
            }
        }

        return next(specifier, context);
    }
});
