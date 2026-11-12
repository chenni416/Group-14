/* =========================================================
   AI：拆解、指派、Review 建議、Prompt
   ========================================================= */
function decompose(md){
  const goal=(md.match(/Sprint\s*Goal\s*[：:]\s*(.+)/i)||[])[1];
  if(goal&&!S.sprints[3].goal)S.sprints[3].goal=goal.trim();
  const lines=md.split('\n').map(l=>l.trim()).filter(l=>/^([-*•]|\d+[.)、])\s+/.test(l)).map(l=>l.replace(/^([-*•]|\d+[.)、])\s+(\[[ xX]\]\s*)?/,'').trim()).filter(Boolean);
  const used=new Set(),subs=[];
  lines.forEach(l=>{
    const i=LIB.findIndex((x,k)=>!used.has(k)&&x.re.test(l));
    if(i>=0){used.add(i);LIB[i].subs.forEach(s=>subs.push({...s,epic:LIB[i].epic,story:LIB[i].story,src:l}))}
    else{
      const d=/測試|E2E/i.test(l)?'QA':/設計|視覺|Figma/i.test(l)?'DS':/AI|模型|Prompt|RAG/i.test(l)?'AI':/API|後端|資料|webhook|服務|權限/i.test(l)?'BE':'FE';
      const t=l.replace(/^(需要|要|希望|我們|大家)/,'').replace(/[。；;]$/,'');
      subs.push({t:t.length>30?t.slice(0,30)+'…':t,d,tags:DOMTAGS[d],sp:2,why:'依需求描述與領域預估，建議 Leader 確認',slug:'task',ac:['完成「'+(t.length>24?t.slice(0,24)+'…':t)+'」所述功能',GEN_AC[d][0]],epic:'其他需求',story:t.length>22?t.slice(0,22)+'…':t,src:l});
    }
  });
  // 移除舊的草稿
  S.tasks=S.tasks.filter(t=>!(t.sprint===3&&['AI_DRAFT'].includes(t.state)));
  const exist=new Set(sprintTasks(3).map(t=>t.title));
  const created=subs.filter(s=>!exist.has(s.t)).map(s=>{
    const id=S.project.prefix+'-'+(S.seq++);
    return mkTask({id,sprint:3,title:s.t,d:s.d,tags:s.tags,sp:s.sp,spWhy:s.why,ac:['成果與會議決議一致',...s.ac].slice(0,4),epic:s.epic,story:s.story,slug:s.slug,state:'AI_DRAFT',desc:'會議紀錄：「'+s.src+'」',origin:'ai'});
  });
  S.tasks.push(...created);
  suggestAll(created);
  return created.length;
}
function plannedLoad(exclude){const m={};S.members.forEach(x=>m[x.id]=0);sprintTasks(3).forEach(t=>{if(!exclude||!exclude.includes(t))m[t.assignee]=(m[t.assignee]||0)+t.sp});return m}
function rankFor(t,load){
  return S.members.map(m=>{
    const match=t.tags.filter(x=>m.tags.includes(x));
    const tag=t.tags.length?match.length/t.tags.length:0, dom=m.d===t.d?1:0, remain=m.cap-load[m.id];
    const s=.45*tag+.35*dom+.2*Math.max(0,Math.min(1,remain/m.cap))-(remain<t.sp?.6:0);
    return {m,s,match,remain};
  }).sort((a,b)=>b.s-a.s);
}
function suggestAll(list){
  const load=plannedLoad(list);
  [...list].sort((a,b)=>b.sp-a.sp).forEach(t=>{
    const r=rankFor(t,load)[0];
    t.suggested=t.assignee=r.m.id;t.edited=false;
    t.sugWhy=(r.match.length?`吻合其 ${r.match.join('、')} 技能`:`其為${r.m.title}，最接近此任務領域`)+`，剩餘負擔 ${r.remain}/${r.m.cap} SP`;
    load[r.m.id]+=t.sp;
    // Review 策略建議
    if(/資料表|遷移|狀態機/.test(t.spWhy)||(t.d==='BE'&&t.sp>=5)){t.policy={mode:'leader',targets:[],rule:'any'};t.policyWhy='涉及資料表更動或核心架構，建議 Leader 專審'}
    else if(t.d==='DS'||/視覺|卡片/.test(t.title)){const ds=S.members.find(x=>x.d==='DS'&&x.id!==t.assignee)||S.members.find(x=>x.d==='FE'&&x.id!==t.assignee);t.policy={mode:'target',targets:ds?[ds.id]:[],rule:'any'};t.policyWhy=`跨職能：建議由 ${ds?ds.name:'設計師'} 確認畫面`}
    else{t.policy={...S.project.policy,targets:[...S.project.policy.targets]};t.policyWhy='一般功能，沿用專案預設策略'}
  });
}
function promptText(t,ver){
  const clar=t.pv[ver??t.pc]||[];const sp=S.sprints[t.sprint];
  return [
    '你現在是這項任務的執行者。',
    `【專案】${S.project.name}（${S.project.repo}）`,
    `【Sprint 目標】${sp.goal||'（尚未設定）'}`,
    `【任務背景】${KB[t.d]}`,
    `【目標】${t.id} ${t.title}`,
    '【驗收條件】',...t.ac.map((a,i)=>`${i+1}. ${a}`),
    `【技術限制】${LIMIT[t.d]}`,
    `【參考檔案】${REF[t.d].join('、')}`,
    `【Branch】${t.branch}`,
    ...(clar.length?['【補充釐清】',...clar.map(c=>'- '+c)]:[]),
    '完成後請列出修改的檔案，並說明如何驗證每一條驗收條件。'
  ];
}
function aiReply(t,q){
  const D=t.d;
  const rules=[
    [/驗證|簽章|HMAC|安全|auth|JWT|權限|401/i,()=>({a:'依「API 規格 v2」，一般端點使用 JWT；外部 webhook 以 HMAC SHA-256 驗證 X-Hub-Signature-256，失敗時回傳 401 並記錄事件 ID。',add:'驗證失敗一律回傳 401，錯誤格式 {code, message}',src:['openapi.yaml']})],
    [/測試|test|覆蓋|coverage/i,()=>({a:`README 規定 PR 需通過 lint + unit + e2e。這個任務建議單元測試覆蓋率 > 80%，使用 ${D==='FE'?'Vitest + Testing Library':D==='QA'?'Playwright':'pytest'}。`,add:`需撰寫對應測試（${D==='FE'?'Vitest':D==='QA'?'Playwright':'pytest'}），覆蓋率 > 80%`,src:['README.md']})],
    [/資料表|schema|資料庫|migration|欄位/i,()=>({a:'依 Coding Standards，資料表變更需使用 Alembic 產生 migration，命名格式為 YYYYMMDD_描述，且必須可 downgrade。',add:'資料表變更需附可 downgrade 的 Alembic migration',src:['CODING_STANDARDS.md']})],
    [/設計|UI|樣式|Figma|顏色|畫面|間距/i,()=>({a:'請參考 Figma「Taskline UI Kit v2」：卡片圓角 22/30px、主色 #131518；AI 產生內容使用淡紫色外框區隔。',add:'樣式依 Figma UI Kit v2，AI 產生內容需以淡紫色外框標示',src:['Figma · Taskline UI Kit v2']})],
    [/檔案|參考|哪裡|路徑|結構|放在|資料夾/,()=>({a:`相關程式位於 ${REF[D].join('、')}。新增檔案請放在同一層，並依 Coding Standards 命名。`,add:`修改範圍限定於 ${REF[D][0]} 及其測試`,src:['CODING_STANDARDS.md','系統架構圖.png']})],
    [/範圍|不用|不需要|scope|先不|之後再/i,()=>({a:'了解，我會把這部分標記為本次範圍外，避免 Agent 多做。',add:'範圍外：'+q.replace(/[？?。]/g,''),src:['PRD_v2.md']})],
    [/效能|延遲|performance|速度|快取/i,()=>({a:'PRD §6 的非功能需求：API p90 < 300ms，AI 對話 p90 < 3 秒；必要時以 Redis 快取檢索結果。',add:'效能需求：API p90 < 300ms，AI 回應 p90 < 3 秒',src:['PRD_v2.md']})],
  ];
  const hit=rules.find(([re])=>re.test(q));
  return hit?hit[1]():{a:'PRD 與 Sprint 目標中沒有明確規定這點。建議先以最小可行做法實作，並在 PR 描述中註記這個假設，方便 Reviewer 確認。',add:'假設：'+q.replace(/[？?。]/g,'')+'（PRD 未定義，需於 PR 註記）',src:['PRD_v2.md']};
}
