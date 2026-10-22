import { component, html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import check from '@esportsplus/ui/svg/check.svg';
import spinner from '@esportsplus/ui/svg/spinner.svg';
import template, { BUTTON_MORPH_CONTENT, type A as MorphAttributes, type Status } from './template';


type A = Attributes & Pick<MorphAttributes, typeof BUTTON_MORPH_CONTENT | 'onclick' | 'onconnect' | 'ondisconnect' | 'state' | 'successFor'> & {
    label?: string;
    onsave: () => Promise<unknown>;
    retryLabel?: string;
};


const ANNOUNCE: Record<Status, string> = {
    error: 'Couldn\'t save. Try again.',
    idle: '',
    loading: 'Saving',
    success: 'Changes saved'
};


export default component(
    function(this: { attributes?: Partial<A> } | void, { label = 'Save changes', onsave, retryLabel = 'Try again', state = reactive({ status: 'idle' as Status }), ...attributes }: A) {
        return template.call(
            this,
            {
                ...attributes,
                [BUTTON_MORPH_CONTENT]: { 'aria-hidden': 'true', ...attributes[BUTTON_MORPH_CONTENT] },
                announce: ANNOUNCE,
                'aria-label': () => {
                    switch (state.status) {
                        case 'error':
                            return retryLabel;
                        case 'loading':
                            return 'Saving';
                        case 'success':
                            return 'Saved';
                        default:
                            return label;
                    }
                },
                onaction: onsave,
                state
            },
            html`
                <span class='button-morph-text ${() => state.status === 'idle' && '--active'}'>${label}</span>
                <span class='button-morph-text ${() => state.status === 'error' && '--active'}'>${retryLabel}</span>
                ${icon({ class: 'button-morph-icon button-morph-icon--loading' }, spinner)}
                ${icon({ class: 'button-morph-icon button-morph-icon--success' }, check)}
            `
        );
    }
);
