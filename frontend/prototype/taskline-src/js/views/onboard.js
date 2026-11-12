/* =========================================================
   專案初始化
   ========================================================= */
const docIcon=d=>d.link?'link':/png|jpg|fig/i.test(d.n)?'eye':'file';
function ragState(){const ix=S.docs.filter(d=>d.p<100).length;return ix?{t:`Indexing ${S.docs.length-ix}/${S.docs.length} files`,c:'c-amber'}:{t:`RAG Ready · ${sum(S.docs.map(d=>d.ch))} chunks`,c:'c-green'}}
function vOnboard(){
  const steps=['基本資訊','專案知識庫','成員技術特徵','Review 預設策略'];const s=S.obStep,P=S.project;
  let body='';
  if(s===0) body=`<div class="g2e"><div class="card"><div class="ch"><h2>專案基本資訊</h2></div><div class="stack">
      <div><label class="f">專案名稱</label><input class="in" data-pf="name" value="${esc(P.name)}"></div>
      <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">代碼前綴</label><input class="in" data-pf="prefix" value="${esc(P.prefix)}" maxlength="6"></div><div style="flex:1"><label class="f">Sprint 長度</label><select class="in" data-pf="sprintLen">${['1 週','2 週','3 週'].map(x=>`<option ${P.sprintLen===x?'selected':''}>${x}</option>`).join('')}</select></div></div>
      <div><label class="f">Repository</label><div class="row" style="flex-wrap:nowrap"><div class="seg">${['GitHub','GitLab'].map(x=>`<button class="${P.provider===x?'on':''}" data-a="prov" data-v="${x}">${x}</button>`).join('')}</div><input class="in" data-pf="repo" value="${esc(P.repo)}"></div></div>
      <div><label class="f">Branch 命名規則</label><input class="in mono" data-pf="branch" value="${esc(P.branch)}"></div></div></div>
    <div class="card"><div class="ch"><h2>預覽</h2></div><div class="stack">
      <div class="note"><div class="xs muted">任務編號</div><b class="mono" style="font-size:15px">${esc(P.prefix)}-301</b></div>
      <div class="note"><div class="xs muted">自動建議的 Branch</div><b class="mono" style="font-size:14px">${esc(P.branch.replace('{prefix}',P.prefix.toLowerCase()).replace('{id}','301').replace('{slug}','split-view'))}</b></div>
      <div class="note"><div class="xs muted">PR Webhook</div><span class="mono">https://taskline.app/hooks/${S.org.slug}/${P.provider.toLowerCase()}</span></div></div></div></div>`;
  if(s===1){const r=ragState();body=`<div class="g2"><div class="stack">
      <div class="card"><div class="ch"><h2>上傳文件</h2></div><div class="drop" id="dropKB" data-a="pickKB"><div class="empty" style="padding:8px 0 4px"><div class="ei">${ic('upload',22)}</div><b style="color:var(--ink)">拖曳或點擊上傳</b><div class="small">PRD、架構圖、API 規格、Coding Standards、README</div></div></div>
        <label class="f" style="margin-top:16px">或貼上連結（Figma、Notion、GitHub）</label><div class="row" style="flex-wrap:nowrap"><input class="in" id="kbLink" placeholder="https://www.figma.com/file/…"><button class="pill dark" data-a="addLink">加入</button></div></div>
      <div class="card"><div class="ch"><h2>測試檢索</h2>${aiTag('RAG')}</div><div class="row" style="flex-wrap:nowrap"><input class="in" id="kbQ" placeholder="例如：webhook 要怎麼驗證？"><button class="cbtn" data-a="kbTest" aria-label="檢索">${ic('search',18)}</button></div><div id="kbRes" style="margin-top:12px"></div></div></div>
    <div class="card"><div class="ch"><h2>Project Knowledge Base</h2><span class="rag ${r.c}" id="ragBadge">${ic(r.c==='c-green'?'check':'clock',15,2.2)}${r.t}</span></div>
      <div id="docList">${S.docs.map(d=>`<div class="doc" data-doc="${d.id}"><span class="fi">${ic(docIcon(d),19)}</span><div style="flex:1;min-width:0"><div class="between"><b style="font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.n)}</b><span class="xs ${d.p<100?'muted':'ok'}" data-pl>${d.p<100?'Indexing '+d.p+'%':'Indexed · '+d.ch+' chunks'}</span></div><div class="row" style="gap:8px;margin-top:6px;flex-wrap:nowrap"><span class="tag">${esc(d.k)}</span><span class="xs faint">${d.size}</span><div class="bar" style="flex:1;height:6px"><i class="${d.p<100?'hatch-a':''}" style="width:${d.p}%;${d.p<100?'':'background:var(--green)'}" data-pb></i></div></div></div><button class="xbtn" data-a="rmDoc" data-id="${d.id}" aria-label="移除">×</button></div>`).join('')}</div></div></div>`}
  if(s===2) body=`<div class="card"><div class="ch"><h2>成員角色與技術特徵</h2><span class="muted small">範例：Frontend Lead · React, TypeScript · 8 SP/Sprint</span></div><div class="mgrid">${S.members.map(memberCard).join('')}</div></div>`;
  if(s===3){const p=P.policy;body=`<div class="g2e"><div class="stack">${Object.entries(POL).map(([k,v])=>`<button class="opt ${p.mode===k?'on':''}" data-a="defPol" data-v="${k}"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="rd"></span><div><b style="font-size:16px">${v.n}</b> <span class="muted small">${v.en}</span><div class="small muted" style="margin-top:4px">適用：${v.d}</div></div></div></button>`).join('')}</div>
    <div class="card"><div class="ch"><h2>預設設定</h2></div>${p.mode==='target'?`<label class="f">指定審查者</label><div class="row" style="margin-bottom:14px">${S.members.map(m=>`<button class="pill sm ${p.targets.includes(m.id)?'on':''}" data-a="defTarget" data-v="${m.id}">${esc(m.name)}</button>`).join('')}</div><label class="f">同意門檻</label><div class="seg"><button class="${p.rule==='any'?'on':''}" data-a="defRule" data-v="any">需 1 人同意</button><button class="${p.rule==='all'?'on':''}" data-a="defRule" data-v="all">需全員同意</button></div>`
      :p.mode==='leader'?`<div class="note">所有任務進入 In Review 時，直接通知 Leader ${at(leader().id)}。</div>`:`<div class="note">任務進入 In Review 時推送到團隊 Review 公共池，任何人可 Claim，認領後頭像才鎖定在卡片上。</div>`}
      <div class="note warn" style="margin-top:14px">這是專案預設值。Leader 或負責人可以在單一任務上覆蓋（Task-level Override），AI 也會依任務特性建議策略。</div></div></div>`}
  return ph('Project Onboarding & Context Hub','專案初始化',`<span class="rag ${ragState().c}">${ic('layers',15,2)}${ragState().t}</span>`)+
   `<div class="stepper">${steps.map((l,i)=>`<button class="pill ${i===s?'on':''} ${i<s?'done':''}" data-a="obStep" data-v="${i}"><span class="n">${i<s?'✓':i+1}</span>${l}</button>`).join('')}</div>${body}
   <div class="between" style="margin-top:22px"><button class="pill" data-a="obStep" data-v="${Math.max(0,s-1)}" ${s?'':'disabled'}>上一步</button>${s<3?`<button class="pill dark" data-a="obStep" data-v="${s+1}">下一步</button>`:`<button class="pill dark" data-a="go" data-v="planning">${ic('check',17,2.2)}完成並前往 Sprint 規劃</button>`}</div>`;
}
