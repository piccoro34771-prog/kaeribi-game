/* KAERIBI v6: one authored site-plan feeds BOTH scenery and navigation.
 * World positions are feet/ground coordinates. Assets are isolated PNG/WebP fragments.
 * Geometry is derived from explicit lots, streets and physical footprints, never the picture alpha.
 */
window.KAERIBI_TOWN={
  version:'6.0', name:'第一夜・冬の住宅街', world:{w:2048,h:1536},
  start:{x:1060,y:760,dir:'down'},
  surfaces:[
    {id:'east_west',kind:'road',rect:[0,622,2048,344]},
    {id:'north_lane',kind:'road',rect:[825,0,392,622]},
    {id:'south_lane',kind:'road',rect:[825,966,392,570]},
    {id:'alley_nw',kind:'road',rect:[0,0,202,622]},
    {id:'alley_sw',kind:'road',rect:[0,966,202,570]},
    {id:'parking_west',kind:'parking',rect:[286,405,428,217]},
    {id:'parking_east',kind:'parking',rect:[1395,405,430,217]},
    {id:'pavement_vending',kind:'paving',rect:[722,510,103,112]},
    {id:'pavement_east',kind:'paving',rect:[1217,510,180,112]},
    {id:'approach_sw',kind:'paving',rect:[556,966,146,112]},
    {id:'approach_se',kind:'paving',rect:[1395,966,162,112]},
    {id:'apron_nw',kind:'paving',rect:[207,580,78,42]},
    {id:'apron_ne',kind:'paving',rect:[1825,580,75,42]}
  ],
  objects:[
    // Houses and their enclosed yards: roof silhouettes stay INSIDE these grounded footprints.
    {id:'house_nw',kind:'house',atlas:'houses',src:[0,0,599,370],draw:[270,66,478,350],solid:[286,95,451,313],baseY:416},
    {id:'house_ne',kind:'house',atlas:'houses',src:[600,0,556,372],draw:[1410,68,491,346],solid:[1420,90,477,319],baseY:414},
    {id:'house_sw',kind:'house',atlas:'houses',src:[0,0,599,370],draw:[251,1067,498,368],solid:[270,1082,467,362],baseY:1435},
    {id:'house_se',kind:'house',atlas:'houses',src:[600,0,556,372],draw:[1385,1057,513,380],solid:[1400,1076,485,368],baseY:1437},
    // Upper lots are accessible from the east-west road, with no invisible barrier across entrances.
    {id:'car_w',kind:'vehicle',atlas:'props',src:[254,2,258,303],draw:[399,424,151,187],solid:[413,437,119,158],baseY:611},
    {id:'car_e',kind:'vehicle',atlas:'props',src:[254,2,258,303],draw:[1562,421,158,189],solid:[1578,435,125,160],baseY:610},
    {id:'vending',kind:'vending',atlas:'props',src:[6,8,242,303],draw:[719,498,115,140],solid:[738,516,79,113],baseY:639},
    // Physically connected front-yard boundaries, with gaps aligned to visible walkways.
    {id:'wall_nw',kind:'wall',atlas:'architecture',src:[612,174,300,272],draw:[533,324,192,105],solid:[548,396,171,32],baseY:429},
    {id:'wall_ne',kind:'wall',atlas:'architecture',src:[612,174,300,272],draw:[1390,322,195,108],solid:[1406,395,174,33],baseY:430},
    {id:'gate_sw',kind:'wall',atlas:'architecture',src:[15,406,324,231],draw:[274,1010,198,99],solid:[288,1072,173,32],baseY:1109},
    {id:'gate_se',kind:'wall',atlas:'architecture',src:[15,406,324,231],draw:[1728,998,201,102],solid:[1740,1065,178,30],baseY:1100},
    {id:'fence_sw',kind:'wall',atlas:'props',src:[260,392,251,184],draw:[712,1052,135,76],solid:[720,1094,120,25],baseY:1128},
    // Roadside objects are parked AGAINST the property edges, not randomly in traversable lanes.
    {id:'lamp_w',kind:'street',atlas:'architecture',src:[234,0,180,400],draw:[770,424,77,220],solid:[792,626,24,18],baseY:644},
    {id:'lamp_e',kind:'street',atlas:'architecture',src:[234,0,180,400],draw:[1237,420,77,221],solid:[1259,624,23,17],baseY:641},
    {id:'board_w',kind:'small',atlas:'props',src:[10,677,246,258],draw:[202,512,111,104],solid:[221,589,76,21],baseY:616},
    {id:'bike_w',kind:'small',atlas:'props',src:[519,710,245,182],draw:[665,534,95,80],solid:[675,593,74,17],baseY:614},
    {id:'ac_e',kind:'small',atlas:'props',src:[530,370,241,232],draw:[1810,482,102,110],solid:[1834,560,64,31],baseY:592},
    {id:'post_sw',kind:'small',atlas:'architecture',src:[358,404,158,238],draw:[477,1000,83,106],solid:[491,1075,54,25],baseY:1106},
    {id:'hedge_ne',kind:'plant',atlas:'architecture',src:[499,412,296,257],draw:[1794,522,200,108],solid:[1813,594,176,28],baseY:630},
    {id:'tree_ne',kind:'plant',atlas:'props',src:[264,958,248,299],draw:[1862,334,168,274],solid:[1925,583,42,25],baseY:608},
    {id:'tree_sw',kind:'plant',atlas:'architecture',src:[1209,420,202,293],draw:[189,977,152,200],solid:[239,1140,40,28],baseY:1177},
    {id:'cone_ne',kind:'small',atlas:'props',src:[584,1012,145,201],draw:[1822,578,38,54],solid:[1833,618,18,15],baseY:633},
    {id:'planters_w',kind:'small',atlas:'props',src:[263,716,252,160],draw:[274,559,126,74],solid:[292,607,97,22],baseY:633}
  ],
  groundDetails:[
    {id:'manhole',atlas:'props',src:[788,714,237,166],draw:[1080,778,74,53]},
    {id:'drain_w',atlas:'props',src:[3,1009,255,198],draw:[302,620,160,28]},
    {id:'drain_e',atlas:'props',src:[3,1009,255,198],draw:[1425,619,160,28]},
    {id:'snow_w',atlas:'road',src:[789,812,254,189],draw:[648,618,110,33]},
    {id:'snow_e',atlas:'road',src:[789,812,254,189],draw:[1310,960,115,32]}
  ],
  // No decorative examine icons: only once-per-story meaningful actions.
  interactions:[
    {id:'vending',object:'vending',at:[849,661],radius:76,label:'自販機を調べる'},
    {id:'car',object:'car_e',at:[1560,657],radius:80,label:'駐車中の車を調べる'},
    {id:'lamp',object:'lamp_w',at:[824,685],radius:75,label:'街灯の下を調べる'},
    {id:'exit',at:[1036,1483],radius:74,label:'帰り道を進む'}
  ],
  lightSources:[{x:808,y:569,r:190,color:[255,178,103]},{x:1274,y:559,r:175,color:[249,180,104]}]
};