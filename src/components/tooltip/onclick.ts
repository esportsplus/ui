import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { morph, morphing } from './utilities';


type A = Attributes & {
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
    ({ state = reactive({ active: false }), toggle = false, ...attributes }, content) => {
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
                    onclick: function(e) {
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
                    },
                    ondocumentclick: function(this, event) {
                        if (!this?.isConnected || !state.active) {
                            return;
                        }

                        if (!this.contains(event.target as Node | null)) {
                            state.active = false;
                        }
                    },
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
