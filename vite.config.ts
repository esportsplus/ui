import { glob } from 'glob';
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';


export default defineConfig({
    build: {
        outDir: 'build',
        rollupOptions: {
            input: [
                ...glob.sync('./src/{components,css-utilities,fonts}/*/scss/index.scss'),
                ...glob.sync('./src/normalize/scss/index.scss')
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
                    name: '@esportsplus/ui-layers',
                    generateBundle(_, bundle) {
                        for (let filename in bundle) {
                            let file = bundle[filename];

                            if (
                                !filename.endsWith('.scss') ||
                                filename.startsWith('fonts') ||
                                file.type !== 'asset' ||
                                typeof file.source !== 'string'
                            ) {
                                continue;
                            }

                            let layer,
                                parts = file.source.split('\n', 2);

                            if (filename.startsWith('css-utilities')) {
                                layer = 'css-utilities';
                            }
                            else if (filename.startsWith('components')) {
                                layer = 'components';
                            }
                            else if (filename.startsWith('normalize')) {
                                layer = 'normalize';
                            }
                            else {
                                continue;
                            }

                            file.source = `@layer ${layer} {${parts[0]}}\n${parts[1]}`;
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
        }
    },
});