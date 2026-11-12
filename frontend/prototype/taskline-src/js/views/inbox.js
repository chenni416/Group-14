/* =========================================================
   Inbox
   ========================================================= */
function vInbox(){
  const f=S.inboxFilter,mine=S.notifs.filter(n=>n.to===S.me&&(f==='all'||n.type===f||(f==='review'&&n.type==='pool')));
  const p3=sprintTasks(3).filter(t=>t.assignee===S.me),acc=sum(p3.filter(t=>t.state==='ASSIGNED').map(t=>t.sp)),pend=sum(p3.filter(t=>t.state==='PENDING_MEMBER').map(t=>t.sp));
  const icon={invite:['flag','c-amber'],review:['eye','c-blue'],pool:['bolt','c-blue'],returned:['undo','c-red'],info:['check','c-gray']};
  const item=n=>{const t=T(n.task);if(!t)return '';const pend=n.state==='pending';
    let head='',act='';
    if(n.type==='invite'){head=`${at(n.from)} 已指派 <b>${t.id}: ${esc(t.title)}</b> 給您，預估 ${t.sp} 點`;
      act=pend&&t.state==='PENDING_MEMBER'?`<button class="pill sm dark" data-a="accept" data-id="${t.id}">${ic('check',15,2.2)}接受 Accept</button><button class="pill sm" data-a="negotiate" data-id="${t.id}">協商轉移 / 拒絕</button><button class="pill sm ghost" data-a="open" data-id="${t.id}">查看</button>`:''}
    else if(n.type==='review'){head=`${at(n.from)} 請你審查 <b>${t.id}: ${esc(t.title)}</b>`;act=pend?`<button class="pill sm dark" data-a="open" data-id="${t.id}">開啟審查</button>`:''}
    else if(n.type==='pool'){head=`Review 公共池：<b>${t.id}: ${esc(t.title)}</b>`;act=pend&&!t.reviewer&&t.state==='IN_REVIEW'?`<button class="claim" data-a="claim" data-id="${t.id}">${ic('bolt',14,2)}Claim Review</button><button class="pill sm ghost" data-a="open" data-id="${t.id}">查看</button>`:''}
    else if(n.type==='returned'){head=`${at(n.from)} 對 <b>${t.id}: ${esc(t.title)}</b> 提出協商`;act=pend&&t.state==='RETURNED'?`<button class="pill sm dark" data-a="go" data-v="planning">前往重新指派</button>`:''}
    else head=`${at(n.from)} · <b>${t.id}: ${esc(t.title)}</b>`;
    const [ico,cc]=icon[n.type];
    return `<div class="nitem ${pend?'':'read'}"><span class="ico ${cc}">${ic(ico,19,2)}</span><div class="tx"><div>${head}</div><div class="small muted" style="margin-top:2px">${esc(n.text)} · ${rel(n.t)}</div>${act?`<div class="row" style="margin-top:12px">${act}</div>`:!pend?`<div style="margin-top:8px"><span class="chip c-gray">已處理</span></div>`:''}</div></div>`};
  return ph('Action Required Inbox','確認與認領',`<div class="seg">${[['all','全部'],['invite','指派邀請'],['review','Review'],['returned','協商退回']].map(([k,l])=>`<button class="${f===k?'on':''}" data-a="inF" data-v="${k}">${l}</button>`).join('')}</div>`)+
  `<div class="g2 g2r"><div>${mine.length?mine.map(item).join(''):`<div class="card"><div class="empty"><div class="ei">${ic('inbox',22)}</div>沒有待處理的項目<div class="small" style="margin-top:6px">試試從右上角切換成其他成員</div></div></div>`}</div>
    <div class="stack"><div class="card"><div class="ch"><h2>我的 Sprint 3 承接量</h2></div>
      <div class="between" style="margin-bottom:8px"><span class="muted">已接受 ${acc} SP · 待確認 ${pend} SP</span><b>${acc+pend} / ${me().cap}</b></div>
      <div class="bar thick" style="height:22px"><i class="hatch-g" style="width:${Math.min(100,acc/me().cap*100)}%"></i><i class="hatch-a" style="left:${Math.min(100,acc/me().cap*100)}%;width:${Math.min(100-acc/me().cap*100,pend/me().cap*100)}%"></i></div>
      <div class="note" style="margin-top:14px">雙向確認：Leader 核准後任務只是「邀請」，必須由你接受才會鎖定；時間不足可以協商，任務會退回 Leader 重新指派。</div></div>
    <div class="card"><div class="ch"><h2>狀態流程</h2></div>${smList(true)}</div></div></div>`;
}
function smList(compact){
  const N=[['會議紀錄上傳',''],['AI 拆解任務','AI_DRAFT'],['Leader 審核 / 調整','LEADER_APPROVED / PENDING_MEMBER'],['成員接受認領','ASSIGNED / READY_FOR_SPRINT'],['Sprint 啟動','To Do'],['取得 Agent Prompt 開發','In Progress'],['PR 發布 · 依策略路由','In Review'],['通過審查','Done']];
  return `<div class="sm-list">${N.map((n,i)=>`${i?`<div class="ar">↓${i===3?' <span style="color:var(--red)">（成員拒絕 → 退回 Leader 重新指派）</span>':''}</div>`:''}<div class="node"><span class="${compact?'small':''}">${n[0]}</span>${n[1]?`<span class="mono xs muted">${n[1]}</span>`:''}</div>`).join('')}</div>`;
}
