/* =========================================================
   Dashboard
   ========================================================= */
function donut(cnt){
  const segs=[['IN_PROGRESS','url(#hO)'],['IN_REVIEW','url(#hP)'],['DONE','url(#hB)'],['TODO','#e4e6ea']];
  const total=sum(segs.map(s=>cnt[s[0]]))||1,R=62,C=2*Math.PI*R;let off=0;
  const arcs=segs.map(([k,f])=>{const len=cnt[k]/total*C;const gap=cnt[k]&&len>4?3:0;const a=`<circle r="${R}" cx="90" cy="90" fill="none" stroke="${f}" stroke-width="34" stroke-dasharray="${Math.max(0,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`;off+=len;return cnt[k]?a:''}).join('');
  return `<svg viewBox="0 0 180 180" width="190" height="190" style="display:block;margin:4px auto 0"><defs>
    <pattern id="hO" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f28c3a"/><rect width="2.4" height="7" fill="#f7ac72"/></pattern>
    <pattern id="hB" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#4689f5"/><rect width="2.4" height="7" fill="#7eacf8"/></pattern>
    <pattern id="hP" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#8b3ffb"/><rect width="2.4" height="7" fill="#ad7bfc"/></pattern></defs>
    <circle r="62" cx="90" cy="90" fill="none" stroke="#eef0f3" stroke-width="34"/>${arcs}
    <text x="90" y="86" text-anchor="middle" font-size="26" font-weight="600" fill="#131518" font-family="DM Sans, Noto Sans TC, sans-serif">${total===1&&!sum(Object.values(cnt))?0:total}</text><text x="90" y="106" text-anchor="middle" font-size="11" fill="#6c717a">tasks</text></svg>`;
}
function burnData(){
  const ts=boardTasks(),total=sum(ts.map(t=>t.sp)),done=sum(ts.filter(t=>t.state==='DONE').map(t=>t.sp));
  const labels=S.active===2?['10/27','10/28','10/29','10/30','10/31','11/03','11/04','11/05','11/06','11/09']:['11/10','11/11','11/12','11/13','11/14','11/17','11/18','11/19','11/20','11/21'];
  const n=labels.length,ideal=labels.map((_,i)=>+(total*(1-i/(n-1))).toFixed(1));
  let actual;
  if(S.active===2){const base=[29,29,28,28,27,26,26,25,24].map(v=>v*total/29);actual=[...base.map(v=>Math.max(total-done,Math.round(v))),total-done]}
  else actual=[total-done];
  return {labels,ideal,actual,total};
}
function smooth(p){let d=`M${p[0][0]},${p[0][1]}`;for(let i=0;i<p.length-1;i++){const a=p[i-1]||p[i],b=p[i],c=p[i+1],e=p[i+2]||c;d+=` C${b[0]+(c[0]-a[0])/6},${b[1]+(c[1]-a[1])/6} ${c[0]-(e[0]-b[0])/6},${c[1]-(e[1]-b[1])/6} ${c[0]},${c[1]}`}return d}
function burnSvg(){
  const {labels,ideal,actual,total}=burnData(),W=560,H=230,x0=8,x1=W-8,y0=16,y1=190,mx=total||1;
  const X=i=>x0+(x1-x0)*i/(labels.length-1),Y=v=>y1-(y1-y0)*v/mx;
  const pi=ideal.map((v,i)=>[X(i),Y(v)]),pa=actual.map((v,i)=>[X(i),Y(v)]);
  const area=p=>smooth(p)+` L${p[p.length-1][0]},${y1} L${p[0][0]},${y1} Z`;
  return `<svg id="burn" viewBox="0 0 ${W} ${H+24}" width="100%" style="display:block;overflow:visible"><defs>
    <pattern id="sB" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#e5eefd"/><rect width="6" height="1.4" fill="#d4e2fc"/></pattern>
    <pattern id="sO" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fdeee2"/><rect width="6" height="1.4" fill="#fbdcc3"/></pattern></defs>
    ${[0,.25,.5,.75,1].map(f=>`<line x1="${x0}" x2="${x1}" y1="${Y(mx*f)}" y2="${Y(mx*f)}" stroke="#e3e6ea" stroke-dasharray="3 5"/>`).join('')}
    <path d="${area(pi)}" fill="url(#sB)" opacity=".9"/>${pa.length>1?`<path d="${area(pa)}" fill="url(#sO)" opacity=".75"/>`:''}
    <path d="${smooth(pi)}" fill="none" stroke="#4689f5" stroke-width="2.2"/>${pa.length>1?`<path d="${smooth(pa)}" fill="none" stroke="#f28c3a" stroke-width="2.2"/>`:''}
    ${pa.length===1?`<circle cx="${pa[0][0]}" cy="${pa[0][1]}" r="5" fill="#fff" stroke="#f28c3a" stroke-width="2.4"/>`:''}
    ${labels.map((l,i)=>`<text x="${X(i)}" y="${H+16}" text-anchor="middle" font-size="12.5" fill="#6c717a" font-family="DM Sans, Noto Sans TC, sans-serif">${l}</text>`).join('')}
    <line id="bl" x1="0" x2="0" y1="${y0}" y2="${y1}" stroke="#9ca1a9" stroke-dasharray="3 4" visibility="hidden"/>
    <circle id="bdi" r="5" fill="#fff" stroke="#4689f5" stroke-width="2.4" visibility="hidden"/><circle id="bda" r="5" fill="#fff" stroke="#f28c3a" stroke-width="2.4" visibility="hidden"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent" id="bhit"/></svg>`;
}
function bindChart(){
  const svg=$('#burn');if(!svg)return;const tip=$('#btip');const {labels,ideal,actual,total}=burnData();
  const W=560,x0=8,x1=W-8,y0=16,y1=190,mx=total||1,X=i=>x0+(x1-x0)*i/(labels.length-1),Y=v=>y1-(y1-y0)*v/mx;
  const hide=()=>{['bl','bdi','bda'].forEach(id=>svg.querySelector('#'+id).setAttribute('visibility','hidden'));tip.style.display='none'};
  svg.addEventListener('mousemove',e=>{
    const r=svg.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*W;const i=Math.max(0,Math.min(labels.length-1,Math.round((sx-x0)/(x1-x0)*(labels.length-1))));
    const l=svg.querySelector('#bl');l.setAttribute('x1',X(i));l.setAttribute('x2',X(i));l.setAttribute('visibility','visible');
    const di=svg.querySelector('#bdi');di.setAttribute('cx',X(i));di.setAttribute('cy',Y(ideal[i]));di.setAttribute('visibility','visible');
    const da=svg.querySelector('#bda');if(actual[i]!=null){da.setAttribute('cx',X(i));da.setAttribute('cy',Y(actual[i]));da.setAttribute('visibility','visible')}else da.setAttribute('visibility','hidden');
    tip.innerHTML=`<div><i style="background:#4689f5"></i>理想剩餘：${ideal[i]} SP</div><div><i style="background:#f28c3a"></i>實際剩餘：${actual[i]!=null?actual[i]+' SP':'—'}</div>`;
    tip.style.display='block';const px=X(i)/W*r.width;tip.style.left=Math.min(r.width-170,Math.max(0,px+10))+'px';tip.style.top='6px';
  });
  svg.addEventListener('mouseleave',hide);
}
function vDashboard(){
  const bt=boardTasks(),cnt={TODO:0,IN_PROGRESS:0,IN_REVIEW:0,DONE:0};bt.forEach(t=>cnt[t.state]++);
  const mine=S.myTab==='doing'?S.tasks.filter(t=>t.assignee===S.me&&['TODO','IN_PROGRESS','IN_REVIEW'].includes(t.state))
    :S.tasks.filter(t=>(t.assignee===S.me&&t.state==='PENDING_MEMBER')||canReview(t)||(t.state==='IN_REVIEW'&&t.policy.mode==='pool'&&!t.reviewer&&t.assignee!==S.me));
  const rv=bt.filter(t=>t.state==='IN_REVIEW');
  const q=[['等待 Leader 專審',rv.filter(t=>t.policy.mode==='leader'),'hatch-a'],['開放認領中',rv.filter(t=>t.policy.mode==='pool'&&!t.reviewer),'hatch-b'],['審查進行中',rv.filter(t=>(t.policy.mode==='pool'&&t.reviewer)||t.policy.mode==='target'),'hatch-o']];
  const p3=sprintTasks(3),pc=k=>p3.filter(t=>k.includes(t.state)).length;
  const sp=S.sprints[S.active];
  return ph('管理並追蹤你的專案','Project Dashboard',`<div class="seg"><button class="on">${sp.n}</button><button data-a="go" data-v="board">看板</button><button data-a="help">流程</button></div>`)+
  `<div class="dash">
    <div class="card mytasks"><div class="ch" style="margin-bottom:14px"><h2>我的任務</h2><button class="cbtn" data-a="go" data-v="planning" aria-label="新增">${ic('plus',20)}</button></div>
      <div class="row"><button class="pill sm ${S.myTab==='doing'?'on':''}" data-a="myTab" data-v="doing">進行中</button><button class="pill sm ${S.myTab==='todo'?'on':''}" data-a="myTab" data-v="todo">待我處理</button></div>
      <button class="dd" data-a="go" data-v="${S.myTab==='doing'?'board':'inbox'}"><span class="n">${mine.length}</span>${S.myTab==='doing'?'On Going Tasks':'Action Required'}<span style="margin-left:auto">${ic('down',18)}</span></button>
      <div class="plist">${mine.length?mine.slice(0,6).map(t=>`<div class="ptask p-${t.d}" data-a="open" data-id="${t.id}"><div class="between"><span class="dico d-${t.d}">${ic(DOM[t.d].icon,18,2)}</span><span class="chk">${ic('check',15,2.2)}</span></div><b>${esc(t.title)}</b><p>${t.id} · ${ST[t.state].n} · ${t.sp} SP</p></div>`).join(''):`<div class="empty small">目前沒有項目</div>`}</div>
    </div>
    <div class="card"><div class="ch"><h2>Sprint 概況</h2><button class="cbtn" data-a="go" data-v="board" aria-label="開啟看板">${ic('arrow',18)}</button></div>
      ${donut(cnt)}
      <div class="legend"><span><i style="background:var(--orange)"></i>In Progress: ${cnt.IN_PROGRESS}</span><span><i style="background:var(--purple)"></i>In Review: ${cnt.IN_REVIEW}</span><span><i style="background:var(--blue)"></i>Done: ${cnt.DONE}</span><span><i style="background:#dfe2e6"></i>To Do: ${cnt.TODO}</span></div></div>
    <div class="card"><div class="ch"><h2>Burndown</h2><div class="row"><span class="legend" style="margin:0;font-size:13px"><span><i style="background:var(--blue)"></i>理想</span><span><i style="background:var(--orange)"></i>實際</span></span></div></div>
      <div class="chartbox">${burnSvg()}<div class="ctip" id="btip"></div></div></div>
    <div class="card wide"><div class="ch"><h2>Review 佇列</h2><button class="cbtn" data-a="go" data-v="board" aria-label="看板">${ic('arrow',18)}</button></div>
      ${q.map(([l,a,h])=>`<div class="qrow"><div class="between"><span>${l}</span><span><b>${a.length}</b> <span class="faint">|</span> ${sum(a.map(t=>t.sp))} SP</span></div><div class="bar thick"><i class="${h}" style="width:${rv.length?Math.max(a.length?8:0,a.length/rv.length*100):0}%"></i></div></div>`).join('')}
    </div>
    <div class="card wide"><div class="ch"><h2>Sprint 3 規劃進度</h2><button class="pill sm dark" data-a="go" data-v="planning">${ic('spark',15)}開啟 Planning Studio</button></div>
      ${p3.length?`<div class="pipe">
        <div class="st"><span class="chip c-purple">AI Suggestion</span><div class="v">${pc(['AI_DRAFT','DRAFT'])}</div></div><span class="ar">›</span>
        <div class="st"><span class="chip c-amber">Leader Approved</span><div class="v">${pc(['PENDING_MEMBER'])}</div></div><span class="ar">›</span>
        <div class="st"><span class="chip c-red">協商退回</span><div class="v">${pc(['RETURNED'])}</div></div><span class="ar">›</span>
        <div class="st"><span class="chip c-green">Member Accepted</span><div class="v">${pc(['ASSIGNED','TODO','IN_PROGRESS','IN_REVIEW','DONE'])}</div></div></div>`
      :`<div class="note">尚未拆解 Sprint 3 的會議紀錄。前往 Planning Studio 貼上會議紀錄，讓 AI 拆解成 Epic → Story → Sub-task。</div>`}
    </div>
    <div class="card wide"><div class="ch"><h2>團隊負載</h2><span class="muted small">${sp.n} 剩餘 SP ／ Capacity</span></div>
      ${S.members.map(m=>{const l=sum(bt.filter(t=>t.assignee===m.id&&t.state!=='DONE').map(t=>t.sp));const r=l/m.cap;return `<div class="qrow" style="padding:9px 0"><div class="between" style="margin-bottom:7px;font-size:14px"><span class="row" style="gap:9px">${av(m.id,'sm')}${esc(m.name)}<span class="faint small">${esc(m.title)}</span></span><span><b>${l}</b> / ${m.cap} SP</span></div><div class="bar"><i class="${r>1?'hatch-o':''}" style="width:${Math.min(100,r*100)}%;${r>1?'':'background:var(--ink)'}"></i></div></div>`}).join('')}
    </div>
  </div>`;
}
