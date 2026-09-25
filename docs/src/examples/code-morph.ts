import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { codeMorph } from '@esportsplus/ui';
import type { Entry } from '../types';


const RENAME = [
    {
        code: `
function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}`,
        label: 'Loop',
        title: 'Add up the prices with a loop'
    },
    {
        code: `
function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`,
        label: 'Reduce',
        title: 'Fold the loop into a single reduce'
    }
];

const STEPS = [
    {
        code: `
function Profile({ id }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(\`/api/users/\${id}\`)
      .then((res) => res.json())
      .then(setUser);
  }, [id]);

  return <Card user={user} />;
}`,
        label: 'Step 1',
        title: 'Fetch the user in an effect'
    },
    {
        code: `
function Profile({ id }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(\`/api/users/\${id}\`)
      .then((res) => res.json())
      .then(setUser)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  return <Card user={user} />;
}`,
        label: 'Step 2',
        title: 'Show a spinner while it loads'
    },
    {
        code: `
function Profile({ id }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(\`/api/users/\${id}\`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setUser)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (loading) return <Spinner />;
  return <Card user={user} />;
}`,
        label: 'Step 3',
        title: 'Abort the stale request on a new id'
    }
];


export default {
    name: 'code-morph',
    variants: [
        {
            render: () => codeMorph({ steps: STEPS }),
            title: 'default'
        },
        {
            render: () => {
                let state = reactive({ step: 0 }),
                    timer: ReturnType<typeof setInterval> | undefined;

                return html`
                    <div style='align-items: center; display: flex; flex-direction: column; gap: var(--size-400); max-width: 100%;'>
                        ${codeMorph({ label: 'Refactor', state, steps: RENAME })}
                        <button class='button --background-blue --color-white' onclick=${() => {
                            if (timer) {
                                clearInterval(timer);
                                timer = undefined;
                                return;
                            }

                            state.step = (state.step + 1) % RENAME.length;
                            timer = setInterval(() => {
                                state.step = (state.step + 1) % RENAME.length;
                            }, 2400);
                        }} type='button'>
                            autoplay (external state)
                        </button>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
} satisfies Entry;
