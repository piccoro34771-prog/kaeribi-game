/* KAERIBI — 第一夜：雪の街角 / playable coherent diorama, v5.0
 * World-space illustration + explicitly authored traversable surfaces.
 * No stacked road decals or free-floating building sprites.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', {alpha:false, desynchronized:true});
  const $ = id => document.getElementById(id);
  const ui = {progress:$('progress'),caption:$('caption'),prompt:$('prompt'),act:$('act'),light:$('light'),dialog:$('dialog'),end:$('ending'),pad:$('pad'),nub:$('nub'),zone:$('zone'),status:$('loadStatus')};
  const WORLD = {w:1448,h:1086};
  const scene = new Image();
  // The compressed WebP is carried in a plain-text asset for reliable Pages deployment.
  fetch('assets/scene_winter_v5.b64.txt?v=500').then(r=>{if(!r.ok)throw Error('Scene HTTP '+r.status);return r.text()}).then(base64=>{scene.src='data:image/webp;base64,'+base64.trim()}).catch(e=>{ui.status.textContent='背景を読み込めませんでした。再読み込みしてください。';console.error(e)});
  const hero = new Image(); hero.src='assets/hero_winter.webp?v=400';
  let W=0,H=0,D=1,z=1,clock=0,last=0,ready=false,ended=false;
  const keys = new Set();
  const startX=626,startY=704;
  const player={x:startX,y:startY,dir:'down',moving:false,step:0,light:false};
  const camera={x:startX,y:startY};
  const stick={pointer:null,baseX:0,baseY:0,x:0,y:0,dash:false};
  const DEBUG=new URLSearchParams(location.search).has('debug');
  const story={vending:false,car:false,lamp:false,finish:false};
  let dialogUntil=0,footprint=0,breath=0,shadowT=0,shake=0;
  const map = {
    areas:[
      [[107,72],[178,75],[241,146],[326,241],[414,343],[517,455],[636,568],[725,641],[655,731],[581,657],[494,554],[399,447],[310,348],[228,264],[170,191],[104,131]],
      [[355,585],[443,573],[525,622],[604,640],[710,628],[811,598],[939,580],[1090,548],[1276,503],[1448,450],[1448,580],[1291,630],[1120,673],[997,696],[921,752],[863,822],[728,830],[596,771],[496,709],[403,670]],
      [[647,714],[793,682],[859,752],[908,833],[980,945],[1071,1086],[787,1086],[754,968],[691,855],[607,770]],
      [[833,419],[929,375],[1039,334],[1143,287],[1286,319],[1350,391],[1368,485],[1273,537],[1154,559],[1042,578],[928,596],[866,560]],
      [[1327,406],[1448,422],[1448,567],[1347,573],[1299,523]]
    ],
    solids:[
      [[583,342],[675,337],[676,512],[593,507]],              // upright vending machine
      [[1030,307],[1203,297],[1257,417],[1263,494],[1084,493],[1041,452]], // parked car
      [[1055,520],[1210,495],[1217,534],[1071,560]],         // red parking barrier
      [[674,463],[812,460],[823,572],[735,570]],             // bicycle + wall
      [[1262,525],[1305,528],[1320,559],[1264,567]],         // parking curb/cone
      [[804,496],[899,512],[935,587],[836,638],[808,611]]    // retaining garden wall
    ]
  };
  const events=[
    {id:'vending',x:562,y:504,r:66,label:'自販機の足元を調べる'},
    {id:'car',x:1320,y:450,r:78,label:'停まった車を調べる'},
    {id:'lamp',x:452,y:371,r:82,label:'街灯の下を見る'},
    {id:'exit',x:891,y:971,r:78,label:'帰り道を進む'}
  ];
  function inPolygon(x,y,poly){
    let c=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;
    }
    return c;
  }
  function canStand(x,y){
    const samples=[[0,0],[-9,0],[9,0],[0,-6],[0,6]];
    return samples.every(([ox,oy])=>{
      const px=x+ox,py=y+oy;
      return px>10&&px<WORLD.w-10&&py>15&&py<WORLD.h-13 &&
         map.areas.some(poly=>inPolygon(px,py,poly)) && !map.solids.some(poly=>inPolygon(px,py,poly));
    });
  }
  function resize(){
    W=innerWidth;H=innerHeight;D=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(W*D);canvas.height=Math.round(H*D);
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    z=Math.max(W/1120,H/780);z=Math.max(.72,Math.min(1.50,z));
  }
  resize();addEventListener('resize',resize,{passive:true});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
  const special = new Set();
  function show(text,ms=4500){
    ui.dialog.textContent=text;ui.dialog.classList.add('visible');dialogUntil=performance.now()+ms;
  }
  function refreshProgress(){
    const n=(story.vending?1:0)+(story.car?1:0);
    ui.progress.textContent=n===0?'雪の街角を歩く':n===1?'違和感をもうひとつ探す':n===2?'帰り道を確かめる':'雪の街角を歩く';
  }
  function availableEvent(){
    let nearest=null,best=9999;
    for(const e of events){
      if((e.id==='vending'&&story.vending)||(e.id==='car'&&story.car)||(e.id==='lamp'&&!story.vending)||(e.id==='lamp'&&story.lamp)||(e.id==='exit'&&(!story.car||!story.vending||story.finish)))continue;
      let d=dist(player.x,player.y,e.x,e.y);
      if(d<e.r&&d<best){nearest=e;best=d}
    }
    return nearest;
  }
  function interact(){
    if(ended)return;
    const e=availableEvent();if(!e)return;
    if(e.id==='vending'){
      story.vending=true;
      show('自販機の下に、濡れた小さな足跡。雪がないところまで続いている。',6000);
      special.add('track');
    }else if(e.id==='car'){
      story.car=true;
      show('車の窓は凍っている。なのに内側から、指でなぞった跡がある。「かえりみち」',6000);
      shadowT=performance.now()+1900;shake=3;
    }else if(e.id==='lamp'){
      story.lamp=true;
      show('街灯が一度だけ明滅した。自分の足音だけ、一拍遅れて聞こえた。',5500);
      shadowT=performance.now()+2100;
    }else if(e.id==='exit'){
      story.finish=true;ended=true;
      ui.end.classList.add('visible');
      ui.end.querySelector('small').textContent='第一夜・街角  —  つづく';
    }
    refreshProgress();
    ui.act.classList.remove('visible');ui.prompt.textContent='';
  }
  ui.act.addEventListener('pointerdown',e=>{e.preventDefault();interact()});
  function toggleLight(){player.light=!player.light;ui.light.classList.toggle('on',player.light);ui.light.setAttribute('aria-pressed',String(player.light))}
  ui.light.addEventListener('pointerdown',e=>{e.preventDefault();toggleLight()});
  $('restart').addEventListener('click',()=>{location.reload()});
  function pointerMove(e){
    const dx=e.clientX-stick.baseX,dy=e.clientY-stick.baseY;
    const mag=Math.hypot(dx,dy),m=Math.min(1,mag/68);
    stick.x=mag>8?dx/mag*m:0;stick.y=mag>8?dy/mag*m:0;
    stick.dash=mag>=78;
    ui.nub.style.transform=`translate(${stick.x*56}px,${stick.y*56}px)`;
    ui.pad.classList.toggle('running',stick.dash);
  }
  ui.zone.addEventListener('pointerdown',e=>{
    e.preventDefault();if(stick.pointer!==null)return;
    stick.pointer=e.pointerId;stick.baseX=e.clientX;stick.baseY=e.clientY;
    const p=ui.pad.getBoundingClientRect();
    const cx=clamp(e.clientX,p.width/2+12,W*.52-p.width/2),cy=clamp(e.clientY,H*.61,H-p.height/2-20);
    ui.pad.style.left=(cx-p.width/2)+'px';ui.pad.style.top=(cy-p.height/2)+'px';ui.pad.classList.add('engaged');
    stick.baseX=e.clientX;stick.baseY=e.clientY;
    ui.zone.setPointerCapture(e.pointerId);pointerMove(e);
  });
  ui.zone.addEventListener('pointermove',e=>{if(stick.pointer===e.pointerId){e.preventDefault();pointerMove(e)}});
  function release(e){if(e.pointerId===stick.pointer){stick.pointer=null;stick.x=stick.y=0;stick.dash=false;ui.nub.style.transform='';ui.pad.classList.remove('engaged','running')}}
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])ui.zone.addEventListener(ev,release);
  ui.zone.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault()},{passive:false});
  ui.zone.addEventListener('touchstart',e=>{if(e.cancelable)e.preventDefault()},{passive:false});
  document.addEventListener('touchmove',e=>{if(e.cancelable)e.preventDefault()},{passive:false});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('keydown',e=>{
    keys.add(e.code);
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    if((e.code==='KeyE'||e.code==='Space')&&!e.repeat)interact();
    if(e.code==='KeyF'&&!e.repeat)toggleLight();
    if(e.code==='KeyB'&&!e.repeat&&DEBUG)document.body.classList.toggle('debug');
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',()=>{keys.clear();stick.pointer=null;stick.x=stick.y=0;stick.dash=false;ui.nub.style.transform='';ui.pad.classList.remove('engaged','running')});
  function movePlayer(dt){
    let dx=stick.x,dy=stick.y;
    if(keys.has('KeyA')||keys.has('ArrowLeft'))dx--;
    if(keys.has('KeyD')||keys.has('ArrowRight'))dx++;
    if(keys.has('KeyW')||keys.has('ArrowUp'))dy--;
    if(keys.has('KeyS')||keys.has('ArrowDown'))dy++;
    const m=Math.hypot(dx,dy);
    if(m<.055||ended){player.moving=false;return}
    dx/=Math.max(1,m);dy/=Math.max(1,m);
    const speed=(stick.dash||keys.has('ShiftLeft')||keys.has('ShiftRight'))?185:112;
    const amount=speed*dt;let mx=0,my=0;
    const steps=Math.max(1,Math.ceil(amount/3));
    for(let k=0;k<steps;k++){
      const sx=dx*amount/steps,sy=dy*amount/steps;
      if(canStand(player.x+sx,player.y)){player.x+=sx;mx+=sx}
      if(canStand(player.x,player.y+sy)){player.y+=sy;my+=sy}
    }
    player.moving=Math.hypot(mx,my)>.01;
    if(player.moving){
      player.dir=Math.abs(mx)>Math.abs(my)?mx<0?'left':'right':my<0?'up':'down';
      player.step+=dt*((speed===185)?14.5:9.5);breath+=dt;
    }
  }
  function radial(x,y,r,inner,outer){
    const g=ctx.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,inner);g.addColorStop(1,outer);
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const lampSources=[{x:505,y:258,r:163},{x:1371,y:230,r:155},{x:897,y:295,r:72}];
  function drawDynamicLighting(){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const a of lampSources)radial(a.x,a.y,a.r,'rgba(236,167,76,.14)','rgba(245,156,44,0)');
    if(player.light){
      const a=player.dir==='up'?-Math.PI/2:player.dir==='down'?Math.PI/2:player.dir==='left'?Math.PI:0;
      const px=player.x,py=player.y-30;
      ctx.save();ctx.translate(px,py);ctx.rotate(a);
      let beam=ctx.createLinearGradient(6,0,215,0);
      beam.addColorStop(0,'rgba(227,234,209,.09)');beam.addColorStop(.55,'rgba(247,241,208,.16)');beam.addColorStop(1,'rgba(241,229,189,0)');
      ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(5,-11);ctx.lineTo(210,-82);ctx.quadraticCurveTo(236,0,210,82);ctx.lineTo(5,11);ctx.closePath();ctx.fill();ctx.restore();
      radial(px+Math.cos(a)*90,py+Math.sin(a)*90,98,'rgba(242,239,209,.15)','rgba(255,239,170,0)');
    }
    ctx.restore();
  }
  function drawFootprints(){
    if(!story.vending)return;
    const steps=[[698,608],[723,625],[756,638],[789,646],[827,644],[867,645],[903,640],[942,631],[986,620],[1031,608],[1080,602],[1133,583],[1188,574],[1245,556]];
    ctx.save();ctx.globalAlpha=.34;ctx.fillStyle='#111d23';
    steps.forEach(([x,y],i)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(-.22);
      ctx.beginPath();ctx.ellipse(-4,i%2?1:-1,2.8,5.5,-.18,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(3,i%2?-4:3,2.8,5.2,.16,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
  function drawHero(t){
    const x=player.x,y=player.y;
    ctx.fillStyle='rgba(1,7,16,.30)';ctx.beginPath();ctx.ellipse(x,y+1,18,6,0,0,Math.PI*2);ctx.fill();
    if(!hero.complete||!hero.naturalWidth){
      ctx.fillStyle='#8b554a';ctx.beginPath();ctx.arc(x,y-36,17,0,Math.PI*2);ctx.fill();return;
    }
    // The sprite sheet faces down / up / left / right by column, idle / step / step by row.
    const col=player.dir==='down'?0:player.dir==='up'?1:player.dir==='left'?2:3;
    const row=player.moving?1+(Math.floor(player.step/Math.PI*1.1)%2):0;
    const sw=hero.naturalWidth/4,sh=hero.naturalHeight/3;
    const bob=player.moving?Math.abs(Math.sin(player.step))*.8:0;
    ctx.drawImage(hero,col*sw,row*sh,sw,sh,x-38,y-82-bob,76,83);
    // Breath is emitted in winter air, not a second hard-coded sprite light source.
    if(player.moving&&breath>1.9){
      breath=0;
      special.add('breath');
    }
  }
  function drawShadow(t){
    if(t>shadowT||!hero.complete||!hero.naturalWidth)return;
    let k=(shadowT-t)/2000;ctx.save();ctx.globalAlpha=Math.min(.26,Math.max(0,k*.28));ctx.filter='brightness(0) blur(2px)';
    ctx.drawImage(hero,hero.naturalWidth/4,0,hero.naturalWidth/4,hero.naturalHeight/3,450-(1-k)*13,620,62,72);
    ctx.restore();
  }
  function drawDebug(){
    if(!document.body.classList.contains('debug'))return;
    ctx.save();ctx.lineWidth=2;
    for(const poly of map.areas){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='rgba(50,208,121,.14)';ctx.fill();ctx.strokeStyle='#66f59a';ctx.stroke()}
    for(const poly of map.solids){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='rgba(255,53,64,.29)';ctx.fill();ctx.strokeStyle='#ff6060';ctx.stroke()}
    ctx.restore();
  }
  function tick(t){
    requestAnimationFrame(tick);
    if(!ready)return;
    let dt=Math.min((t-last)/1000||.016,.042);last=t;clock=t;
    if(t>dialogUntil)ui.dialog.classList.remove('visible');
    movePlayer(dt);
    const ev=availableEvent();
    ui.prompt.textContent=ev?ev.label:'';
    ui.act.classList.toggle('visible',!!ev);
    let goalX=clamp(player.x,W/(2*z),WORLD.w-W/(2*z));
    let goalY=clamp(player.y,H/(2*z),WORLD.h-H/(2*z));
    // When the visible area is larger than the map, center it instead of oscillating.
    if(W/z>=WORLD.w)goalX=WORLD.w/2;
    if(H/z>=WORLD.h)goalY=WORLD.h/2;
    camera.x+=(goalX-camera.x)*Math.min(1,dt*8.2);
    camera.y+=(goalY-camera.y)*Math.min(1,dt*8.2);
    ctx.setTransform(D,0,0,D,0,0);ctx.fillStyle='#06101b';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(W/2-camera.x*z,H/2-camera.y*z);ctx.scale(z,z);
    ctx.drawImage(scene,0,0,WORLD.w,WORLD.h);
    drawDynamicLighting();
    drawFootprints();drawShadow(t);drawHero(t);drawDebug();
    ctx.restore();
    const vg=ctx.createRadialGradient(W*.5,H*.45,Math.min(W,H)*.19,W*.5,H*.5,Math.max(W,H)*.78);
    vg.addColorStop(0,'rgba(1,6,13,0)');vg.addColorStop(1,'rgba(0,2,11,.56)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }
  function loadDone(){
    if(scene.complete&&scene.naturalWidth&&hero.complete&&hero.naturalWidth){
      if(!ready){ready=true;ui.status.classList.add('hidden');show('雪がやんだ。帰り道は、まだ覚えている。',5000);refreshProgress()}
    }else if((scene.complete&&!scene.naturalWidth)||(hero.complete&&!hero.naturalWidth)){
      ui.status.textContent='画像を読み込めませんでした。ページを再読み込みしてください。';
    }
  }
  scene.addEventListener('load',loadDone);hero.addEventListener('load',loadDone);
  scene.addEventListener('error',loadDone);hero.addEventListener('error',loadDone);
  if(scene.complete&&hero.complete)loadDone();
  refreshProgress();requestAnimationFrame(tick);
  // Deterministic checks can be inspected at ?debug=1 in the developer console.
  window.kaeribiCheck=()=>({
    assets:ready,
    startReachable:canStand(startX,startY),
    vendingSolid:!canStand(631,424),
    carSolid:!canStand(1144,401),
    parkingWalkable:canStand(953,471),
    roadwayWalkable:canStand(615,701),
    world:WORLD,
    player:{x:Math.round(player.x),y:Math.round(player.y),dir:player.dir},
    story:{...story}
  });
})();