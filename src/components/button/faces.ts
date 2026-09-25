import { html, type Renderable } from '@esportsplus/template';


type Face = {
    content: Renderable<unknown>;
    icon?: () => Renderable<unknown>;
    key: string;
    tone?: 'error' | 'success';
};


// Every face shares one grid cell so the widest label reserves the width and state swaps never shift layout.
// Only the resting face stays in the accessibility tree; it is the button's fixed accessible name.
export default (status: () => string, faces: Face[]) => html`
    <span class='button-faces'>
        ${faces.map(({ content, icon, key, tone }, index) => html`
            <span
                aria-hidden='${index === 0 ? 'false' : 'true'}'
                class='button-face'
                data-tone='${tone}'
                ${{ class: () => status() === key && '--active' }}
            >
                ${icon?.()}
                ${content}
            </span>
        `)}
    </span>
`;
export type { Face };
