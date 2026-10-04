import { reactive } from '@esportsplus/reactivity';
import { toaster as createToaster } from '@esportsplus/ui/components';
import 'docs/components/toaster/scss/index.scss';


// Where the docs' toaster is pinned; the toast example moves it around.
const placement = reactive({ value: 'se' });

// The docs' own toaster, placed once by the viewer shell; its toasts wear the docs' surface.
const toaster = createToaster({
    [createToaster.overflow]: { class: 'docs-toast-overflow' },
    class: () => `toaster--${placement.value}`
});

const toast = toaster.toast.bind({ attributes: { class: 'docs-toast' } });


export default toast;
export { toaster, placement };
