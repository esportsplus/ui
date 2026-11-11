import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import form from '~/components/form';
import group from '~/components/group';
import inlineEdit from '~/components/inline-edit';


type A = Attributes & {
    // Floats the label and value over the track instead of above it.
    inline?: boolean;
    label: string;
    max?: number;
    min?: number;
    state?: State;
    step?: number;
    // Marks every 10% along the track; 'all' adds one every 2%.
    ticks?: 'all' | 'major';
    unit?: string;
    value?: number;
};

type State = { active: boolean; error: string; value: number };


const NON_NUMERIC_CHARACTERS = /[^\d.-]/g;


// A native range under a painted track, its label and value read from the group around it: above the track, or
// floating over it with 'inline'. The input stays on top for pointer and keyboard, and the fill, handle and text
// follow its value through '--fraction'; hovering past the value shows how far the fill would reach through
// '--preview', as the filter's ghost does.
export default ({
    inline = false,
    label,
    max = 100,
    min = 0,
    state = reactive({ active: false, error: '', value: min }),
    step = 1,
    ticks,
    unit = '',
    value,
    ...attributes
}: A) => {
    if (value !== undefined) {
        state.value = value;
    }

    let edit = reactive({ editing: false, saved: false, value: String(state.value) }),
        local = reactive({ preview: min }),
        overlay = inline && 'group-item--overlay',
        span = max - min || 1;

    // The value under the pointer across the travel the thumb's centre has. Layout alone knows where the track sits
    // and how wide its thumb is, so they're measured.
    function at(event: PointerEvent) {
        let element = event.currentTarget as HTMLInputElement,
            rect = element.getBoundingClientRect(),
            thumb = parseFloat(getComputedStyle(element).getPropertyValue('--thumb-size')) || 0;

        return snap(min + ((event.clientX - rect.left - thumb / 2) / Math.max(1, rect.width - thumb)) * span);
    }

    function snap(value: number) {
        return clamp(min + Math.round((value - min) / step) * step, min, max);
    }

    effect(() => {
        let value = String(state.value);

        untrack(() => {
            edit.value = value;
        });
    });

    return group({
        ...attributes,
        class: ['range-surface', inline && 'range-surface--inline', attributes.class ?? []].flat(),
        // Never short of the value, so a ghost with nothing to show sits under the fill.
        style: () => `--fraction: ${(state.value - min) / span}; --preview: ${(Math.max(local.preview, state.value) - min) / span};`
    }, html`
        <span aria-hidden='true' class='group-label group-item ${overlay} range-surface-label'>${label}</span>
        <div class='range-surface-control ${ticks && 'range-surface-control--ticks'} ${ticks === 'all' && 'range-surface-control--ticks-all'}'>
            <div
                aria-hidden='true'
                class='range-ghost'
                ${{ class: () => local.preview > state.value && '--active' }}
            ></div>
            <div aria-hidden='true' class='range-fill'></div>
            <div aria-hidden='true' class='range-surface-handle'></div>
            <input
                aria-label='${label}'
                class='range-surface-input'
                max='${max}'
                min='${min}'
                step='${step}'
                type='range'
                ${form.input.attributes(state)}
                ${{
                    'aria-valuetext': () => `${state.value}${unit}`,
                    oninput: (event: Event) => {
                        state.value = Number((event.target as HTMLInputElement).value);
                    },
                    onpointerleave: () => {
                        local.preview = min;
                    },
                    // Touch has no hover, so there is nothing to preview.
                    onpointermove: (event: PointerEvent) => {
                        if (event.pointerType === 'mouse') {
                            local.preview = at(event);
                        }
                    },
                    value: () => state.value
                }}
            />
        </div>
        ${inlineEdit({
            class: ['group-item', overlay, 'range-edit', 'range-surface-value'],
            label,
            // Snapped and held to the range, as the input would take it; shown as taken, even when unchanged.
            onsave: (text: string) => {
                let parsed = Number(text.replace(NON_NUMERIC_CHARACTERS, ''));

                if (text.trim() !== '' && Number.isFinite(parsed)) {
                    state.value = snap(parsed);
                }

                edit.value = String(state.value);
            },
            state: edit
        }, html`${() => state.value}<span class='range-surface-unit'>${unit}</span>`)}
    `);
};

export type { State as RangeSurfaceState };
