import { reactive, root } from '@esportsplus/reactivity';
import { on, setProperties, type Element as Bound } from '@esportsplus/template';
import './scss/index.scss';


type Mode = 'dark' | 'light';

type Options = {
    fallback?: Preference;
    store?: Store;
};

type Preference = Mode | 'system';

// The slice of @esportsplus/web-storage's Local<T> the theme uses, so any Local<{ theme: Preference }> is a store.
type Store = {
    delete(...keys: (typeof KEY)[]): Promise<void>;
    get(key: typeof KEY): Promise<unknown>;
    set(key: typeof KEY, value: Preference): Promise<boolean>;
};


const ATTRIBUTE = 'data-theme';

const KEY = 'theme';

const PREFERENCES: readonly unknown[] = ['dark', 'light', 'system'];

const QUERY = '(prefers-color-scheme: dark)';

const THEME_STATE = Symbol('theme.root');


// Always a resolved mode, 'system' included, so styles keyed on '[data-theme]' always have one to match.
function apply(mode: Mode) {
    page(mode).mode = mode;
}

// The mode bound on <html>, once however many themes start. Seeded with the first mode, so the binding writes it as
// it is created rather than a pass later, before the page first paints.
function page(mode: Mode) {
    let element = document.documentElement as HTMLElement & { [THEME_STATE]?: { mode: Mode } };

    return element[THEME_STATE] ??= root(() => {
        let state = reactive({ mode });

        setProperties(element as Bound, { [ATTRIBUTE]: () => state.mode });

        return state;
    });
}

function system(dark: boolean): Mode {
    return dark ? 'dark' : 'light';
}


// 'fallback' is the developer's default, shown until the user picks a mode; picking it again clears the stored override.
export default ({ fallback = 'system', store }: Options = {}) => {
    let media = matchMedia(QUERY),
        state = reactive({ preference: fallback, system: system(media.matches) }),
        touched = false;

    function mode(): Mode {
        return state.preference === 'system' ? state.system : state.preference;
    }

    apply(mode());

    on(media, 'change', (event) => {
        state.system = system(event.matches);

        if (state.preference === 'system') {
            apply(state.system);
        }
    });

    store?.get(KEY).then(
        (value) => {
            if (!touched && PREFERENCES.includes(value)) {
                state.preference = value as Preference;
                apply(mode());
            }
        },
        () => {}
    );

    return {
        get mode() {
            return mode();
        },
        get preference() {
            return state.preference;
        },
        set(preference: Preference) {
            touched = true;
            state.preference = preference;
            apply(mode());

            if (preference === fallback) {
                void store?.delete(KEY);
            }
            else {
                void store?.set(KEY, preference);
            }
        }
    };
};


export type { Mode, Options, Preference, Store };
