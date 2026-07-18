import { config } from '@esportsplus/vite';
import template from '@esportsplus/template/compiler/vite';


export default ({ mode }: { mode: string }) => config({
    mode,
    plugins: [
        template()
    ]
});
