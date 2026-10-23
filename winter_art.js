/* KAERIBI illustrated winter pass v4.0. Sprite sheets are separated from gameplay logic. */
(()=>{
  'use strict';
  const sprites={};
  const images={hero:'assets/hero_winter.webp?v=400',props:'assets/town_winter.webp?v=400',houses:'assets/houses_winter.webp?v=400'};
  for(const [name,path] of Object.entries(images)){
    const im=new Image();im.decoding='async';im.src=path;sprites[name]=im;
  }
  const ready=name=>!!(sprites[name]&&sprites[name].complete&&sprites[name].naturalWidth);
  const catalog={"vending":[8,20,240,280],"car":[264,23,240,273],"lamp":[587,12,106,296],"streetlamp":[851,12,90,296],"wall":[14,332,227,296],"fence":[264,405,240,150],"ac":[530,372,220,216],"post":[799,361,193,238],"board":[13,678,230,244],"pots":[264,716,240,167],"bike":[520,717,240,165],"manhole":[795,720,201,159],"drain":[8,1034,240,172],"tree":[271,981,226,277],"cone":[580,1035,119,169],"curb":[776,1038,240,163]};
  function prop(name,x,y,w,h){
    if(!ready('props')||!catalog[name])return false;
    const s=catalog[name];
    ctx.drawImage(sprites.props,s[0],s[1],s[2],s[3],x,y,w,h);
    return true;
  }
  const originalCharacter=character;
  character=function(){
    if(!ready('hero'))return originalCharacter();
    const col=player.dir==='down'?0:player.dir==='up'?1:player.dir==='left'?2:3;
    const row=player.moving?1+(Math.floor(player.step/1.55)%2):0;
    const img=sprites.hero,sw=img.naturalWidth/4,sh=img.naturalHeight/3;
    const bob=player.moving?Math.sin(player.step*1.5)*0.65:0;
    ctx.save();
    // All directions share the same ground-contact point, and the sprite has no fixed sunlight.
    ctx.fillStyle='#02080ca0';ctx.beginPath();ctx.ellipse(player.x,player.y+2,12,4,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(img,col*sw,row*sh,sw,sh,player.x-43,player.y-79+bob,84,84);
    ctx.restore();
  };

  // Shrink only overly tall proxy houses; keep the roadway and parking footprint unchanged.
  for(const o of objects){
    if(o.type==='house' && o.h>o.w*1.2){
      const bottom=o.y+o.h;
      o.h=Math.round(o.w*.82);o.y=bottom-o.h;
      o.collider={x:0,y:0,w:o.w,h:o.h};o.depthY=bottom;
    }
  }
  const originalHouse=drawHouse;
  drawHouse=function(o){
    if(!ready('houses'))return originalHouse(o);
    const im=sprites.houses,variant=['home_north','home_ne','home_south','home_se'].includes(o.id)?1:0;
    const src=variant?[602,0,556,396]:[0,0,602,396];
    let destW=o.w+35,destH=Math.min(o.h+32,destW/1.52);
    const bottom=o.y+o.h+12;
    ctx.drawImage(im,src[0],src[1],src[2],src[3],o.x-17,bottom-destH,destW,destH);
  };

  const originalDrawObject=drawObject;
  drawObject=function(o){
    if(o.type==='house')return drawHouse(o);
    if(o.type==='winterprop'){
      if(prop(o.part,o.x,o.y,o.w,o.h))return;
      return;
    }
    if(o.type==='vending'){
      ctx.save();
      if(o.state==='fallen'||o.state==='falling'){
        const t=Math.min(1,o.anim||0);
        ctx.translate(o.x+o.w/2,o.y+o.h-9);ctx.rotate(-Math.PI*.5*t);ctx.translate(-(o.x+o.w/2),-(o.y+o.h-9));
      }
      const rendered=prop('vending',o.x-13,o.y-17,o.w+27,o.h+31);
      ctx.restore();if(rendered)return;
    }
    if(o.type==='car'&&prop('car',o.x-9,o.y-9,o.w+18,o.h+17))return;
    if(o.type==='lamp'&&prop('lamp',o.x-38,o.y-85,o.w+78,o.h+97))return;
    if(o.type==='tree'&&prop('tree',o.x-33,o.y-90,o.w+65,o.h+112))return;
    if(o.renderMode==='ground'&&o.style==='manhole'&&prop('manhole',o.x-4,o.y-5,o.w+8,o.h+10))return;
    if(o.renderMode==='ground'&&o.style==='drain'&&prop('drain',o.x-7,o.y-8,o.w+14,o.h+16))return;
    return originalDrawObject(o);
  };

  // Physical objects, plants and snowy pavement are independent of the painting's transparent extent.
  // All additions are set back from the free passage between the parking bays and the road.
  const winterDecor=[
    {id:'winter_mail_w',type:'winterprop',part:'post',x:480,y:496,w:66,h:79,collidable:false},
    {id:'winter_notice',type:'winterprop',part:'board',x:650,y:492,w:105,h:107,collidable:false},
    {id:'winter_ac',type:'winterprop',part:'ac',x:1590,y:492,w:88,h:86,collidable:false},
    {id:'winter_pots',type:'winterprop',part:'pots',x:535,y:531,w:106,h:69,collidable:false},
    {id:'winter_bicycle',type:'winterprop',part:'bike',x:365,y:504,w:130,h:92,collidable:true,collider:{x:10,y:56,w:110,h:32}},
    {id:'winter_cone',type:'winterprop',part:'cone',x:1340,y:580,w:31,h:43,collidable:true,collider:{x:2,y:30,w:27,h:13}},
    {id:'winter_curb',type:'winterprop',part:'curb',x:1760,y:612,w:172,h:68,collidable:false},
  ];
  for(const o of winterDecor){if(!objectById.has(o.id))addObject(o)}

  // Cold-season ground treatment is cached ONCE and never obscures the feet or prop colliders.
  const ground=groundCanvas.getContext('2d');
  ground.save();ground.lineCap='round';
  for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){
    if(!tiles[j][i] || !([0,2].includes(tiles[j-1]?.[i])||[0,2].includes(tiles[j+1]?.[i])))continue;
    if(rnd(i,j,219)<.39)continue;
    for(let k=0;k<4;k++){
      let x=i*TILE+3+rnd(i+k,j,89)*57,
          y=j*TILE+(tiles[j-1]?.[i]===0?6:58)+(rnd(i,j+k,90)-.5)*8;
      ground.beginPath();ground.moveTo(x,y);ground.quadraticCurveTo(x+5,y-2,x+10+rnd(k,i,90)*10,y+1);
      ground.strokeStyle=k===0?'#cad8da5a':'#c0ced133';ground.lineWidth=1.5+rnd(k,j,70)*3;ground.stroke();
    }
  }
  ground.restore();

  // In diagnostics mode an explicit image-load status accompanies collision smoke tests.
  if(new URLSearchParams(location.search).has('test')){
    setTimeout(()=>{
      const state=Object.fromEntries(Object.entries(sprites).map(([k,v])=>[k,v.complete&&v.naturalWidth>0]));
      console.info('Winter art loaded:',state);
      if(Object.values(state).some(ok=>!ok)){
        const e=document.getElementById('msg');e.textContent='Winter image load failed: '+Object.entries(state).filter(([,v])=>!v).map(([k])=>k).join(', ');e.style.opacity=1;
      }
    },1300);
  }
})();
