/* KAERIBI 4.1 — illustrated winter streets. Artwork stores NO directional lighting.
   Road art is baked into the ground plane; buildings and props are Y-depth sorted.
   Source sheet images remain separate from physical collision footprints. */
(()=>{
'use strict';
const roadImage=new Image(),buildingImage=new Image();
roadImage.decoding='async';buildingImage.decoding='async';
roadImage.src='assets/street_tiles_v41.webp?v=410';
buildingImage.src='assets/architecture_v41.webp?v=410';
const roads={
 straight:[25,40,269,489],
 thin:[326,36,498,498],
 junction:[516,113,911,503],
 cross:[947,35,1396,508],
 parking:[359,542,687,783],
 pavement:[721,540,1035,782],
 curb:[1060,635,1394,732],
 drain:[35,853,356,980],
 manhole:[587,819,777,1011],
 snowyPatch:[789,812,1057,1015]
};
const parts={
 vending:[6,63,228,392],
 pole:[238,2,414,413],
 ac:[418,204,608,408],
 wall:[607,183,912,449],
 wallCorner:[914,178,1110,442],
 railing:[1120,178,1417,425],
 gate:[6,408,274,653],
 post:[263,413,496,657],
 hedge:[480,420,780,669],
 shrubs:[778,420,1036,667],
 bush:[1021,411,1218,666],
 tree:[1205,410,1420,666],
 house:[36,639,857,1067],
 steps:[886,753,1425,1072]
};
function ready(im){return im.complete&&im.naturalWidth>0}
function section(im,s,x,y,w,h,context=ctx){context.drawImage(im,s[0],s[1],s[2]-s[0],s[3]-s[1],x,y,w,h)}
function paintRoads(){
 if(!ready(roadImage))return;
 const g=groundCanvas.getContext('2d');
 g.save();g.globalAlpha=.94;
 // Primary north/south roadway. Intersection source has transparent garden corners.
 section(roadImage,roads.straight,773,0,318,516,g);
 section(roadImage,roads.straight,773,1051,318,485,g);
 section(roadImage,roads.cross,630,424,620,642,g);
 // Only ground: faded bordering strips connect the cross to the old grid road.
 g.save();g.translate(0,949);g.rotate(-Math.PI/2);section(roadImage,roads.straight,0,0,309,634,g);g.restore();
 g.save();g.translate(1243,949);g.rotate(-Math.PI/2);section(roadImage,roads.straight,0,0,309,804,g);g.restore();
 section(roadImage,roads.straight,1451,0,305,570,g);
 section(roadImage,roads.straight,1451,955,305,581,g);
 // Winter parking aprons are *ground*, the parked cars remain independent solid sprites.
 section(roadImage,roads.parking,75,383,405,241,g);
 section(roadImage,roads.parking,1123,257,333,370,g);
 section(roadImage,roads.parking,1076,1027,382,355,g);
 // Manholes have no interaction marker and are always beneath the player's shoes.
 section(roadImage,roads.manhole,1047,820,57,48,g);
 section(roadImage,roads.snowyPatch,1801,870,106,65,g);
 g.restore();
}
if(roadImage.complete){paintRoads()}else roadImage.addEventListener('load',paintRoads,{once:true});

// New art uses a single neutral-light source; the existing dynamic lamp renderer
// remains a separate pass and can be replaced with flashlight/orb lights later.
const originalDrawObject=drawObject;
const originalDrawHouse=drawHouse;
function drawPart(part,x,y,w,h){if(!ready(buildingImage)||!parts[part])return false;section(buildingImage,parts[part],x,y,w,h);return true}
// Precise visual size and physical geometry share an anchor at the FRONT of houses.
for(const o of objects){
 if(o.type!=='house')continue;
 const dw=o.w+30,dh=Math.round(dw*.52);
 o.collider={x:0,y:Math.max(0,o.h-dh+10),w:o.w,h:Math.min(o.h,dh-10)};
}
drawHouse=function(o){
 const dw=o.w+30,dh=Math.round(dw*.52),bottom=o.y+o.h+6;
 if(!drawPart('house',o.x-15,bottom-dh,dw,dh))originalDrawHouse(o);
};
drawObject=function(o){
 if(o.type==='house')return drawHouse(o);
 if(o.type==='winter41'){
  drawPart(o.part,o.x,o.y,o.w,o.h);return;
 }
 if(o.type==='vending'&&o.state==='upright'){
  if(drawPart('vending',o.x-14,o.y-24,o.w+30,o.h+38))return;
 }
 if(o.type==='lamp'){
  if(drawPart('pole',o.x-36,o.y-103,o.w+72,o.h+122))return;
 }
 if(o.type==='tree'){
  if(drawPart('tree',o.x-40,o.y-111,o.w+84,o.h+135))return;
 }
 return originalDrawObject(o);
};
// All solid props: collider is the small ground contact, rather than the tall pixels.
const nearby=[
 {id:'winter41_wall_west',part:'wall',x:483,y:470,w:172,h:159,collider:{x:9,y:89,w:156,h:70}},
 {id:'winter41_gate_west',part:'gate',x:71,y:893,w:205,h:149,collider:{x:14,y:95,w:176,h:53}},
 {id:'winter41_hedge_east',part:'hedge',x:1782,y:524,w:217,h:115,collider:{x:9,y:74,w:198,h:39}},
 {id:'winter41_ac_east',part:'ac',x:1811,y:440,w:104,h:111,collider:{x:9,y:66,w:86,h:43}},
 {id:'winter41_rail_east',part:'railing',x:1807,y:909,w:218,h:117,collider:{x:5,y:83,w:208,h:32}},
 {id:'winter41_tree_south',part:'tree',x:923,y:1050,w:151,h:172,collider:{x:61,y:132,w:29,h:36}},
 {id:'winter41_post_south',part:'post',x:655,y:1022,w:68,h:91,collider:{x:16,y:65,w:38,h:23}},
 {id:'winter41_shrubs_ne',part:'shrubs',x:1735,y:264,w:179,h:115,collider:{x:12,y:83,w:150,h:29}},
 {id:'winter41_gate_north',part:'gate',x:1122,y:116,w:177,h:135,collider:{x:10,y:88,w:160,h:44}},
 {id:'winter41_fence_south',part:'railing',x:1267,y:1178,w:192,h:107,collider:{x:10,y:82,w:170,h:25}}
];
for(const prop of nearby){
 if(objectById.has(prop.id))continue;
 // Prevent props being built directly inside the traversable center-road lanes.
 addObject({id:prop.id,type:'winter41',part:prop.part,x:prop.x,y:prop.y,w:prop.w,h:prop.h,
  collider:prop.collider,collidable:true,depthY:prop.y+prop.h});
}
// Ground items never block traversal and must never generate hollow-circle prompts.
for(const o of objects){if(o.type==='decal')o.collidable=false}
// Expose a deterministic integrity check without generating a GUI prompt.
function checkNewWinterMap(){
 return {
  roadLoaded:ready(roadImage),propsLoaded:ready(buildingImage),
  houseSprites:objects.filter(o=>o.type==='house').length,
  separateProps:objects.filter(o=>o.type==='winter41').length,
  roadPassable:pass(925,800),
  vendingBlocked:!pass(844,590),
  carBlocked:!pass(210,485),
  parkedEntranceWalkable:pass(330,614)
 };
}
window.kaeribiV41Check=checkNewWinterMap;
if(new URLSearchParams(location.search).has('test')){
 Promise.all([new Promise(resolve=>roadImage.addEventListener('load',resolve,{once:true})),new Promise(resolve=>buildingImage.addEventListener('load',resolve,{once:true}))]).then(()=>console.table(checkNewWinterMap())).catch(console.error);
}
})();
