import { config } from '@esportsplus/vite';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import template from '@esportsplus/template/compiler/vite';


export default defineConfig((env) => {
    return config({
        appType: 'spa',
        mode: env.mode,
        plugins: [
            // HTTPS so LAN devices get a secure context; APIs like crypto.randomUUID only exist there.
            basicSsl(),
            template()
        ],
        resolve: {
            alias: [
                // Library SCSS imports its partials from the package root
                { find: /^\/(lib|tokens)$/, replacement: resolve(import.meta.dirname, '../$1.scss') }
            ]
        }
    });
});
