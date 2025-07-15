import { glob } from 'glob';
import { defineConfig } from 'vite';
import autoprefixer from 'autoprefixer';


export default defineConfig({
    build: {
        cssMinify: 'lightningcss',
        rollupOptions: {
            input: Object.fromEntries(
                glob.sync('./src/{components,css-utilities,fonts}/*/scss/index.scss').map(file => [file, file])
            ),
            output: {
                assetFileNames: ({ originalFileNames: [filename] }) => {
                    if (filename) {
                        return filename.split('src/').pop()!;
                    }

                    return '[name].[ext]';
                }
            }
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