/* =========================================================
   Sprint Planning Studio
   ========================================================= */
function subCard(t){
  const edit=['AI_DRAFT','DRAFT'].includes(t.state)&&isLead();const load=plannedLoad();
  return `<div class="sub ${t.state==='AI_DRAFT'?'aiout':''} ${t.state==='RETURNED'?'ret':''}">
    <div class="sub-h"><span class="mono muted">${t.id}</span>${t.origin==='ai'?aiTag(t.state==='AI_DRAFT'?'AI Draft':'AI Generated'):'<span class="tag">手動新增</span>'}${t.edited?'<span class="tag">Leader 已調整</span>':''}${chip(t.state)}${edit?`<button class="xbtn" data-a="rmTask" data-id="${t.id}" aria-label="移除">×</button>`:''}</div>
    <div class="sub-b"><div>
      ${edit?`<input class="in ttl" data-tf="title" data-id="${t.id}" value="${esc(t.title)}">`:`<b style="font-size:15px">${esc(t.title)}</b>`}
      <div class="row" style="gap:6px;margin-top:8px">${domTag(t.d)}${t.tags.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>
      <ul class="ac">${t.ac.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>
      ${edit?`<details><summary>編輯驗收條件</summary><textarea class="in" rows="4" style="margin-top:6px;font-size:13px" data-tf="ac" data-id="${t.id}">${esc(t.ac.join('\n'))}</textarea></details>`:''}
    </div><div class="stack" style="gap:10px">
      <div><label class="f">Story Points</label><div class="row" style="flex-wrap:nowrap"><select class="in sm" style="width:80px" data-tf="sp" data-id="${t.id}" ${edit?'':'disabled'}>${[1,2,3,5,8].map(v=>`<option ${t.sp===v?'selected':''}>${v}</option>`).join('')}</select>${t.spWhy?`<span class="xs muted">${esc(t.spWhy)}</span>`:''}</div></div>
      <div><label class="f">指派</label><div class="row" style="flex-wrap:nowrap">${av(t.assignee,'sm')}<select class="in sm" data-tf="assignee" data-id="${t.id}" ${edit?'':'disabled'}>${S.members.map(m=>`<option value="${m.id}" ${t.assignee===m.id?'selected':''}>${esc(m.name)} · ${load[m.id]}/${m.cap} SP</option>`).join('')}</select></div></div>
      ${t.sugWhy?`<div class="aibox"><div class="lbl">${ic('spark',12,2)}AI SUGGESTED ASSIGNEE</div>建議指派 ${at(t.suggested)}，因為${esc(t.sugWhy)}${t.assignee!==t.suggested?`<div class="xs" style="margin-top:4px;color:var(--muted)">Leader 已改派給 ${at(t.assignee)}</div>`:''}</div>`:''}
      <div class="xs muted">Review：<b style="color:var(--ink)">${POL[t.policy.mode].n}</b>${t.policyWhy?` · ${esc(t.policyWhy)}`:''}</div>
    </div></div>
    ${t.state==='RETURNED'&&t.negotiate?`<div class="note err" style="margin-top:12px"><b>${at(t.negotiate.by)} 提出協商：</b>${esc(t.negotiate.reason)}${t.negotiate.suggest?`（建議改由 ${at(t.negotiate.suggest)} 處理）`:''}
      ${isLead()?`<div class="row" style="margin-top:10px"><select class="in sm" style="width:auto;background-color:#fff" id="re-${t.id}">${S.members.filter(m=>m.id!==t.negotiate.by).map(m=>`<option value="${m.id}" ${m.id===t.negotiate.suggest?'selected':''}>${esc(m.name)}</option>`).join('')}</select><button class="pill sm dark" data-a="resend" data-id="${t.id}">重新指派並發送</button></div>`:''}</div>`:''}
  </div>`;
}
function vPlanning(){
  const sp=S.sprints[3],ts=planTasks(),drafts=ts.filter(t=>['AI_DRAFT','DRAFT'].includes(t.state));const load=plannedLoad();
  const epics={};ts.forEach(t=>{(epics[t.epic||'手動任務']??={})[t.story||'—']??=[];epics[t.epic||'手動任務'][t.story||'—'].push(t)});
  const r=ragState();
  let right;
  if(S.analyzing!=null){const steps=['讀取專案知識庫（'+S.docs.length+' 份文件）','擷取會議需求與 Sprint Goal','拆解 Epic → User Story → Sub-task','估算 Story Points 與理由','依技能、負載推薦指派與 Review 策略'];
    right=`<div class="aibox" style="padding:18px"><div class="lbl">${ic('spark',13,2)}AI 正在分析</div><div class="loadsteps">${steps.map((s,i)=>`<div class="${i<S.analyzing?'done':i===S.analyzing?'cur':''}">${i<S.analyzing?`<span class="ok">${ic('check',16,2.4)}</span>`:i===S.analyzing?'<span class="spin"></span>':`<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #d3d6db;display:inline-block"></span>`}${s}</div>`).join('')}</div></div>`}
  else if(!ts.length) right=`<div class="empty"><div class="ei">${ic('spark',24)}</div><b style="color:var(--ink);font-size:16px">還沒有任務</b><div class="small" style="margin-top:4px">在左側貼上會議紀錄後，按「AI Analyze & Decompose」</div></div>`;
  else right=`<div class="cap">${S.members.map(m=>{const v=load[m.id],r=v/m.cap;return `<div class="c"><div class="row" style="gap:7px;flex-wrap:nowrap">${av(m.id,'sm')}<span class="small" style="white-space:nowrap">${esc(m.name)}</span></div><div class="between" style="margin:6px 0 5px"><span class="xs muted">SP</span><b class="small" style="color:${r>1?'var(--red)':'inherit'}">${v}/${m.cap}</b></div><div class="bar" style="height:5px"><i style="width:${Math.min(100,r*100)}%;background:${r>1?'var(--red)':'var(--ink)'}"></i></div></div>`}).join('')}</div>`+
    Object.entries(epics).map(([e,stories])=>`<div class="epic"><div class="epic-h"><span class="lvl">EPIC</span><h3>${esc(e)}</h3></div>${Object.entries(stories).map(([s,arr])=>`<div class="story"><div class="story-h"><span class="lvl s">STORY</span>${esc(s)}<span class="xs faint" style="margin-left:auto">${sum(arr.map(t=>t.sp))} SP</span></div>${arr.map(subCard).join('')}</div>`).join('')}</div>`).join('');
  const all=sprintTasks(3),ready=sprint3Ready();
  return ph('Sprint Planning Studio',`${sp.n} 規劃`,`<div class="chain"><span class="chip c-purple">AI Suggestion</span><span class="ar">›</span><span class="chip c-amber">Leader Approved</span><span class="ar">›</span><span class="chip c-green">Member Accepted</span></div>`)+
  `<div class="split"><div class="card sticky"><div class="ch"><h2>Source Context</h2><span class="tag">${sp.start} – ${sp.end}</span></div><div class="stack">
      <div><label class="f">Sprint Goal</label><input class="in" data-g="goal" value="${esc(sp.goal)}" placeholder="本次 Sprint 要達成的成果"></div>
      <div><div class="between" style="margin-bottom:6px"><label class="f" style="margin:0">會議紀錄（Markdown）</label><div class="row" style="gap:6px"><button class="pill xs" data-a="pickNotes">${ic('upload',13)}上傳</button><button class="pill xs" data-a="sample">範例</button></div></div>
        <textarea class="in code" id="notes" rows="14">${esc(S.notes)}</textarea></div>
      <div><label class="f">AI 已掛載的專案脈絡</label><div class="ctxchips"><span class="rag ${r.c}" style="padding:3px 10px;font-size:12px">${r.t}</span>${S.docs.slice(0,5).map(d=>`<span class="tag">${esc(d.k)}</span>`).join('')}</div></div>
      <button class="pill dark" style="height:52px;justify-content:center;font-size:15.5px" data-a="analyze" ${S.analyzing!=null?'disabled':''}>${ic('spark',18)}AI Analyze &amp; Decompose</button>
      ${isLead()?'':'<div class="note warn">只有 Leader / PO 可以執行拆解與核准，請從右上角切換身分。</div>'}
    </div></div>
    <div class="card"><div class="ch"><h2>Review &amp; Approval Workspace</h2><span class="muted small">${ts.length} 項 · ${sum(ts.map(t=>t.sp))} SP</span></div>${right}
      ${ts.length||all.length?`<div class="footbar"><div class="row"><button class="pill sm" data-a="manual" ${isLead()?'':'disabled'}>${ic('plus',15)}手動新增任務</button>${ready?`<span class="chip c-green">${all.length} 項任務全部被接受</span>`:`<span class="small muted">待確認 ${all.filter(t=>t.state==='PENDING_MEMBER').length} · 退回 ${all.filter(t=>t.state==='RETURNED').length} · 已接受 ${all.filter(t=>t.state==='ASSIGNED').length}</span>`}</div>
        ${ready?`<button class="pill dark" data-a="startSprint" ${me().role==='Leader'?'':'disabled'}>${ic('play',15)}Start Sprint</button>`:`<button class="pill dark" data-a="approve" ${drafts.length&&isLead()?'':'disabled'}>${ic('send',16)}核准並發送指派邀請（${drafts.length}）</button>`}</div>`:''}
    </div></div>`;
}
