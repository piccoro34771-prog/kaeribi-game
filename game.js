const cv=document.getElementById('scene');let ctx=cv.getContext('2d');
let W=innerWidth,H=innerHeight,D=1;
function resize(){W=innerWidth;H=innerHeight;D=Math.min(devicePixelRatio||1,2);cv.width=W*D;cv.height=H*D}addEventListener('resize',resize);resize();
// Artwork files are independent assets, not baked into a single background image.
const assetPaths={hero_down:'assets/hero_down.svg',hero_up:'assets/hero_up.svg',hero_side:'assets/hero_side.svg',vending:'assets/vending.svg',tree:'assets/tree.svg'};
const artwork={};for(const [key,path] of Object.entries(assetPaths)){const img=new Image();img.src=path;artwork[key]=img}
function imageReady(key){return artwork[key]&&artwork[key].complete&&artwork[key].naturalWidth>0}
const TILE=64,COLS=32,ROWS=24,MW=COLS*TILE,MH=ROWS*TILE;
const tiles=Array.from({length:ROWS},()=>Array(COLS).fill(0)); // 0 = blocked garden, 1 = asphalt, 2 = driveway
function paint(x,y,w,h,t){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(tiles[j]?.[i]!==undefined)tiles[j][i]=t}
paint(0,10,32,5,1);paint(12,0,5,24,1);paint(23,0,4,24,1);
// Parking bays and driveways connect directly to the street.
// The old western parking area overlapped the house and looked like an impassable lawn.
paint(1,6,7,4,2);paint(18,4,5,6,2);paint(17,16,6,7,2);
// Narrow open approach between pavement and the west/east parking aprons.
paint(2,9,6,1,2);paint(18,9,5,1,2);paint(17,15,6,2,2);
// Each scene object has a persistent ID, independent collision and event state.
const objects=[
 {id:'home_nw',type:'house',x:65,y:60,w:390,h:285},
 {id:'home_north',type:'house',x:520,y:35,w:215,h:425},
 {id:'home_ne',type:'house',x:1110,y:70,w:320,h:180},
 {id:'home_far_east',type:'house',x:1730,y:85,w:280,h:420},
 {id:'home_sw',type:'house',x:55,y:1010,w:560,h:490},
 {id:'home_south',type:'house',x:1100,y:1200,w:310,h:300},
 {id:'home_se',type:'house',x:1770,y:1040,w:260,h:450},
 {id:'vending_01',type:'vending',x:820,y:554,w:52,h:77,state:'upright',event:'vending_fall',collidable:true},
 {id:'car_park_01',type:'car',x:155,y:388,w:125,h:190},
 {id:'car_park_02',type:'car',x:1190,y:340,w:125,h:185},
 {id:'fence_west',type:'fence',x:740,y:130,w:22,h:380},
 {id:'fence_east',type:'fence',x:1470,y:125,w:24,h:390},
 {id:'tree_01',type:'tree',x:420,y:470,w:85,h:85},
 {id:'tree_02',type:'tree',x:1030,y:320,w:90,h:90},
 {id:'tree_03',type:'tree',x:1620,y:460,w:80,h:80},
 // Flat world details never join the Y-sorted sprite list.
 {id:'drain_01',type:'decal',style:'drain',x:900,y:636,w:58,h:26,layer:'ground'},
 {id:'manhole_01',type:'decal',style:'manhole',x:1310,y:795,w:55,h:35,layer:'ground'},
 {id:'leaf_01',type:'decal',style:'leaves',x:680,y:678,w:48,h:21,layer:'ground'},
 {id:'can_01',type:'item',style:'can',x:1022,y:748,w:13,h:10,layer:'ground'},
 {id:'lamp_01',type:'lamp',x:996,y:592,w:17,h:102,depthY:694},
 {id:'lamp_02',type:'lamp',x:1554,y:604,w:17,h:102,depthY:706}
];
// World coordinates refer to a shared ground plane. Visual bounds, collision, and depth are separate.
const objectById=new Map(objects.map(o=>[o.id,o]));
if(objectById.size!==objects.length)throw Error('Duplicate world object IDs');
function setupObject(o){
 o.layer=o.layer||(o.type==='item'||o.type==='decal'?'ground':'world');
 o.state=o.state||'normal';
 o.visible=o.visible!==false;
 o.collidable=o.collidable!==false&&o.layer!=='ground';
 o.depthY=Number.isFinite(o.depthY)?o.depthY:o.y+o.h;
 o.renderMode=o.layer==='ground'?'ground':'depth';
 o.tags=o.tags||[];
 // Only the physical footprint blocks movement, never the whole sprite.
 const footprints={
  lamp:{x:o.w*.3,y:o.h*.86,w:o.w*.4,h:o.h*.14},
  house:{x:0,y:0,w:o.w,h:o.h},
  tree:{x:o.w*.37,y:o.h*.68,w:o.w*.26,h:o.h*.32},
  fence:{x:0,y:0,w:o.w,h:o.h},
  vending:{x:-5,y:0,w:o.w+10,h:o.h+3},
  car:{x:o.w*.06,y:o.h*.03,w:o.w*.88,h:o.h*.94}
 };
 o.collider=o.collider||footprints[o.type]||{x:0,y:0,w:o.w,h:o.h};
 return o;
}
objects.forEach(setupObject);
function addObject(o){if(!o.id||objectById.has(o.id))throw Error('Duplicate or missing object ID: '+o.id);setupObject(o);objects.push(o);objectById.set(o.id,o);return o}
function removeObject(id){const o=objectById.get(id);if(!o)return false;objectById.delete(id);const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);return true}
function objectFootprint(o){const c=o.collider;return {x:o.x+c.x,y:o.y+c.y,w:c.w,h:c.h}}

const eventDefinitions={
 vending_fall:{once:true,trigger:'proximity',radius:125,chancePerSecond:0.012,
  guard:o=>o.state==='upright',
  run:o=>{o.state='falling';o.anim=0;eventHistory.add(o.id+':vending_fall');}}
};
const eventHistory=new Set();
function updateWorld(dt){
 for(const o of objects){
  if(o.state==='falling'){o.anim=Math.min(1,(o.anim||0)+dt*1.8);if(o.anim>=1)o.state='fallen'}
  if(!o.event)continue;
  const e=eventDefinitions[o.event];if(!e||!e.guard(o)||(e.once&&eventHistory.has(o.id+':'+o.event)))continue;
  if(Math.hypot(player.x-(o.x+o.w/2),player.y-(o.y+o.h/2))<e.radius && Math.random()<e.chancePerSecond*dt)e.run(o);
 }
}
function objectBounds(o){
 if(o.type==='vending'&&(o.state==='falling'||o.state==='fallen')){
  const t=Math.min(1,o.anim||0);
  return {x:o.x-52*t,y:o.y+o.h-26,w:o.w+52*t,h:26};
 }
 return objectFootprint(o);
}
// Rendering, collision and ground contact never derive from one another implicitly.
function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function touchesObject(o,footprint){return o.visible&&o.collidable&&intersects(footprint,objectBounds(o))}
function groundedTerrain(x,y){
 const i=Math.floor(x/TILE),j=Math.floor(y/TILE);
 return i>=0&&j>=0&&i<COLS&&j<ROWS&&tiles[j][i]!==0;
}
const player={x:960,y:785,dir:'down',step:0};
let joy={x:0,y:0,id:null,dash:false},keys=new Set(),last=performance.now(),time=0,debugCollision=false;
const rnd=(x,y,k=1)=>{let n=Math.sin(x*127.1+y*311.7+k*74.7)*43758.5453;return n-Math.floor(n)};
function box(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function line(x,y,xx,yy,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke()}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function tileDraw(i,j){
 const x=i*TILE,y=j*TILE,t=tiles[j][i];
 const colors=t===1?['#30383b','#353b3e','#2c373a']:t===2?['#464640','#454139','#504940']:['#182922','#1b3027','#1f3027'];
 box(x,y,TILE,TILE,colors[Math.floor(rnd(i,j,7)*colors.length)]);
 // Sparse multiscale grain, softer than repeated geometric blocks.
 for(let k=0;k<32;k++){
  let px=x+rnd(i,j,k)*64,py=y+rnd(j,i,k+31)*64;
  ellipse(px,py,.3+rnd(i,k)*1.2,.3+rnd(j,k)*1.1,t===0?'#586f4937':'#c0b6a51a');
 }
 if(t===0){
  for(let k=0;k<4;k++){let px=x+rnd(i,j,k+80)*64,py=y+rnd(j,i,k+60)*64;ellipse(px,py,6+rnd(k,i)*8,3+rnd(k,j)*7,'#3e593045')}
 }
 if(t===1){
  if(tiles[j-1]?.[i]===0){box(x,y,64,7,'#817c6d');line(x,y+8,x+64,y+8,'#575e58')}
  if(tiles[j+1]?.[i]===0){box(x,y+57,64,7,'#817c6d');line(x,y+57,x+64,y+57,'#aa9d8466')}
  if(rnd(i,j,99)>.64){let q=x+7+rnd(i,j,77)*43;line(q,y+8,q+3,y+30,'#131e2399');line(q+3,y+30,q-4,y+52,'#111e2199')}
  if(rnd(i,j,100)>.80)ellipse(x+31,y+24,22,8,'#78858719');
 }
 if(t===2){for(let k=0;k<3;k++)line(x,y+k*21+6,x+64,y+k*21+6,'#a49a8530')}
}
// Static ground is cached once; hundreds of decorative marks no longer redraw each frame.
const groundCanvas=document.createElement('canvas');groundCanvas.width=MW;groundCanvas.height=MH;
const screenCtx=ctx;ctx=groundCanvas.getContext('2d');
for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++)tileDraw(i,j);
ctx=screenCtx;
function drawHouse(o){
 const {x,y,w,h}=o;const roofTop=y+44,foot=y+h;
 // Deep shadow and textured plaster sit behind the sloped tiled roof.
 box(x+12,y+20,w,h-16,'#0c171b');
 const wall=ctx.createLinearGradient(x,y,x+w,y+h);
 wall.addColorStop(0,'#4a4d47');wall.addColorStop(.45,'#343b3b');wall.addColorStop(1,'#1c282c');
 box(x,y+roofTop,w,h-roofTop,wall);
 for(let yy=y+roofTop;yy<foot;yy+=35){
  line(x+4,yy,x+w-4,yy,'#17232999',1.2);
  for(let xx=x+10;xx<x+w;xx+=57){if(rnd(xx,yy)<.65)line(xx,yy+1,xx-5,yy+28,'#a4a29515',1)}
 }
 const lightX=x+w*.24,lightY=foot-64;
 box(lightX-6,lightY-6,60,64,'#192225');
 box(lightX,lightY,47,52,'#9a8055');
 box(lightX+5,lightY+4,36,43,'#ebba797e');
 for(let q=0;q<5;q++)line(lightX+6+q*8,lightY+4,lightX+6+q*8,lightY+46,'#322d2a',2);
 box(x+w*.72,foot-70,43,61,'#121d22');
 box(x+w*.72+4,foot-65,34,50,'#222e30');
 line(x+w*.72+22,foot-65,x+w*.72+22,foot-12,'#80857b',2);
 // Roof is a separate visual shape; its physical boundary remains the building footprint.
 const roof=ctx.createLinearGradient(x,y-80,x,roofTop+30);
 roof.addColorStop(0,'#273846');roof.addColorStop(.4,'#293943');roof.addColorStop(1,'#121e28');
 ctx.fillStyle=roof;ctx.beginPath();
 ctx.moveTo(x-19,roofTop);ctx.lineTo(x+w*.50,y-62);
 ctx.lineTo(x+w+19,roofTop);ctx.lineTo(x+w+7,roofTop+36);
 ctx.lineTo(x-7,roofTop+36);ctx.closePath();ctx.fill();
 ctx.save();ctx.beginPath();ctx.moveTo(x-19,roofTop);ctx.lineTo(x+w*.5,y-62);ctx.lineTo(x+w+19,roofTop);ctx.lineTo(x+w+7,roofTop+36);ctx.lineTo(x-7,roofTop+36);ctx.closePath();ctx.clip();
 for(let ry=y-55;ry<roofTop+43;ry+=12){
  const offset=Math.floor(ry/12)%2*17;
  line(x-24,ry,x+w+24,ry,'#5d677065',1.5);
  for(let rx=x-30+offset;rx<x+w+35;rx+=35){
   line(rx,ry,rx+4,ry+11,'#61747b55',1);
   line(rx+8,ry+3,rx+29,ry+3,'#08151cb0',2);
  }
 }
 ctx.restore();line(x-18,roofTop,x+w/2,y-61,'#79848a',2.5);line(x+w/2,y-61,x+w+19,roofTop,'#79848a',2.5);
}
function drawObject(o){if(!o.visible)return;const {x,y,w,h}=o;
if(o.renderMode==='ground'){
 if(o.style==='manhole'){ellipse(x+w/2,y+h/2,w*.5,h*.5,'#0b1517');ellipse(x+w/2,y+h/2,w*.40,h*.37,'#424a48');ellipse(x+w/2,y+h/2,w*.32,h*.29,'#1b2528');for(let k=0;k<8;k++){let a=k*Math.PI/4;line(x+w/2+Math.cos(a)*w*.15,y+h/2+Math.sin(a)*h*.12,x+w/2+Math.cos(a)*w*.28,y+h/2+Math.sin(a)*h*.22,'#63706e',1.4)}}
 else if(o.style==='drain'){box(x,y,w,h,'#151e20');for(let k=4;k<w;k+=7)line(x+k,y+3,x+k-2,y+h-3,'#677574',2)}
 else if(o.style==='leaves'){for(let k=0;k<13;k++){let xx=x+rnd(k,x)*w,yy=y+rnd(k,y)*h;ellipse(xx,yy,2+rnd(k,y)*4,1.2+rnd(k,x)*2,['#756541','#857349','#4d573a'][k%3])}}
 else if(o.style==='can'){ellipse(x+w/2,y+h/2,w*.58,h*.45,'#0a1113');box(x+2,y+1,w-4,h-3,'#69808a');line(x+3,y+3,x+w-3,y+3,'#c7d3c9',1)}
 return;
}
if(o.type==='lamp'){ellipse(x+w/2,y+h-1,10,4,'#0009');line(x+w/2,y+h,x+w/2,y+8,'#555955',5);line(x+w/2,y+9,x+w/2+14,y+8,'#7d8175',3);ellipse(x+w/2+15,y+10,12,6,'#b89759');ellipse(x+w/2+15,y+12,8,3,'#f5d99b');return}if(o.type==='house')return drawHouse(o);
if(o.type==='vending'){if(o.state==='fallen'||o.state==='falling'){ctx.save();ctx.translate(x+o.w/2,y+o.h-8);ctx.rotate(-Math.PI/2*Math.min(1,o.anim||1));ctx.translate(-(x+o.w/2),-(y+o.h-8))}if(imageReady('vending')){ctx.drawImage(artwork.vending,x-2,y-2,w+4,h+4);if(o.state==='fallen'||o.state==='falling')ctx.restore();return}
box(x+5,y+8,w,h,'#121719');box(x,y,w,h-4,'#a63435');box(x+7,y+8,w-14,h*.48,'#b4d5d3');for(let a=0;a<12;a++)box(x+10+(a%4)*9,y+12+Math.floor(a/4)*10,5,8,['#e6a775','#93b0d2','#f1e2b5'][a%3]);box(x+7,y+h-24,w-14,13,'#aeb2aa');box(x+36,y+h-21,8,7,'#242d32');if(o.state==='fallen'||o.state==='falling')ctx.restore();return}
if(o.type==='car'){ellipse(x+w/2,y+h-10,w*.58,25,'#0009');box(x+12,y+13,w-24,h-24,'#64665e');box(x+21,y+30,w-42,50,'#26323a');box(x+20,y+h-60,w-40,38,'#7c7a6c');box(x+5,y+30,13,32,'#1c2022');box(x+w-18,y+30,13,32,'#1c2022');box(x+18,y+h-16,21,7,'#a94b40');box(x+w-39,y+h-16,21,7,'#a94b40');return}
if(o.type==='fence'){box(x,y,w,h,'#54544a');for(let k=10;k<h;k+=23)line(x,y+k,x+w,y+k,'#242c2e',3);return}
if(o.type==='tree'&&imageReady('tree')){ctx.drawImage(artwork.tree,x-22,y-33,w+44,h+47);return}
if(o.type==='tree'){ellipse(x+w/2,y+h/2,w*.75,h*.65,'#0a1511');for(let k=0;k<19;k++){let xx=x+rnd(k,x)*w,yy=y+rnd(k,y)*h;ellipse(xx,yy,10+rnd(k,y)*15,9+rnd(k,x)*13,['#1b3327','#294333','#3b4a2c','#172a25'][k%4])}}}
// Player position is the center of the feet, not the sprite's head or torso.
function playerFeet(x,y){return {x:x-8,y:y-5,w:16,h:10}}
function pass(x,y){
 const foot=playerFeet(x,y);
 const probes=[[foot.x,foot.y],[foot.x+foot.w,foot.y],[foot.x,foot.y+foot.h],[foot.x+foot.w,foot.y+foot.h]];
 if(!probes.every(([tx,ty])=>groundedTerrain(tx,ty)))return false;
 return !objects.some(o=>touchesObject(o,foot));
}
function character(){
 const x=player.x,y=player.y;
 const bob=player.moving?Math.abs(Math.sin(player.step))*1.6:0;
 const key=player.dir==='up'?'hero_up':player.dir==='down'?'hero_down':'hero_side';
 ellipse(x,y+1,11,3.8,'#0008');
 if(imageReady(key)){
  ctx.save();
  if(player.dir==='left'){ctx.translate(x*2,0);ctx.scale(-1,1)}
  ctx.drawImage(artwork[key],x-22,y-63-bob,44,64);
  ctx.restore();return;
 }
 // Fallback if an asset fails to download.
 ctx.fillStyle='#744958';ctx.beginPath();ctx.ellipse(x,y-22,11,18,0,0,Math.PI*2);ctx.fill();
 ellipse(x,y-48,12,13,'#252733');
 ellipse(x,y-42,8,9,'#cfac9b');
}
function frame(ts){const dt=Math.min((ts-last)/1000,.05);last=ts;time=ts;updateWorld(dt);let dx=joy.x,dy=joy.y;if(keys.has('ArrowLeft')||keys.has('KeyA'))dx--;if(keys.has('ArrowRight')||keys.has('KeyD'))dx++;if(keys.has('ArrowUp')||keys.has('KeyW'))dy--;if(keys.has('ArrowDown')||keys.has('KeyS'))dy++;let n=Math.hypot(dx,dy);if(n>.08){dx/=Math.max(1,n);dy/=Math.max(1,n);const sp=(joy.dash||keys.has('ShiftLeft')||keys.has('ShiftRight')?210:120)*dt;const steps=Math.max(1,Math.ceil(sp/3));for(let k=0;k<steps;k++){let d=sp/steps;if(pass(player.x+dx*d,player.y))player.x+=dx*d;if(pass(player.x,player.y+dy*d))player.y+=dy*d}player.dir=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';player.step+=dt*11;player.moving=true}else player.moving=false
ctx.setTransform(D,0,0,D,0,0);box(0,0,W,H,'#071019');const z=Math.max(W/1000,H/710);const camX=Math.max(W/(2*z),Math.min(MW-W/(2*z),player.x)),camY=Math.max(H/(2*z),Math.min(MH-H/(2*z),player.y));ctx.save();ctx.translate(W/2-camX*z,H/2-camY*z);ctx.scale(z,z);
ctx.drawImage(groundCanvas,0,0);
for(const lamp of objects.filter(o=>o.type==='lamp'&&o.visible)){
 const x=lamp.x+lamp.w/2+15,y=lamp.y+lamp.h+18;
 const glow=ctx.createRadialGradient(x,y,2,x,y,210);
 glow.addColorStop(0,'#f0c47a59');glow.addColorStop(.25,'#d1a5632d');glow.addColorStop(1,'#d1a56300');
 box(x-210,y-210,420,420,glow);
}
// Ground decals and dropped items must always be BELOW feet and standing objects.
// Standing objects use their ground-contact Y (not their image top or array order).
const isGroundRenderable=o=>o.visible&&(o.renderMode==='ground'||(o.type==='vending'&&o.state==='fallen'));
const isStandingRenderable=o=>o.visible&&!isGroundRenderable(o);
const groundObjects=objects.filter(isGroundRenderable);
const standingObjects=objects.filter(isStandingRenderable);
for(const o of groundObjects)drawObject(o);
const depthActors=standingObjects.map(o=>({
 depth:o.depthY,order:0,draw:()=>drawObject(o)
}));
depthActors.push({depth:player.y,order:1,draw:character});
depthActors.sort((a,b)=>a.depth-b.depth||a.order-b.order);
for(const actor of depthActors)actor.draw();
if(debugCollision){ctx.save();for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){ctx.strokeStyle=tiles[j][i]?'#35d89755':'#c34d4d44';ctx.lineWidth=1;ctx.strokeRect(i*TILE,j*TILE,TILE,TILE)}
for(const o of objects){if(!o.collidable)continue;const b=objectBounds(o);ctx.fillStyle='#ef58563a';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='#ff9c84';ctx.strokeRect(b.x,b.y,b.w,b.h)}
let f=playerFeet(player.x,player.y);ctx.strokeStyle='#55ffff';ctx.lineWidth=2;ctx.strokeRect(f.x,f.y,f.w,f.h);ctx.restore()}
// Environmental light is on the ground; it never draws a solid disc above a character.

ctx.restore();let g=ctx.createRadialGradient(W/2,H/2,50,W/2,H/2,Math.max(W,H)*.7);g.addColorStop(0,'#0000');g.addColorStop(1,'#000b');box(0,0,W,H,g);requestAnimationFrame(frame)}
const pad=document.getElementById('pad'),nub=document.getElementById('nub');
const zone=document.createElement('div');zone.style.cssText='position:fixed;left:0;bottom:0;width:65vw;height:45dvh;z-index:8;touch-action:none;overscroll-behavior:none';document.body.appendChild(zone);pad.style.pointerEvents='none';pad.style.zIndex='9';
function move(e){let r=pad.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/60,y=(e.clientY-r.top-r.height/2)/60,m=Math.hypot(x,y),d=Math.max(1,m);joy.x=x/d;joy.y=y/d;joy.dash=m>.78;nub.style.transform='translate('+(joy.x*61)+'px,'+(joy.y*61)+'px)';nub.style.background=joy.dash?'#efbc76':'#d0d7d58c'}
zone.addEventListener('pointerdown',e=>{e.preventDefault();if(joy.id!==null)return;joy.id=e.pointerId;zone.setPointerCapture(e.pointerId);move(e)});
zone.addEventListener('pointermove',e=>{if(e.pointerId===joy.id){e.preventDefault();move(e)}});
for(const t of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(t,e=>{if(e.pointerId===joy.id){joy.id=null;joy.x=joy.y=0;joy.dash=false;nub.style.transform='none'}});
addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyB'&&!e.repeat)debugCollision=!debugCollision;if(e.code.startsWith('Arrow'))e.preventDefault()});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();joy.x=joy.y=0;joy.id=null;joy.dash=false;nub.style.transform='none'});
document.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault()},{passive:false});addEventListener('gesturestart',e=>{if(e.cancelable)e.preventDefault()},{passive:false});
// In-browser smoke tests: add ?test=1 to the URL to inspect basic scene invariants.
function sceneChecks(){
 const ids=objects.map(o=>o.id),ground=objects.filter(isGroundRenderable),standing=objects.filter(isStandingRenderable);
 return [
  ['unique IDs',new Set(ids).size===ids.length],
  ['all visible objects assigned once',ground.length+standing.length===objects.filter(o=>o.visible).length],
  ['ground item behind player',isGroundRenderable({type:'item',renderMode:'ground',visible:true})],
  ['fallen vending behind player',isGroundRenderable({type:'vending',renderMode:'depth',state:'fallen',visible:true})],
  ['upright vending depth sorted',isStandingRenderable(objectById.get('vending_01'))],
  ['ground items have no collision',objects.filter(o=>o.renderMode==='ground').every(o=>!o.collidable)],
  ['player start reachable',pass(player.x,player.y)],
  ['houses block walking',!pass(65+390/2,60+285/2)],
  ['west parking entrance walkable',pass(300,619)],
  ['west parking paved area walkable',pass(350,500)],
  ['east parking entrance walkable',pass(1400,619)],
  ['east parking paved area walkable',pass(1380,350)],
  ['vending machine top blocked',!pass(844,572)],
  ['parked car collision blocked',!pass(210,480)],
  ['road nearby vending walkable',pass(903,681)]
 ];
}
if(new URLSearchParams(location.search).has('test')){
 const checks=sceneChecks(),fail=checks.filter(([,ok])=>!ok);
 console.table(checks.map(([name,pass])=>({name,pass})));
 const e=document.getElementById('msg');e.style.opacity=1;e.style.bottom='40%';e.textContent=fail.length?'CHECK FAILED: '+fail.map(x=>x[0]).join(', '):'Scene checks: '+checks.length+' passed';
}
requestAnimationFrame(frame);
