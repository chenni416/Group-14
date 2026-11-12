/* =========================================================
   按鈕動作：data-a="名稱" 對應下方 A.名稱()
   ========================================================= */
const A={
  go(e,el){S.view=el.dataset.v;closeStudio();render();window.scrollTo(0,0)},
  help(){helpModal()}, closeModal(){closeModal()}, modalBg(e){if(e.target.id==='modal')closeModal()},
  toast(e,el){toast(el.dataset.v)},
  open(e,el){e.stopPropagation();openStudio(el.dataset.id)}, closeStudio(){closeStudio()},
  myTab(e,el){S.myTab=el.dataset.v;render()}, inF(e,el){S.inboxFilter=el.dataset.v;render()}, bF(e,el){S.boardFilter=el.dataset.v;render()},
  // team
  rmTag(e,el){const m=M(el.dataset.id);m.tags.splice(+el.dataset.i,1);render()},
  mDom(e,el){M(el.dataset.id).d=el.dataset.v;render()},
  invite(){if(!isLead())return toast('只有 Leader / PO 可以邀請成員');modal(`<div class="between" style="margin-bottom:16px"><h2>邀請成員</h2><button class="cbtn sm" data-a="closeModal">${ic('x',16)}</button></div><div class="stack">
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">姓名</label><input class="in" id="iv-n"></div><div style="flex:1"><label class="f">Email</label><input class="in" id="iv-e" placeholder="name@atlab.tw"></div></div>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">角色</label><select class="in" id="iv-r"><option>Member</option><option>PO</option><option>Leader</option></select></div><div style="flex:1"><label class="f">職稱</label><input class="in" id="iv-t" placeholder="Frontend Engineer"></div></div>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">主要領域</label><select class="in" id="iv-d">${Object.entries(DOM).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select></div><div style="width:120px"><label class="f">Capacity (SP)</label><input class="in" id="iv-c" type="number" value="8"></div></div>
    <div><label class="f">技術標籤（逗號分隔）</label><input class="in" id="iv-g" placeholder="React, TypeScript"></div>
    <button class="pill dark" style="justify-content:center" data-a="inviteOk">送出邀請</button></div>`)},
  inviteOk(){const n=$('#iv-n').value.trim();if(!n)return toast('請輸入姓名');const cols=['#0f9fb0','#c2410c','#7c3aed','#be185d'];
    S.members.push({id:'m'+uid(),name:n,email:$('#iv-e').value.trim()||'—',role:$('#iv-r').value,title:$('#iv-t').value.trim()||'Engineer',d:$('#iv-d').value,tags:$('#iv-g').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),cap:+$('#iv-c').value||8,color:cols[S.members.length%cols.length]});
    closeModal();render();toast('已送出邀請')},
  // onboarding
  obStep(e,el){S.obStep=+el.dataset.v;render();window.scrollTo(0,0)},
  prov(e,el){S.project.provider=el.dataset.v;render()},
  pickKB(){$('#fileKB').click()},
  addLink(){const v=$('#kbLink').value.trim();if(!v)return;const k=/figma/i.test(v)?'Figma':/notion/i.test(v)?'Notion':/github/i.test(v)?'README':'連結';addDoc({n:v.replace(/^https?:\/\//,'').slice(0,40),k,size:'連結',link:true})},
  rmDoc(e,el){S.docs=S.docs.filter(d=>d.id!==el.dataset.id);render()},
  kbTest(){const q=$('#kbQ').value.trim();if(!q)return;const hits=[];
    if(/webhook|驗證|簽章|API|JWT/i.test(q))hits.push(['openapi.yaml','§webhooks：驗證 X-Hub-Signature-256（HMAC SHA-256），失敗回傳 401。',.92]);
    if(/測試|CI|test/i.test(q))hits.push(['README.md','§CI：PR 觸發 lint + unit + e2e，E2E 使用 Playwright。',.88]);
    if(/UI|設計|樣式|Figma/i.test(q))hits.push(['Figma · Taskline UI Kit v2','卡片圓角 22/30px，主色 #131518。',.85]);
    if(!hits.length)hits.push(['PRD_v2.md','§1 產品目標：讓會議決議自動轉為可追蹤、可交付的任務。',.61]);
    hits.push(['CODING_STANDARDS.md','§2 命名與資料夾結構規範。',.54]);
    $('#kbRes').innerHTML=hits.slice(0,3).map(h=>`<div class="note" style="margin-bottom:8px"><div class="between"><b class="small">${esc(h[0])}</b><span class="mono xs muted">score ${h[2]}</span></div><div class="small muted">${esc(h[1])}</div></div>`).join('')},
  defPol(e,el){if(!isLead())return toast('只有 Leader / PO 可以設定');S.project.policy.mode=el.dataset.v;render()},
  defTarget(e,el){const a=S.project.policy.targets,v=el.dataset.v;S.project.policy.targets=a.includes(v)?a.filter(x=>x!==v):[...a,v];render()},
  defRule(e,el){S.project.policy.rule=el.dataset.v;render()},
  // planning
  sample(){S.notes=SAMPLE;$('#notes').value=SAMPLE},
  pickNotes(){$('#fileNotes').click()},
  analyze(){
    if(!isLead())return toast('只有 Leader / PO 可以執行 AI 拆解');
    S.notes=$('#notes').value;if(!S.notes.trim())return toast('請先貼上會議紀錄');
    S.analyzing=0;render();
    const iv=setInterval(()=>{S.analyzing++;if(S.analyzing>=5){clearInterval(iv);const n=decompose(S.notes);S.analyzing=null;render();toast(n?`AI 拆解出 ${n} 項 Sub-task，請審核後核准`:'沒有偵測到新的待辦項目')}else if(S.view==='planning')render()},420);
  },
  rmTask(e,el){S.tasks=S.tasks.filter(t=>t.id!==el.dataset.id);render()},
  manual(){modal(`<div class="between" style="margin-bottom:16px"><h2>手動新增任務</h2><button class="cbtn sm" data-a="closeModal">${ic('x',16)}</button></div><div class="stack">
    <div><label class="f">標題</label><input class="in" id="mt-t"></div>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">領域</label><select class="in" id="mt-d">${Object.entries(DOM).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select></div><div style="width:110px"><label class="f">SP</label><select class="in" id="mt-s">${[1,2,3,5,8].map(v=>`<option>${v}</option>`).join('')}</select></div></div>
    <div><label class="f">指派</label><select class="in" id="mt-a">${S.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
    <div><label class="f">驗收條件（每行一條）</label><textarea class="in" id="mt-ac" rows="3"></textarea></div>
    <button class="pill dark" style="justify-content:center" data-a="manualOk">加入草稿</button></div>`)},
  manualOk(){const title=$('#mt-t').value.trim();if(!title)return toast('請輸入標題');const id=S.project.prefix+'-'+(S.seq++);
    const ac=$('#mt-ac').value.split('\n').map(s=>s.trim()).filter(Boolean);
    S.tasks.push(mkTask({id,sprint:3,title,d:$('#mt-d').value,sp:+$('#mt-s').value,assignee:$('#mt-a').value,state:'DRAFT',origin:'human',epic:'手動任務',story:'Leader 新增',ac:ac.length?ac:[],policy:{...S.project.policy,targets:[...S.project.policy.targets]},policyWhy:'沿用專案預設策略'}));
    closeModal();render()},
  approve(){const ds=sprintTasks(3).filter(t=>['AI_DRAFT','DRAFT'].includes(t.state));
    ds.forEach(t=>{t.state='PENDING_MEMBER';notify(t.assignee,'invite',t.id,S.me,`預估 ${t.sp} 點，請確認是否接受`)});
    render();toast(`已核准 ${ds.length} 項任務並發送指派邀請`)},
  resend(e,el){const t=T(el.dataset.id),to=$('#re-'+t.id).value;doneNotifs(t.id,['returned']);t.assignee=to;t.edited=true;t.state='PENDING_MEMBER';t.negotiate=null;notify(to,'invite',t.id,S.me,`預估 ${t.sp} 點（重新指派），請確認是否接受`);render();toast('已重新發送邀請給 '+M(to).name)},
  startSprint(){if(me().role!=='Leader')return toast('只有 Leader 可以啟動 Sprint');
    const carry=sprintTasks(2).filter(t=>t.state!=='DONE');carry.forEach(t=>t.sprint=3);
    sprintTasks(3).forEach(t=>{if(t.state==='ASSIGNED')t.state='TODO'});S.sprints[2].state='closed';S.sprints[3].state='active';S.active=3;
    S.view='board';closeStudio();render();toast(`Sprint 3 已啟動${carry.length?`，${carry.length} 項未完成任務已帶入`:''}`)},
  // inbox
  accept(e,el){e.stopPropagation();const t=T(el.dataset.id);if(t.assignee!==S.me)return toast('只有被指派的成員可以接受');t.state='ASSIGNED';doneNotifs(t.id,['invite']);
    notify(leader().id,'info',t.id,S.me,'已接受任務指派');render();toast(`已接受 ${t.id}`)},
  negotiate(e,el){e.stopPropagation();const t=T(el.dataset.id);
    modal(`<div class="between" style="margin-bottom:6px"><h2>協商轉移 / 拒絕</h2><button class="cbtn sm" data-a="closeModal">${ic('x',16)}</button></div><div class="small muted" style="margin-bottom:16px">${t.id} · ${esc(t.title)} · ${t.sp} SP</div><div class="stack">
      <div><label class="f">原因（會通知 Leader）</label><div class="row" style="gap:6px;margin-bottom:8px">${['本週時間不足','不熟悉此技術','與其他任務衝突'].map(r=>`<button class="pill xs" data-a="ngQuick" data-v="${r}">${r}</button>`).join('')}</div><textarea class="in" id="ng-r" rows="3" placeholder="例如：本週有期中考，建議改由 @林柏翰 處理"></textarea></div>
      <div><label class="f">建議人選（選填）</label><select class="in" id="ng-s"><option value="">不指定</option>${S.members.filter(m=>m.id!==t.assignee).map(m=>`<option value="${m.id}">${esc(m.name)} · ${esc(m.title)}</option>`).join('')}</select></div>
      <button class="pill dark" style="justify-content:center" data-a="ngOk" data-id="${t.id}">送出並退回 Leader</button></div>`)},
  ngQuick(e,el){$('#ng-r').value=el.dataset.v},
  ngOk(e,el){const t=T(el.dataset.id),r=$('#ng-r').value.trim();if(!r)return toast('請填寫原因');
    t.state='RETURNED';t.negotiate={by:S.me,reason:r,suggest:$('#ng-s').value||null};doneNotifs(t.id,['invite']);
    notify(leader().id,'returned',t.id,S.me,r);closeModal();render();toast('已退回 Leader 重新指派')},
  claim(e,el){e.stopPropagation();const t=T(el.dataset.id);if(t.assignee===S.me)return toast('不能審查自己的任務');if(t.reviewer)return toast('已被其他成員認領');
    t.reviewer=S.me;t.claimedAt=clock();doneNotifs(t.id,['pool']);render();toast(`已領取 ${t.id} 的審查`)},
  // board / studio
  copyPrompt(e,el){e.stopPropagation();const t=T(el.dataset.id);copy(promptText(t).join('\n'),`已複製 ${t.id} 的 Prompt，可直接貼到 Claude Code`)},
  copyBranch(){const t=T(S.studio);copy('git checkout -b '+t.branch,'已複製 git 指令')},
  pv(e,el){T(S.studio).pc=+el.dataset.v;renderStudio()},
  revert(){const t=T(S.studio);if(t.pc>0){t.pc--;renderStudio();toast('已還原至 v'+(t.pc+1))}},
  tPol(e,el){const t=T(S.studio);t.policy.mode=el.dataset.v;if(el.dataset.v!=='target')t.policy.targets=[];t.policyWhy='';renderStudio()},
  tTarget(e,el){const p=T(S.studio).policy,v=el.dataset.v;p.targets=p.targets.includes(v)?p.targets.filter(x=>x!==v):[...p.targets,v];renderStudio()},
  tRule(e,el){T(S.studio).policy.rule=el.dataset.v;renderStudio()},
  startDev(){const t=T(S.studio);t.state='IN_PROGRESS';render();toast('已進入 In Progress，記得先複製 Prompt')},
  toReview(){const t=T(S.studio);if(t.policy.mode==='target'&&!t.policy.targets.length)return toast('指定成員模式至少需選一位審查者');sendToReview(t);render();
    toast(t.policy.mode==='leader'?`已通知 ${leader().name} 審查`:t.policy.mode==='pool'?'已推送到團隊 Review 公共池':'已通知指定審查者')},
  rvOk(){const t=T(S.studio),p=t.policy;
    if(p.mode==='target'){t.approvals.push(S.me);S.notifs.forEach(n=>{if(n.task===t.id&&n.to===S.me&&n.state==='pending')n.state='done'});
      if(p.rule==='all'&&t.approvals.length<p.targets.length){render();return toast(`已核准（${t.approvals.length}/${p.targets.length}），等待其他審查者`)}}
    t.state='DONE';t.pr.st='merged';doneNotifs(t.id,['review','pool']);notify(t.assignee,'info',t.id,S.me,'審查通過，任務已完成');render();toast(`${t.id} 已完成`)},
  rvNo(){const t=T(S.studio),n=$('#rvNote').value.trim();if(!n)return toast('要求修改時請填寫意見');
    t.state='IN_PROGRESS';t.reviewer=null;t.claimedAt=null;t.approvals=[];doneNotifs(t.id,['review','pool']);notify(t.assignee,'info',t.id,S.me,'要求修改：'+n);render();toast('已退回負責人修改')},
  ask(e,el){askAI(el.dataset.v)}, send(){const i=$('#chatIn');askAI(i.value.trim());},
};
