import { html } from 'docs/app';
import { mode } from 'docs/data/theme';
import { preview, theme } from '@esportsplus/ui/components';
import type { Renderable } from 'docs/app';
import 'docs/actions/themes/scss/pickers.scss';


type Variant = {
    code: string;
    name: string;
    render: () => Renderable<unknown>;
};


// The theme pickers the library ships, each driving the docs' own theme.
const VARIANTS: Variant[] = [
    { code: 'theme.toggle({ mode })', name: 'Toggle', render: () => theme.toggle({ mode }) },
    { code: 'theme.cards({ mode })', name: 'Cards', render: () => theme.cards({ mode }) },
    { code: 'theme.swatches({ mode })', name: 'Swatches', render: () => theme.swatches({ mode }) }
];


const pickers = () => html`
    <section class='page-section pickers' id='pickers'>
        <h2>Pickers</h2>
        <p>
            Ready-made controls for choosing the mode, exported on the <code>theme</code> component. Each takes
            the instance as <code>mode</code>, so every one here switches these docs.
        </p>
        <div class='pickers-grid'>
            ${VARIANTS.map((variant, index) => {
                let state = preview.state();

                return preview({ state }, [
                    preview.header(
                        { index: index + 1, title: variant.name },
                        html`<code class='pickers-note'>${variant.code}</code>`
                    ),
                    preview.stage({ state }, variant.render)
                ]);
            })}
        </div>
    </section>
`;


export { pickers };
