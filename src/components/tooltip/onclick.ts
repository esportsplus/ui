import { component, html, type Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import overlay from '~/components/overlay';
import { content as surface, morph, morphs } from './utilities';


type A = Attributes & {
    // Controlled triggers handle their own clicks while sharing the tooltip's visibility and dismissal.
    manual?: boolean,
    onanimationcancel?: never,
    onanimationend?: never,
    onanimationstart?: never,
    onclick?: never,
    ondocumentclick?: never,
    ontransitioncancel?: never,
    ontransitionend?: never,
    ontransitionrun?: never,
    state?: { active: boolean },
    toggle?: boolean
};


export default component<A>(
    ({ manual = false, state = reactive({ active: false }), toggle = false, ...attributes }, content) => {
        let cancel: VoidFunction | undefined,
            local = reactive({ morphing: false });

        onCleanup(() => cancel?.());

        let popup = overlay.popup({
            canDismiss: () => !!cancel,
            ondismiss: () => {
                cancel?.();
                cancel = undefined;
            },
            state,
            target: surface
        });

        return html`
            <div
                class='tooltip'
                ${attributes}
                ${{
                    ...popup,
                    ...morphs(local),
                    class: [
                        popup.class,
                        () => local.morphing && 'tooltip--morphing'
                    ].flat(),
                    ...(!manual && { onclick: function(this: HTMLElement, e: MouseEvent) {
                        let active = this === e.target || toggle ? !state.active : true;

                        cancel?.();
                        cancel = undefined;

                        if (active && !state.active) {
                            cancel = morph(this, () => {
                                cancel = undefined;
                                state.active = true;
                            });
                            return;
                        }

                        state.active = active;
                    } })
                }}
            >
                ${content}
            </div>
        `;
    }
);
