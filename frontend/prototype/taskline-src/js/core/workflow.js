/* =========================================================
   流程動作
   ========================================================= */
function notify(to,type,task,from,text){S.notifs.unshift({id:uid(),to,type,task,from,t:clock(),text,state:'pending'})}
function doneNotifs(task,types){S.notifs.forEach(n=>{if(n.task===task&&types.includes(n.type)&&n.state==='pending')n.state='done'})}
function sendToReview(t){
  t.state='IN_REVIEW';t.pr={no:35+Math.floor(Math.random()*40),st:'open'};t.reviewStart=clock();t.approvals=[];t.reviewer=null;t.claimedAt=null;
  const p=t.policy;
  if(p.mode==='leader'){t.reviewer=leader().id;notify(leader().id,'review',t.id,t.assignee,`請你以 Leader 身分審查 PR #${t.pr.no}`)}
  else if(p.mode==='pool'){S.members.filter(m=>m.id!==t.assignee).forEach(m=>notify(m.id,'pool',t.id,t.assignee,`PR #${t.pr.no} 已開啟，任何有空的成員都可以領取審查`))}
  else p.targets.forEach(id=>notify(id,'review',t.id,t.assignee,`請你審查 PR #${t.pr.no}（${p.rule==='all'?'需全員同意':'需 1 人同意'}）`));
}
function canReview(t,id=S.me){
  if(t.state!=='IN_REVIEW'||id===t.assignee)return false;
  const p=t.policy;
  if(p.mode==='leader')return id===t.reviewer;
  if(p.mode==='pool')return t.reviewer===id;
  return p.targets.includes(id)&&!t.approvals.includes(id);
}
function sprint3Ready(){const ts=sprintTasks(3);return ts.length&&ts.every(t=>t.state==='ASSIGNED')}
