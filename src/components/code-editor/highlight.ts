export type Language = 'plain' | 'javascript' | 'typescript' | 'json' | 'jsonc' | 'css' | 'html' | 'markdown' | 'python' | 'jsx' | 'tsx' | 'scss';
export type Token = Readonly<{ from: number; to: number; kind: 'comment' | 'string' | 'keyword' | 'number' | 'tag' | 'operator' | 'function' | 'variable' | 'property' | 'type' | 'regexp' }>;
export type LexState = string;
export type HighlightedLine = { tokens: Token[]; state: LexState };
const KEYWORDS = new Set(('as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of package private protected public readonly return static super switch this throw true try type typeof undefined var void while with yield and assert def del elif except global is lambda None nonlocal not or pass raise True False self').split(' '));

export function languageFor(path = ''): Language {
    let extension = path.split(/[\\/]/).at(-1)?.split('.').at(-1)?.toLowerCase() ?? '';
    if (/^(js|jsx|mjs|cjs)$/.test(extension)) return 'javascript';
    if (/^(ts|tsx|mts|cts)$/.test(extension)) return 'typescript';
    if (/^(css|scss)$/.test(extension)) return 'css';
    if (/^(html|htm|xml|svg|vue)$/.test(extension)) return 'html';
    if (/^(md|markdown)$/.test(extension)) return 'markdown';
    if (/^(py|pyi)$/.test(extension)) return 'python';
    if (extension === 'json' || extension === 'jsonc') return extension;
    return 'plain';
}

/** A small lexical highlighter, deliberately not a parser. Tokens always slice the original line. */
export function highlightLine(text: string, language: Language, initial: LexState = ''): HighlightedLine {
    if(language==='jsx')language='javascript';
    if(language==='tsx')language='typescript';
    if(language==='scss')language='css';
    if(language==='html')return highlightHtml(text,initial);
    if(language==='markdown')return highlightMarkdown(text,initial);
    if(language==='javascript'||language==='typescript')return highlightScript(text,language,initial);
    return highlightBasic(text,language,initial);
}

function highlightBasic(text:string,language:Language,initial:LexState=''):HighlightedLine {
    let tokens: Token[] = [], state = initial, i = 0;
    if (language === 'plain' || text.length > 10000) return { tokens, state: '' };
    let add = (from: number, to: number, kind: Token['kind']) => { tokens.push({ from, to, kind }); },
        code = language === 'javascript' || language === 'typescript' || language === 'jsonc' || language === 'css';
    while (i < text.length) {
        let from = i;
        if (state) {
            let end = state === 'comment' ? '*/' : state === 'html-comment' ? '-->' : state,
                at = text.indexOf(end, i);
            // Escaped template delimiters are skipped; interpolation is intentionally lexical.
            while (state === '`' && at >= 0) {
                let escapes = 0;
                for (let j = at - 1; j >= 0 && text[j] === '\\'; j--) escapes++;
                if (escapes % 2 === 0) break;
                at = text.indexOf(end, at + 1);
            }
            i = at < 0 ? text.length : at + end.length;
            add(from, i, state.includes('comment') ? 'comment' : 'string');
            if (at >= 0) state = '';
            continue;
        }
        if ((code && text.startsWith('//', i)) || (language === 'python' && text[i] === '#')) {
            add(i, text.length, 'comment');
            break;
        }
        if (code && text.startsWith('/*', i)) {
            state = 'comment';
            i += 2;
            let at = text.indexOf('*/', i);
            i = at < 0 ? text.length : at + 2;
            add(from, i, 'comment');
            if (at >= 0) state = '';
            continue;
        }
        if (language === 'python' && (text.startsWith("'''", i) || text.startsWith('"""', i))) {
            state = text.slice(i, i + 3) as LexState;
            let at = text.indexOf(state, i + 3);
            i = at < 0 ? text.length : at + 3;
            add(from, i, 'string');
            if (at >= 0) state = '';
            continue;
        }
        if (text[i] === '"' || (language !== 'json' && text[i] === "'") ||
            ((language === 'javascript' || language === 'typescript') && text[i] === '`')) {
            let quote = text[i++], closed = false;
            while (i < text.length) {
                if (text[i] === '\\') { i = Math.min(i + 2, text.length); continue; }
                if (text[i++] === quote) { closed = true; break; }
            }
            if (!closed && quote === '`') state = '`';
            add(from, i, /^(?:json|jsonc)$/.test(language) && /^\s*:/.test(text.slice(i)) ? 'property' : 'string');
            continue;
        }
        if((language==='javascript'||language==='typescript') && text[i]==='/' && /(?:^|[=(:,!&|?;{]\s*|\b(?:return|case|throw)\s+)$/.test(text.slice(0,i))) {
            let at=i+1, bracket=false;
            for(;at<text.length;at++) {if(text[at]==='\\'){at++;continue;} if(text[at]==='[')bracket=true;if(text[at]===']')bracket=false;if(text[at]==='/'&&!bracket)break;}
            if(at<text.length){i=at+1;while(/[a-z]/i.test(text[i]??'')&&i<text.length)i++;add(from,i,'regexp');continue;}
        }
        if ((language==='javascript'||language==='typescript') && text[i]==='<') {
            let match=/^<\/?[A-Za-z][\w.:-]*/.exec(text.slice(i));
            if(match){i+=match[0].length;add(from,i,'tag');continue;}
        }
        if (/[0-9]/.test(text[i])) {
            let match = /^(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?)/i.exec(text.slice(i))!;
            i += match[0].length; add(from, i, 'number'); continue;
        }
        if (/[a-zA-Z_$]/.test(text[i])) {
            i++;
            while (i < text.length && /[\w$]/.test(text[i])) i++;
            let word=text.slice(from,i), before=text.slice(0,from), after=text.slice(i), kind:Token['kind'];
            if(/^(true|false|null|None|True|False|undefined)$/.test(word))kind='number';
            else if(KEYWORDS.has(word))kind='keyword';
            else if(/^(?:\s*\()/.test(after))kind='function';
            else if(/(?:class|interface|type|extends|new|namespace)\s+$/.test(before)||/^[A-Z]/.test(word))kind='type';
            else if(/\.\s*$/.test(before)||/^\s*:/.test(after)||language==='css'||(before.lastIndexOf('<')>before.lastIndexOf('>')&&/^\s*=/.test(after)))kind='property';
            else kind='variable';
            add(from,i,kind);
            continue;
        }
        if (/[{}()[\];,:=+\-*/<>!?&|]/.test(text[i])) add(i, i + 1, 'operator');
        i++;
    }
    return { tokens, state };
}

export function commentSyntax(language: Language): { line: string | false; block?: readonly [string, string] } {
    if (language === 'python') return { line: '#' };
    if (language === 'html' || language === 'markdown') return { line: false, block: ['<!--', '-->'] };
    if (language === 'css' || language === 'scss') return { line: false, block: ['/*', '*/'] };
    if (language === 'json') return { line: false };
    return { line: '//' };
}

function highlightHtml(text:string,initial:LexState):HighlightedLine {
    let tokens:Token[]=[],state=initial,i=0;
    const push=(from:number,to:number,kind:Token['kind'])=>tokens.push({from,to,kind});
    while(i<text.length) {
        if(state.startsWith('embed:')) {
            let [,mode,...rest]=state.split(':'),closing=new RegExp('</'+mode+'\\s*>','i'),match=closing.exec(text.slice(i)),end=match?i+match.index:text.length;
            let result=highlightLine(text.slice(i,end),mode==='style'?'css':'javascript',rest.join(':'));
            tokens.push(...result.tokens.map(token=>({...token,from:token.from+i,to:token.to+i})));
            if(!match)return {tokens,state:'embed:'+mode+':'+result.state};
            i=end;state='';
        }
        if(state==='html-comment'||text.startsWith('<!--',i)) {
            let end=text.indexOf('-->',i+(state?0:4)),to=end<0?text.length:end+3;
            push(i,to,'comment');i=to;state=end<0?'html-comment':'';continue;
        }
        if(state.startsWith('tag:')||text[i]==='<') {
            let tagState=state.startsWith('tag:')?state.split(':'):null,
                match=tagState?null:/^<(\/?)([\w:-]+)/.exec(text.slice(i));
            if(!tagState&&!match){push(i,i+1,'operator');i++;continue;}
            let name=tagState?.[1]??match![2].toLowerCase(),closing=tagState?.[2]==='1'||!!match?.[1],quote=tagState?.[3]??'';
            if(match){push(i,i+match[0].length,'tag');i+=match[0].length;}
            let complete=false,selfClosing=false;
            while(i<text.length) {
                let from=i;
                if(quote||text[i]==='"'||text[i]==="'") {
                    if(!quote)quote=text[i++];
                    while(i<text.length&&text[i]!==quote)i++;
                    if(i<text.length){i++;quote='';}
                    push(from,i,'string');continue;
                }
                if(text[i]==='>'){selfClosing=text[i-1]==='/';push(i,i+1,'operator');i++;complete=true;break;}
                let attribute=/^[\w:-]+/.exec(text.slice(i));
                if(attribute){i+=attribute[0].length;push(from,i,'property');}
                else {if(text[i]==='='||text[i]==='/')push(i,i+1,'operator');i++;}
            }
            if(!complete)return {tokens,state:'tag:'+name+':'+(closing?'1':'0')+':'+quote};
            state=!closing&&!selfClosing&&/^(script|style)$/.test(name)?'embed:'+name+':':'';continue;
        }
        if(text[i]==='&'){let match=/^&(?:#\d+|#x[\da-f]+|\w+);/i.exec(text.slice(i));if(match){push(i,i+match[0].length,'number');i+=match[0].length;continue;}}
        i++;
    }
    return {tokens,state};
}
function highlightMarkdown(text:string,initial:LexState):HighlightedLine {
    let fence=/^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/.exec(text);
    if(initial.startsWith('fence:')) {
        let [,delimiter,mode,...rest]=initial.split(':');
        if(fence&&fence[1][0]===delimiter[0]&&fence[1].length>=delimiter.length)return {tokens:[{from:0,to:text.length,kind:'operator'}],state:''};
        let result=highlightLine(text,languageFor('file.'+mode),rest.join(':'));
        return {tokens:result.tokens,state:'fence:'+delimiter+':'+mode+':'+result.state};
    }
    if(fence)return {tokens:[{from:0,to:text.length,kind:'operator'}],state:'fence:'+fence[1]+':'+fence[2]+':'};
    let tokens:Token[]=[],patterns:[RegExp,Token['kind']][]=[[/^\s{0,3}#{1,6}\s.*$/g,'keyword'],[/`+[^`]*`+/g,'string'],[/!?\[[^\]]*\]\([^)]*\)/g,'property'],[/\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_/g,'type'],[/^\s*(?:[-*>]|\d+\.)\s/g,'operator'],[/<!--.*?(?:-->|$)/g,'comment']];
    for(let [pattern,kind] of patterns)for(let match; (match=pattern.exec(text));){let from=match.index,to=from+match[0].length;if(!tokens.some(token=>from<token.to&&to>token.from))tokens.push({from,to,kind});}
    return {tokens:tokens.sort((a,b)=>a.from-b.from),state:''};
}


type ScriptFrame = {mode:'code'|'template'|'jsx'|'tag'|'comment';depth:number;closing?:boolean;void?:boolean};
/** Small resumable mode stack: literal text stays protected; expression braces remain structural. */
function highlightScript(text:string,language:Language,initial:LexState):HighlightedLine {
    if(text.length>10000)return {tokens:[],state:''};
    let frames:ScriptFrame[]=initial.startsWith('script:')?JSON.parse(initial.slice(7)):[{mode:'code',depth:0}];
    if(initial==='comment')frames.push({mode:'comment',depth:0});
    if(initial==='`')frames.push({mode:'template',depth:0});
    let tokens:Token[]=[],i=0,plain=0;
    let push=(from:number,to:number,kind:Token['kind'])=>{if(to>from)tokens.push({from,to,kind});};
    let flush=(to:number)=>{if(to>plain)tokens.push(...highlightBasic(text.slice(plain,to),language).tokens.map(t=>({...t,from:t.from+plain,to:t.to+plain})));plain=to;};
    while(i<text.length) {
        let frame=frames.at(-1)!;
        if(frame.mode==='comment') {
            let end=text.indexOf('*/',i),to=end<0?text.length:end+2;push(i,to,'comment');i=plain=to;if(end>=0)frames.pop();continue;
        }
        if(frame.mode==='template') {
            let from=i;
            while(i<text.length) {
                if(text[i]==='\\'){i=Math.min(text.length,i+2);continue;}
                if(text[i]==='`'){i++;frames.pop();break;}
                if(text.startsWith('${',i)){push(from,i+1,'string');push(i+1,i+2,'operator');i+=2;frames.push({mode:'code',depth:1});from=i;break;}
                i++;
            }
            push(from,i,'string');plain=i;continue;
        }
        if(frame.mode==='jsx'||frame.mode==='tag') {
            if(text[i]==='{'){push(i,i+1,'operator');i++;frames.push({mode:'code',depth:1});plain=i;continue;}
            if(frame.mode==='jsx'&&text[i]==='<') {
                let match=/^<(\/?)(?:[A-Za-z][\w.:-]*|(?=>))/.exec(text.slice(i));
                if(match){push(i,i+match[0].length,'tag');i+=match[0].length;frames.push({mode:'tag',depth:0,closing:!!match[1],void:/^<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(match[0])});plain=i;continue;}
            }
            if(frame.mode==='tag') {
                if(text[i]==='"'||text[i]==="'"){let from=i,quote=text[i++];while(i<text.length&&text[i]!==quote)i++;if(i<text.length)i++;push(from,i,'string');plain=i;continue;}
                if(text[i]==='>') {
                    let self=text[i-1]==='/'||frame.void;push(i,i+1,'tag');i++;frames.pop();let jsx=frames.at(-1)!;
                    jsx.depth+=frame.closing?-1:self?0:1;
                    if(jsx.depth===0)frames.pop();plain=i;continue;
                }
                let from=i;while(i<text.length&&!/[{}>"']/.test(text[i]))i++;push(from,i,'property');plain=i;continue;
            }
            let from=i;while(i<text.length&&text[i]!=='{'&&text[i]!=='<')i++;
            if(i===from)i++;push(from,i,'string');plain=i;continue;
        }
        if(text.startsWith('//',i)){flush(i);push(i,text.length,'comment');i=plain=text.length;break;}
        if(text.startsWith('/*',i)){flush(i);frames.push({mode:'comment',depth:0});let end=text.indexOf('*/',i+2),to=end<0?text.length:end+2;push(i,to,'comment');i=plain=to;if(end>=0)frames.pop();continue;}
        if(text[i]==='"'||text[i]==="'") {
            let from=i;flush(i);let quote=text[i++];while(i<text.length){if(text[i]==='\\'){i=Math.min(text.length,i+2);continue;}if(text[i++]===quote)break;}push(from,i,'string');plain=i;continue;
        }
        if(text[i]==='/'&&/(?:^|[=(:,!&|?;{]\s*|\b(?:return|case|throw)\s+)$/.test(text.slice(0,i))) {
            let end=i+1,bracket=false;for(;end<text.length;end++){if(text[end]==='\\'){end++;continue;}if(text[end]==='[')bracket=true;if(text[end]===']')bracket=false;if(text[end]==='/'&&!bracket)break;}
            if(end<text.length){flush(i);let from=i;i=end+1;while(i<text.length&&/[a-z]/i.test(text[i]))i++;push(from,i,'regexp');plain=i;continue;}
        }
        if(text[i]==='`'){flush(i);push(i,i+1,'string');i++;plain=i;frames.push({mode:'template',depth:0});continue;}
        if(text[i]==='<'&&/^<\/?(?:[A-Za-z][\w.:-]*|>)/.test(text.slice(i))&&!/^<[^>]*>\s*\(/.test(text.slice(i))) {flush(i);frames.push({mode:'jsx',depth:0});continue;}
        if(frame.depth) {
            if(text[i]==='{')frame.depth++;
            if(text[i]==='}'&&--frame.depth===0){i++;flush(i);frames.pop();continue;}
        }
        i++;
    }
    flush(text.length);
    return {tokens,state:frames.length===1?'':frames.length===2&&frames[1].mode==='comment'?'comment':frames.length===2&&frames[1].mode==='template'?'`':'script:'+JSON.stringify(frames)};
}
