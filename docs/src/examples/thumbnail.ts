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
        },
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-500); padding: var(--size-500); border-radius: var(--border-radius-400); background: repeating-linear-gradient(45deg, var(--color-yellow-400) 0 8px, var(--color-blue-400) 8px 16px);'>
                    <div style='display: flex;'>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-red-400), var(--color-purple-400));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-purple-300), var(--color-black-500));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-green-400), var(--color-blue-400));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --border-radius: 100%; --background: var(--color-black-300); color: var(--color-white-300); display: grid; font-size: var(--font-size-300); place-items: center;'>+3</div>
                    </div>
                    <div style='display: flex;'>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --background: linear-gradient(135deg, var(--color-red-400), var(--color-purple-400));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --background: linear-gradient(135deg, var(--color-purple-300), var(--color-black-500));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --background: linear-gradient(135deg, var(--color-green-400), var(--color-blue-400));'></div>
                        <div class='thumbnail thumbnail--stack' style='--size: var(--size-800); --background: var(--color-black-300); color: var(--color-white-300); display: grid; font-size: var(--font-size-300); place-items: center;'>+3</div>
                    </div>
                </div>
            `,
            title: 'stack'
        },
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-500); align-items: center; padding: var(--size-500); border-radius: var(--border-radius-400); background: repeating-linear-gradient(45deg, var(--color-yellow-400) 0 8px, var(--color-blue-400) 8px 16px);'>
                    <div class='thumbnail thumbnail--status' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-red-400), var(--color-purple-400));'></div>
                    <div class='thumbnail thumbnail--status' style='--size: var(--size-900); --background: linear-gradient(135deg, var(--color-purple-300), var(--color-black-500));'></div>
                    <div class='thumbnail thumbnail--status' style='--size: var(--size-800); --border-radius: 100%; --status-color: var(--color-red-400); --background: linear-gradient(135deg, var(--color-green-400), var(--color-blue-400));'></div>
                    <div style='display: flex;'>
                        <div class='thumbnail thumbnail--stack thumbnail--status' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-red-400), var(--color-purple-400));'></div>
                        <div class='thumbnail thumbnail--stack thumbnail--status' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-purple-300), var(--color-black-500));'></div>
                        <div class='thumbnail thumbnail--stack thumbnail--status' style='--size: var(--size-800); --border-radius: 100%; --background: linear-gradient(135deg, var(--color-green-400), var(--color-blue-400));'></div>
                    </div>
                </div>
            `,
            title: 'status'
        }
    ]
};
