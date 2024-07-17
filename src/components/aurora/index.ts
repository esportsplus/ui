import { html } from '@esportsplus/template';


type Options = {
    backgrounds: [string, string, string, string];
    blur?: string;
    opacity?: number;
    scale?: number;
};


export default ({ backgrounds, blur, opacity, scale }: Options) => html`
    <div class="aurora" ${{
        style: {
            '--blur': blur || '50px',
            '--opacity': opacity || 0.8,
            '--scale': scale || 1
        }
    }}>
        ${backgrounds.map((bg) => html`<div style='${`--background-color: ${bg}`}'></div>`)}
    </div>
`;