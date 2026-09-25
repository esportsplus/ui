import { checkbox, icon, input, select, settings, switch as toggle, tooltip } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import add from '~/storage/svg/settings/add-line.svg';
import bankCard from '~/storage/svg/settings/bank-card-line.svg';
import bookOpen from '~/storage/svg/settings/book-open-line.svg';
import calendar from '~/storage/svg/settings/calendar-line.svg';
import chevronLeft from '~/storage/svg/settings/arrow-left-s-line.svg';
import chevronRight from '~/storage/svg/settings/arrow-right-s-line.svg';
import chevronSort from '~/storage/svg/settings/arrow-down-s-line.svg';
import codeBlock from '~/storage/svg/settings/code-block.svg';
import copy from '~/storage/svg/settings/file-copy-line.svg';
import database from '~/storage/svg/settings/database-2-line.svg';
import deleteBin from '~/storage/svg/settings/delete-bin-6-line.svg';
import download from '~/storage/svg/settings/download-2-line.svg';
import edit from '~/storage/svg/settings/edit-line.svg';
import expand from '~/storage/svg/settings/expand-up-down-line.svg';
import externalLink from '~/storage/svg/settings/external-link-line.svg';
import fileDocument from '~/storage/svg/settings/file-text-fill.svg';
import fileSpreadsheet from '~/storage/svg/settings/file-excel-2-fill.svg';
import fileVideo from '~/storage/svg/settings/film-fill.svg';
import gear from '~/storage/svg/settings/settings-6-line.svg';
import gearDesktop from '~/storage/svg/settings/settings-line.svg';
import gitMerge from '~/storage/svg/settings/git-merge-line.svg';
import logout from '~/storage/svg/settings/logout-circle-line.svg';
import mail from '~/storage/svg/settings/mail-line.svg';
import more from '~/storage/svg/settings/more-fill.svg';
import moreVertical from '~/storage/svg/settings/more-2-fill.svg';
import organization from '~/storage/svg/settings/organization-chart.svg';
import palette from '~/storage/svg/settings/palette-line.svg';
import plug from '~/storage/svg/settings/plug-line.svg';
import school from '~/storage/svg/settings/school-line.svg';
import search from '~/storage/svg/settings/search-line.svg';
import tools from '~/storage/svg/settings/tools-fill.svg';
import upload from '~/storage/svg/settings/upload-cloud-2-line.svg';
import './settings.scss';


type Kind = 'document' | 'spreadsheet' | 'video';

type Server = {
    initial: string;
    name: string;
    status: 'connected' | 'error';
    summary?: string;
    tile: string;
    tools?: string[];
};

type Sort = { dir: 'asc' | 'desc', key: 'bytes' | 'name' | 'stamp' } | null;

type Stored = {
    bytes: number;
    id: string;
    kind: Kind;
    name: string;
    stamp: number;
    uploaded: string;
};


const ART_SIZE = 277;

const KINDS: Record<Kind, { icon: string, label: string }> = {
    document: { icon: fileDocument, label: 'Documents' },
    spreadsheet: { icon: fileSpreadsheet, label: 'Spreadsheets' },
    video: { icon: fileVideo, label: 'Videos' }
};

const MAX_UPLOAD = 8 * 1024 * 1024;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PER_PAGE = 6;

const SERVERS: Record<string, Server> = {
    astro: { initial: 'A', name: 'astro', status: 'error', tile: 'muted' },
    figma: {
        initial: 'F',
        name: 'Figma',
        status: 'connected',
        summary: '26 tools, 1 prompts, 104 resources enabled',
        tile: 'pink',
        tools: ['get_design_context', 'get_metadata', 'get_screenshot', 'get_variable_defs', 'create_new_file']
    },
    paper: { initial: 'P', name: 'paper', status: 'error', tile: 'blue' },
    posthog: {
        initial: 'P',
        name: 'posthog',
        status: 'connected',
        summary: '521 tools, 173 resources enabled',
        tile: 'amber',
        tools: ['query_insights', 'list_dashboards', 'capture_event', 'feature_flags', 'session_recordings']
    },
    vercel: {
        initial: 'V',
        name: 'vercel',
        status: 'connected',
        summary: '30 tools, 13 prompts enabled',
        tile: 'black',
        tools: ['list_deployments', 'get_build_logs', 'promote_deployment', 'env_variables']
    }
};

const PLUGIN_SERVERS = [SERVERS.paper, SERVERS.posthog, SERVERS.vercel];

const SCOPES: { id: string, label: string, servers: Server[] }[] = [
    { id: 'home', label: 'Home', servers: [SERVERS.astro, SERVERS.figma] },
    { id: 'boardui', label: 'boardui', servers: [SERVERS.figma, SERVERS.vercel] },
    { id: 'iospoke', label: 'iospoke', servers: [SERVERS.astro] },
    { id: 'mideo', label: 'mideo', servers: [SERVERS.posthog] },
    { id: 'bereal', label: 'BeReal Task', servers: [SERVERS.figma] },
    { id: 'poke', label: 'poke-1', servers: [] },
    { id: 'cloud', label: 'Cloud', servers: [SERVERS.vercel, SERVERS.posthog] }
];

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Ported from BoardUI's plan artwork: the image waves like a flag while an fbm burn eats in from the edges.
const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseStr;
varying vec2 v_uv;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(17.0, 9.2);
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = v_uv;
    float edge = clamp(distance(uv, vec2(0.5)) * 1.6, 0.0, 1.0);
    float mouseBoost = u_mouseStr * smoothstep(0.2, 0.02, distance(v_uv, u_mouse));
    float amp = 0.004 + 0.022 * edge * edge + 0.012 * mouseBoost;
    uv.x += sin(uv.y * 9.0 + u_time * 2.2) * amp;
    uv.y += sin(uv.x * 12.0 - u_time * 2.7) * amp * 0.85;
    uv += (vec2(fbm(v_uv * 3.0 + vec2(u_time * 0.35, 0.0)), fbm(v_uv * 3.0 + vec2(0.0, u_time * 0.31) + 31.7)) - 0.5) * 0.03 * edge;

    vec4 img = texture2D(u_tex, uv);
    float n = fbm(uv * 4.5 + vec2(u_time * 0.3, -u_time * 0.48));
    float breathe = 0.78 + 0.22 * sin(u_time * 1.1 + n * 7.0);
    float burn = min(edge * breathe * 0.85 + mouseBoost * 0.45, 1.05);
    float d = n - (1.0 - burn);
    float hole = smoothstep(0.0, 0.07, d);
    float rim = smoothstep(-0.11, 0.0, d) * (1.0 - hole);
    float charr = smoothstep(-0.26, -0.08, d) * (1.0 - rim) * (1.0 - hole);
    float hot = smoothstep(-0.05, 0.0, d);
    vec3 ember = mix(vec3(1.0, 0.38, 0.08), vec3(1.0, 0.85, 0.35), hot);
    vec3 col = img.rgb;
    col = mix(col, col * vec3(0.32, 0.24, 0.22), charr * 0.75);
    col = mix(col, ember, rim);
    col += ember * rim * 0.6;
    float alpha = img.a * (1.0 - hole);

    float gate = smoothstep(0.12, 0.5, edge * breathe) + mouseBoost;
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float scale = 13.0 + fi * 8.0;
        vec2 sp = v_uv * scale + vec2(-u_time * (0.8 + fi * 0.5), -u_time * (2.0 + fi * 1.1));
        vec2 cell = floor(sp);
        float sh = hash(cell + fi * 13.7);
        if (sh > 0.7) {
            vec2 pos = 0.2 + 0.6 * vec2(hash(cell + 3.1), hash(cell + 7.7));
            pos.x += sin(u_time * (2.0 + sh * 3.0) + sh * 20.0) * 0.08;
            vec2 delta = fract(sp) - pos;
            float angle = sh * 6.2831 + u_time * (1.2 + sh * 2.0);
            vec2 r = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * delta;
            float body = smoothstep(0.17, 0.03, length(r * vec2(1.0, 2.6)));
            float life = fract(u_time * (0.35 + sh * 0.5) + sh * 11.0);
            float glow = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.5, 0.95, life));
            float flicker = 0.75 + 0.25 * sin(u_time * 11.0 + sh * 40.0);
            vec3 flakeCol = mix(vec3(1.0, 0.4, 0.07), vec3(1.0, 0.93, 0.55), glow * flicker);
            float lum = body * glow * flicker * min(gate, 1.2);
            col += flakeCol * lum;
            alpha = max(alpha, lum * 0.95);
        }
    }

    gl_FragColor = vec4(col, alpha);
}
`;

const FILES: Stored[] = (() => {
    let names = ['Invoice', 'Contract', 'Payroll Sheet', 'Quarterly report', 'Pitch deck', 'Budget plan', 'Onboarding video', 'Team photo', 'Meeting notes', 'Roadmap'],
        pinned: [string, Kind, number][] = [
            ['Invoice 1', 'document', 4 * 1024 * 1024],
            ['Payroll Sheet', 'spreadsheet', 539 * 1024],
            ['Welcome video', 'video', 36 * 1024 * 1024],
            ['Payroll Sheet', 'spreadsheet', 539 * 1024],
            ['Invoice 1', 'document', 4 * 1024 * 1024]
        ],
        random = rng(26),
        total = 1262,
        files: Stored[] = [];

    for (let i = 0; i < total; i++) {
        if (i < pinned.length) {
            let [name, kind, bytes] = pinned[i];

            files.push({ bytes, id: `file-${i}`, kind, name, stamp: total - i, uploaded: 'May 11, 2026' });
            continue;
        }

        let kind = (['document', 'document', 'spreadsheet', 'video'] as Kind[])[Math.floor(random() * 4)],
            bytes = Math.floor(kind === 'video' ? (4 + random() * 60) * 1024 * 1024 : 40 * 1024 + random() * 7 * 1024 * 1024),
            month = MONTHS[Math.floor(random() * 5)].slice(0, 3),
            name = `${names[Math.floor(random() * names.length)]} ${1 + Math.floor(random() * 40)}`;

        files.push({ bytes, id: `file-${i}`, kind, name, stamp: total - i, uploaded: `${month} ${1 + Math.floor(random() * 28)}, 2026` });
    }

    return files;
})();


function art(size: number, element: HTMLElement) {
    let canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d'),
        styles = getComputedStyle(element);

    if (!ctx) {
        return null;
    }

    canvas.height = size;
    canvas.width = size;

    let blob = (x: number, y: number, r: number, color: string) => {
            let gradient = ctx.createRadialGradient(x, y, 0, x, y, r);

            gradient.addColorStop(0, color);
            gradient.addColorStop(0.55, color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        };

    ctx.fillStyle = styles.getPropertyValue('--color-grey-500').trim() || '#ebebeb';
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.7;
    blob(size * 0.125, size * 0.125, size * 0.42, '#3392ff');
    blob(size * 0.83, size * 0.58, size * 0.38, '#9ae600');
    blob(size * 0.5, size * 0.95, size * 0.42, '#ff8904');
    ctx.globalAlpha = 1;

    return canvas;
}

function button(content: Renderable<unknown>, href?: string, attributes: Record<string, unknown> = {}) {
    return html`
        <button class='settings-demo-button' type='button' ${attributes}>
            ${href && icon({ 'aria-hidden': 'true' }, href)}
            ${content}
        </button>
    `;
}

function flame() {
    let stop: VoidFunction | undefined;

    return html`
        <canvas
            class='settings-demo-plan-canvas'
            aria-hidden='true'
            ${{
                onconnect: (canvas: HTMLCanvasElement) => {
                    let gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }),
                        source = gl && art(512, canvas);

                    if (!gl || !source) {
                        canvas.parentElement?.classList.add('--fallback');
                        return;
                    }

                    // Pages render while the dialog is still closed, so layout size is 0 here.
                    let size = Math.round(ART_SIZE * (window.devicePixelRatio || 1));

                    canvas.height = size;
                    canvas.width = size;
                    gl.viewport(0, 0, canvas.width, canvas.height);

                    let program = gl.createProgram()!,
                        compile = (type: number, code: string) => {
                            let shader = gl.createShader(type)!;

                            gl.shaderSource(shader, code);
                            gl.compileShader(shader);

                            return shader;
                        };

                    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
                    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
                    gl.linkProgram(program);

                    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                        canvas.parentElement?.classList.add('--fallback');
                        return;
                    }

                    gl.useProgram(program);
                    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

                    let position = gl.getAttribLocation(program, 'a_pos');

                    gl.enableVertexAttribArray(position);
                    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

                    let eased = { str: 0, x: 0.5, y: 0.5 },
                        frame = 0,
                        start = performance.now(),
                        target = { str: 0, x: 0.5, y: 0.5 },
                        uMouse = gl.getUniformLocation(program, 'u_mouse'),
                        uMouseStr = gl.getUniformLocation(program, 'u_mouseStr'),
                        uTime = gl.getUniformLocation(program, 'u_time');

                    // Overlays sit above the canvas, so the pointer is tracked on window.
                    let move = (e: PointerEvent) => {
                            let rect = canvas.getBoundingClientRect(),
                                x = (e.clientX - rect.left) / rect.width,
                                y = 1 - (e.clientY - rect.top) / rect.height,
                                inside = x > -0.15 && x < 1.15 && y > -0.15 && y < 1.15;

                            if (inside) {
                                target.x = x;
                                target.y = y;
                            }

                            target.str = inside ? 1 : 0;
                        },
                        draw = (now: number) => {
                            eased.x += (target.x - eased.x) * 0.12;
                            eased.y += (target.y - eased.y) * 0.12;
                            eased.str += (target.str - eased.str) * 0.07;

                            gl.uniform1f(uTime, (now - start) / 1000);
                            gl.uniform2f(uMouse, eased.x, eased.y);
                            gl.uniform1f(uMouseStr, eased.str);
                            gl.clearColor(0, 0, 0, 0);
                            gl.clear(gl.COLOR_BUFFER_BIT);
                            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                            frame = requestAnimationFrame(draw);
                        };

                    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

                    window.addEventListener('pointermove', move);
                    frame = requestAnimationFrame(draw);

                    stop = () => {
                        cancelAnimationFrame(frame);
                        window.removeEventListener('pointermove', move);
                    };
                },
                ondisconnect: () => {
                    stop?.();
                }
            }}
        ></canvas>
    `;
}

function general() {
    return html`
        <div class='settings-page'>
            <div class='settings-demo-plan'>
                <div class='settings-demo-plan-art' aria-hidden='true'>
                    ${flame()}
                </div>

                <div class='settings-demo-plan-body'>
                    <span class='settings-demo-chip'>Current plan</span>
                    <div>
                        <div class='settings-demo-plan-title'>Ultra $149/mo</div>
                        <div class='settings-row-description'>You are on 7x more usage than Regular.</div>
                    </div>
                    ${button('Upgrade to Max')}
                </div>
            </div>

            <div class='settings-card'>
                ${row('Limits', 'You are on 7x more usage than Premium', button('Manage limits'))}
            </div>

            ${section('Pull Requests', html`
                ${row('Review provider', 'Select Github or other providers for reviews', picker('Review provider', { bitbucket: 'Bitbucket', github: 'GitHub', gitlab: 'GitLab' }, 'github'))}
                ${row('PR destination', 'Open pull request links inside your app', picker('PR destination', { browser: 'In the browser', inside: 'Inside BoardUI' }, 'inside'))}
            `)}

            ${section('Notifications', html`
                ${row('Critical requests', 'Get notified when the mode needs to make a critical decision', swap('Critical requests', true))}
                ${row('System notifications', 'Show fundamental notifications when an agent completes a task', swap('System notifications'))}
                ${row('Completion sound', 'Sound effect a task is completed', swap('Completion sound'))}
                ${row('Dispatch alerts', 'Push notification on your phone when BoardUI messages you', swap('Dispatch alerts'))}
            `)}
        </div>
    `;
}

function human(bytes: number) {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function kindOf(name: string): Kind {
    let extension = name.split('.').pop()?.toLowerCase() ?? '';

    if (extension === 'xlsx') {
        return 'spreadsheet';
    }

    if (['mov', 'mp4', 'webm'].includes(extension)) {
        return 'video';
    }

    return 'document';
}

function menu(label: string, trigger: string, options: { content: string, icon?: string }[]) {
    return tooltip.menu(
        {
            'aria-label': label,
            class: 'settings-demo-menu',
            options: options.map((option) => ({
                content: html`${option.icon && icon({ 'aria-hidden': 'true' }, option.icon)}<span>${option.content}</span>`
            })),
            role: 'button',
            tabindex: '0',
            toggle: true,
            [tooltip.menu.option]: { class: 'settings-demo-menu-option' },
            [tooltip.menu.tooltipContent]: { class: 'settings-demo-menu-content', direction: 'se' }
        },
        icon({ 'aria-hidden': 'true' }, trigger)
    );
}

function pages(total: number, current: number) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    if (current <= 4) {
        return [1, 2, 3, 4, 5, 0, total];
    }

    if (current >= total - 3) {
        return [1, 0, total - 4, total - 3, total - 2, total - 1, total];
    }

    return [1, 0, current - 1, current, current + 1, 0, total];
}

function picker(label: string, options: Record<string, string>, selected: string, onchange?: (key: string) => void) {
    let previous = selected,
        state = reactive({ active: false, error: '', render: false, selected });

    // Options commit on click without a DOM change event; the bubbled click lands after the select's own handler.
    return html`
        <div
            class='settings-demo-select-wrap'
            ${{
                onclick: () => {
                    let next = String(state.selected);

                    if (next !== previous) {
                        previous = next;
                        onchange?.(next);
                    }
                }
            }}
        >
            ${select({
                'aria-label': label,
                class: 'settings-demo-select',
                options,
                state,
                [select.option]: { class: 'settings-demo-menu-option' },
                [select.tooltipContent]: { class: 'settings-demo-menu-content', direction: 'se' }
            })}
        </div>
    `;
}

function profile(state: { saved: boolean }) {
    let birth = reactive({ value: '1997-07-28' }),
        field = (label: string, value: string, href?: string, type = 'text') => {
            let committed = value;

            return html`
                <label class='settings-demo-input'>
                    ${href && icon({ 'aria-hidden': 'true' }, href)}
                    ${input({
                        'aria-label': label,
                        onblur: (e: Event) => {
                            let next = (e.target as HTMLInputElement).value;

                            if (next !== committed) {
                                committed = next;
                                state.saved = true;
                            }
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        },
                        type,
                        value
                    })}
                </label>
            `;
        };

    return html`
        <div class='settings-page'>
            <div class='settings-card'>
                ${row('Email', '', field('Email', 'hi@mertcan.works', mail, 'email'))}
                ${row('First name', '', field('First name', 'Mertcan'))}
                ${row('Last name', '', field('Last name', 'Esmergül'))}
                ${row('Date of birth', '', html`
                    <label class='settings-demo-button settings-demo-date'>
                        ${icon({ 'aria-hidden': 'true' }, calendar)}
                        <span>${() => {
                            let [year, month, day] = birth.value.split('-').map(Number);

                            return `${day} ${MONTHS[month - 1]} ${year}`;
                        }}</span>
                        <input
                            aria-label='Date of birth'
                            type='date'
                            value='${birth.value}'
                            ${{
                                onchange: (e: Event) => {
                                    let value = (e.target as HTMLInputElement).value;

                                    if (value) {
                                        birth.value = value;
                                        state.saved = true;
                                    }
                                },
                                onclick: (e: Event) => {
                                    (e.target as HTMLInputElement).showPicker?.();
                                }
                            }}
                        >
                    </label>
                `)}
            </div>

            <div class='settings-card'>
                ${row('BoardUI account', '', button('Manage', externalLink))}
                ${row('Public profile', 'When enabled your profile page will be visible to anyone', swap('Public profile', true))}
                ${row('Device ID', '', html`<div class='settings-field settings-field--muted'>593e2611-b9e3-44e2-1289-ab3f9d21</div>`)}
                ${row('Log out from all devices', '', button('Logout', logout))}
            </div>
        </div>
    `;
}

function rng(seed: number) {
    let a = seed;

    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;

        let t = Math.imul(a ^ (a >>> 15), 1 | a);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function row(label: string, description: string, control: Renderable<unknown>) {
    return html`
        <div class='settings-row'>
            <div class='settings-row-label'>
                <span>${label}</span>
                ${description && html`<span class='settings-row-description'>${description}</span>`}
            </div>
            ${control}
        </div>
    `;
}

function section(label: string, content: Renderable<unknown>, description?: string) {
    return html`
        <div class='settings-section'>
            <div>
                <div class='settings-section-label'>${label}</div>
                ${description && html`<div class='settings-section-description'>${description}</div>`}
            </div>
            <div class='settings-card'>${content}</div>
        </div>
    `;
}

function server(item: Server) {
    let state = reactive({ expanded: false });

    return html`
        <div class='settings-demo-server'>
            <div class='settings-demo-server-row'>
                <span class='settings-demo-tile settings-demo-tile--${item.tile}'>
                    ${item.initial}
                    <span class='settings-demo-tile-status settings-demo-tile-status--${item.status}' aria-hidden='true'></span>
                </span>

                <div class='settings-demo-server-body'>
                    <div class='settings-demo-server-name'>
                        <span>${item.name}</span>
                        <button class='settings-demo-link' type='button'>Logout</button>
                    </div>

                    ${item.status === 'connected'
                        ? html`
                            <div class='settings-demo-server-meta'>
                                <span>${item.summary}</span>
                                ${item.tools && html`
                                    <button
                                        class='settings-demo-expand'
                                        type='button'
                                        ${{
                                            'aria-expanded': () => String(state.expanded),
                                            'aria-label': () => `${state.expanded ? 'Hide' : 'Show'} ${item.name} tools`,
                                            onclick: () => {
                                                state.expanded = !state.expanded;
                                            }
                                        }}
                                    >
                                        ${icon({ 'aria-hidden': 'true' }, expand)}
                                    </button>
                                `}
                            </div>
                        `
                        : html`
                            <div class='settings-demo-server-meta'>
                                <span>Error</span>
                                <span class='settings-demo-faint'>–</span>
                                <button class='settings-demo-link' type='button'>Show Output</button>
                            </div>
                        `}
                </div>

                ${menu(`Actions for ${item.name}`, more, [
                    { content: 'Show output' },
                    { content: 'Refresh tools' },
                    { content: 'Remove server' }
                ])}
            </div>

            ${item.tools && html`
                <div class='settings-demo-grow ${() => state.expanded && '--active'}'>
                    <div>
                        <div class='settings-demo-chips'>
                            ${item.tools.map((name) => html`<span class='settings-demo-chip settings-demo-chip--code'>${name}</span>`)}
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
}

function storage() {
    let files = FILES.slice(),
        chosen = new Set(['file-1', 'file-3']),
        deleting = new Set<string>(),
        view = reactive({
            added: '',
            kind: 'all',
            page: 1,
            query: '',
            recency: 'newest',
            sort: null as Sort,
            tick: 0
        }),
        drop = reactive({ error: '', name: '', phase: 'idle', progress: 0, size: 0 }),
        timers: ReturnType<typeof setTimeout>[] = [];

    let filtered = () => {
            let q = view.query.trim().toLowerCase(),
                sort = view.sort,
                rows = files.filter((f) => (view.kind === 'all' || f.kind === view.kind) && (!q || f.name.toLowerCase().includes(q)));

            // `files` and the id sets mutate in place; `tick` is what makes this re-run.
            view.tick;

            if (sort) {
                let { dir, key } = sort;

                rows.sort((a, b) => {
                    let cmp = key === 'name' ? a.name.localeCompare(b.name) : a[key] - b[key];

                    return dir === 'asc' ? cmp : -cmp;
                });
            }
            else {
                rows.sort((a, b) => view.recency === 'newest' ? b.stamp - a.stamp : a.stamp - b.stamp);
            }

            return rows;
        },
        remove = (id: string) => {
            if (deleting.has(id)) {
                return;
            }

            deleting.add(id);
            view.tick++;

            timers.push(setTimeout(() => {
                chosen.delete(id);
                deleting.delete(id);
                files = files.filter((f) => f.id !== id);
                view.tick++;
            }, 225));
        },
        sorter = (label: string, key: 'bytes' | 'name' | 'stamp') => html`
            <button
                class='settings-demo-sort'
                type='button'
                aria-label='Sort by ${label}'
                ${{
                    class: () => `${view.sort?.key === key ? '--active' : ''} ${view.sort?.key === key && view.sort.dir === 'asc' ? '--asc' : ''}`,
                    onclick: () => {
                        let prev = view.sort;

                        view.sort = !prev || prev.key !== key ? { dir: 'asc', key } : prev.dir === 'asc' ? { dir: 'desc', key } : null;
                    }
                }}
            >
                ${label}
                ${icon({ 'aria-hidden': 'true' }, chevronSort)}
            </button>
        `,
        start = (file: File) => {
            if (drop.phase !== 'idle') {
                return;
            }

            if (file.size > MAX_UPLOAD) {
                drop.error = `${file.name} is larger than 8 MB`;
                return;
            }

            drop.error = '';
            drop.name = file.name;
            drop.phase = 'uploading';
            drop.progress = 0;
            drop.size = file.size;

            let tick = () => {
                drop.progress = Math.min(100, drop.progress + 4 + Math.random() * 10);

                if (drop.progress < 100) {
                    timers.push(setTimeout(tick, 120));
                    return;
                }

                drop.phase = 'complete';
                timers.push(setTimeout(() => {
                    let now = new Date(),
                        stored: Stored = {
                            bytes: file.size,
                            id: `upload-${now.getTime()}`,
                            kind: kindOf(file.name),
                            name: file.name.replace(/\.[^.]+$/, ''),
                            stamp: 10_000 + now.getTime() / 1000,
                            uploaded: now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                        };

                    files.unshift(stored);
                    drop.phase = 'idle';
                    view.added = stored.id;
                    view.page = 1;
                    view.sort = null;
                    view.tick++;

                    timers.push(setTimeout(() => view.added = '', 700));
                }, 1100));
            };

            timers.push(setTimeout(tick, 160));
        };

    return html`
        <div
            class='settings-page settings-demo-storage'
            ${{
                ondisconnect: () => {
                    for (let i = 0, n = timers.length; i < n; i++) {
                        clearTimeout(timers[i]);
                    }
                }
            }}
        >
            <label
                class='settings-demo-drop ${() => `--${drop.phase}`}'
                ${{
                    ondragleave: (e: DragEvent) => {
                        (e.currentTarget as HTMLElement).classList.remove('--over');
                    },
                    ondragover: (e: DragEvent) => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).classList.add('--over');
                    },
                    ondrop: (e: DragEvent) => {
                        let file = e.dataTransfer?.files[0];

                        e.preventDefault();
                        (e.currentTarget as HTMLElement).classList.remove('--over');

                        if (file) {
                            start(file);
                        }
                    }
                }}
            >
                <svg class='settings-demo-drop-ring' aria-hidden='true'>
                    <rect class='settings-demo-drop-track' pathLength='100' rx='16' x='1' y='1'></rect>
                    <rect
                        class='settings-demo-drop-progress'
                        pathLength='100'
                        rx='16'
                        x='1'
                        y='1'
                        ${{ style: () => `stroke-dasharray: ${drop.progress} ${100 - drop.progress};` }}
                    ></rect>
                </svg>

                <span class='settings-demo-drop-badge' aria-hidden='true'>${() => `${Math.round(drop.progress)}%`}</span>

                ${() => drop.phase === 'idle'
                    ? html`
                        <div class='settings-demo-drop-content'>
                            <span class='settings-demo-drop-icon'>${icon({ 'aria-hidden': 'true' }, upload)}</span>
                            <span class='settings-demo-drop-title'>Drag and drop to upload or <span>select</span></span>
                            <span class='settings-demo-drop-hint'>${drop.error || 'PDF, JPG, PNG or XLSX (max 8 MB)'}</span>
                        </div>
                    `
                    : html`
                        <div class='settings-demo-drop-content'>
                            <span class='settings-demo-drop-icon settings-demo-drop-icon--file'>${icon({ 'aria-hidden': 'true' }, KINDS[kindOf(drop.name)].icon)}</span>
                            <span class='settings-demo-drop-title'>${drop.name}</span>
                            <span class='settings-demo-drop-hint'>${() => drop.phase === 'complete' ? 'Uploaded successfully!' : `Uploading ${human(drop.size)}…`}</span>
                        </div>
                    `}

                <input
                    accept='.pdf,.jpg,.jpeg,.png,.xlsx'
                    class='settings-demo-drop-input'
                    type='file'
                    ${{
                        disabled: () => drop.phase !== 'idle',
                        onchange: (e: Event) => {
                            let element = e.target as HTMLInputElement,
                                file = element.files?.[0];

                            if (file) {
                                start(file);
                            }

                            element.value = '';
                        }
                    }}
                >
            </label>

            <section class='settings-demo-table'>
                <div class='settings-demo-toolbar'>
                    <div>
                        <div class='settings-demo-faint'>Stored in</div>
                        <div>${() => `${filtered().length.toLocaleString()} files`}</div>
                    </div>

                    <div class='settings-demo-toolbar-controls'>
                        ${picker('Filter by file type', { all: 'File type', document: 'Documents', spreadsheet: 'Spreadsheets', video: 'Videos' }, 'all', (key) => {
                            view.kind = key;
                            view.page = 1;
                        })}
                        ${picker('Order by', { newest: 'Modified', oldest: 'Oldest first' }, 'newest', (key) => {
                            view.page = 1;
                            view.recency = key;
                            view.sort = null;
                        })}
                        <label class='settings-demo-search'>
                            ${icon({ 'aria-hidden': 'true' }, search)}
                            ${input({
                                'aria-label': 'Search files',
                                oninput: (e: Event) => {
                                    view.page = 1;
                                    view.query = (e.target as HTMLInputElement).value;
                                },
                                placeholder: 'Search',
                                type: 'search'
                            })}
                        </label>
                    </div>
                </div>

                ${() => {
                    let all = filtered(),
                        total = Math.max(1, Math.ceil(all.length / PER_PAGE)),
                        current = Math.min(view.page, total),
                        rows = all.slice((current - 1) * PER_PAGE, current * PER_PAGE),
                        picked = rows.filter((f) => chosen.has(f.id)).length;

                    return html`
                        <div class='settings-demo-thead'>
                            <div class='settings-demo-cell settings-demo-cell--name'>
                                ${checkbox({
                                    class: `settings-demo-checkbox ${picked > 0 && picked < rows.length ? '--mixed' : ''}`,
                                    [checkbox.input]: {
                                        'aria-label': 'Select all files on this page',
                                        checked: rows.length > 0 && picked === rows.length,
                                        onchange: (e: Event) => {
                                            let on = (e.target as HTMLInputElement).checked;

                                            for (let i = 0, n = rows.length; i < n; i++) {
                                                on ? chosen.add(rows[i].id) : chosen.delete(rows[i].id);
                                            }

                                            view.tick++;
                                        }
                                    }
                                })}
                                ${sorter('File name', 'name')}
                            </div>
                            <div class='settings-demo-cell settings-demo-cell--date'>${sorter('Uploaded on', 'stamp')}</div>
                            <div class='settings-demo-cell settings-demo-cell--size'>${sorter('File size', 'bytes')}</div>
                            <div class='settings-demo-cell settings-demo-cell--actions settings-demo-faint'>Actions</div>
                        </div>

                        <div class='settings-demo-tbody'>
                            ${rows.length === 0
                                ? html`<div class='settings-demo-empty'>No files match your filters.</div>`
                                : rows.map((file) => html`
                                    <div class='settings-demo-tr ${deleting.has(file.id) ? '--exiting' : file.id === view.added ? '--entering' : ''}'>
                                        <div>
                                            <div class='settings-demo-tr-inner'>
                                                <div class='settings-demo-cell settings-demo-cell--name'>
                                                    ${checkbox({
                                                        class: 'settings-demo-checkbox',
                                                        [checkbox.input]: {
                                                            'aria-label': `Select ${file.name}`,
                                                            checked: chosen.has(file.id),
                                                            onchange: (e: Event) => {
                                                                (e.target as HTMLInputElement).checked ? chosen.add(file.id) : chosen.delete(file.id);
                                                                view.tick++;
                                                            }
                                                        }
                                                    })}
                                                    <span class='settings-demo-file settings-demo-file--${file.kind}'>${icon({ 'aria-hidden': 'true' }, KINDS[file.kind].icon)}</span>
                                                    <span class='settings-demo-truncate'>${file.name}</span>
                                                </div>
                                                <div class='settings-demo-cell settings-demo-cell--date'>${file.uploaded}</div>
                                                <div class='settings-demo-cell settings-demo-cell--size'>
                                                    <span class='settings-demo-chip'>${human(file.bytes)}</span>
                                                </div>
                                                <div class='settings-demo-cell settings-demo-cell--actions'>
                                                    ${button(icon({ 'aria-hidden': 'true' }, deleteBin), undefined, {
                                                        'aria-label': 'Delete file',
                                                        class: 'settings-demo-button--icon',
                                                        onclick: () => remove(file.id),
                                                        title: 'Delete file'
                                                    })}
                                                    ${menu(`More actions for ${file.name}`, moreVertical, [
                                                        { content: 'Download file', icon: download },
                                                        { content: 'Rename', icon: edit },
                                                        { content: 'Copy link', icon: copy }
                                                    ])}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `)}
                        </div>

                        <nav class='settings-demo-pagination' aria-label='Pagination'>
                            ${button(html`${icon({ 'aria-hidden': 'true' }, chevronLeft)} Previous`, undefined, {
                                disabled: current === 1,
                                onclick: () => view.page = current - 1
                            })}
                            <div class='settings-demo-pages'>
                                ${pages(total, current).map((page) => page === 0
                                    ? html`<span class='settings-demo-page settings-demo-faint'>…</span>`
                                    : html`
                                        <button
                                            class='settings-demo-page ${page === current && '--active'}'
                                            type='button'
                                            aria-current='${page === current ? 'page' : 'false'}'
                                            ${{ onclick: () => view.page = page }}
                                        >
                                            ${page}
                                        </button>
                                    `)}
                            </div>
                            ${button(html`Next ${icon({ 'aria-hidden': 'true' }, chevronRight)}`, undefined, {
                                disabled: current === total,
                                onclick: () => view.page = current + 1
                            })}
                        </nav>
                    `;
                }}
            </section>
        </div>
    `;
}

function swap(label: string, checked = false) {
    return toggle({ class: 'settings-demo-switch', [toggle.input]: { 'aria-label': label, checked } });
}

function toolsPage() {
    let state = reactive({ scope: 'home' });

    return html`
        <div class='settings-page'>
            <div class='settings-demo-pills --scrollbar' role='tablist' aria-label='Project scope'>
                ${SCOPES.map((scope) => html`
                    <button
                        class='settings-demo-pill'
                        role='tab'
                        type='button'
                        ${{
                            'aria-selected': () => String(state.scope === scope.id),
                            class: () => state.scope === scope.id && '--active',
                            onclick: () => {
                                state.scope = scope.id;
                            }
                        }}
                    >
                        ${scope.label}
                    </button>
                `)}
            </div>

            ${section('Authentication', row(
                'Wait for MCP Authentication',
                'Wait indefinitely to authenticate when prompted. When off, skip authentication prompts after 30 seconds.',
                swap('Wait for MCP authentication', true)
            ))}

            ${() => {
                let scope = SCOPES.find((s) => s.id === state.scope) ?? SCOPES[0];

                return section(`${scope.label} MCP Servers`, html`
                    ${scope.servers.map(server)}
                    <button class='settings-demo-server-row settings-demo-new' type='button'>
                        <span class='settings-demo-tile settings-demo-tile--muted'>${icon({ 'aria-hidden': 'true' }, add)}</span>
                        <span class='settings-demo-server-body'>
                            <span class='settings-demo-server-name'>New MCP Server</span>
                            <span class='settings-demo-server-meta'>Add a Custom MCP Server</span>
                        </span>
                    </button>
                `, `Servers available from ${scope.label}.`);
            }}

            <div class='settings-section'>
                <div class='settings-demo-heading'>
                    <div>
                        <div class='settings-section-label'>Team MCP Servers</div>
                        <div class='settings-section-description'>Configured in the dashboard</div>
                    </div>
                    ${button('Manage')}
                </div>
                <div class='settings-card settings-demo-empty-state'>
                    <div class='settings-demo-empty-state-title'>No Team MCP Servers</div>
                    <div class='settings-row-description'>
                        Configure MCP servers in the dashboard to make them available in BoardUI on desktop and in the cloud.
                    </div>
                    ${button('Configure Team MCP Servers')}
                </div>
            </div>

            ${section('Plugin MCP Servers', PLUGIN_SERVERS.map(server))}
        </div>
    `;
}

function demo() {
    let state = reactive({ active: false, saved: false, selected: 'general' });

    return html`
        ${button('Open settings', gear, {
            onclick: () => {
                state.selected = 'general';
                state.active = true;
            }
        })}

        ${settings({
            groups: [
                {
                    items: [
                        { content: 'General', icon: gear, id: 'general', render: general },
                        { content: 'Profile', icon: school, id: 'profile', render: () => profile(state) },
                        { content: 'Appearance', icon: palette },
                        { content: 'Billing', icon: bankCard },
                        { content: 'Rules and Workflows', icon: organization },
                        { content: 'Tools', icon: tools, id: 'tools', render: toolsPage },
                        { content: 'Storage', icon: database, id: 'storage', render: storage }
                    ],
                    label: 'Settings'
                },
                {
                    items: [
                        { content: 'General', icon: gearDesktop },
                        { content: 'Plugins', icon: plug },
                        { content: 'Developer', icon: codeBlock }
                    ],
                    label: 'Desktop app'
                },
                {
                    items: [
                        { content: 'Skills', icon: bookOpen },
                        { content: 'Git', icon: gitMerge }
                    ],
                    label: 'Customize'
                }
            ],
            state
        })}
    `;
}


export default {
    name: 'settings',
    variants: [
        {
            render: demo,
            title: 'general, profile, tools, storage'
        }
    ]
};
