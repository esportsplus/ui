// Compiles every component stylesheet, nested ones included, through the library's own Vite setup.
import { build } from 'vite';
import { glob } from 'glob';
import { resolve } from 'path';

let root = 'G:/ui',
    inputs = glob.sync('src/{components,modifiers}/**/scss/index.scss', { cwd: root }).map((file) => resolve(root, file));

await build({
    build: {
        emptyOutDir: true,
        outDir: resolve(process.env.TEMP, 'fix/scss-out'),
        rollupOptions: { input: inputs }
    },
    configFile: resolve(root, 'vite.config.ts'),
    logLevel: 'warn',
    root
});

console.log(`compiled ${inputs.length} stylesheets`);
