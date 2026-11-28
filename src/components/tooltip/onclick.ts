import { component, html, type Attributes } from '@esportsplus/template';
import { onCleanup, reactive } from '@esportsplus/reactivity';
import overlay from '~/components/overlay';
import { content as surface, lift, morph, morphs, position } from './utilities';
import type { Axis } from '~/shared/placement';


type A = Attributes & {
    // Keeps the content beside the trigger ('x') or above and below it ('y'); left out, either.
    axis?: Axis,
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
    ({ axis, manual = false, state = reactive({ active: false }), toggle = false, ...attributes }, content) => {
        let cancel: VoidFunction | undefined,
            following: VoidFunction | undefined,
            host: HTMLElement | undefined,
            local = reactive({ morphing: false });

        onCleanup(() => {
            cancel?.();
            following?.();
        });

        let popup = overlay.popup({
            canDismiss: () => !!cancel,
            ondismiss: () => {
                cancel?.();
                cancel = undefined;
            },
            // Stops following once the close has played out and the content has left the top layer.
            onclosed: () => {
                following?.();
                following = undefined;
            },
            // A controlled trigger opens through 'state' alone, so its content is lifted and placed as it shows.
            onopen: () => {
                if (manual && host) {
                    following?.();
                    following = lift(host);
                    position(host, axis);
                }
            },
            popover: true,
            state,
            target: (element) => {
                host = element;

                return surface(element);
            }
        });

        return html`
            <div
                class='tooltip'
                ${attributes}
                ${popup}
                ${morphs(local)}
                ${{ class: () => local.morphing && 'tooltip--morphing' }}
                ${!manual && { onclick: function(this: HTMLElement, e: MouseEvent) {
                    let active = this === e.target || toggle ? !state.active : true;

                    cancel?.();
                    cancel = undefined;

                    if (active && !state.active) {
                        following?.();
                        following = lift(this);
                        position(this, axis);
                        cancel = morph(this, () => {
                            cancel = undefined;
                            state.active = true;
                        });
                        return;
                    }

                    state.active = active;
                } }}
            >
                ${content}
            </div>
        `;
    }
);
