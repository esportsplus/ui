import { effect, reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { select } from '@esportsplus/ui';
import { apply, palettes } from '~/viewer/palettes';


let options: Record<string, string> = {},
    state = reactive({ active: false, error: '', render: false, selected: palettes[0].name });


for (let i = 0, n = palettes.length; i < n; i++) {
    options[palettes[i].name] = palettes[i].label;
}

effect(() => apply(state.selected));


export default html`
    <div class='viewer-palette'>
        ${select({ class: 'viewer-palette-select', options, state })}
    </div>
`;
