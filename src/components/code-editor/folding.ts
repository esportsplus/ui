import { lineStarts, lineEnd, floorIndex, type Edit } from './document';
import { highlightLine, type Language, type LexState } from './highlight';
export type FoldRange = {from:number;to:number;line:number;endLine:number;open?:number;close?:number};
export type BracketPair = {from:number;to:number};
/** Bounded lexical structure scan. Strings/comments do not participate in brace folding. */
export function structures(source:string,language:Language) {
    let starts=lineStarts(source),commentStart:number|null=null,fenceStart:number|null=null,folds:FoldRange[]=[],pairs:BracketPair[]=[],stack:{character:string;offset:number}[]=[],state:LexState='',scanned=0,processed=0,python:{index:number;indent:number}[]=[],headings:{index:number;level:number}[]=[],tags:{name:string;offset:number}[]=[];
    let addFold=(from:number,to:number)=>{let first=floorIndex(starts,from),last=floorIndex(starts,to);if(to>from+1)folds.push({from:from+1,to,line:first+1,endLine:last+1,open:from,close:to});};
    for(let index=0;index<starts.length&&index<30000&&scanned<1_000_000;index++) {
        let from=starts[index],text=source.slice(from,lineEnd(source,starts,index)),previousState=state,lex=highlightLine(text,language,state);state=lex.state;scanned+=text.length;processed=index+1;
        if(state.includes('comment')&&!previousState.includes('comment'))commentStart=from;
        if(commentStart!==null&&!state.includes('comment')){addFold(commentStart,from);commentStart=null;}
        if(language==='markdown'&&state.startsWith('fence:')&&!previousState.startsWith('fence:'))fenceStart=from;
        if(fenceStart!==null&&!state.startsWith('fence:')){addFold(fenceStart,from);fenceStart=null;}
        for(let offset=0,tokenIndex=0;offset<text.length;offset++) {
            while(lex.tokens[tokenIndex]?.to<=offset)tokenIndex++;
            let token=lex.tokens[tokenIndex];if(token&&token.from<=offset&&['string','comment','regexp'].includes(token.kind))continue;
            let character=text[offset];
            if('([{'.includes(character))stack.push({character,offset:from+offset});
            else if(')]}'.includes(character)){let open=stack.at(-1);if(open&&'([{'.indexOf(open.character)===')]}'.indexOf(character)){stack.pop();pairs.push({from:open.offset,to:from+offset});addFold(open.offset,from+offset);}}
        }
        if(language==='html'||language==='jsx'||language==='tsx'||language==='javascript'||language==='typescript') {
            let pattern=/<(\/?)([\w:-]+)\b[^>]*>/g;
            for(let match;(match=pattern.exec(text));){let name=match[2].toLowerCase();if(lex.tokens.some(token=>token.from<=match.index&&token.to>match.index&&['string','comment','regexp'].includes(token.kind)))continue;if(match[0].endsWith('/>')||/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name))continue;
                if(match[1]){let at=tags.map(tag=>tag.name).lastIndexOf(name);if(at>=0){let open=tags[at];tags.length=at;addFold(open.offset,from+match.index);}}
                else tags.push({name,offset:from+match.index+match[0].length-1});}
        }
        if(language==='python'&&text.trim()&&!/^\s*#/.test(text)&&![String.fromCharCode(34).repeat(3),String.fromCharCode(39).repeat(3)].includes(previousState)) {
            let indent=0;for(let character of /^[\t ]*/.exec(text)![0])indent+=character==='\t'?4-indent%4:1;
            while(python.length&&python.at(-1)!.indent>=indent){let header=python.pop()!;if(index>header.index+1)folds.push({from:starts[header.index+1],to:starts[index],line:header.index+1,endLine:index+1});}
            if(/:\s*(?:#.*)?$/.test(text))python.push({index,indent});
        }
        if(language==='markdown'&&!previousState.startsWith('fence:')&&/^#{1,6}\s/.test(text)) {
            let level=/^#+/.exec(text)![0].length;
            while(headings.length&&headings.at(-1)!.level>=level){let header=headings.pop()!;if(index>header.index+1)folds.push({from:starts[header.index+1],to:starts[index],line:header.index+1,endLine:index+1});}
            headings.push({index,level});
        }
    }
    if(processed===starts.length)for(let header of [...python,...headings])if(processed>header.index+1)folds.push({from:starts[header.index+1],to:source.length,line:header.index+1,endLine:processed+1});
    // A header may contain parameters and an inline type before its body. The gutter
    // collapses the outer body, rather than the first short pair on that line.
    return {folds:folds.sort((a,b)=>a.line-b.line||b.endLine-a.endLine||(b.to-b.from)-(a.to-a.from)||a.from-b.from),pairs};
}
export function matchingPair(pairs:readonly BracketPair[],offset:number) {return pairs.find(pair=>pair.from===offset||pair.to===offset||pair.from===offset-1||pair.to===offset-1)??null;}
export function outerFolds(folds:readonly FoldRange[]) {let result:FoldRange[]=[];for(let fold of [...folds].sort((a,b)=>a.from-b.from||b.to-a.to))if(!result.some(range=>fold.from>=range.from&&fold.to<=range.to))result.push(fold);return result;}

/** Lexical context for character assistance. Scan caps preserve responsiveness on large sources. */
export function contexts(source:string,language:Language,offsets:readonly number[]) {
    let found=new Map<number,import('./highlight').Token>();if(language==='plain'||!offsets.length)return found;
    let starts=lineStarts(source),maximum=Math.max(...offsets),last=floorIndex(starts,maximum),state:LexState='',budget=0,positions=[...offsets].sort((a,b)=>a-b),cursor=0;
    for(let line=0;line<=last&&line<30000;line++) {
        let from=starts[line],end=lineEnd(source,starts,line),text=source.slice(from,end);budget+=text.length;
        if(budget>1_000_000)break;
        let lex=highlightLine(text,language,state);state=lex.state;
        while(cursor<positions.length&&positions[cursor]<=end) {
            let offset=positions[cursor++],local=offset-from,token=lex.tokens.find(token=>token.from<local&&token.to>=local);
            if(token) {
                let closed=token.to===local&&((token.kind==='string'&&text[token.from]===text[token.to-1]&&token.to-token.from>1)||(token.kind==='comment'&&/\*\/|-->/.test(text.slice(token.to-3,token.to)))||token.kind==='regexp');
                if(!closed)found.set(offset,token);
            }
        }
    }
    return found;
}
export function tokenAt(source:string,language:Language,offset:number) {return contexts(source,language,[offset]).get(offset)??null;}

/** Each batch uses its own pre-edit offsets, including grouped history travel. */
export function mapFolds(folds:readonly FoldRange[], batches:readonly (readonly Edit[])[], source:string):FoldRange[] {
    let mapped=[...folds];
    for(let batch of batches) mapped=mapped.flatMap(fold=> {
        // Insertions at either boundary are visible; edits of hidden characters reveal the fold.
        if(batch.some(edit=>edit.from===edit.to?edit.from>fold.from&&edit.from<fold.to:(edit.from<fold.to&&edit.to>fold.from)||(fold.open!==undefined&&edit.from<=fold.open&&edit.to>fold.open)||(fold.close!==undefined&&edit.from<=fold.close&&edit.to>fold.close)))return [];
        let shift=(offset:number,right:boolean)=>batch.reduce((delta,edit)=>delta+((edit.to<offset||edit.to===offset&&(right||edit.from!==edit.to))?edit.insert.length-(edit.to-edit.from):0),0);
        return [{...fold,from:fold.from+shift(fold.from,true),to:fold.to+shift(fold.to,false),open:fold.open===undefined?undefined:fold.open+shift(fold.open,true),close:fold.close===undefined?undefined:fold.close+shift(fold.close,true)}];
    });
    let starts=lineStarts(source);
    return mapped.map(fold=>({...fold,line:floorIndex(starts,fold.open??Math.max(0,fold.from-1))+1,endLine:floorIndex(starts,fold.close??fold.to)+1}));
}
