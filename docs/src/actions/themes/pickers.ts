import { html } from 'docs/app';
import { mode } from 'docs/data/theme';
import { themePicker } from '@esportsplus/ui/components';
import { preview } from 'docs/components/preview';
import type { Renderable } from 'docs/app';
import 'docs/actions/themes/scss/pickers.scss';


type Variant = {
    code: string;
    name: string;
    render: () => Renderable<unknown>;
};


// The theme pickers the library ships, each driving the docs' own theme.
const VARIANTS: Variant[] = [
    { code: 'themePicker.toggle({ mode })', name: 'Toggle', render: () => themePicker.toggle({ mode }) },
    { code: 'themePicker.cards({ mode })', name: 'Cards', render: () => themePicker.cards({ mode }) },
    { code: 'themePicker.swatches({ mode })', name: 'Swatches', render: () => themePicker.swatches({ mode }) }
];


const pickers = () => html`
    <section class='page-section pickers' id='pickers'>
        <h2>Pickers</h2>
        <p>
            Ready-made controls for choosing the mode, exported as the <code>themePicker</code> component. Each takes
            the instance as <code>mode</code>, so every one here switches these docs.
        </p>
        <div class='pickers-grid'>
            ${VARIANTS.map((variant, index) => preview({
                aside: html`<code class='pickers-note'>${variant.code}</code>`,
                index: index + 1,
                node: variant.render,
                title: variant.name
            }))}
        </div>
    </section>
`;


export { pickers };
