import { stickyHeader } from '@esportsplus/ui/components';
import { html } from '@esportsplus/template';


let invoices = Array.from({ length: 14 }, (_, i) => ({
        amount: `$${(((i * 7919) % 4200) + 180).toLocaleString()}.00`,
        client: ['Acme Co', 'Globex', 'Initech', 'Hooli', 'Umbrella', 'Stark Industries', 'Wayne Enterprises'][i % 7],
        id: `INV-${1042 + i}`,
        paid: i % 3 === 0
    })),
    compact = 'color: var(--color-text-400); font-size: 13px; font-weight: var(--font-weight-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    row = 'align-items: center; display: flex; gap: var(--size-300); justify-content: space-between; padding: var(--size-200) var(--size-400);',
    subtitle = 'color: var(--color-text-300); font-size: 11.5px; line-height: 1.35; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
    title = 'color: var(--color-text-500); font-size: 20px; font-weight: var(--font-weight-500); letter-spacing: -0.03em; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

function list() {
    return html`
        <div style='padding-bottom: var(--size-300);'>
            ${invoices.map((invoice) => html`
                <div style='${row}'>
                    <div>
                        <div class='text' style='font-weight: var(--font-weight-500);'>${invoice.client}</div>
                        <div class='text' style='color: var(--color-text-300); font-size: var(--font-size-200);'>${invoice.id}</div>
                    </div>
                    <div class='text' style='color: ${invoice.paid ? 'var(--color-primary-300)' : 'var(--color-primary-500)'};'>
                        ${invoice.amount}
                    </div>
                </div>
            `)}
        </div>
    `;
}


export default {
    name: 'sticky-header',
    variants: [
        {
            render: () => stickyHeader({
                style: 'width: min(100%, 360px);',
                after: html`<div class='text' style='${compact}'>Invoices</div>`,
                before: html`
                    <div class='text' style='${title}'>Invoices</div>
                    <div class='text' style='${subtitle}'>${invoices.filter((invoice) => !invoice.paid).length} awaiting payment</div>
                `
            }, list()),
            title: 'title and subtitle'
        },
        {
            render: () => stickyHeader({
                after: html`
                    <div style='align-items: center; display: flex; gap: var(--size-300); width: 100%;'>
                        <div class='button' style='--width: auto;' tabindex='0'>back</div>
                        <div class='text' style='${compact} flex: 1;'>Invoices</div>
                        <div class='button' style='--width: auto;' tabindex='0'>new</div>
                    </div>
                `,
                before: html`
                    <div style='align-items: flex-start; display: flex; gap: var(--size-300);'>
                        <div style='flex: 1; min-width: 0;'>
                            <div class='text' style='${subtitle}'>Billing</div>
                            <div class='text' style='${title}'>Invoices</div>
                        </div>
                        <div class='button' style='--width: auto;' tabindex='0'>new</div>
                    </div>
                `,
                style: '--expanded-height: 76px; --max-height: 420px; width: min(100%, 360px);'
            }, list()),
            title: 'custom content'
        }
    ]
};
