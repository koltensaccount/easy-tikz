import {test} from './_lib';
import {strict as assert} from 'node:assert';
import {SettingsManager} from '../src/settings';
import {computeScene2D,computeScene3D} from '../src/scene';
import {parseChartText} from '../src/text/parse';
import {printChartText} from '../src/text/print';
import {canonical} from '../src/chartdata';

const tools:any[]=[
    {type:'points',name:'P1',points:'(0, 0.5)',hollow:true},
    {type:'segment',name:'S1',path:'(-2, 0); (0, 1); (2, 0)',start:'hollow',end:'arrow'},
];
function settings(extra:any={}){return SettingsManager.fromJSON({v:4,tools,...extra});}
function scene(data:any={}){
    const s=settings(data),math=s.createMathContext();
    return computeScene2D({math,tools:s.toRendererConfig(math).tools!,functions:[],axisStyle:'box',polar:false,view:{xmin:-5,xmax:5,ymin:-5,ymax:5},grid:{nx:40,ny:40}});
}
test('point and independent path endpoints survive text and JSON round trips',()=>{
    const data=settings().serialize();
    const text=printChartText(data);
    const parsed=parseChartText(text);
    assert.deepEqual(parsed.problems,[]);
    assert.equal(canonical(parsed.data),canonical(data));
    const restored=settings(data).serialize().tools as any[];
    assert.equal(restored[0].hollow,true);
    assert.equal(restored[1].start,'hollow');assert.equal(restored[1].end,'arrow');
});
test('a modern path decorates only its outer endpoints',()=>{
    const s=scene();
    const markers=s.items.flatMap(i=>i.markers);
    assert.equal(markers.length,2);assert(markers.every(p=>p.hollow));
    const stroke=s.items.flatMap(i=>i.strokes)[0];
    assert.equal(stroke.lines.length,1);assert.equal(stroke.arrow,'forward');
});
test('legacy arrows retain per-leg heads without adding modern fields',()=>{
    const s=scene({tools:[{type:'segment',name:'S1',path:'(0,0); (1,1); (2,0)',style:'both'}]});
    const stroke=s.items.flatMap(i=>i.strokes)[0];
    assert.equal(stroke.lines.length,2);assert.equal(stroke.arrow,'both');
    const saved=settings({tools:[{type:'segment',style:'both'}]}).serialize().tools as any[];
    assert(!('start' in saved[0])&&!('end' in saved[0]));
});
test('closed paths have no competing endpoint glyphs',()=>{
    const s=scene({tools:[{...tools[1],closed:true}]});
    assert.equal(s.items.flatMap(i=>i.markers).length,0);
    assert.equal(s.items.flatMap(i=>i.strokes)[0].arrow,undefined);
});
test('3D hollow points and mixed path ends propagate into scene and TikZ',()=>{
    const s=settings({dimension:true,tools:[{type:'points',dim:3,points:'(0,0,0)',hollow:true},{type:'segment',dim:3,path:'(0,0,0); (1,1,1); (2,1,0)',start:'arrow',end:'hollow'}]});
    const math=s.createMathContext();const config=s.toRendererConfig(math);
    const scene=computeScene3D({math,tools:config.tools!,view:{xmin:-5,xmax:5,ymin:-5,ymax:5,zmin:-5,zmax:5}});
    assert.equal(scene.points.length,2);assert(scene.points.every(p=>p.hollow));
    assert.equal(scene.segments[0].arrow,'backward');assert.equal(scene.segments[1].arrow,undefined);
    assert(s.generateTikzCode().includes('mark options={fill=white'));
});
test('2D TikZ preserves filled/open marks and arrow ends',()=>{
    const code=settings().generateTikzCode();
    assert(code.includes('fill=white, draw='));assert(code.includes('->'));
});
