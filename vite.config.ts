import { glob } from 'glob';
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';


export default defineConfig({
    build: {
        cssMinify: 'lightningcss',
        outDir: 'build',
        rollupOptions: {
            input: glob.sync('./src/{components,css-utilities,fonts}/*/scss/index.scss'),
            output: {
                assetFileNames: ({ originalFileNames: [filename] }) => {
                    if (filename) {
                        return filename.split('src/').pop()!;
                    }

                    return '[name].[ext]';
                }
            }
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
});