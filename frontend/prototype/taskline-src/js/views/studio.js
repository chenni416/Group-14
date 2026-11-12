/* =========================================================
   Task Detail Studio
   ========================================================= */
function openStudio(id){const t=T(id);if(!t)return;S.studio=id;
  if(!t.chat.length)t.chat.push({r:'a',text:`我已讀取 ${t.id} 的規格、${S.sprints[t.sprint].n} 目標與 ${S.docs.length} 份專案文件。有任何需要釐清的地方都可以直接問，不用重打背景；我會把結論更新到左側的 Prompt。`,src:['PRD_v2.md','openapi.yaml']});
  renderStudio();$('#studio').classList.add('on');$('#ov').classList.add('on');document.body.style.overflow='hidden';
  const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight}
function closeStudio(){S.studio=null;$('#studio').classList.remove('on');$('#ov').classList.remove('on');document.body.style.overflow=''}
function renderStudio(){
  const t=T(S.studio);if(!t)return;const p=t.policy;const owner=t.assignee===S.me;
  const canPol=!['IN_REVIEW','DONE'].includes(t.state)&&(isLead()||owner);
  const lines=promptText(t),prev=t.pc>0?promptText(t,t.pc-1):lines;
  const plines=lines.map(l=>{const add=t.pc>0&&!prev.includes(l);const h=esc(l).replace(/^(【[^】]+】)/,'<span class="k">$1</span>');return add?`<span class="add">${h}</span>`:h}).join('\n');
  let act='';
  if(t.state==='PENDING_MEMBER')act=owner?`<button class="pill dark" data-a="accept" data-id="${t.id}">${ic('check',16,2.2)}接受 Accept</button><button class="pill" data-a="negotiate" data-id="${t.id}">協商轉移 / 拒絕</button>`:`<span class="muted small">等待 ${at(t.assignee)} 確認</span>`;
  else if(['AI_DRAFT','DRAFT'].includes(t.state))act=`<span class="muted small">草稿：Leader 核准後才會發送指派邀請</span>`;
  else if(t.state==='RETURNED')act=`<span class="muted small">已退回 Leader 重新指派</span>`;
  else if(t.state==='ASSIGNED')act=`<span class="muted small">已接受，等待 Leader 啟動 Sprint</span>`;
  else if(t.state==='TODO')act=owner?`<button class="pill dark" data-a="startDev">${ic('play',15)}開始開發</button>`:`<span class="muted small">只有 ${at(t.assignee)} 可以開始（可切換身分）</span>`;
  else if(t.state==='IN_PROGRESS')act=owner?`<button class="pill dark" data-a="toReview">${ic('pr',16)}發布 PR 並送審</button><span class="small muted">將套用：${POL[p.mode].n}</span>`:`<span class="muted small">${at(t.assignee)} 開發中</span>`;
  else if(t.state==='IN_REVIEW'){
    if(p.mode==='pool'&&!t.reviewer&&!owner)act=`<button class="claim" style="height:40px;padding:0 18px" data-a="claim" data-id="${t.id}">${ic('bolt',15,2)}Claim Review</button>`;
    else if(canReview(t))act=`<input class="in" id="rvNote" style="flex:1;min-width:180px;height:42px;border-radius:99px" placeholder="審查意見（要求修改時必填）"><button class="pill dark" data-a="rvOk">${ic('check',16,2.2)}核准</button><button class="pill" data-a="rvNo">要求修改</button>`;
    else act=`<span class="muted small">${p.mode==='pool'&&!t.reviewer?'開放認領中（負責人不能審查自己的任務）':'等待 '+(p.mode==='target'?p.targets.filter(x=>!t.approvals.includes(x)).map(at).join('、'):at(t.reviewer))+' 審查'}</span>`}
  else if(t.state==='DONE')act=`<span class="chip c-green">已通過審查</span>`;
  $('#studio').innerHTML=`<div class="sh"><div style="min-width:0"><div class="row" style="gap:8px"><span class="mono muted">${t.id}</span>${t.epic&&t.epic!=='Sprint 2'?`<span class="xs muted">${esc(t.epic)} › ${esc(t.story)}</span>`:''}${chip(t.state)}${t.origin==='ai'?aiTag():''}</div><h2>${esc(t.title)}</h2></div><button class="cbtn" data-a="closeStudio" aria-label="關閉">${ic('x',18)}</button></div>
  <div class="sgrid"><div class="sleft">
    <div class="meta"><div><label>Assignee</label><div class="row" style="gap:7px;flex-wrap:nowrap">${av(t.assignee,'sm')}<span class="small">${esc(M(t.assignee).name)}</span></div></div><div><label>Story Points</label><b>${t.sp} SP</b></div>
      <div style="grid-column:span 2"><label>Git Branch</label><div class="row" style="gap:6px;flex-wrap:nowrap"><span class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.branch)}</span><button class="cmd" style="margin-left:auto" data-a="copyBranch">${ic('copy',12)}</button></div></div></div>
    <div class="card" style="padding:20px"><div class="ch" style="margin-bottom:10px"><h3>驗收條件 Acceptance Criteria</h3>${t.pr?`<span class="pr ${t.pr.st}">${ic('pr',15)}PR #${t.pr.no} ${t.pr.st}</span>`:''}</div><ul class="ac" style="font-size:14px;margin:0">${t.ac.map(a=>`<li>${esc(a)}</li>`).join('')}</ul><div class="small muted" style="margin-top:10px">${esc(t.desc)}</div></div>
    <div class="card" style="padding:20px"><div class="ch" style="margin-bottom:12px"><h3>Living Prompt</h3><div class="row" style="gap:8px"><div class="vdots">${t.pv.map((_,i)=>`<button class="${i===t.pc?'on':''}" data-a="pv" data-v="${i}" title="版本 ${i+1}">v${i+1}</button>`).join('')}</div><button class="pill xs" data-a="revert" ${t.pc?'':'disabled'}>${ic('undo',13)}還原上一版</button><button class="pill xs dark" data-a="copyPrompt" data-id="${t.id}">${ic('copy',13)}Copy to Claude Code</button></div></div>
      <pre class="prompt">${plines}</pre><div class="xs muted" style="margin-top:8px">${t.pc?'紫色為本版新增內容 · ':''}由任務規格 + Sprint 目標 + 專案知識庫自動組合，會隨右側對話更新</div></div>
    <div class="card" style="padding:20px"><div class="ch" style="margin-bottom:12px"><h3>Review Policy</h3><span class="xs muted">${canPol?'Task-level Override':'審查中已鎖定'}</span></div>
      <div class="seg" style="margin-bottom:12px">${Object.entries(POL).map(([k,v])=>`<button class="${p.mode===k?'on':''}" data-a="tPol" data-v="${k}" ${canPol?'':'disabled'}>${v.n}</button>`).join('')}</div>
      <div class="small muted" style="margin-bottom:10px">${POL[p.mode].en} · 適用：${POL[p.mode].d}</div>
      ${p.mode==='target'?`<div class="row" style="margin-bottom:10px">${S.members.filter(m=>m.id!==t.assignee).map(m=>`<button class="pill xs ${p.targets.includes(m.id)?'on':''}" data-a="tTarget" data-v="${m.id}" ${canPol?'':'disabled'}>${esc(m.name)} · ${esc(m.title)}</button>`).join('')}</div><div class="seg"><button class="${p.rule==='any'?'on':''}" data-a="tRule" data-v="any" ${canPol?'':'disabled'}>需 1 人同意</button><button class="${p.rule==='all'?'on':''}" data-a="tRule" data-v="all" ${canPol?'':'disabled'}>需全員同意</button></div>`:''}
      ${t.policyWhy?`<div class="aibox" style="margin-top:12px"><div class="lbl">${ic('spark',12,2)}AI 建議</div>${esc(t.policyWhy)}</div>`:''}</div>
    <div class="card" style="padding:16px 20px"><div class="row">${act}</div></div>
  </div>
  <div class="card chat"><div class="between" style="margin-bottom:10px"><div><h3>專案脈絡助理</h3><div class="xs muted">Context-Aware Copilot</div></div>${aiTag('RAG Ready')}</div>
    <div class="ctxchips" style="margin-bottom:8px"><span class="tag">任務規格</span><span class="tag">${S.sprints[t.sprint].n} Goal</span>${S.docs.slice(0,4).map(d=>`<span class="tag">${esc(d.k)}</span>`).join('')}</div>
    <div class="msgs" id="msgs">${t.chat.map(m=>m.r==='u'?`<div class="msg u">${esc(m.text)}</div>`:`<div class="msg a"><div class="lbl">${ic('spark',12,2)}AI GENERATED</div>${esc(m.text)}${m.add?`<div class="delta">+ Prompt v${m.v}：${esc(m.add)}</div>`:''}${m.src?`<div class="src">${m.src.map(s=>`<span class="tag">${ic('file',11)}${esc(s)}</span>`).join('')}</div>`:''}</div>`).join('')}${S.typing?'<div class="msg a typing"><span></span><span></span><span></span></div>':''}</div>
    <div class="qs">${['webhook 簽章要怎麼驗證？','需要寫哪些測試？','相關檔案在哪裡？','UI 要參考哪份設計？','先不用做多語系'].map(q=>`<button data-a="ask" data-v="${q}">${q}</button>`).join('')}</div>
    <div class="cin"><input id="chatIn" placeholder="直接問專案問題，不用重打背景…"><button data-a="send" aria-label="送出">${ic('send',18,2)}</button></div>
  </div></div>`;
  const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight;
}
function askAI(q){
  const t=T(S.studio);if(!q||!t||S.typing)return;
  t.chat.push({r:'u',text:q});S.typing=true;renderStudio();
  setTimeout(()=>{const r=aiReply(t,q);S.typing=false;
    const cur=t.pv[t.pc];if(!cur.includes(r.add)){t.pv=t.pv.slice(0,t.pc+1);t.pv.push([...cur,r.add]);t.pc=t.pv.length-1}
    t.chat.push({r:'a',text:r.a,src:r.src,add:r.add,v:t.pc+1});if(S.studio===t.id)renderStudio()},750);
}
