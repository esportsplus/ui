import { html } from '@esportsplus/template';


export default {
    name: 'thumbnail',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-500); align-items: center;'>
                    <div class='thumbnail' style='--width: 160px; --height: 120px; --border-radius: var(--border-radius-400); --background: linear-gradient(135deg, var(--color-purple-300), var(--color-black-500));'></div>
                    <div class='thumbnail' style='--width: 90px; --height: 90px; --border-radius: 100%; --background: linear-gradient(135deg, var(--color-red-400), var(--color-purple-400));'></div>
                    <div class='thumbnail' style='--width: 120px; --height: 80px; --border-radius: var(--border-radius-300); --background: linear-gradient(to top right, var(--color-black-500), var(--color-grey-500));'></div>
                </div>
            `,
            title: 'gradient fills'
        }
    ]
};
