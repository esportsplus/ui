import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import dismiss from '~/shared/dismiss';
import { morph, morphing } from './utilities';


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

        return html`
            <div
                class='tooltip'
                ${attributes}
                ${{
                    class: [
                        () => state.active && '--active',
                        () => local.morphing && 'tooltip--morphing'
                    ],
                    onanimationcancel: morphing(local, false),
                    onanimationend: morphing(local, false),
                    onanimationstart: morphing(local, true),
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
                    } }),
                    ondocumentclick: dismiss(() => state.active, () => {
                        state.active = false;
                    }),
                    ontransitioncancel: morphing(local, false),
                    ontransitionend: morphing(local, false),
                    ontransitionrun: morphing(local, true)
                }}
            >
                ${content}
            </div>
        `;
    }
);
