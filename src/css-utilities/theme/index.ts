import { reactive } from '@esportsplus/reactivity';


type Mode = 'dark' | 'light';

type Preference = Mode | 'system';

// The slice of @esportsplus/web-storage's Local<T> the theme uses, so any Local<{ theme: Preference }> is a store.
type Store = {
    delete(...keys: (typeof KEY)[]): Promise<void>;
    get(key: typeof KEY): Promise<unknown>;
    set(key: typeof KEY, value: Preference): Promise<boolean>;
};


const KEY = 'theme';

const PREFERENCES: readonly unknown[] = ['dark', 'light', 'system'];

const QUERY = '(prefers-color-scheme: dark)';


function system(dark: boolean): Mode {
    return dark ? 'dark' : 'light';
}


export default (store?: Store) => {
    let media = matchMedia(QUERY),
        state = reactive({ preference: 'system' as Preference, system: system(media.matches) }),
        touched = false;

    media.addEventListener('change', (event) => {
        state.system = system(event.matches);
    });

    store?.get(KEY).then(
        (value) => {
            if (!touched && PREFERENCES.includes(value)) {
                state.preference = value as Preference;
            }
        },
        () => {}
    );

    return {
        get class() {
            return `--theme-${this.mode}`;
        },
        get mode(): Mode {
            return state.preference === 'system' ? state.system : state.preference;
        },
        get preference() {
            return state.preference;
        },
        set(preference: Preference) {
            touched = true;
            state.preference = preference;

            if (preference === 'system') {
                void store?.delete(KEY);
            }
            else {
                void store?.set(KEY, preference);
            }
        }
    };
};


export type { Mode, Preference, Store };
