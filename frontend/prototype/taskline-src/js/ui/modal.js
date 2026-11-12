/* =========================================================
   Modal / Toast / Copy
   ========================================================= */
function modal(h){$('#mbox').innerHTML=h;$('#modal').classList.add('on')}
function closeModal(){$('#modal').classList.remove('on')}
let tt;function toast(s){const e=$('#toast');e.textContent=s;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2600)}
function copy(text,msg){
  const fb=()=>{const a=document.createElement('textarea');a.value=text;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();try{document.execCommand('copy');toast(msg)}catch(e){toast('請手動選取複製')}a.remove()};
  if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast(msg),fb);else fb();
}
function helpModal(){modal(`<div class="between" style="margin-bottom:16px"><h2>系統狀態機</h2><button class="cbtn sm" data-a="closeModal">${ic('x',16)}</button></div>${smList()}
  <h3 style="margin:20px 0 10px">Review 路由</h3><div class="stack" style="gap:8px">${Object.entries(POL).map(([k,v])=>`<div class="note"><b>${v.n}</b> <span class="muted xs">${v.en}</span><div class="small muted">${v.d}</div></div>`).join('')}</div>`)}
