import { reactive, ReactiveArray } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import { input } from '@esportsplus/ui/components';
import { morph, morphs } from '@esportsplus/ui/components/tooltip/utilities';
import '@esportsplus/ui/modifiers/glass/scss/index.scss';
import 'docs/examples/error/scss/alternatives.scss';


// A fill class for the tooltip, and whether it frosts what it covers with the glass modifier's blur.
type Look = { class?: string; glass?: boolean };


// Personal providers, turned away so the list shows a long, wrapping message.
const PERSONAL = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com']);

// The icon's pop, so the tooltip opens once it has landed.
const POP = 200;


// Every problem with an address at once, so the tooltip can list them together.
function issues(value: string) {
    if (!value) {
        return ['Required'];
    }

    let at = value.lastIndexOf('@'),
        domain = value.slice(at + 1).toLowerCase(),
        found: string[] = [];

    if (/\s/.test(value)) {
        found.push('Remove the spaces');
    }

    if (value.startsWith('.') || value.endsWith('.')) {
        found.push('Addresses can\'t start or end with a dot');
    }

    if (value.includes('..')) {
        found.push('Remove the double dots');
    }

    if (at === -1) {
        found.push('Add an @ between the name and the domain');
    }
    else {
        if (value.indexOf('@') !== at) {
            found.push('Use only one @');
        }

        if (at === 0) {
            found.push('Add a name before the @');
        }

        if (!/\.[^.\s]+$/.test(domain)) {
            found.push('Add a domain after the @, like example.com');
        }

        if (PERSONAL.has(domain)) {
            found.push('Use your work address; personal domains like gmail.com aren\'t accepted for team accounts');
        }
    }

    return found;
}

// An icon pops into the field's end, then the morph tooltip grows out of the field under it, at least as wide as the
// field, listing every problem at once. Checked on Enter; typing clears it.
function icon(look: Look = {}) {
    let element: HTMLElement | undefined,
        errors = new ReactiveArray<string>(),
        local = reactive({ active: false, morphing: false }),
        opening: VoidFunction | undefined,
        state = reactive({ active: false, error: '' }),
        timer: ReturnType<typeof setTimeout> | undefined;

    // The list stays as it was, so the closing morph shrinks the message it opened with.
    function close() {
        clearTimeout(timer);
        opening?.();
        opening = undefined;
        local.active = false;
        state.error = '';
    }

    function open() {
        if (!element || local.active || opening) {
            return;
        }

        opening = morph(element, () => {
            opening = undefined;
            local.active = true;
        });
    }

    function check(value: string) {
        let next = issues(value);

        if (!next.length) {
            close();
            return;
        }

        errors.splice(0, errors.length, ...next);
        state.error = next[0];
        clearTimeout(timer);
        timer = setTimeout(open, POP);
    }

    return html`
        <div class='error-alt'>
            <div class='field'>
                <label class='field-label'>Email</label>
                <div
                    class='error-alt-icon tooltip ${look.class ?? ''}'
                    ${morphs(local)}
                    ${{
                        class: [
                            () => local.active && '--active',
                            () => state.error && '--invalid',
                            () => local.morphing && 'tooltip--morphing'
                        ],
                        onconnect: (el: HTMLElement) => {
                            element = el;
                        }
                    }}
                >
                    ${input({
                        'aria-invalid': () => state.error ? 'true' : 'false',
                        oninput: close,
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                check((e.target as HTMLInputElement).value);
                            }
                        },
                        placeholder: 'you@example.com',
                        state
                    })}
                    <span aria-hidden='true' class='error-alt-icon-mark'>!</span>
                    <div class='error-alt-icon-message tooltip-message tooltip-message--se tooltip-message--morph ${look.glass && '--glass'}'>
                        <ul>
                            ${html.reactive(errors, (error) => html`<li>${error}</li>`)}
                        </ul>
                    </div>
                </div>
            </div>
            <div class='error-alt-after'>Content below never moves</div>
        </div>
    `;
}

function variant(title: string, render: () => Renderable<unknown>) {
    return { render, title: `alternative · ${title}` };
}


export default [
    variant('icon + tooltip', () => icon()),
    variant('icon + tooltip, glass', () => icon({ class: 'error-alt-icon--glass', glass: true })),
    variant('icon + tooltip, surface', () => icon({ class: 'error-alt-icon--surface' })),
    variant('icon + tooltip, surface primary', () => icon({ class: 'error-alt-icon--surface-primary' }))
];
