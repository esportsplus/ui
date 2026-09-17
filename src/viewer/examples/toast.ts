import { toast } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let trigger = 'button button--tertiary';


let all = () => {
    toast.success('Saved successfully.', { description: 'Your changes are live.' });
    toast.error('Something went wrong.', { description: 'The request failed after several retries. This longer error body shows the four-line clamp and the copy control in action.', action: { label: 'Retry', onclick: () => toast.success('Retried.') } });
    toast.info('Heads up — just so you know.');
    toast.warning('Careful with that action.');
    toast.loading('Working on it…');
    toast.message('A plain message with no icon.');
};


export default {
    name: 'toast',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.success('Saved successfully.', { description: 'Your changes are live.' })}'>success</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.error('Something went wrong.', { description: 'The request failed. Please try again.', action: { label: 'Retry', onclick: () => toast.success('Retried.') } })}'>error</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.info('Heads up — just so you know.')}'>info</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.warning('Careful with that action.')}'>warning</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.loading('Working on it…')}'>loading</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.message('A plain message with no icon.')}'>message</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${all}'>show all</div>
                    <div class='${trigger}' style='--width: auto;' onclick='${() => toast.dismiss()}'>dismiss all</div>
                </div>
            `,
            title: 'triggers'
        }
    ]
};
