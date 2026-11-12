/* =========================================================
   基礎工具
   ========================================================= */
const BOOT=Date.now(), NOW0=new Date('2026-11-09T14:00:00+08:00').getTime();
const clock=()=>new Date(NOW0+(Date.now()-BOOT));
const hAgo=h=>new Date(NOW0-h*36e5);
function rel(d){if(!d)return '';const m=(clock()-d)/6e4;if(m<1)return '剛剛';if(m<60)return Math.round(m)+'m 前';const h=m/60;if(h<24)return Math.round(h)+'h 前';return Math.floor(h/24)+' 天前'}
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,8);
const sum=a=>a.reduce((x,y)=>x+y,0);

const IC={
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/>',
  spark:'<path d="M10 3.5 11.6 8.4 16.5 10 11.6 11.6 10 16.5 8.4 11.6 3.5 10 8.4 8.4z"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  inbox:'<path d="M3 13h5l1.5 2.5h5L16 13h5"/><path d="M5.5 5.5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  board:'<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 7.5v6M12 7.5v3.5M15.5 7.5v8.5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.3 9.3a2.8 2.8 0 0 1 5.4.9c0 1.9-2.7 2.4-2.7 3.8"/><path d="M12 17.3h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', arrow:'<path d="M7 17 17 7M8 7h9v9"/>', check:'<path d="m6 12.5 4 4 8-9"/>',
  down:'<path d="m6 9 6 6 6-6"/>', sliders:'<path d="M6 4v7M6 15v5M12 4v3M12 11v9M18 4v9M18 17v3"/><circle cx="6" cy="13" r="2"/><circle cx="12" cy="9" r="2"/><circle cx="18" cy="15" r="2"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="3"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  pr:'<circle cx="6" cy="6" r="2.3"/><circle cx="6" cy="18" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M6 8.3v7.4M18 15.7V10a3 3 0 0 0-3-3h-3.5"/><path d="m13.5 5-2 2 2 2"/>',
  send:'<path d="M5 12h13M13 6l6 6-6 6"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>', undo:'<path d="M4 9h11a5 5 0 0 1 0 10h-4"/><path d="m8 5-4 4 4 4"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', upload:'<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  file:'<path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3.5V9h5.5"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  code:'<path d="m15.5 17 5-5-5-5M8.5 7l-5 5 5 5"/>', db:'<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  shield:'<path d="M12 21s7.5-3.6 7.5-9.5V5.8L12 3 4.5 5.8v5.7C4.5 17.4 12 21 12 21z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  pen:'<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', bolt:'<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>', eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  play:'<path d="M7 5v14l11-7z"/>', search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
};
const ic=(n,s=20,w=1.7)=>`<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
