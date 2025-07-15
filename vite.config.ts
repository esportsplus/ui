import { glob } from 'glob';
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';


export default defineConfig({
    build: {
        cssMinify: 'lightningcss',
        rollupOptions: {
            input: {
                ...Object.fromEntries(
                    glob.sync('./src/components/*/index.ts').map(file => [
                        path.basename(path.dirname(file)),
                        file
                    ])
                ),
                ...Object.fromEntries(
                    glob.sync('./src/fonts/*/index.ts').map(file => [
                        path.basename(path.dirname(file)),
                        file
                    ])
                ),
                'css-utilities': './src/css-utilities/index.ts'
            },
            output: {
                assetFileNames: (info) => {
                    let { names: [name], originalFileNames: [filename] } = info;

                    if (filename && (filename.indexOf('/components/') !== -1 || filename.indexOf('/fonts/') !== -1)) {
                        let parts = filename.split('/');

                        parts.shift();

                        if (name.endsWith('.css')) {
                            parts.pop();
                            parts.push('scss/index.scss');
                        }

                        return parts.join('/');
                    }

                    return '[name].[ext]';
                }
            },
            plugins: [
                tsconfigPaths(),
                {
                    name: 'delete-empty-files',
                    generateBundle(_, bundle) {
                        let filenames = Object.keys(bundle);

                        for (let i = 0, n = filenames.length; i < n; i++) {
                            let filename = filenames[i];

                            if (bundle[filename].type === 'chunk' && filename.endsWith('.js')) {
                                delete bundle[filename];
                            }
                        }
                    }
                }
            ],
        },
        outDir: 'build',
    },
    css: {
        postcss: {
            plugins: [
                autoprefixer()
            ]
        }
    },
});