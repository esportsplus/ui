import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import type { Reactive } from '@esportsplus/reactivity';
import type { Slot } from './rows';
import chevron from '@esportsplus/ui/svg/chevron-down.svg';


// Clicks must not move focus out of the text: the gutter is hidden from assistive technology and its markers are
// no tab stops, so folding from the keyboard goes through the editor's own shortcuts.
function keep(e: MouseEvent) {
    e.preventDefault();
}


// Line numbers, change bars and fold markers for the pooled rows; 'peek' opens the change under a bar.
const gutter = (slots: Reactive<Slot[]>, toggle: (slot: Slot) => void, peek: (slot: Slot) => void) => html.reactive(slots, (slot) => html`
    <div
        class='code-editor-number'
        ${{
            class: [() => slot.active && '--active', () => slot.line < 0 && 'code-editor-number--unused'],
            style: () => `height: ${slot.height}px; top: ${slot.top}px;`
        }}
    >
        <span
            class='code-editor-change'
            ${{
                class: () => slot.change && `code-editor-change--${slot.change}`,
                onclick: () => peek(slot),
                onmousedown: keep
            }}
        ></span>
        <span class='code-editor-number-text'>${() => slot.number}</span>
        <span
            class='code-editor-fold'
            ${{
                class: [() => slot.fold === 0 && 'code-editor-fold--none', () => slot.fold === 2 && '--active'],
                onclick: () => toggle(slot),
                onmousedown: keep
            }}
        >
            ${icon({ class: 'code-editor-fold-icon' }, chevron)}
        </span>
    </div>
`);


export { gutter };
