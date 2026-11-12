/* =========================================================
   狀態
   ========================================================= */
const S={
  view:'dashboard', me:'m1', boardFilter:'all', inboxFilter:'all', myTab:'doing', obStep:0, analyzing:null, studio:null, typing:false,
  org:{name:'NYCU ATLAB',slug:'atlab',plan:'Team',teams:[{n:'第 3 組 · Taskline',m:5,on:true},{n:'第 1 組 · 校園二手平台',m:4},{n:'第 5 組 · 課程評價爬蟲',m:4}]},
  project:{name:'Taskline — 會議到交付平台',prefix:'TL',provider:'GitHub',repo:'github.com/atlab/taskline',branch:'feature/{prefix}-{id}-{slug}',sprintLen:'2 週',policy:{mode:'pool',targets:[],rule:'any'}},
  members:[
    {id:'m1',name:'陳怡君',email:'yijun@atlab.tw',role:'Leader',title:'Frontend Lead',d:'FE',tags:['React','TypeScript','Tailwind','Figma'],cap:8,color:'#f28c3a'},
    {id:'m2',name:'林柏翰',email:'bohan@atlab.tw',role:'Member',title:'Backend Engineer',d:'BE',tags:['Python','FastAPI','PostgreSQL','Docker'],cap:10,color:'#4689f5'},
    {id:'m3',name:'王思妤',email:'szuyu@atlab.tw',role:'Member',title:'AI Engineer',d:'AI',tags:['LLM','RAG','Python','LangChain'],cap:8,color:'#8b3ffb'},
    {id:'m4',name:'張家豪',email:'chiahao@atlab.tw',role:'Member',title:'QA / DevOps',d:'QA',tags:['Playwright','GitHub Actions','Docker','Vitest'],cap:8,color:'#22a06b'},
    {id:'m5',name:'李雅婷',email:'yating@atlab.tw',role:'PO',title:'Product Designer',d:'DS',tags:['Figma','UX Research','Design System','React'],cap:6,color:'#e0517a'},
  ],
  docs:[
    {id:'d1',n:'PRD_v2.md',k:'PRD',size:'38 KB',p:100,ch:42},{id:'d2',n:'系統架構圖.png',k:'架構圖',size:'1.2 MB',p:100,ch:6},
    {id:'d3',n:'openapi.yaml',k:'API 規格',size:'64 KB',p:100,ch:58},{id:'d4',n:'CODING_STANDARDS.md',k:'Coding Standards',size:'12 KB',p:100,ch:15},
    {id:'d5',n:'README.md',k:'README',size:'8 KB',p:100,ch:9},{id:'d6',n:'Figma · Taskline UI Kit v2',k:'Figma',size:'連結',p:100,ch:24,link:true},
  ],
  sprints:{2:{n:'Sprint 2',start:'10/27',end:'11/09',goal:'完成會議紀錄匯入、AI 拆解與指派推薦的第一版',state:'active'},3:{n:'Sprint 3',start:'11/10',end:'11/23',goal:'',state:'planning'}},
  active:2, notes:SAMPLE, tasks:[], notifs:[], seq:301,
};
const M=id=>S.members.find(m=>m.id===id);
const T=id=>S.tasks.find(t=>t.id===id);
const me=()=>M(S.me);
const leader=()=>S.members.find(m=>m.role==='Leader')||S.members[0];
const isLead=(id=S.me)=>['Leader','PO'].includes(M(id)?.role);
const at=id=>'@'+(M(id)?.name||'—');
const sprintTasks=n=>S.tasks.filter(t=>t.sprint===n);
const BOARD=['TODO','IN_PROGRESS','IN_REVIEW','DONE'];
const boardTasks=()=>sprintTasks(S.active).filter(t=>BOARD.includes(t.state));
const planTasks=()=>sprintTasks(3).filter(t=>!BOARD.includes(t.state));

function mkTask(o){
  const t=Object.assign({sprint:2,epic:'',story:'',origin:'ai',edited:false,tags:[],ac:[],spWhy:'',suggested:null,sugWhy:'',policy:{mode:'pool',targets:[],rule:'any'},policyWhy:'',approvals:[],reviewer:null,claimedAt:null,reviewStart:null,pr:null,pv:[[]],pc:0,chat:[],negotiate:null,desc:''},o);
  if(!t.ac.length)t.ac=['成果與會議決議一致',...GEN_AC[t.d]];
  if(!t.tags.length)t.tags=DOMTAGS[t.d];
  if(!t.branch)t.branch=`feature/${S.project.prefix.toLowerCase()}-${t.id.split('-')[1]}-${t.slug||'task'}`;
  if(!t.desc)t.desc=`${t.title}。詳細規格見 PRD 對應章節。`;
  return t;
}
function seed(){
  const R=[
    ['TL-201','會議紀錄上傳與格式正規化','BE',3,'m2','DONE','pool',{reviewer:'m4',pr:{no:28,st:'merged'},slug:'minutes-upload'}],
    ['TL-202','AI 任務拆解 Prompt 設計','AI',5,'m3','IN_REVIEW','leader',{reviewer:'m1',reviewStart:hAgo(3),pr:{no:31,st:'open'},slug:'decompose-prompt',policyWhy:'影響全系統拆解品質，建議 Leader 專審'}],
    ['TL-203','Sprint Planning 雙欄介面','FE',3,'m1','IN_REVIEW','pool',{reviewer:'m4',claimedAt:hAgo(2),reviewStart:hAgo(5),pr:{no:33,st:'open'},slug:'planning-split'}],
    ['TL-204','指派推薦演算法服務','BE',5,'m2','IN_PROGRESS','leader',{pr:null,slug:'assign-reco',policyWhy:'涉及資料表更動，建議 Leader 專審'}],
    ['TL-205','通知中心 UI 設計稿','DS',2,'m5','IN_REVIEW','pool',{reviewStart:hAgo(1),pr:{no:34,st:'open'},slug:'inbox-design'}],
    ['TL-206','CI 與 Playwright 測試環境','QA',2,'m4','DONE','pool',{reviewer:'m2',pr:{no:27,st:'merged'},slug:'ci-setup'}],
    ['TL-207','知識庫文件索引 Pipeline','AI',3,'m3','IN_PROGRESS','target',{targets:['m2'],slug:'kb-index'}],
    ['TL-208','E2E：登入與專案建立流程','QA',2,'m4','TODO','pool',{slug:'e2e-login'}],
    ['TL-209','GitHub OAuth 登入','BE',2,'m2','TODO','leader',{slug:'oauth'}],
    ['TL-210','看板卡片元件','FE',2,'m1','IN_REVIEW','target',{targets:['m5','m4'],rule:'all',approvals:['m5'],reviewStart:hAgo(6),pr:{no:32,st:'open'},slug:'kanban-card',policyWhy:'跨職能：需設計師確認畫面、QA 確認互動'}],
  ];
  S.tasks=R.map(([id,title,d,sp,a,state,mode,x])=>{
    const t=mkTask({id,title,d,sp,assignee:a,suggested:a,state,slug:x.slug,epic:'Sprint 2',story:''});
    t.policy={mode,targets:x.targets||[],rule:x.rule||'any'};t.policyWhy=x.policyWhy||'';
    Object.assign(t,{reviewer:x.reviewer||null,claimedAt:x.claimedAt||null,reviewStart:x.reviewStart||null,pr:x.pr||null,approvals:x.approvals||[]});
    return t;
  });
  const N=(to,type,task,from,h,text,state='pending')=>S.notifs.push({id:uid(),to,type,task,from,t:hAgo(h),text,state});
  N('m1','review','TL-202','m3',3,'請你以 Leader 身分審查此任務的 PR #31');
  ['m1','m2','m3','m4'].forEach(m=>N(m,'pool','TL-205','m5',1,'PR #34 已開啟，任何有空的成員都可以領取審查'));
  N('m4','review','TL-210','m1',6,'請你審查 PR #32（指定成員，需全員同意）');
  N('m5','review','TL-210','m1',6,'請你審查 PR #32（指定成員，需全員同意）','done');
  N('m4','info','TL-203','m1',2,'你已領取此任務的審查');
}
