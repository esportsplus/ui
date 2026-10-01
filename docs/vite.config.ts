import { config } from '@esportsplus/vite';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { layers } from '../vite.config';
import template from '@esportsplus/template/compiler/vite';


export default defineConfig((env) => {
    return config({
        appType: 'spa',
        mode: env.mode,
        plugins: [
            layers,
            template()
        ],
        resolve: {
            alias: [
                // Library SCSS imports its partials from the package root
                { find: /^\/(lib|shared|tokens)$/, replacement: resolve(import.meta.dirname, '../$1.scss') }
            ]
        }
    });
});
