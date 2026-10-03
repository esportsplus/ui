import { glob } from 'glob';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import autoprefixer from 'autoprefixer';
import shelljs from 'shelljs';


const BACKSLASHES = /\\/g;


// Every stylesheet compiled from the library's source sits in the cascade layer its top-level folder names, in the
// order 'layer.scss' declares. Wrapped as it compiles rather than once bundled, so the docs, which build from source,
// layer exactly as the published files do; their own styles, outside it, stay unlayered and override the library.
const LAYERS = ['components', 'css-utilities', 'normalize', 'themes'];

// Minification only keeps '/*! ... */' license comments at the top level, so they stay outside the layer.
const LICENSE = /^(?:\s*\/\*![\s\S]*?\*\/)+/;

// These imports get the file's source or address as a module (the docs show source with '?raw'), not compiled CSS.
const NOT_CSS = /[?&](?:raw|sharedworker|url|worker)\b/;

const SOURCE = resolve(import.meta.dirname, 'src').replace(BACKSLASHES, '/') + '/';


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
            outDir: 'build',
            rollupOptions: {
                input: [
                    ...glob.sync('./src/normalize/scss/index.scss'),
                    ...glob.sync('./src/{components,css-utilities,themes/dark,themes/light}/*/scss/index.scss'),
                    ...glob.sync('./src/css-utilities/font/*/scss/index.scss'),
                    ...glob.sync('./src/css-utilities/index.scss')
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
            postcss: {
                plugins: [
                    autoprefixer()
                ]
            },
            transformer: 'lightningcss'
        },
        plugins: [
            layers
        ]
    };
});


export { layers };
