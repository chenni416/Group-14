/* =========================================================
   組織與團隊
   ========================================================= */
function memberCard(m){
  const ro=!isLead();
  return `<div class="mcard"><div class="between" style="margin-bottom:14px"><div class="row" style="gap:12px">${av(m.id,'lg')}<div><b style="font-size:16px">${esc(m.name)}</b><div class="xs muted">${esc(m.email)}</div></div></div>
    <select class="in sm" style="width:auto" data-mf="role" data-id="${m.id}" ${ro?'disabled':''}>${['Leader','PO','Member'].map(r=>`<option ${m.role===r?'selected':''}>${r}</option>`).join('')}</select></div>
    <div class="row" style="flex-wrap:nowrap;margin-bottom:12px"><div style="flex:1"><label class="f">職稱</label><input class="in" style="height:38px;border-radius:12px" data-mf="title" data-id="${m.id}" value="${esc(m.title)}" ${ro?'disabled':''}></div>
    <div style="width:96px"><label class="f">Capacity</label><div class="row" style="flex-wrap:nowrap;gap:4px"><input class="in" type="number" min="1" max="30" style="height:38px;border-radius:12px;padding:0 8px" data-mf="cap" data-id="${m.id}" value="${m.cap}" ${ro?'disabled':''}><span class="xs muted">SP</span></div></div></div>
    <label class="f">技術棧與領域標籤</label><div class="tagbox">${m.tags.map((t,i)=>`<span class="tag">${esc(t)}${ro?'':`<button class="x" data-a="rmTag" data-id="${m.id}" data-i="${i}" aria-label="移除">×</button>`}</span>`).join('')}${ro?'':`<input data-tagadd="${m.id}" placeholder="+ 標籤 Enter">`}</div>
    <div class="row" style="margin-top:12px"><label class="f" style="margin:0">主要領域</label>${Object.keys(DOM).map(d=>`<button class="pill xs ${m.d===d?'on':''}" data-a="mDom" data-id="${m.id}" data-v="${d}" ${ro?'disabled':''}>${DOM[d].n}</button>`).join('')}</div></div>`;
}
function vTeam(){
  const perms=[['AI 拆解會議紀錄',1,1,0],['調整與核准指派',1,1,0],['啟動 Sprint',1,0,0],['設定專案 Review 預設策略',1,1,0],['覆蓋單一任務 Review 策略',1,1,'負責人'],['Leader 專審',1,1,0],['領取 Review（Claim）',1,1,1],['接受／協商任務',1,1,1]];
  return ph('Organization & Team','組織與團隊設定',`<button class="pill dark" data-a="invite">${ic('plus',17)}邀請成員</button>`)+
  `<div class="g2"><div class="stack">
    <div class="card"><div class="ch"><h2>組織</h2><span class="tag">${S.org.plan} Plan</span></div>
      <div class="kv"><span class="muted">組織名稱</span><b>${esc(S.org.name)}</b></div><div class="kv"><span class="muted">Workspace</span><span class="mono">taskline.app/${S.org.slug}</span></div>
      <div class="kv"><span class="muted">Git 整合</span><span class="row" style="gap:6px">${ic('pr',16)}GitHub 已連結</span></div><div class="kv"><span class="muted">成員</span><span>${S.members.length} 人</span></div></div>
    <div class="card"><div class="ch"><h2>團隊</h2><button class="cbtn sm" data-a="toast" data-v="新增團隊需組織管理員權限">${ic('plus',16)}</button></div>
      ${S.org.teams.map(t=>`<div class="kv" style="align-items:center"><span class="row" style="gap:10px"><span class="dico ${t.on?'d-FE':''}" style="${t.on?'':'background:#c9ccd2'}">${ic('users',16,2)}</span>${esc(t.n)}</span><span class="row" style="gap:8px"><span class="muted small">${t.m} 人</span>${t.on?'<span class="chip c-green">目前</span>':''}</span></div>`).join('')}</div>
    <div class="card"><div class="ch"><h2>角色權限</h2></div><table class="matrix"><thead><tr><th>動作</th><th>Leader</th><th>PO</th><th>Member</th></tr></thead><tbody>
      ${perms.map(p=>`<tr><td>${p[0]}</td>${p.slice(1).map(v=>`<td>${v===1?`<span class="ok">${ic('check',16,2.4)}</span>`:v?`<span class="xs muted">${v}</span>`:'<span class="no">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card"><div class="ch"><h2>成員角色與技術特徵</h2><span class="muted small">${isLead()?'AI 推薦指派會依據這些資料':'僅 Leader / PO 可編輯'}</span></div><div class="mgrid">${S.members.map(memberCard).join('')}</div></div></div>`;
}
