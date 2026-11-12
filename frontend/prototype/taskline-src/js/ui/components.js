/* =========================================================
   共用 UI
   ========================================================= */
const av=(id,c='')=>{const m=M(id);return m?`<span class="av ${c}" style="background:${m.color}" title="${esc(m.name)}">${esc(m.name[0])}</span>`:`<span class="av ${c}" style="background:#9ca1a9">?</span>`};
const chip=s=>`<span class="chip c-${ST[s].c}">${ST[s].n}</span>`;
const aiTag=(txt='AI Generated')=>`<span class="tag aitag">${ic('spark',12,2)}${txt}</span>`;
const domTag=d=>`<span class="tag">${DOM[d].n}</span>`;
const ph=(s,h,right='')=>`<div class="ph"><div><div class="s">${s}</div><h1>${h}</h1></div><div class="row">${right}</div></div>`;
const FLOW=[['team','團隊設定'],['onboard','專案初始化'],['planning','Sprint 規劃'],['inbox','確認與認領'],['board','Active Board']];
const SIDE=[['dashboard','grid','Dashboard'],['planning','spark','Sprint 規劃'],['inbox','inbox','收件匣'],['board','board','Active Board'],['sep'],['onboard','layers','專案與知識庫'],['team','users','組織與團隊'],['help','help','流程說明']];
const myPending=()=>S.notifs.filter(n=>n.to===S.me&&n.state==='pending');

function renderShell(){
  $('#flow').innerHTML=FLOW.map(([k,l],i)=>`${i?'<span class="arr">›</span>':''}<button class="pill ${S.view===k?'on':''}" data-a="go" data-v="${k}"><span class="n">${i+1}</span>${l}</button>`).join('');
  $('#sbar').innerHTML=SIDE.map(x=>x[0]==='sep'?'<span class="sep"></span>':`<button class="sbtn ${S.view===x[0]?'on':''}" data-a="${x[0]==='help'?'help':'go'}" data-v="${x[0]}" aria-label="${x[2]}">${ic(x[1],21)}${x[0]==='inbox'&&myPending().length?'<span class="dot"></span>':''}<span class="tip">${x[2]}</span></button>`).join('');
  const m=me();
  $('#meBox').innerHTML=`${av(m.id)}<div><div class="nm">${esc(m.name)}</div><div class="rl">${m.role} · ${esc(m.title)}</div></div>${ic('down',16)}<select id="whoSel" aria-label="切換身分">${S.members.map(x=>`<option value="${x.id}" ${x.id===S.me?'selected':''}>${esc(x.name)}（${x.role}）</option>`).join('')}</select>`;
}
function render(){renderShell();$('#main').innerHTML=VIEW[S.view]();if(S.view==='dashboard')bindChart();if(S.studio)renderStudio()}
