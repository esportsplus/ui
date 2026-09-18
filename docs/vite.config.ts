import { config } from '@esportsplus/vite';
import { defineConfig } from 'vite';
import template from '@esportsplus/template/compiler/vite';


export default defineConfig((env) => {
    return config({
        appType: 'spa',
        mode: env.mode,
        plugins: [
            template()
        ]
    });
});
