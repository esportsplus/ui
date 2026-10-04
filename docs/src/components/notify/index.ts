import { reactive } from '@esportsplus/reactivity';
import { toaster } from '@esportsplus/ui/components';
import '~/components/notify/scss/index.scss';


// Where the docs' toaster is pinned; the toast example moves it around.
const placement = reactive({ value: 'se' });

// The docs' own toaster, placed once by the layout; its toasts wear the docs' surface.
const notifications = toaster({
    [toaster.overflow]: { class: 'notify-overflow' },
    class: () => `toaster--${placement.value}`
});

const notify = notifications.toast.bind({ attributes: { class: 'notify' } });


export default notify;
export { notifications, placement };
