/* KAERIBI — 第一夜：雪の街角 / playable coherent diorama, v5.2
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
  // Sprite atlases are separate neutral-light drawings with fixed foot registration.
  // They may load after the scene: the previous hero drawing remains a fallback.
  const motionSprites=window.KAERIBI_MOTION_SHEETS||{};
  const motionWalk=new Image(); if(motionSprites.walk)motionWalk.src=motionSprites.walk;
  const motionAction=new Image(); if(motionSprites.action)motionAction.src=motionSprites.action;
  let W=0,H=0,D=1,z=1,clock=0,last=0,ready=false,ended=false;
  const keys = new Set();
  const startX=626,startY=704;
  const player={x:startX,y:startY,dir:'down',moving:false,step:0,light:false};
  const camera={x:startX,y:startY};
  const stick={pointer:null,baseX:0,baseY:0,x:0,y:0,dash:false};
  const DEBUG=new URLSearchParams(location.search).has('debug');
  const story={vending:false,car:false,lamp:false,finish:false};
  let dialogUntil=0,footprint=0,breath=0,shadowT=0,shake=0;
  // Every pose has a painted in-between; elapsed time controls START/STOP/INSPECT transitions.
  const anim={state:'idle',elapsed:0,walkDistance:0,idleAge:0,action:null,wasMoving:false,dashing:false,blockedFor:0,actualDistance:0,transitionCount:0};
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
  // Roofs are painted into the illustrated scene. The painted area is NOT walkable.
  // The same geometry is used for the foreground pass, so players cannot stand on tiles.
  // These shapes are scene-specific polygons traced in world-space pixels.
  const roofMasks=[
    {id:'house_south_east',depth:970,poly:[[987,659],[1182,597],[1345,623],[1447,684],[1447,1012],[1384,978],[1317,924],[1191,875],[1099,836],[1024,824],[972,757]]},
    {id:'house_south_west',depth:1025,poly:[[0,721],[191,703],[269,707],[348,739],[411,883],[331,950],[0,932]]},
    {id:'house_north_west',depth:476,poly:[[0,0],[239,0],[218,118],[176,256],[89,352],[0,390]]}
  ];
  const houseSolids=[
    // SE roof + walls. Footprints are intentionally wider than roof-only silhouettes.
    [[1010,672],[1182,603],[1369,650],[1447,700],[1447,1084],[1101,1084],[1030,943],[984,780]],
    // SW roof and building wall: nearby road stays clear.
    [[0,747],[223,712],[309,755],[415,908],[390,1085],[0,1085]],
    // NW corner house.
    [[0,0],[242,0],[224,121],[183,269],[91,366],[0,418]]
  ];
  map.solids.push(...houseSolids);
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
    const e=availableEvent();if(!e||anim.action)return;
    anim.action={kind:e.id==='vending'?'kneel':e.id==='car'?'lean':'look',time:0,duration:e.id==='vending'?1.55:1.05};
    anim.state='idle';anim.elapsed=0;player.moving=false;
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
  // Travel-based locomotion: collision blocks spatial movement AND the gait clock.
  // A short blocked hysteresis prevents 1px wall tangencies from restarting animation.
  function movePlayer(dt){
    let dx=stick.x,dy=stick.y;
    if(keys.has('KeyA')||keys.has('ArrowLeft'))dx--;
    if(keys.has('KeyD')||keys.has('ArrowRight'))dx++;
    if(keys.has('KeyW')||keys.has('ArrowUp'))dy--;
    if(keys.has('KeyS')||keys.has('ArrowDown'))dy++;
    const m=Math.hypot(dx,dy);
    if(anim.action){
      if(m>.24 && anim.action.time>anim.action.duration*.76){
        anim.action=null;anim.state='starting';anim.elapsed=0;anim.transitionCount++;
      }else{player.moving=false;anim.actualDistance=0;return}
    }
    if(m<.075||ended){
      if(anim.wasMoving){anim.state='stopping';anim.elapsed=0;anim.transitionCount++}
      anim.actualDistance=0;anim.blockedFor=0;
      player.moving=false;anim.wasMoving=false;
      return;
    }
    dx/=Math.max(1,m);dy/=Math.max(1,m);
    const dashing=stick.dash||keys.has('ShiftLeft')||keys.has('ShiftRight');
    const speed=dashing?185:112;
    const amount=speed*dt, steps=Math.max(1,Math.ceil(amount/2.5));
    const beforeX=player.x,beforeY=player.y;
    for(let k=0;k<steps;k++){
      const sx=dx*amount/steps,sy=dy*amount/steps;
      // Order major axis first. When an edge blocks one axis the other glides naturally.
      if(Math.abs(dx)>Math.abs(dy)){
        if(canStand(player.x+sx,player.y))player.x+=sx;
        if(canStand(player.x,player.y+sy))player.y+=sy;
      }else{
        if(canStand(player.x,player.y+sy))player.y+=sy;
        if(canStand(player.x+sx,player.y))player.x+=sx;
      }
    }
    const mx=player.x-beforeX,my=player.y-beforeY;
    const actuallyMoved=Math.hypot(mx,my);
    anim.actualDistance=actuallyMoved;
    // Movement smaller than a small ground-space tolerance is not a completed step.
    if(actuallyMoved>Math.max(.16,dt*7)){
      anim.blockedFor=0;
      player.moving=true;
      if(!anim.wasMoving||anim.state==='stopping'){
        anim.state='starting';anim.elapsed=0;anim.transitionCount++;
      }
      player.dir=Math.abs(mx)>Math.abs(my)?mx<0?'left':'right':my<0?'up':'down';
      anim.walkDistance+=Math.min(actuallyMoved,8.5);
      anim.idleAge=0;anim.dashing=dashing;
      breath+=dt;
    }else{
      anim.blockedFor+=dt;
      // Keep the frame still during minor collisions, then settle into a stop.
      if(anim.blockedFor>=.105){
        if(anim.wasMoving){anim.state='stopping';anim.elapsed=0;anim.transitionCount++}
        player.moving=false;
      }
    }
    anim.wasMoving=player.moving;
  }
  function updateAnimation(dt){
    anim.elapsed+=dt;
    if(anim.action){
      anim.action.time=Math.min(anim.action.duration,anim.action.time+dt);
      if(anim.action.time>=anim.action.duration){
        anim.action=null;anim.state='idle';anim.elapsed=0;anim.idleAge=0;
        anim.transitionCount++;
      }
      return;
    }
    if(!player.moving){
      // An extended blocked input must never cause a rapid start/stop loop.
      anim.idleAge+=dt;
      if(anim.state==='stopping'&&anim.elapsed>=.16){anim.state='idle';anim.elapsed=0}
      if(anim.state==='starting'&&anim.blockedFor>=.105){anim.state='stopping';anim.elapsed=0}
    }
    if(player.moving&&anim.state==='starting'&&anim.elapsed>=.15){anim.state='moving';anim.elapsed=0}
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
  // Source naming convention is defined in assets/hero_motion_manifest_v52.json.
  // The eight-frame loop deliberately returns to *closed feet* between contacts.
  const strideFrames=[0,2,1,3,0,4,1,5];
  const spriteGrid={width:136,height:164,rows:{down:0,left:1,right:2,up:3}};
  function drawHero(t){
    const x=player.x,y=player.y;
    ctx.fillStyle='rgba(1,7,16,.28)';ctx.beginPath();ctx.ellipse(x,y+1,15.5,4.3,0,0,Math.PI*2);ctx.fill();
    if(motionWalk.complete&&motionWalk.naturalWidth){
      const row=spriteGrid.rows[player.dir],Wf=spriteGrid.width,Hf=spriteGrid.height;
      let tex=motionWalk,frame=0;
      if(anim.action&&motionAction.complete&&motionAction.naturalWidth){
        tex=motionAction;
        const phase=anim.action.time/anim.action.duration;
        // Enter crouch -> grounded hold -> rise, never jump directly to idle.
        frame=phase<.14?0:phase<.30?1:phase<.74?2:phase<.90?1:0;
      }else if(player.moving){
        if(anim.state==='starting')frame=anim.elapsed<.065?0:anim.elapsed<.13?1:2;
        else{
          const strideLength=anim.dashing?83:69;
          const phase=(anim.walkDistance%strideLength)/strideLength;
          frame=strideFrames[Math.floor(phase*strideFrames.length)%strideFrames.length];
        }
      }else if(anim.state==='stopping'){
        frame=anim.elapsed<.055?2:anim.elapsed<.11?1:0;
      }else if(anim.idleAge>8){
        // Short, infrequent weight shift: no sweat drops, surprise lines or symbols.
        const rest=(anim.idleAge-8)%15;
        frame=rest<.28?1:0;
      }
      const bob=player.moving&&anim.actualDistance>.2?.35*Math.sin(anim.walkDistance/7):0;
      const cols=tex===motionWalk?8:4;
      frame=Math.min(cols-1,Math.max(0,frame));
      // All frames share the same foot anchor. No body-space offset is applied.
      ctx.drawImage(tex,frame*Wf,row*Hf,Wf,Hf,x-40,y-95+bob,80,96);
    }else if(hero.complete&&hero.naturalWidth){
      const col=player.dir==='down'?0:player.dir==='up'?1:player.dir==='left'?2:3;
      const row=player.moving?1+(Math.floor(anim.walkDistance/31)%2):0;
      const sw=hero.naturalWidth/4,sh=hero.naturalHeight/3;
      ctx.drawImage(hero,col*sw,row*sh,sw,sh,x-38,y-82,76,83);
    }else{
      ctx.fillStyle='#8b554a';ctx.beginPath();ctx.arc(x,y-36,17,0,Math.PI*2);ctx.fill();
    }
  }
  function drawForeground(){
    // Roof pixels are recovered from the original painting and drawn on TOP of
    // the character. Unlike Y-sorting a single background JPEG, this actually
    // makes the girl's body disappear behind the front-facing eaves and walls.
    const heroBounds={x:player.x-42,y:player.y-98,w:84,h:101};
    for(const mask of roofMasks){
      const poly=mask.poly;
      const minX=Math.min(...poly.map(p=>p[0])),maxX=Math.max(...poly.map(p=>p[0]));
      const minY=Math.min(...poly.map(p=>p[1])),maxY=Math.max(...poly.map(p=>p[1]));
      if(heroBounds.x>maxX||heroBounds.x+heroBounds.w<minX||heroBounds.y>maxY||heroBounds.y+heroBounds.h<minY)continue;
      ctx.save();ctx.beginPath();
      poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
      ctx.closePath();ctx.clip();ctx.drawImage(scene,0,0,WORLD.w,WORLD.h);ctx.restore();
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
    movePlayer(dt);updateAnimation(dt);
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
    drawShadow(t);drawHero(t);drawForeground();drawDebug();
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
    story:{...story},animation:{state:anim.state,action:anim.action?.kind||null,walkFrames:motionWalk.complete&&motionWalk.naturalWidth>0,actionFrames:motionAction.complete&&motionAction.naturalWidth>0,walkDistance:Math.round(anim.walkDistance),actualDistance:Number(anim.actualDistance.toFixed(3)),blockedFor:Number(anim.blockedFor.toFixed(3)),transitions:anim.transitionCount},roof:{southEastBlocked:!canStand(1160,752),southWestBlocked:!canStand(230,811),northWestBlocked:!canStand(80,270),masks:roofMasks.length},spriteFrameSequence:strideFrames
  });
})();