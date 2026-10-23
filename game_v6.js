/* KAERIBI 6.0 — modular miniature neighborhood.
   Every rendered prop and its collider come from KAERIBI_TOWN, not a single painted screenshot.
   Road surfaces are separately authored and precisely match player navigation.
*/
(() => {
'use strict';
const T=window.KAERIBI_TOWN;
if(!T)throw Error('Town site plan was not loaded');
const $=s=>document.getElementById(s),canvas=$('scene'),ctx=canvas.getContext('2d',{alpha:false});
const UI={hud:$('hud'),status:$('status'),pad:$('pad'),nub:$('nub'),touch:$('touchZone'),interact:$('interact'),light:$('light'),hint:$('hint'),modal:$('modal'),debug:$('debugLabel')};
const world=T.world;let screenW=innerWidth,screenH=innerHeight,dpr=1,zoom=0.70,clock=0,last=0,ready=false;
const keys=new Set(),params=new URLSearchParams(location.search),debug=params.has('debug');
const cam={x:T.start.x,y:T.start.y};
const player={x:T.start.x,y:T.start.y,dir:T.start.dir,moved:0,phase:0,rest:0,lastDir:T.start.dir};
const stick={id:null,cx:0,cy:0,x:0,y:0,dash:false};
let torch=false,finished=false,dialogUntil=0,activeAction=null,delay=0;
const found=new Set();
const assets={snowhouse:window.KAERIBI_V6_SNOWHOUSE,housesclean:window.KAERIBI_V6_HOUSESCLEAN,houses:'assets/houses_winter.webp?v=600',props:'assets/town_winter.webp?v=600',architecture:'assets/architecture_v41.webp?v=600',road:'assets/street_tiles_v41.webp?v=600',hero:'assets/hero_winter.webp?v=600'};
const imgs={};for(const [id,url]of Object.entries(assets)){const im=new Image();im.decoding='async';im.src=url;imgs[id]=im}
const motion=window.KAERIBI_MOTION_SHEETS||{},walkAtlas=new Image(),actionAtlas=new Image();
if(motion.walk)walkAtlas.src=motion.walk;if(motion.action)actionAtlas.src=motion.action;
const loaded=im=>im&&im.complete&&im.naturalWidth>0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const inside=(x,y,r)=>x>=r[0]&&x<=r[0]+r[2]&&y>=r[1]&&y<=r[1]+r[3];
const dist=(x,y,a,b)=>Math.hypot(x-a,y-b);
const collision=T.objects.filter(o=>o.solid);
function safe(x,y){
 if(x<13||y<13||x>world.w-13||y>world.h-13)return false;
 // A small foot circle, not the head or painted hair, occupies the pavement.
 return [[0,0],[-11,0],[11,0],[0,-8],[0,8]].every(([dx,dy])=>{
  const X=x+dx,Y=y+dy;
  return T.surfaces.some(s=>inside(X,Y,s.rect))&&!collision.some(o=>inside(X,Y,o.solid));
 });
}
function scaleCanvas(){
 screenW=innerWidth;screenH=innerHeight;dpr=Math.min(devicePixelRatio||1,1.7);
 canvas.width=Math.round(screenW*dpr);canvas.height=Math.round(screenH*dpr);
 canvas.style.width=screenW+'px';canvas.style.height=screenH+'px';
 zoom=clamp(Math.min(screenW/690,screenH/900),.53,1.15);
}
scaleCanvas();addEventListener('resize',scaleCanvas,{passive:true});
const phase=(n,k=0)=>{let x=Math.sin(n*73.62+k*239.1)*43758.5453;return x-Math.floor(x)};
const ground=document.createElement('canvas');ground.width=world.w;ground.height=world.h;const g=ground.getContext('2d',{alpha:false});
function crop(c,img,src,draw){if(!loaded(img))return;c.drawImage(img,src[0],src[1],src[2],src[3],draw[0],draw[1],draw[2],draw[3]);}
function paintGround(){
 // Deep winter greenery sits outside physically paved routes.
 let grad=g.createLinearGradient(0,0,world.w,world.h);grad.addColorStop(0,'#152225');grad.addColorStop(.56,'#1b2928');grad.addColorStop(1,'#111b20');g.fillStyle=grad;g.fillRect(0,0,world.w,world.h);
 for(let i=0;i<3700;i++){
  const x=phase(i,1)*world.w,y=phase(i,2)*world.h;
  if(T.surfaces.some(s=>inside(x,y,s.rect)))continue;
  g.fillStyle=i%5===0?'#c9d3d229':'#6077762a';g.beginPath();g.ellipse(x,y,phase(i,3)*6+1,phase(i,4)*3+1,0,0,Math.PI*2);g.fill();
 }
 // Roads first. The cross is paved continuously — no tile-piece overlap or seams.
 for(const s of T.surfaces.filter(s=>s.kind==='road')){
  const [x,y,w,h]=s.rect;const gr=g.createLinearGradient(x,y,x+w,y+h);
  gr.addColorStop(0,'#33383b');gr.addColorStop(.55,'#303537');gr.addColorStop(1,'#383b3c');g.fillStyle=gr;g.fillRect(x,y,w,h);
 }
 // Parking/pavement are separate materials but share walkability with their visual extent.
 for(const s of T.surfaces.filter(s=>s.kind!=='road')){
  const [x,y,w,h]=s.rect;
  g.fillStyle=s.kind==='parking'?'#434744':'#565a54';g.fillRect(x,y,w,h);
  for(let yy=y+7;yy<y+h;yy+=33){g.strokeStyle='#9ba0991b';g.beginPath();g.moveTo(x+3,yy);g.lineTo(x+w-3,yy);g.stroke()}
 }
 // Hand-painted paving components are grounded to the very same physical surfaces.
 // No image contains a house/obstacle; those objects are depth-sorted separately.
 if(loaded(imgs.road)){
  const art=imgs.road;
  g.save();g.globalAlpha=.90;
  for(const s of T.surfaces){
   const [x,y,w,h]=s.rect;
   if(s.kind==='parking'){
    // Cropping away the snow-plugged bottom edge keeps the entrance visibly open.
    g.drawImage(art,359,542,328,212,x,y,w,h);
   }else if(s.kind==='road' && w<460 && h>500){
    g.drawImage(art,26,41,241,273,x,y,w,h);
   }else if(s.kind==='road' && h<460 && w>800){
    g.save();g.translate(x,y+h);g.rotate(-Math.PI/2);
    for(let off=0;off<w;off+=410){const size=Math.min(410,w-off);g.drawImage(art,26,41,241,273,0,off,h,size)}g.restore();
   }else if(s.kind==='road'){
    g.drawImage(art,26,41,241,273,x,y,w,h);
   }else if(s.kind==='paving' && w>130){
    g.globalAlpha=.7;g.drawImage(art,721,540,314,241,x,y,w,h);g.globalAlpha=.90;
   }
  }
  // A painted crossing re-establishes continuity at the four-way intersection.
  g.drawImage(art,947,35,449,473,768,545,504,518);
  g.restore();
 }
 // Procedural aggregate, distributed only on real paved areas; not obvious square tiles.
 for(let i=0;i<14000;i++){
  const x=phase(i,19)*world.w,y=phase(i,20)*world.h;
  if(!T.surfaces.some(s=>inside(x,y,s.rect)))continue;
  g.fillStyle=i%5===0?'#bdc6c21a':'#15232627';g.fillRect(x,y,.6+phase(i,5)*2.2,.4+phase(i,6)*1.6);
 }
 // Continuous curbstones are painted only where paving actually meets unpaved land.
 for(const s of T.surfaces){
  const [x,y,w,h]=s.rect;if(s.kind==='road')continue;
  g.strokeStyle='#a6a79b83';g.lineWidth=2;g.strokeRect(x+.5,y+.5,w-1,h-1);
 }
 // Snow along outside edges of streets, not a fake white wall across junctions.
 for(const s of T.surfaces){
  if(s.kind!=='road')continue;
  const [x,y,w,h]=s.rect,step=13;
  for(let edge=0;edge<4;edge++){
   const n=(edge%2? h:w)/step;
   for(let i=0;i<n;i++){
    const X=edge===0?x+i*step:edge===2?x+i*step:edge===1?x+w:x;
    const Y=edge===0?y:edge===2?y+h:edge===1?y+i*step:y+i*step;
    const oX=edge===1?4:edge===3?-4:0,oY=edge===0?-4:edge===2?4:0;
    if(T.surfaces.some(t=>t.id!==s.id&&inside(X+oX,Y+oY,t.rect)))continue;
    if(phase(i,edge+s.rect[0])>.76)continue;
    const rr=3+phase(i,edge+8)*7;g.fillStyle='#b7c1c078';g.beginPath();g.ellipse(X,Y,rr,2+phase(i,edge+9)*3,0,0,Math.PI*2);g.fill();
   }
  }
 }
 // Painted parking bays are *inside* the accessible slab; barrier never blocks their entrance.
 for(const s of T.surfaces.filter(s=>s.kind==='parking')){
  const [x,y,w,h]=s.rect;g.strokeStyle='#c1c3b77a';g.lineWidth=4;
  for(const px of [x+26,x+w/2,x+w-26]){g.beginPath();g.moveTo(px,y+34);g.lineTo(px,y+h-20);g.stroke()}
  g.fillStyle='#8e9082';for(const px of [x+w/3-20,x+w*2/3-20]){g.fillRect(px,y+17,40,11);g.fillStyle='#242a2b';g.fillRect(px,y+25,40,2);g.fillStyle='#8e9082'}
 }
 // Organic damp asphalt cracks. Their direction is coherent across street and junction.
 for(let i=0;i<85;i++){
  const x=phase(i,40)*world.w,y=phase(i,41)*world.h;
  if(!T.surfaces.some(s=>s.kind==='road'&&inside(x,y,s.rect)))continue;
  const dx=(phase(i,42)-.5)*48,dy=25+phase(i,43)*55;
  g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx/3,y+dy/2,x+dx,y+dy);g.lineWidth=1.3;g.strokeStyle='#121d2170';g.stroke();
 }
 for(const d of T.groundDetails){const img=imgs[d.atlas];crop(g,img,d.src,d.draw)}
}
function objectsSorted(){return T.objects.slice().sort((a,b)=>a.baseY-b.baseY)}
const objs=objectsSorted();
function shadow(c,o){
 const [x,y,w,h]=o.solid||o.draw;
 c.fillStyle='#01050961';c.beginPath();c.ellipse(x+w*.55,y+h-2,Math.max(8,w*.47),Math.max(4,Math.min(18,h*.08)),0,0,Math.PI*2);c.fill();
}
function drawObj(o){shadow(ctx,o);crop(ctx,imgs[o.atlas],o.src,o.draw)}
function drawHero(){
 const x=player.x,y=player.y,action=activeAction;
 ctx.save();ctx.translate(x,y);
 const shadowSize=action?11:12;ctx.fillStyle='#03090ba0';ctx.beginPath();ctx.ellipse(0,0,shadowSize,4,0,0,Math.PI*2);ctx.fill();
 const row=({down:0,left:1,right:2,up:3})[player.dir]||0;
 let source=walkAtlas,cols=8,frame=0;
 if(action&&loaded(actionAtlas)){
  source=actionAtlas;cols=4;
  const q=clamp(action.elapsed/action.duration,0,.999);frame=q<.29?Math.floor(q/.29*2):q<.74?2:3;
 } else if(player.moved>.08&&loaded(walkAtlas)){
  // The 8-frame cycle passes through a near-closed-feet silhouette after every step.
  const order=[0,1,2,3,4,5,6,7];frame=order[Math.floor(player.phase)%8];
 }
 if(loaded(source)){
  const sx=Math.floor(source.naturalWidth/cols),sy=Math.floor(source.naturalHeight/4);
  const lean=player.moved>.3?Math.sin(player.phase*Math.PI/4)*.012:0;
  ctx.rotate(lean);
  ctx.drawImage(source,frame*sx,row*sy,sx,sy,-42,-85,84,85);
 }else if(loaded(imgs.hero)){
  const im=imgs.hero,sw=im.naturalWidth/4,sh=im.naturalHeight/3;
  const col=({down:0,up:1,left:2,right:3})[player.dir]||0;
  ctx.drawImage(im,col*sw,0,sw,sh,-41,-84,82,84);
 }else{
  ctx.fillStyle='#74454c';ctx.fillRect(-9,-35,18,28);ctx.fillStyle='#282d36';ctx.beginPath();ctx.arc(0,-41,14,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
function pickEvent(){
 if(finished)return null;
 let best=null,bestDist=9999;
 for(const e of T.interactions){
  if(found.has(e.id))continue;
  if(e.id==='exit'&&(!found.has('vending')||!found.has('car')))continue;
  const d=dist(player.x,player.y,...e.at);
  if(d<e.radius&&d<bestDist){best=e;bestDist=d}
 }
 return best;
}
function showMessage(msg,seconds=4){UI.modal.textContent=msg;UI.modal.classList.add('visible');dialogUntil=performance.now()+seconds*1000}
function act(){
 if(activeAction||finished)return;
 const e=pickEvent();if(!e)return;
 activeAction={id:e.id,elapsed:0,duration:1.05};player.moved=0;found.add(e.id);
 if(e.id==='vending')showMessage('雪の残る自販機の足元。小さな足跡が、道路の方へ続いている。',5);
 else if(e.id==='car')showMessage('車の窓の内側に、指でなぞったような文字。「かえりみち」',5);
 else if(e.id==='lamp')showMessage('街灯の下だけ、雪が妙に薄い。ここで誰かが立ち止まったのだろうか。',5);
 else if(e.id==='exit'){finished=true;showMessage('雪の路地を抜けた。けれど、窓明かりが一つだけ増えていた。 — 第一夜・おわり',20)}
}
function showInteractions(){
 if(performance.now()>dialogUntil)UI.modal.classList.remove('visible');
 const e=pickEvent();UI.interact.classList.toggle('visible',!!e&&!activeAction);
 if(e&&!activeAction){UI.interact.setAttribute('aria-label',e.label);UI.hint.textContent=e.label}else UI.hint.textContent='';
}
function move(dt){
 if(activeAction){activeAction.elapsed+=dt;if(activeAction.elapsed>=activeAction.duration)activeAction=null;player.moved=0;return}
 let dx=stick.x,dy=stick.y;
 if(keys.has('a')||keys.has('ArrowLeft'))dx-=1;
 if(keys.has('d')||keys.has('ArrowRight'))dx+=1;
 if(keys.has('w')||keys.has('ArrowUp'))dy-=1;
 if(keys.has('s')||keys.has('ArrowDown'))dy+=1;
 const mag=Math.hypot(dx,dy);
 if(mag>.02){dx/=Math.max(1,mag);dy/=Math.max(1,mag)}else{dx=dy=0}
 const speed=(stick.dash||keys.has('Shift')?231:129);
 const oldX=player.x,oldY=player.y;
 let d=Math.min(dt,.045)*speed;
 const vx=dx*d,vy=dy*d;
 // Separate-axis slide, 3 substeps for narrow passages and frame-rate independence.
 for(let i=0;i<3;i++){
  if(vx&&safe(player.x+vx/3,player.y))player.x+=vx/3;
  if(vy&&safe(player.x,player.y+vy/3))player.y+=vy/3;
 }
 const moved=Math.hypot(player.x-oldX,player.y-oldY);
 if(moved>.04){
  player.rest=0;player.moved=moved;
  player.phase=(player.phase+moved/19)%8;
  // Preserve the previous heading until the next actual step, avoiding flicker against obstacles.
  if(Math.abs(dx)>Math.abs(dy)*1.12)player.dir=dx>0?'right':'left';
  else if(Math.abs(dy)>.03)player.dir=dy>0?'down':'up';
 }else{
  player.rest+=dt;player.moved=0;
  // Stop in place at the end of the actual spatial movement, not on every held input.
  if(player.rest>.10)player.phase=0;
 }
}
function drawLight(){
 // Neutral prop art. Dynamic lighting is a separate pass so new lanterns/flashlights can be added.
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const l of T.lightSources){const gr=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);
  const [r,g,b]=l.color;gr.addColorStop(0,`rgba(${r},${g},${b},.18)`);gr.addColorStop(.36,`rgba(${r},${g},${b},.07)`);gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);
 }
 if(torch){const r=240,gr=ctx.createRadialGradient(player.x,player.y,9,player.x,player.y,r);
 gr.addColorStop(0,'rgba(215,231,232,.26)');gr.addColorStop(.4,'rgba(168,202,217,.12)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(player.x-r,player.y-r,r*2,r*2)}
 ctx.restore();
}
function drawDebug(){
 if(!debug)return;
 ctx.save();for(const s of T.surfaces){const [x,y,w,h]=s.rect;ctx.strokeStyle=s.kind==='road'?'#66e1a5aa':'#7bb0ffbb';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h)}
 for(const o of collision){const [x,y,w,h]=o.solid;ctx.fillStyle='#ef526f45';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#f77a79';ctx.strokeRect(x,y,w,h)}
 ctx.restore();
}
function frame(t){
 const dt=clamp((t-last)/1000||.016,0,.055);last=t;clock+=dt;
 if(ready){
  move(dt);
  const friction=Math.min(1,dt*5);cam.x+=(player.x-cam.x)*friction;cam.y+=(player.y-cam.y)*friction;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0b1217';ctx.fillRect(0,0,screenW,screenH);
  ctx.save();ctx.translate(screenW/2,screenH/2);ctx.scale(zoom,zoom);ctx.translate(-cam.x,-cam.y);
  ctx.drawImage(ground,0,0);
  // All upright objects and the player share the EXACT same depth sort.
  const depthList=[...objs,{id:'__player',baseY:player.y}];depthList.sort((a,b)=>a.baseY-b.baseY);
  for(const o of depthList){if(o.id==='__player')drawHero();else drawObj(o)}
  drawLight();drawDebug();ctx.restore();
  showInteractions();
  if(debug){UI.debug.textContent=`(x ${Math.round(player.x)} y ${Math.round(player.y)}) canStand:${safe(player.x,player.y)} · objects:${objs.length} · events:${found.size}`}
 }
 requestAnimationFrame(frame);
}
function joystick(e){
 const dx=e.clientX-stick.cx,dy=e.clientY-stick.cy,r=Math.hypot(dx,dy),bound=74;
 stick.x=dx/Math.max(bound,r);stick.y=dy/Math.max(bound,r);stick.dash=r>88;
 const nx=clamp(dx,-59,59),ny=clamp(dy,-59,59);
 UI.nub.style.transform=`translate(${nx}px,${ny}px)`;
 UI.pad.classList.toggle('running',stick.dash);
}
function down(e){if(stick.id!==null)return;e.preventDefault();stick.id=e.pointerId;
 const rect=UI.pad.getBoundingClientRect();stick.cx=rect.left+rect.width/2;stick.cy=rect.top+rect.height/2;
 UI.touch.setPointerCapture(e.pointerId);joystick(e)}
function end(e){if(e.pointerId!==stick.id)return;stick.id=null;stick.x=stick.y=0;stick.dash=false;UI.nub.style.transform='';UI.pad.classList.remove('running')}
UI.touch.addEventListener('pointerdown',down);UI.touch.addEventListener('pointermove',e=>{if(e.pointerId===stick.id){e.preventDefault();joystick(e)}});
for(const type of ['pointerup','pointercancel','lostpointercapture'])UI.touch.addEventListener(type,end);
UI.interact.addEventListener('pointerdown',e=>{e.preventDefault();act()});UI.light.addEventListener('pointerdown',e=>{e.preventDefault();torch=!torch;UI.light.classList.toggle('on',torch)});
addEventListener('keydown',e=>{if(/^(Arrow| )/.test(e.key))e.preventDefault();keys.add(e.key.length===1?e.key.toLowerCase():e.key);if(e.key==='e'||e.key==='E'||e.key===' ')act();if(e.key==='f'||e.key==='F'){torch=!torch;UI.light.classList.toggle('on',torch)}});
addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
addEventListener('blur',()=>{keys.clear();stick.id=null;stick.x=stick.y=0;stick.dash=false;UI.nub.style.transform='' });
for(const type of ['touchmove','gesturestart'])document.addEventListener(type,e=>{if(e.cancelable)e.preventDefault()},{passive:false});
Promise.all(Object.entries(imgs).map(([id,im])=>new Promise((res,rej)=>{if(loaded(im))return res();im.addEventListener('load',res,{once:true});im.addEventListener('error',()=>rej(new Error('asset '+id)),{once:true})}))).then(()=>{paintGround();ready=true;UI.status.textContent='';UI.hud.classList.add('ready');}).catch(e=>{UI.status.textContent='街の素材を読み込めませんでした。再読み込みしてください。';console.error(e)});
// Geometry regression checks for representative locations; can be invoked from console.
function checks(){
 const cases={mainRoad:safe(1000,840),northStreet:safe(1030,240),southStreet:safe(1030,1350),westParkingEntry:safe(615,635),westParkingBay:safe(601,470),eastParkingBay:safe(1445,520),vendingBlocked:!safe(779,573),carBlocked:!safe(460,492),roofBlocked:!safe(400,270),alleyOpen:safe(80,880),noInvisibleHouse:safe(1030,1070)};
 return {...cases,allPass:Object.values(cases).every(Boolean)}
}
window.KAERIBI_V6={town:T,checks,safe,player,warp(x,y){if(safe(x,y)){player.x=x;player.y=y;cam.x=x;cam.y=y;return true}return false}};
requestAnimationFrame(frame);
})();