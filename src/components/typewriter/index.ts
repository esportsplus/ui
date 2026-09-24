import { component, html } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


// Prevents parent node from collapsing
const EMPTY_NODE = html` `;


export default component(
    function(attributes, content: string[]) {
        let state = reactive({ text: '' }),
            timer: ReturnType<typeof setTimeout> | undefined;

        return html`
            <div class='typewriter' ${attributes} ${{
                onconnect: () => {
                    let character = 0,
                        i = 0,
                        isWriting = true,
                        write = content[i];

                    function play() {
                        timer = setTimeout(() => {
                            state.text = write.slice(0, character);

                            if (isWriting) {
                                if (character > write.length) {
                                    isWriting = false;
                                    timer = setTimeout(play, 2000);
                                    return;
                                }
                                else {
                                    character++;
                                }
                            }
                            else {
                                if (character === 0) {
                                    isWriting = true;
                                    write = content[++i] || content[i = 0];
                                }
                                else {
                                    character--;
                                }
                            }

                            play();
                        }, isWriting ? 64 : 32);
                    }

                    play();
                },
                ondisconnect: () => {
                    clearTimeout(timer);
                }
            }}>
                ${() => state.text || EMPTY_NODE}
            </div>
        `;
    }
);
