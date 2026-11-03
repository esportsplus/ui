import { config } from '@esportsplus/vite';
import { resolve } from 'path';
import template from '@esportsplus/template/compiler/vite';
import exampleSource from './scripts/example-source.mjs';
import { CSS_TARGET, CSS_TARGETS, CSS_UTILITIES, layers } from '../vite.config.ts';


const LIBRARY_SCSS_PARTIAL = /^\/(shared|tokens)$/;


export default config({
    appType: 'spa',
    build: {
        cssTarget: CSS_TARGET
    },
    css: {
        lightningcss: {
            targets: CSS_TARGETS
        }
    },
    plugins: [
        exampleSource(),
        template(),
        layers
    ],
    resolve: {
        alias: [
            // Library SCSS imports its partials from the package root
            { find: LIBRARY_SCSS_PARTIAL, replacement: resolve(import.meta.dirname, '../$1.scss') },
            CSS_UTILITIES
        ]
    }
});
