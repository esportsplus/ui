import { theme } from '@esportsplus/ui/components';


// The docs' one theme instance, remembered across reloads; the pickers on the themes page drive it.
const mode = theme({
    delete: async (...keys) => keys.forEach((key) => localStorage.removeItem(key)),
    get: async (key) => localStorage.getItem(key),
    set: async (key, value) => {
        localStorage.setItem(key, value);

        return true;
    }
});


export { mode };
