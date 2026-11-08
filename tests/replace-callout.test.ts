import { test, assert } from './_lib';
import { replaceChartBlock } from '../src/text/replaceBlock';
const original = '```easy-tikz\nplot f(x) = x\n```';
const replacement = '```easy-tikz\nplot f(x) = x^2\nxlabel $t$\n```';

for (const prefix of ['', '> ', '> > ', '  > ']) {
    test('save keeps chart prefix '+JSON.stringify(prefix), () => {
        const before = prefix+'[!note] Keep this callout\n'+original.split('\n').map(l=>prefix+l).join('\n')+'\n'+prefix+'Keep this text';
        const after = replaceChartBlock(before, original, replacement);
        assert.equal(after,prefix+'[!note] Keep this callout\n'+replacement.split('\n').map(l=>prefix+l).join('\n')+'\n'+prefix+'Keep this text');
        assert.equal(replaceChartBlock(after!,replacement,original),before);
    });
}
test('tilde fences and CRLF survive a quoted save',()=>{
    const before='> [!note]\r\n> ~~~~easy-tikz\r\n> plot f(x) = x\r\n> ~~~~\r\nAfter';
    assert.equal(replaceChartBlock(before,original,replacement),'> [!note]\r\n> ~~~~easy-tikz\r\n> plot f(x) = x^2\r\n> xlabel $t$\r\n> ~~~~\r\nAfter');
});
test('duplicate, stale or unclosed charts never overwrite a selection',()=>{
    assert.equal(replaceChartBlock(original+'\n'+original,original,replacement),null);
    assert.equal(replaceChartBlock(original.replace('= x','= 2'),original,replacement),null);
    assert.equal(replaceChartBlock(original.slice(0,-4),original,replacement),null);
});
test('replacement labels are literal, not string replacement patterns',()=>{
    const value='```easy-tikz\nxlabel $$ $& $\'\n```';
    assert.equal(replaceChartBlock(original,original,value),value);
});

test('resize matches a callout chart with an indented opening and an unindented closing fence', () => {
    const sibling = '> [!note] Sibling\n> ```easy-tikz\n> plot f(x) = cos(x)\n> ```\n\n';
    const before = sibling + '> [!note] Target\n>  ```easy-tikz\n>  plot f(x) = x\n> ```\n';
    const resized = '```easy-tikz\nset displayWidth = 440\nplot f(x) = x\n```';
    const after = sibling + '> [!note] Target\n>  ```easy-tikz\n>  set displayWidth = 440\n>  plot f(x) = x\n> ```\n';
    assert.equal(replaceChartBlock(before, original, resized), after);
    assert.equal(replaceChartBlock(after, resized, original), before);
});
