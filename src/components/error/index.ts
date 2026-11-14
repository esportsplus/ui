import { effect, onCleanup, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import accordion from '~/components/accordion';
import '~/components/group/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    // The field's description, shown in the error's place while there's none; the two swap as the error comes and goes.
    description?: Renderable<unknown>;
    // Milliseconds an error shows before it clears 'state.error' itself, counted from its latest failure; left out, it
    // shows until its owner clears it.
    duration?: number;
    // Each line of 'error' is its own message, spaced by the footer's gap.
    state: { error: string };
};


// A control's error, set under it, taking no room while there's none and sliding what follows down as it opens. With
// a description, the two swap: the description closes as the error opens, so only the difference in their heights
// moves anything. Each is an accordion, open while the error is absent or present. The last message stays while it
// closes, so the text doesn't go before the space does.
export default component<A>(({ description, duration, state, ...attributes }) => {
    let expire: ReturnType<typeof setTimeout> | undefined,
        shown = '';

    if (duration) {
        effect(() => {
            let text = state.error;

            untrack(() => {
                clearTimeout(expire);

                if (text) {
                    expire = setTimeout(() => {
                        state.error = '';
                    }, duration);
                }
            });
        });

        onCleanup(() => clearTimeout(expire));
    }

    return html`
        <div class='error' ${attributes} ${{ class: () => state.error && '--active' }}>
            ${description !== undefined && accordion(
                {
                    [accordion.content]: { class: 'group-footer' },
                    class: 'error-description',
                    state: { get active() { return !state.error; } }
                },
                html`<small class='group-description'>${description}</small>`
            )}
            ${accordion(
                {
                    [accordion.content]: { 'aria-hidden': 'true', class: 'group-footer' },
                    class: 'error-message',
                    state: { get active() { return !!state.error; } }
                },
                html`${() => {
                    if (state.error) {
                        shown = state.error;
                    }

                    return shown.split('\n').map((line) => html`
                        <p class='group-error'>${line}</p>
                    `);
                }}`
            )}
            <span aria-live='polite' class='error-live'>${() => state.error}</span>
        </div>
    `;
});
