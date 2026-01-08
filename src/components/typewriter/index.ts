import { html, reactive } from '@esportsplus/template';
import template from '~/components/template';
import './scss/index.scss';


// Prevents parent node from collapsing
const EMPTY_NODE = html` `;


export default template.factory(
    function(_, content: string[]) {
        let state = reactive({ text: '' });

        return html`
            <div class='typewriter' ${{
                onconnect: () => {
                    let character = 0,
                        i = 0,
                        isWriting = true,
                        write = content[i];

                    function play() {
                        setTimeout(() => {
                            state.text = write.slice(0, character);

                            if (isWriting) {
                                if (character > write.length) {
                                    isWriting = false;
                                    setTimeout(play, 2000);
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
                }
            }}>
                ${() => state.text || EMPTY_NODE}
            </div>
        `;
    }
);