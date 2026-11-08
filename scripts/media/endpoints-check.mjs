import assert from 'node:assert/strict';
import {launch} from './lib/obsidian.mjs';
let obs;
try{
  obs=await launch({port:9395,workDir:'/private/tmp/etz-endpoint-ui-nov5',plugin:'source',width:1440,height:1000,theme:'dark'});
  await obs.openEditor({chart:{v:4,xmin:-3,xmax:3,ymin:-2,ymax:2,tools:[
    {type:'points',name:'P1',points:'(0,0.5)'},
    {type:'segment',name:'S1',path:'(-2,0); (2,0)',start:'hollow',end:'arrow'},
  ]}});
  await obs.reveal('P1');
  await obs.call(()=>{
    const radio=[...document.querySelectorAll('[role="radiogroup"]')].find(el=>el.getAttribute('aria-label')==='Point fill'||el.getAttribute('aria-labelledby')?.split(' ').some(id=>document.getElementById(id)?.textContent==='Fill'));
    if(!radio)throw Error('Point fill control missing');
    const b=[...radio.querySelectorAll('button')].find(b=>b.textContent==='Hollow');
    b.click();
  });
  await obs.waitForRender();
  const chart=await obs.chart();assert.equal(chart.tools.find(t=>t.name==='P1').hollow,true);
  await obs.screenshot('/private/tmp/etz-points-hollow-desktop.png',{clip:'editor',scale:0.5});
  await obs.reveal('S1');
  await obs.call(()=>{
    const select=[...document.querySelectorAll('select')].find(el=>Array.from(el.labels||[]).some(label=>label.textContent==='Start')||el.getAttribute('aria-label')==='Start endpoint');
    if(!select)throw Error('Start endpoint control missing');
    select.value='dot';select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await obs.waitForRender();
  const updated=await obs.chart();assert.equal(updated.tools.find(t=>t.name==='S1').start,'dot');
  assert.equal(updated.tools.find(t=>t.name==='S1').end,'arrow');
  await obs.screenshot('/private/tmp/etz-endpoints-desktop.png',{clip:'editor',scale:0.5});
  await obs.setWindowSize(430,900);
  await obs.reveal('S1');
  const fits=await obs.call(()=>{
    const controls=[...document.querySelectorAll('select')].filter(el=>Array.from(el.labels||[]).some(label=>/^(Start|End)$/.test(label.textContent||'')));
    return controls.length===2&&controls.every(el=>el.getBoundingClientRect().width<=el.parentElement.getBoundingClientRect().width+1);
  });
  assert(fits);
  await obs.screenshot('/private/tmp/etz-endpoints-mobile.png',{clip:'editor',scale:0.5});
  assert.equal((await obs.issues()).length,0);
  assert.equal(obs.errors.length,0);
  console.log('PASS: real isolated Obsidian hollow-point and endpoint controls, retained opposite end, preview, desktop/mobile.');
}finally{if(obs)await obs.quit();}
