import { config } from '@esportsplus/vite';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { layers } from '../vite.config';
import template from '@esportsplus/template/compiler/vite';


const LIBRARY_SCSS_PARTIAL = /^\/(shared|tokens)$/;


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
                { find: LIBRARY_SCSS_PARTIAL, replacement: resolve(import.meta.dirname, '../$1.scss') }
            ]
        }
    });
});
