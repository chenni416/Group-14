/* =========================================================
   Active Board
   ========================================================= */
function reviewLine(t){
  const p=t.policy;
  if(p.mode==='leader')return `<div class="rv">${ic('clock',15)}<span>Awaiting <b>${at(t.reviewer||leader().id)}</b> approval</span></div>`;
  if(p.mode==='pool')return t.reviewer?`<div class="rv">${av(t.reviewer,'sm')}<span style="flex:1;min-width:0">Under review by <b>${at(t.reviewer)}</b>（${rel(t.claimedAt)}）</span></div>`
    :`<div class="rv"><button class="claim" data-a="claim" data-id="${t.id}">${ic('bolt',13,2)}Claim Review</button><span class="muted xs">開放認領 · ${rel(t.reviewStart)}</span></div>`;
  return `<div class="rv"><div class="avs">${p.targets.map(id=>`<span style="opacity:${t.approvals.includes(id)?1:.45}">${av(id,'sm')}</span>`).join('')}</div><span style="flex:1;min-width:0">Awaiting ${p.targets.map(at).join(' &amp; ')}（${t.approvals.length}/${p.targets.length}，${p.rule==='all'?'需全員':'需 1 人'}）</span></div>`;
}
function vBoard(){
  const sp=S.sprints[S.active],f=S.boardFilter;
  let ts=boardTasks();if(f==='mine')ts=ts.filter(t=>t.assignee===S.me);if(f==='review')ts=ts.filter(t=>canReview(t)||(t.state==='IN_REVIEW'&&t.policy.mode==='pool'&&!t.reviewer&&t.assignee!==S.me));
  const all=boardTasks(),tot=sum(all.map(t=>t.sp)),dn=sum(all.filter(t=>t.state==='DONE').map(t=>t.sp));
  const p3=sprintTasks(3);const showBanner=S.active===2&&p3.length;
  const COL={TODO:['To Do','已確認接收，待開發'],IN_PROGRESS:['In Progress','開發中 / AI 輔助開發'],IN_REVIEW:['In Review','PR 已發布，待 Code Review'],DONE:['Done','通過驗收與測試']};
  return ph(`${sp.n} · ${sp.start} – ${sp.end}`,'Active Board',`<div class="seg">${[['all','全部'],['mine','我的任務'],['review','待我審查']].map(([k,l])=>`<button class="${f===k?'on':''}" data-a="bF" data-v="${k}">${l}</button>`).join('')}</div>`)+
  (showBanner?`<div class="banner"><span class="dico" style="background:#2a2d33">${ic('play',17,2)}</span><div style="flex:1;min-width:200px"><b>Sprint 3 準備中</b><div class="small muted">${p3.filter(t=>t.state==='ASSIGNED').length}/${p3.length} 項任務已被成員接受${sprint3Ready()?'，可以啟動了':''}</div></div><button class="pill" style="background:#fff;color:var(--ink);border-color:#fff" data-a="${sprint3Ready()?'startSprint':'go'}" data-v="planning" ${sprint3Ready()&&me().role!=='Leader'?'disabled':''}>${sprint3Ready()?'Start Sprint 3':'查看規劃'}</button></div>`:'')+
  `<div class="card" style="margin-bottom:20px;padding:18px 22px"><div class="between"><div style="min-width:0"><div class="xs muted">SPRINT GOAL</div><div style="font-size:16px;font-weight:500">${esc(sp.goal||'—')}</div></div><div style="min-width:220px;flex:0 1 320px"><div class="between small" style="margin-bottom:6px"><span class="muted">完成度</span><b>${dn}/${tot} SP</b></div><div class="bar" style="height:10px"><i class="hatch-b" style="width:${tot?dn/tot*100:0}%"></i></div></div></div></div>
  <div class="board">${BOARD.map(k=>{const col=ts.filter(t=>t.state===k);return `<div class="kcol"><div class="kh"><div><h3>${COL[k][0]}</h3><div class="xs muted">${COL[k][1]}</div></div><span class="cnt">${col.length}</span></div>
    ${col.map(t=>`<div class="kcard ${k==='IN_REVIEW'&&t.policy.mode==='leader'?'await':''}" data-a="open" data-id="${t.id}">
      <div class="row" style="gap:6px;flex-wrap:nowrap"><span class="mono muted" style="font-size:11.5px">${t.id}</span>${domTag(t.d)}<button class="cmd" data-a="copyPrompt" data-id="${t.id}" title="複製 Agent Prompt">⌘ Prompt</button></div>
      <div class="tt">${esc(t.title)}</div>
      <div class="ft">${av(t.assignee,'sm')}<span class="sp">${t.sp} SP</span>${t.pr?`<span class="pr ${t.pr.st}">${ic('pr',14)}#${t.pr.no} ${t.pr.st==='merged'?'merged':'open'}</span>`:`<span class="pr">${ic('pr',14)}no PR</span>`}</div>
      ${k==='IN_REVIEW'?reviewLine(t):''}</div>`).join('')||'<div class="faint small" style="padding:8px">—</div>'}</div>`}).join('')}</div>`;
}
