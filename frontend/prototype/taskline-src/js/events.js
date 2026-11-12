/* =========================================================
   事件監聽（click / change / input / keydown / 拖曳）與檔案、搜尋工具
   ========================================================= */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]');
  if(!e.target.closest('.search'))$('#sres').classList.remove('on');
  if(!el||el.disabled)return;const f=A[el.dataset.a];if(f)f(e,el);
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='whoSel'){S.me=el.value;render();toast(`已切換為 ${me().name}（${me().role}）`);return}
  if(el.dataset.mf){const m=M(el.dataset.id),k=el.dataset.mf;m[k]=k==='cap'?Math.max(1,+el.value||1):el.value;if(k==='role'&&el.value==='Leader')S.members.forEach(x=>{if(x.id!==m.id&&x.role==='Leader')x.role='Member'});render();return}
  if(el.dataset.pf){S.project[el.dataset.pf]=el.dataset.pf==='prefix'?el.value.toUpperCase().replace(/[^A-Z0-9]/g,'')||'TL':el.value;render();return}
  if(el.dataset.g){S.sprints[3].goal=el.value;return}
  if(el.dataset.tf){const t=T(el.dataset.id),k=el.dataset.tf;
    if(k==='ac')t.ac=el.value.split('\n').map(s=>s.trim()).filter(Boolean);
    else if(k==='sp')t.sp=+el.value;else t[k]=el.value;
    if(['sp','assignee','title','ac'].includes(k))t.edited=true;render();return}
  if(el.id==='fileKB'){[...el.files].forEach(f=>addDoc({n:f.name,k:guessKind(f.name),size:fmtSize(f.size)}));el.value='';return}
  if(el.id==='fileNotes'&&el.files[0]){const r=new FileReader();r.onload=()=>{S.notes=r.result;$('#notes').value=r.result;toast('已讀取 '+el.files[0].name)};r.readAsText(el.files[0]);}
});
document.addEventListener('input',e=>{
  if(e.target.id==='notes')S.notes=e.target.value;
  if(e.target.id==='q')search(e.target.value);
});
document.addEventListener('keydown',e=>{
  const el=e.target;
  if(e.key==='Enter'&&el.dataset.tagadd){const v=el.value.trim();if(v){M(el.dataset.tagadd).tags.push(v);render();setTimeout(()=>document.querySelector(`[data-tagadd="${el.dataset.tagadd}"]`)?.focus(),0)}}
  if(e.key==='Enter'&&el.id==='chatIn')askAI(el.value.trim());
  if(e.key==='Enter'&&el.id==='kbQ')A.kbTest();
  if(e.key==='Escape'){if($('#modal').classList.contains('on'))closeModal();else closeStudio()}
});
['dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{const d=e.target.closest&&e.target.closest('#dropKB');if(!d)return;e.preventDefault();d.classList.toggle('over',ev==='dragover');
  if(ev==='drop')[...e.dataTransfer.files].forEach(f=>addDoc({n:f.name,k:guessKind(f.name),size:fmtSize(f.size)}))}));

const fmtSize=b=>b>1e6?(b/1e6).toFixed(1)+' MB':Math.max(1,Math.round(b/1e3))+' KB';
const guessKind=n=>/prd/i.test(n)?'PRD':/api|openapi|swagger/i.test(n)?'API 規格':/readme/i.test(n)?'README':/standard|style|lint/i.test(n)?'Coding Standards':/png|jpg|svg|drawio|arch|架構/i.test(n)?'架構圖':'文件';
function addDoc(o){const d=Object.assign({id:uid(),p:0,ch:5+Math.floor(Math.random()*30)},o);S.docs.push(d);render();
  const iv=setInterval(()=>{d.p=Math.min(100,d.p+8+Math.floor(Math.random()*12));
    const row=document.querySelector(`[data-doc="${d.id}"]`);
    if(row){row.querySelector('[data-pb]').style.width=d.p+'%';row.querySelector('[data-pl]').textContent=d.p<100?'Indexing '+d.p+'%':'Indexed · '+d.ch+' chunks'}
    if(d.p>=100){clearInterval(iv);if(S.view==='onboard'||S.view==='planning')render();toast(d.n+' 已完成索引')}},260)}
function search(q){const box=$('#sres');q=q.trim().toLowerCase();if(!q){box.classList.remove('on');return}
  const r=S.tasks.filter(t=>(t.id+t.title+M(t.assignee).name).toLowerCase().includes(q)).slice(0,7);
  box.innerHTML=r.length?r.map(t=>`<button data-a="open" data-id="${t.id}">${av(t.assignee,'sm')}<span style="flex:1;min-width:0"><span class="mono muted">${t.id}</span> ${esc(t.title)}</span>${chip(t.state)}</button>`).join(''):'<div class="small muted" style="padding:10px">找不到符合的任務</div>';
  box.classList.add('on')}
