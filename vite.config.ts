import { glob } from 'glob';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import autoprefixer from 'autoprefixer';
import shelljs from 'shelljs';
import type { Targets } from 'lightningcss';


const BACKSLASHES = /\\/g;

// The first releases with 'light-dark()', as [major, minor]. Below them Lightning CSS swaps it for variables resolved
// where the theme declares them, on the root, so a nested 'data-theme' could no longer flip its subtree.
const BROWSERS: Record<'chrome' | 'edge' | 'firefox' | 'ios_saf' | 'safari', [number, number]> = {
    chrome: [123, 0],
    edge: [123, 0],
    firefox: [120, 0],
    ios_saf: [17, 5],
    safari: [17, 5]
};

// The same floor in esbuild's form, which Vite minifies CSS to.
const CSS_TARGET = Object.entries(BROWSERS).map(([name, [major, minor]]) => `${name === 'ios_saf' ? 'ios' : name}${major}.${minor}`);

// Lightning CSS packs each version as major << 16 | minor << 8.
const CSS_TARGETS: Targets = Object.fromEntries(
    Object.entries(BROWSERS).map(([name, [major, minor]]) => [name, (major << 16) | (minor << 8)])
);


// Every stylesheet compiled from the library's source sits in the cascade layer its top-level folder names, in the
// order 'layer.scss' declares. Wrapped as it compiles rather than once bundled, so the docs, which build from source,
// layer exactly as the published files do; their own styles, outside it, stay unlayered and override the library.
const LAYERS = ['components', 'modifiers', 'normalize'];

// Minification only keeps '/*! ... */' license comments at the top level, so they stay outside the layer.
const LICENSE = /^(?:\s*\/\*![\s\S]*?\*\/)+/;

// These imports get the file's source or address as a module (the docs show source with '?raw'), not compiled CSS.
const NOT_CSS = /[?&](?:raw|sharedworker|url|worker)\b/;

const SOURCE = resolve(import.meta.dirname, 'src').replace(BACKSLASHES, '/') + '/';

// Stylesheets reach the placeholders as 'css-utilities/<name>'.
const CSS_UTILITIES = { find: /^css-utilities\//, replacement: SOURCE + 'css-utilities/' };


const layers: Plugin = {
    name: '@esportsplus/ui-layers',
    transform(code, id) {
        let path = id.split('?')[0].replace(BACKSLASHES, '/');

        if (!path.endsWith('.scss') || !path.startsWith(SOURCE) || NOT_CSS.test(id)) {
            return;
        }

        let layer = path.slice(SOURCE.length).split('/')[0];

        if (!LAYERS.includes(layer)) {
            return;
        }

        let license = code.match(LICENSE)?.[0] ?? '';

        return { code: `${license}@layer ${layer} {${code.slice(license.length)}}`, map: null };
    }
};


export default defineConfig(() => {
    return {
        base: './',
        build: {
            cssMinify: 'lightningcss',
            cssTarget: CSS_TARGET,
            outDir: 'build',
            rollupOptions: {
                input: [
                    ...glob.sync('./src/normalize/scss/index.scss'),
                    ...glob.sync('./src/{components,modifiers}/*/scss/index.scss')
                ],
                output: {
                    assetFileNames: ({ originalFileNames: [filename] }) => {
                        if (filename) {
                            return filename.split('src/').pop()!;
                        }

                        return '[name].[ext]';
                    },
                },
                plugins: [
                    {
                        name: '@esportsplus/ui-assets-copy',
                        writeBundle() {
                            for (let license of glob.sync('./src/css-utilities/font/*/OFL.txt')) {
                                shelljs.cp(license, license.replace('src', 'build'));
                            }
                        }
                    }
                ]
            }
        },
        css: {
            lightningcss: {
                targets: CSS_TARGETS
            },
            postcss: {
                plugins: [
                    autoprefixer()
                ]
            },
            transformer: 'lightningcss'
        },
        plugins: [ layers ],
        resolve: {
            alias: [ CSS_UTILITIES ]
        }
    };
});


export { CSS_TARGET, CSS_TARGETS, CSS_UTILITIES, layers };
