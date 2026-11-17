/* Deterministic, dependency-free arcade rules. Coordinates: a8 = [0,0]. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.LastKnight=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const eq=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1];
  const inside=p=>p[0]>=0&&p[0]<8&&p[1]>=0&&p[1]<8;
  const name=p=>'abcdefgh'[p[0]]+(8-p[1]);
  const at=s=>['abcdefgh'.indexOf(s[0]),8-Number(s[1])];
  const clone=s=>JSON.parse(JSON.stringify(s));
  const jumps=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  const knight=p=>jumps.map(d=>[p[0]+d[0],p[1]+d[1]]).filter(inside);
  const names={P:'Пешка',K:'Король',B:'Слон',R:'Ладья',N:'Конь',Q:'Ферзь'};
  const values={P:25,K:40,B:60,R:70,N:80,Q:150};
  const all=Array.from({length:64},(_,i)=>[i%8,Math.floor(i/8)]);
  function random(s){s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;}
  function shuffle(s,items){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function config(w){return {count:w<5?1:w<10?2:w<13?3:4,types:w<3?['P','K']:w<5?['B','R']:w<7?['P','K','B','R']:w<10?['P','B','R','N']:['P','K','B','R','N','Q']};}
  function blocked(s,p,except){return s.enemies.some(e=>e.id!==except&&eq(e.pos,p))||eq(s.player,p)||eq(s.king,p);}
  function rayClear(s,from,to,id){const dx=Math.sign(to[0]-from[0]),dy=Math.sign(to[1]-from[1]);let p=[from[0]+dx,from[1]+dy];while(!eq(p,to)){if(blocked(s,p,id))return false;p=[p[0]+dx,p[1]+dy];}return true;}
  function attacks(s,e,to){
    if(e.frozen>0||eq(e.pos,to))return false;
    const dx=to[0]-e.pos[0],dy=to[1]-e.pos[1],x=Math.abs(dx),y=Math.abs(dy);
    if(e.type==='P')return x===1&&dy===1;
    if(e.type==='N')return x*y===2;
    if(e.type==='K')return Math.max(x,y)===1;
    const line=e.type==='B'?x===y:e.type==='R'?dx===0||dy===0:x===y||dx===0||dy===0;
    return line&&rayClear(s,e.pos,to,e.id);
  }
  function enemyMoves(s,e){return all.filter(p=>!blocked(s,p,e.id)&&(e.type==='P'?p[0]===e.pos[0]&&p[1]===e.pos[1]+1:attacks({...s}, {...e,frozen:0},p)));}
  const legal=s=>knight(s.player).filter(p=>!eq(p,s.king));
  function isDanger(s,p){const t={...s,player:p,enemies:s.enemies.filter(e=>!eq(e.pos,p))};return t.enemies.some(e=>attacks(t,e,p));}
  function pursuit(s,e,reserved=[]){
    const target=s.king||s.player;
    const score=p=>{
      const dist=Math.abs(p[0]-target[0])+Math.abs(p[1]-target[1]);
      const imagined={...s,enemies:s.enemies.map(v=>v.id===e.id?{...v,pos:p}:v)};
      return (attacks(imagined,{...e,pos:p},target)?100:0)-dist;
    };
    const options=enemyMoves(s,e).filter(p=>!reserved.some(q=>eq(p,q)));
    options.sort((a,b)=>score(b)-score(a)||a[1]-b[1]||a[0]-b[0]);
    return options[0]||null;
  }
  function plan(s){
    const reserved=[];
    const order=s.enemies.slice().sort((a,b)=>a.id-b.id);
    for(const e of s.enemies)e.plan=null;
    for(const e of order){
      if(e.frozen)continue;
      e.plan=pursuit(s,e,reserved);if(e.plan)reserved.push(e.plan);
    }
    return s;
  }
  function lose(s,e){s.status='over';s.cause=`${names[e.type]} с ${name(e.pos)} взяла коня на ${name(s.player)}.`;s.message=s.cause;return s;}
  function enemyReply(s){
    // All captures are evaluated before any movement, so a move never becomes a second action.
    const killer=s.enemies.find(e=>attacks(s,e,s.player));if(killer)return lose(s,killer);
    const kingKiller=s.king&&s.enemies.find(e=>attacks(s,e,s.king));
    if(kingKiller){s.king=null;s.kingLost=true;s.message='Короля взяли. Забег продолжается.';}
    // Honor announced pursuit destinations. A capture takes priority over a move.
    for(const e of s.enemies.slice().sort((a,b)=>a.id-b.id)){
      if(e.frozen>0){e.frozen--;continue;}
      if(e===kingKiller)continue;
      // A blocked route waits instead of secretly switching to an unannounced cell.
      if(e.plan&&enemyMoves(s,e).some(p=>eq(p,e.plan)))e.pos=e.plan.slice();
      if(e.type==='P'&&e.pos[1]===7){e.type='R';s.message='Пешка дошла до края и стала ладьёй. Она продолжает охоту.';}
    }
    return s;
  }
  function activate(s){
    const waiting=[];
    for(const marker of s.pending){
      if(marker.wait>0)marker.wait--;
      if(marker.wait>0||blocked(s,marker.pos)){waiting.push(marker);continue;}
      s.enemies.push({id:marker.id,type:marker.type,pos:marker.pos.slice(),frozen:0,plan:null});
    }
    s.pending=waiting;
  }
  // Forecast uses the same announced moves as the real enemy response.
  function forecast(s,p){const t=clone(s);t.player=p.slice();t.enemies=t.enemies.filter(e=>!eq(e.pos,p));t.turn++;enemyReply(t);if(t.status==='over')return t;activate(t);return plan(t);}
  function survivable(s,depth=3){if(s.status==='over')return false;if(depth===0)return true;return legal(s).some(p=>{const t=forecast(s,p);return t.status!=='over'&&survivable(t,depth-1);});}
  function fair(s){const t=clone(s);t.enemies.forEach(e=>e.frozen=0);const safe=legal(t).map(p=>forecast(t,p)).filter(x=>x.status!=='over');return safe.length>=(s.wave<=4?2:1)&&safe.some(x=>survivable(x,2));}
  function chooseType(s){
    let types=config(s.wave).types.filter(t=>t!=='Q'||![...s.enemies,...s.pending].some(e=>e.type==='Q'));
    if(s.wave===5||s.wave===6)types=[...s.enemies,...s.pending].some(e=>['P','K'].includes(e.type))?['B','R']:['P','K'];
    return types[Math.floor(random(s)*types.length)];
  }
  function schedule(s){
    const type=chooseType(s),id=s.nextId;
    for(const pos of shuffle(s,all)){
      if((type==='P'&&pos[1]>=6)||blocked(s,pos)||s.pending.some(e=>eq(e.pos,pos))||s.pickups.some(c=>eq(c.pos,pos)))continue;
      const candidate={id,type,pos:pos.slice(),wait:1},t=clone(s);t.pending.push(candidate);
      if(!fair(t))continue;
      s.pending.push(candidate);s.nextId++;return true;
    }
    return false;
  }
  function fill(s){const target=s.waveSize;let attempts=target;while(s.waveKills+s.enemies.length+s.pending.length<target&&attempts-->0)if(!schedule(s))break;}
  function distances(from){const result=new Map([[name(from),0]]),q=[from];for(let i=0;i<q.length;i++)for(const p of knight(q[i]))if(!result.has(name(p))){result.set(name(p),result.get(name(q[i]))+1);q.push(p);}return result;}
  function drop(s,kind){const d=distances(s.player);const candidates=all.filter(p=>!blocked(s,p)&&!s.pickups.some(c=>eq(c.pos,p))&&!s.pending.some(e=>eq(e.pos,p))&&d.get(name(p))>=1&&d.get(name(p))<=3);if(candidates.length)s.pickups.push({id:s.dropId++,kind,pos:candidates[Math.floor(random(s)*candidates.length)].slice()});}
  function beginWave(s,wave){s.wave=wave;s.waveTurn=0;s.waveSize=config(wave).count;s.waveKills=0;s.mode='combat';s.status='playing';s.king=null;s.enemies=[];s.pending=[];s.pickups=[];s.kingLost=false;fill(s);drop(s,'coin');if(wave%2===0)drop(s,'star');s.message=`Волна ${wave}. Возьми всех противников, чтобы пройти дальше.`;return plan(s);}
  function initial(seed=Date.now()){let s={seed:seed>>>0,player:at('e4'),enemies:[{id:1,type:'P',pos:at('b7'),frozen:0,plan:null}],pending:[],pickups:[],wave:1,waveTurn:0,waveSize:1,waveKills:0,turn:0,score:0,coins:0,stars:0,captures:0,charges:1,nextId:2,dropId:1,mode:'combat',status:'playing',king:null,kingLost:false,bonusCoins:0,remaining:20000,message:'Возьми всех врагов, чтобы пройти волну. Метки показывают их следующий ход.'};drop(s,'coin');return plan(s);}
  function freeze(s,id){if(s.status!=='playing'||!['combat','king'].includes(s.mode)||s.charges<1)return s;const t=clone(s),e=t.enemies.find(e=>e.id===id);if(!e||e.frozen)return s;e.frozen=3;e.plan=null;t.charges--;t.message=`${names[e.type]} на ${name(e.pos)} заморожена на 3 ответа.`;return t;}
  function move(s,p){
    if(s.status!=='playing'||!['combat','coins','king'].includes(s.mode)||!legal(s).some(q=>eq(q,p)))return s;
    const t=clone(s);t.player=p.slice();t.turn++;t.message='';
    const captured=t.enemies.find(e=>eq(e.pos,p));if(captured){t.enemies=t.enemies.filter(e=>e.id!==captured.id);t.score+=values[captured.type];t.captures++;t.message=`${names[captured.type]} взята. +${values[captured.type]} очков.`;}
    if(captured&&t.mode==='combat')t.waveKills++;
    const item=t.pickups.find(c=>eq(c.pos,p));if(item){t.pickups=t.pickups.filter(c=>c.id!==item.id);if(item.kind==='coin'){t.coins++;t.score+=10;if(t.mode==='coins')t.bonusCoins++;}else{t.stars++;t.score+=25;}t.message=item.kind==='coin'?'Монета! +10 очков.':'Звезда! +25 очков.';}
    if(t.mode==='coins'){while(t.pickups.length<2)drop(t,'coin');return t;}
    enemyReply(t);if(t.status==='over')return t;
    t.waveTurn++;
    if(t.mode==='king'){
      if(t.kingLost||t.waveTurn>=6){t.status='bonus-result';if(!t.kingLost){t.score+=250;t.charges=Math.min(2,t.charges+1);t.message='Король спасён! +250 очков и заряд заморозки.';}return t;}
      return plan(t);
    }
    if(t.waveKills>=t.waveSize&&t.enemies.length===0&&t.pending.length===0){t.score+=100+t.wave*10;t.status='wave-clear';t.pickups=[];t.message=`Поле очищено! Волна ${t.wave} пройдена.`;return t;}
    activate(t);fill(t);if(!t.pickups.some(c=>c.kind==='coin'))drop(t,'coin');return plan(t);
  }
  function startBonus(s){if(s.status!=='bonus-ready')return s;const t=clone(s);t.status='playing';t.waveTurn=0;t.pending=[];t.enemies=[];t.pickups=[];t.kingLost=false;
    if(t.mode==='coins'){t.remaining=20000;t.bonusCoins=0;drop(t,'coin');drop(t,'coin');t.message='20 секунд. Пять монет принесут заряд заморозки.';}
    else{t.player=at('b4');t.king=at('e1');t.enemies=[{id:t.nextId++,type:'P',pos:at('d5'),frozen:0,plan:null}];t.message='Защити короля шесть ходов. Перехвати пешку до d2.';}
    return plan(t);
  }
  function tick(s,ms){if(s.mode!=='coins'||s.status!=='playing')return s;const t=clone(s);t.remaining=Math.max(0,t.remaining-Math.max(0,ms));if(t.remaining===0){t.status='bonus-result';if(t.bonusCoins>=5)t.charges=Math.min(2,t.charges+1);t.message=t.bonusCoins>=5?'Пять монет собраны — заряд заморозки получен!':'Бонус завершён. Все собранные очки остаются с тобой.';}return t;}
  function next(s){
    if(!['wave-clear','bonus-ready','bonus-result'].includes(s.status))return s;
    const t=clone(s);
    if(s.status==='wave-clear'&&s.wave%3===0){t.status='bonus-ready';t.mode=s.wave%6===0?'king':'coins';t.message='Все противники взяты. Время для бонуса!';return t;}
    return beginWave(t,s.wave+1);
  }
  function restore(s,version=2){const t=clone(s);if(version<2){t.waveKills=0;t.waveSize=Math.max(config(t.wave).count,t.enemies.length+t.pending.length);if(t.mode==='combat'&&t.status==='playing')t.message='Новые правила: враги преследуют коня каждый ход. Возьми весь состав, чтобы завершить волну.';}for(const e of t.enemies)if(e.type==='P'&&e.pos[1]===7)e.type='R';return plan(t);}
  return {initial,move,freeze,tick,startBonus,next,restore,legal,isDanger,attacks,enemyMoves,plan,forecast,survivable,fair,schedule,beginWave,config,distances,eq,at,name,names,values,clone};
});
