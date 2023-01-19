import { effect } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Data = {
    class?: string;
    direction?: string;
    items?: {
        border?: {
            class?: string;
        };
        class?: string;
        onclick?: (...args: any[]) => void;
        style?: string;
        svg?: string;
        target?: string;
        text: string;
        url?: string;
    }[];
    state?: { active?: boolean };
    style?: string;
};


function template(data: Data) {
    return html`
        <div class="tooltip-content tooltip-content--${data?.direction || 's'} --flex-column --width-full ${data?.class || ''}" style='${data?.style || ''}'>
            ${(data?.items || []).map(item => html`
                ${item?.border ? html`
                    <div
                        class="border ${item?.border?.class || ''}"
                        style='
                            margin-left: calc(var(--margin-horizontal) * -1);
                            width: calc(100% + var(--margin-horizontal) * 2);
                        '
                    ></div>
                ` : ''}

                <${item?.url ? 'a' : 'div'}
                    class='link --flex-vertical ${item?.class}' ${item?.onclick ? html({ onclick: item.onclick }) : ''}
                    style='${item?.style || ''}'
                    ${item?.url ? `href='${item.url}' target='${item.target || '_blank'}'` : ''}
                >
                    ${item?.svg ? html`
                        <div class="icon --margin-right --margin-300" style='margin-left: var(--size-100)'>
                            ${item.svg}
                        </div>
                    ` : ''}

                    <div class="text --color-text --flex-fill">
                        ${item.text}
                    </div>
                </${item?.url ? 'a' : 'div'}>
            `)}
        </div>
    `;
}


// TODO: There's nothing binding activate to tooltip menu ( this is never called outside initial effect run )
export default (data: Data, state: { active?: boolean, render?: boolean }) => {
    effect(() => {
        if (!state.active || state.render) {
            return;
        }

        state.render = true;
    });

    return () => state.render ? template(data) : '';
};