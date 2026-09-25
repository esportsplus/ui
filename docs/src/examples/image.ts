import { image } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


let seeds = ['interior', 'harbor', 'canyon', 'atrium'];


function photo(seed: string, bust = 0) {
    return image({
        alt: seed,
        height: 800,
        placeholder: `https://picsum.photos/seed/${seed}/24/16`,
        sizes: '(min-width: 768px) 320px, 45vw',
        src: `https://picsum.photos/seed/${seed}/1200/800${bust ? `?${bust}` : ''}`,
        width: 1200
    });
}


export default {
    name: 'image',
    variants: [
        {
            render: () => {
                let state = reactive({ bust: 0 });

                return html`
                    <div style='display: grid; gap: var(--size-400); grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 680px; width: 100%;'>
                        ${() => {
                            let bust = state.bust;

                            return seeds.map((seed) => photo(seed, bust));
                        }}
                    </div>

                    <div
                        class='button button--tertiary'
                        style='--width: auto; margin-top: var(--size-400);'
                        onclick='${() => { state.bust++; }}'
                    >
                        replay
                    </div>
                `;
            },
            title: 'develop'
        },
        {
            render: () => html`
                <div style='max-width: 320px; width: 100%;'>
                    ${image({
                        alt: 'pending',
                        height: 800,
                        placeholder: 'https://picsum.photos/seed/harbor/24/16',
                        width: 1200
                    })}
                </div>
            `,
            title: 'unresolved src'
        },
        {
            render: () => html`
                <div style='max-width: 320px; width: 100%;'>
                    ${image({
                        alt: 'broken',
                        height: 800,
                        src: 'data:image/png;base64,broken',
                        width: 1200
                    })}
                </div>
            `,
            title: 'error'
        }
    ]
};
