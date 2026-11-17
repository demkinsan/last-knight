(() => {
  'use strict';
  const E=LastKnight,$=id=>document.getElementById(id);
  const assets={wN:'ed518.png',wK:'34704.png',bN:'93fac.png',bQ:'60b4d.png',bK:'f0817.png',bB:'d9920.png',bP:'927e9.png'};
  const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
  const SAVE='last-knight-run-v1',BEST='last-knight-best-v1',HINTS='last-knight-hints-v1';
  let hints=storage.get(HINTS,true)!==false;
  let best=storage.get(BEST,{score:0,wave:0}),saved=storage.get(SAVE,null);
  const validSave=x=>[1,2].includes(x?.version)&&x.state&&Number.isInteger(x.state.seed)&&Number.isInteger(x.state.wave)&&x.state.wave>0&&Array.isArray(x.state.enemies)&&Array.isArray(x.state.pending)&&Array.isArray(x.state.pickups)&&Array.isArray(x.state.player)&&x.state.player.length===2&&x.state.player.every(v=>Number.isInteger(v)&&v>=0&&v<8)&&['playing','over','wave-clear','bonus-ready','bonus-result'].includes(x.state.status)&&['combat','coins','king'].includes(x.state.mode);
  let s=validSave(saved)?E.restore(saved.state,saved.version):E.initial(),paused=validSave(saved)&&saved.state.status==='playing',freezeMode=false,lastTime=performance.now(),focusSquare=E.name(s.player),hoverEnemy=null;
  const plural=(n,a)=>a[n%100>=11&&n%100<=14?2:n%10===1?0:n%10>=2&&n%10<=4?1:2];
  const words=(n,a)=>`${n} ${plural(n,a)}`;
  const coinText=n=>words(n,['монета','монеты','монет']);
  const icon=type=>({P:'♟',N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'}[type]);
  const piece=(type,color='b',selected=false,frozen=0)=>`<span class="piece-wrap type-${type} ${color==='b'?'black':''} ${frozen?'frozen':''}"><span class="piece-shadow"></span>${type==='R'?'<svg viewBox="0 0 70 64" aria-hidden="true" fill="currentColor" stroke="#171923" stroke-width="1.6" stroke-linejoin="round"><path d="M18 7h7v7h7V7h7v7h7V7h7v17l-7 5 3 19H22l3-19-7-5Z"/><path d="M17 50h37v6H17z"/></svg>':`<img class="piece-art" src="assets/figma/${assets[color+type]}" alt="" draggable="false">`}${selected?'<span class="piece-outline"></span>':''}</span>`;
  function persist(){if(s.score>best.score||s.score===best.score&&s.wave>best.wave){best={score:s.score,wave:s.wave};storage.set(BEST,best);}storage.set(SAVE,{version:2,state:s});}
  function commit(next){if(next===s)return false;s=next;freezeMode=false;hoverEnemy=null;persist();render();return true;}
  function coinMarkup(c){return `<span class="coin" data-coin-id="${c.id}" style="--spin-offset:-${2.4+(c.id%10)*.12}s;--hop-delay:-${(c.id%7)*.17}s" aria-hidden="true"><span class="coin-shadow" data-motion="shadow"></span><span class="coin-drop" data-motion="drop"><span class="coin-bounce" data-motion="bounce"><span class="coin-frame" data-motion="phase"></span></span></span></span>`;}
  function motionSnapshot(){const result=new Map();for(const c of $('board').querySelectorAll('.coin'))result.set(c.dataset.coinId,new Map(c.getAnimations({subtree:true}).map(a=>[a.animationName,a.currentTime])));return result;}
  function isModal(){return !!document.querySelector('dialog[open]');}
  function boardRender(){
    const animation=motionSnapshot(),moves=E.legal(s),interactive=s.status==='playing'&&!paused&&!isModal();
    const focused=document.activeElement?.dataset.square;
    let html='';
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const p=[x,y],sq=E.name(p),own=E.eq(p,s.player),king=E.eq(p,s.king),enemy=s.enemies.find(e=>E.eq(e.pos,p)),pending=s.pending.find(e=>E.eq(e.pos,p)),item=s.pickups.find(c=>E.eq(c.pos,p));
      const legal=hints&&interactive&&!freezeMode&&moves.some(q=>E.eq(q,p)),danger=hints&&s.mode!=='coins'&&E.isDanger(s,p),target=freezeMode&&enemy&&!enemy.frozen;
      const cls=['cell',(x+y)%2?'dark':'',own?'selected':'',legal?'legal':'',danger?'danger':'',target?'freeze-target':'',enemy?'enemy':'',enemy?.frozen?'frozen-cell':''];
      const labels=[sq,own?'твой конь':king?'союзный король':enemy?E.names[enemy.type]:null,pending?`${E.names[pending.type]} появится после хода`:null,item?.kind==='coin'?'монета':item?'звезда':null,legal?'доступный ход':null,danger?'под ударом':null,enemy?.frozen?`заморожен: ${enemy.frozen}`:null].filter(Boolean).join(', ');
      let content=own?piece('N','w',true):enemy?piece(enemy.type,'b',false,enemy.frozen):king?piece('K','w'):'';
      if(item&&!own&&!enemy)content+=item.kind==='coin'?coinMarkup(item):'<span class="star" aria-hidden="true">★</span>';
      if(pending&&!own&&!enemy&&!king)content+=`<span class="pending-piece">${piece(pending.type)}<span class="pending-badge">+1</span></span>`;
      if(enemy?.frozen)content+=`<span class="frozen-badge">❄ ${enemy.frozen}</span>`;
      html+=`<button class="${cls.filter(Boolean).join(' ')}" data-square="${sq}" data-rank="${8-y}" aria-label="${labels}" title="${labels}" tabindex="${sq===focusSquare?'0':'-1'}" ${!interactive?'disabled':''}>${content}</button>`;
    }
    const planned=s.enemies.filter(e=>e.plan&&!e.frozen);
    html+='<div class="intent-layer" aria-hidden="true"><svg viewBox="0 0 8 8">'+planned.map((e,i)=>{const x=e.pos[0]+.5,y=e.pos[1]+.5,tx=e.plan[0]+.5,ty=e.plan[1]+.5;return `<path data-enemy="${e.id}" data-from="${E.name(e.pos)}" data-to="${E.name(e.plan)}" d="M ${x} ${y} L ${tx} ${ty}"/><circle cx="${tx}" cy="${ty}" r=".14"/><text x="${tx}" y="${ty+.06}">→</text>`;}).join('')+'</svg></div>';
    $('board').innerHTML=html;
    for(const c of $('board').querySelectorAll('.coin')){const times=animation.get(c.dataset.coinId);if(times)for(const a of c.getAnimations({subtree:true})){const time=times.get(a.animationName);if(time!=null)a.currentTime=time;}}
    if(focused&&interactive)$('board').querySelector(`[data-square="${focusSquare}"]`)?.focus({preventScroll:true});
    $('board').classList.toggle('motion-paused',!interactive);
  }
  function overlay(){
    const el=$('overlay');el.classList.toggle('wave-clear',s.status==='wave-clear');let html='';
    if(s.status==='over')html=`<div class="overlay-icon">♞</div><h2>Хороший был конь</h2><p>${s.cause}</p><div class="result-stats"><span><b>${s.score}</b>очков</span><span><b>${s.wave}</b>волна</span><span><b>${s.captures}</b>взятий</span></div><button class="primary" data-action="restart">Ещё один забег</button>`;
    else if(s.status==='wave-clear'){const bonus=s.wave%3===0,label=bonus?(s.wave%6===0?'Защити короля':'Монетный дождь'):`Волна ${s.wave+1}`;html=`<div class="overlay-icon">✓</div><span class="clear-kicker">ПОЛЕ ОЧИЩЕНО</span><h2>Волна ${s.wave} пройдена!</h2><p>Все противники побеждены.<br>+${100+s.wave*10} очков за волну.</p><div class="next-wave-label">Дальше: <strong>${label}</strong></div><button class="primary" data-action="next">${bonus?'К бонусу':`Начать волну ${s.wave+1}`}</button>`;}
    else if(s.status==='bonus-ready'){const coins=s.mode==='coins';html=`<div class="overlay-icon">${coins?'✦':'♔'}</div><h2>${coins?'Монетный дождь':'Защити короля'}</h2><p>${coins?'20 секунд без врагов. Собери 5 монет и получи заряд заморозки. Таймер начнётся по кнопке.':'Убереги короля на e1 в течение 6 ходов. Перехвати пешку или заморозь её. Награда — 250 очков и заряд.'}</p><button class="primary" data-action="bonus">${coins?'Собирать монеты':'Защитить короля'}</button><button class="secondary" data-action="skip">Пропустить бонус</button>`;}
    else if(s.status==='bonus-result')html=`<div class="overlay-icon">${s.mode==='king'?(s.kingLost?'♔':'✧'):'✦'}</div><h2>${s.mode==='king'?(s.kingLost?'Король потерян':'Король спасён!'):'Время вышло'}</h2><p>${s.message}</p>${s.mode==='coins'?`<div class="result-stats"><span><b>${s.bonusCoins}</b>монет</span><span><b>+${s.bonusCoins*10}</b>очков</span></div>`:''}<button class="primary" data-action="next">К волне ${s.wave+1}</button>`;
    else if(paused)html='<div class="overlay-icon">Ⅱ</div><h2>Никуда не спешим</h2><p>Забег на паузе. Фигуры, монеты и таймер подождут.</p><button class="primary" data-action="resume">Продолжить</button>';
    el.hidden=!html;el.innerHTML=html;
  }
  function render(){
    document.body.dataset.timed=s.mode==='coins';
    $('hints').setAttribute('aria-pressed',String(hints));$('hints').textContent=`Подсказки: ${hints?'вкл':'выкл'}`;
    document.querySelectorAll('[data-hint-legend]').forEach(el=>el.hidden=!hints);
    $('wave-number').textContent=String(s.wave).padStart(2,'0');
    $('mode-label').textContent=s.mode==='combat'?'БЕСКОНЕЧНОЕ ПРИКЛЮЧЕНИЕ':s.mode==='coins'?'БОНУС · МОНЕТНЫЙ ДОЖДЬ':'БОНУС · ЗАЩИТИ КОРОЛЯ';
    $('description').textContent=s.mode==='combat'?'Каждый твой ход — погоня всех врагов. Уворачивайся и бери фигуры. Волна пройдена, когда побеждены все.':s.mode==='coins'?'Две монеты, двадцать секунд и никаких врагов. Пять монет — один заряд заморозки.':'Король на e1 не двигается. У тебя шесть ходов: перехвати пешку, пока она не добралась до него.';
    $('wave-label').textContent=s.mode==='combat'?`Волна ${s.wave}${s.status==='wave-clear'?' пройдена':''}`:s.mode==='coins'?'Собери 5 монет':'Убереги короля';
    const steps=s.mode==='coins'?5:s.mode==='king'?6:s.waveSize,done=s.status==='bonus-ready'?0:s.mode==='coins'?Math.min(5,s.bonusCoins):s.mode==='king'?s.waveTurn:s.waveKills;
    $('turn-label').textContent=s.status==='bonus-ready'?'Бонус готов':s.mode==='combat'?`Взято ${done} из ${steps}`:`${done} / ${steps} ${s.mode==='coins'?'монет':'ходов'}`;
    $('progress').setAttribute('aria-label',s.mode==='combat'?'Побеждённые враги':'Прогресс бонуса');
    $('progress').innerHTML=Array.from({length:steps},(_,i)=>`<i class="${i<done?'done':i===done?'current':''}"></i>`).join('');
    $('score').textContent=words(s.score,['очко','очка','очков']);$('coins').textContent=coinText(s.coins);$('stars').textContent=`☆ ${s.stars}`;
    $('charges').textContent=s.charges;$('freeze').disabled=paused||s.status!=='playing'||s.mode==='coins'||s.charges<1||!s.enemies.some(e=>!e.frozen);$('freeze').setAttribute('aria-pressed',String(freezeMode));
    $('pause').textContent=paused?'Продолжить':'Пауза';$('pause').disabled=s.status!=='playing';
    $('feedback').textContent=freezeMode?'Выбери врага на доске или в списке. Повторное нажатие отменит выбор.':s.message||'Твой ход. Времени на размышление сколько угодно.';
    $('enemy-list').innerHTML=s.enemies.map(e=>`<button class="enemy-row ${freezeMode&&!e.frozen?'selectable':''}" data-enemy="${e.id}" aria-label="${E.names[e.type]} ${E.name(e.pos)}${freezeMode?', заморозить':''}">${e.type==='R'?'<span aria-hidden="true">♜</span>':`<img src="assets/figma/${assets['b'+e.type]}" alt="">`}<span>${E.names[e.type]} · ${E.name(e.pos)}</span><span class="enemy-intent">${e.frozen?`❄ ещё ${e.frozen}`:e.plan?`→ ${E.name(e.plan)}`:'путь закрыт'}</span></button>`).join('')+s.pending.map(e=>`<div class="enemy-row pending-row"><span aria-hidden="true">${icon(e.type)}</span><span>${E.names[e.type]} · ${E.name(e.pos)}</span><span class="enemy-intent">после хода</span></div>`).join('');
    const next=Math.floor(s.wave/3)*3+3;$('next-bonus').textContent=s.mode==='combat'?`После волны ${next} — ${next%6===0?'защита короля':'монетный дождь'}`:'Бонус не повышает сложность следующей волны';
    $('best').textContent=`Рекорд: ${best.score} очков · волна ${best.wave||1}`;
    $('timer').hidden=s.mode!=='coins';renderTimer();boardRender();overlay();
  }
  function renderTimer(){const time=`00:${String(Math.ceil((s.status==='bonus-ready'?20000:s.remaining)/1000)).padStart(2,'0')}`;$('timer').textContent=paused?'Пауза':time;$('timer').setAttribute('aria-label',`Осталось ${time}${paused?', пауза':''}`);$('timer').classList.toggle('low',s.remaining<=5000);}
  function pause(){if(s.status!=='playing'||paused)return;paused=true;freezeMode=false;persist();render();}
  function resume(){paused=false;lastTime=performance.now();render();}
  function restart(){s=E.initial();paused=false;freezeMode=false;focusSquare=E.name(s.player);lastTime=performance.now();persist();render();}
  function toggleFreeze(){if($('freeze').disabled)return;freezeMode=!freezeMode;render();}
  function attempt(square){if(paused||isModal()||s.status!=='playing')return;const p=E.at(square);if(freezeMode){const e=s.enemies.find(e=>E.eq(e.pos,p));if(e)commit(E.freeze(s,e.id));return;}focusSquare=square;if(!commit(E.move(s,p))){$('feedback').textContent=E.eq(p,s.king)?'Это твой король. Его нужно защитить.':'Конь ходит буквой «Г»: две клетки и одна вбок.';}}
  $('board').addEventListener('click',e=>{const cell=e.target.closest('[data-square]');if(cell)attempt(cell.dataset.square);});
  $('board').addEventListener('keydown',e=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!d)return;e.preventDefault();const p=E.at(e.target.closest('[data-square]')?.dataset.square||focusSquare);p[0]=Math.max(0,Math.min(7,p[0]+d[0]));p[1]=Math.max(0,Math.min(7,p[1]+d[1]));focusSquare=E.name(p);for(const c of $('board').querySelectorAll('[data-square]'))c.tabIndex=c.dataset.square===focusSquare?0:-1;$('board').querySelector(`[data-square="${focusSquare}"]`).focus();});
  $('enemy-list').addEventListener('click',e=>{const row=e.target.closest('[data-enemy]');if(!row||paused)return;if(freezeMode)commit(E.freeze(s,Number(row.dataset.enemy)));else{const en=s.enemies.find(v=>v.id===Number(row.dataset.enemy));$('feedback').textContent=en.frozen?`Заморожен ещё на ${en.frozen} ответа.`:en.plan?`${E.names[en.type]}: ${E.name(en.pos)} → ${E.name(en.plan)}. Если сможет взять коня — атакует. Если путь перекрыт — останется на месте.`:`${E.names[en.type]} на ${E.name(en.pos)}: путь закрыт. Если откроется ход — продолжит погоню; если сможет взять коня — атакует.`;hoverEnemy=en.id;boardRender();}});
  $('hints').onclick=()=>{hints=!hints;storage.set(HINTS,hints);hoverEnemy=null;render();};
  $('freeze').onclick=toggleFreeze;$('pause').onclick=()=>paused?resume():pause();
  $('overlay').addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='resume')resume();if(action==='restart')restart();if(action==='bonus'){paused=false;lastTime=performance.now();commit(E.startBonus(s));}if(action==='next'||action==='skip'){paused=false;commit(E.next(s));}});
  $('about').onclick=()=>{pause();$('help').showModal();};
  $('menu').onclick=()=>{pause();$('menu-record').textContent=`${s.score} очков · волна ${s.wave}. Рекорд — ${best.score} очков.`;$('menu-dialog').showModal();};
  document.addEventListener('click',e=>{const id=e.target.closest('[data-close]')?.dataset.close;if(id)$(id).close();});
  $('new-run').onclick=()=>{$('menu-dialog').close();$('confirm').showModal();};
  $('confirm-new').onclick=()=>{$('confirm').close();restart();};
  $('share').onclick=async()=>{const text=`Последний конь: ${s.score} очков, волна ${s.wave}, ${coinText(s.coins)}. Сможешь дальше?`;try{await navigator.clipboard.writeText(text);$('feedback').textContent='Результат скопирован.';}catch{$('feedback').textContent=text;}};
  document.addEventListener('keydown',e=>{if(isModal()||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;if(e.code==='KeyF'){e.preventDefault();toggleFreeze();}if(e.code==='Space'){e.preventDefault();paused?resume():pause();}if(e.key==='Escape'){freezeMode=false;pause();render();}});
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',persist);
  // Only active time counts. Hidden tabs and dialogs pause explicitly, never auto-resume.
  setInterval(()=>{const now=performance.now(),dt=now-lastTime;lastTime=now;if(!paused&&!document.hidden&&!isModal()&&s.mode==='coins'&&s.status==='playing'){const before=s.status;s=E.tick(s,dt);renderTimer();if(s.status!==before){persist();render();}}},100);
  for(const f of ['87183.svg','4aba3.svg','8228f.svg','7064a.svg','79f9e.svg','12cef.svg','42c67.svg','ccc2d.svg','be904.svg','81bc4.svg']){const img=new Image();img.src='assets/figma/'+f;}
  persist();render();
})();
