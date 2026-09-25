import { stickyHeader } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let invoices = Array.from({ length: 14 }, (_, i) => ({
        amount: `$${(((i * 7919) % 4200) + 180).toLocaleString()}.00`,
        client: ['Acme Co', 'Globex', 'Initech', 'Hooli', 'Umbrella', 'Stark Industries', 'Wayne Enterprises'][i % 7],
        id: `INV-${1042 + i}`,
        paid: i % 3 === 0
    })),
    row = 'align-items: center; display: flex; gap: var(--size-300); justify-content: space-between; padding: var(--size-200) var(--size-400);';

function list() {
    return html`
        <div style='padding-bottom: var(--size-300);'>
            ${invoices.map((invoice) => html`
                <div style='${row}'>
                    <div>
                        <div class='text' style='font-weight: var(--font-weight-500);'>${invoice.client}</div>
                        <div class='text' style='color: var(--color-text-300); font-size: var(--font-size-200);'>${invoice.id}</div>
                    </div>
                    <div class='text' style='color: ${invoice.paid ? 'var(--color-text-300)' : 'var(--color-text-500)'};'>
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
            render: () => html`
                <div style='width: min(100%, 360px);'>
                    ${stickyHeader({
                        subtitle: `${invoices.filter((invoice) => !invoice.paid).length} awaiting payment`,
                        title: 'Invoices'
                    }, list())}
                </div>
            `,
            title: 'title and subtitle'
        },
        {
            render: () => html`
                <div style='width: min(100%, 360px);'>
                    ${stickyHeader({
                        actions: html`<div class='button button--tertiary' style='--width: auto;'>new</div>`,
                        leading: html`<div class='button button--tertiary' style='--width: auto;'>back</div>`,
                        style: '--max-height: 420px;',
                        subtitle: 'Billing',
                        title: 'Invoices'
                    }, list())}
                </div>
            `,
            title: 'leading and actions'
        }
    ]
};
