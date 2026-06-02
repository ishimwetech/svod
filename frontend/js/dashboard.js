'use strict';
const BASE = window.location.origin;
const fmt  = n => n==null?'—':new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtM = n => { if(!n)return'0'; if(n>=1e9)return(n/1e9).toFixed(1)+'B'; if(n>=1e6)return(n/1e6).toFixed(1)+'M'; if(n>=1e3)return(n/1e3).toFixed(0)+'K'; return String(n); };
const $  = id => document.getElementById(id);
const $$ = s  => document.querySelectorAll(s);

Chart.defaults.font.family = "'Lato',Arial,sans-serif";
Chart.defaults.color = '#555';
const TT = { backgroundColor:'#083050', padding:12, cornerRadius:2, titleFont:{size:12,weight:'700'}, bodyFont:{size:12} };

const PAL = ['#083050','#F7941F','#1a9e5c','#2e86c1','#8b0000','#7d3c98','#ca6f1e','#148f77','#943126','#1f618d','#196f3d','#d4ac0d','#515a5a','#e74c3c','#9b59b6'];
const SEG = ['#F7941F','#083050','#1a9e5c','#2e86c1','#9b59b6'];

const LOGOS = {
  'Netflix':'netflix.com','Amazon Prime Video':'amazon.com','Hulu':'hulu.com',
  'Disney+':'disneyplus.com','HBO Max (2020-2023)':'hbomax.com',
  'Paramount+':'paramountplus.com','ESPN D2C':'espn.com','Apple TV+':'tv.apple.com',
  'Peacock Premium':'peacocktv.com','Discovery+':'discoveryplus.com',
  'YouTube TV USA':'tv.youtube.com','YouTube Premium':'youtube.com',
  'Starz':'starz.com','Showtime Streaming':'showtime.com','Crunchyroll':'crunchyroll.com',
  'Sling TV':'sling.com','Fubo.tv USA':'fubo.tv','NBA League Pass':'nba.com',
  'MLB.TV':'mlb.com','AMC Plus':'amcplus.com','Noggin':'noggin.com',
  'Philo TV':'philo.com','BET+':'bet.com','Britbox':'britbox.com',
  'Acorn TV':'acorn.tv','Shudder':'shudder.com','DirecTV Stream':'directv.com',
  'Fox Nation':'foxnation.com','Dazn':'dazn.com','Hallmark+':'hallmarkchannel.com',
  'CuriosityStream':'curiositystream.com','Mubi':'mubi.com','Dropout':'dropout.tv',
  'Fox Sports':'foxsports.com','Frndly TV':'frndlytv.com',
};
const fav = d => `https://www.google.com/s2/favicons?domain=${d}&sz=32`;

const charts = {};
function destroy(k){ if(charts[k]){charts[k].destroy();delete charts[k];} }

const state = { page:1, sort:'v22', order:'desc', q:'' };

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  const [kpis, market, top, growth, share, segs, trendData, declining] = await Promise.all([
    fetch(`${BASE}/api/kpis`).then(r=>r.json()),
    fetch(`${BASE}/api/market_total`).then(r=>r.json()),
    fetch(`${BASE}/api/top?n=15`).then(r=>r.json()),
    fetch(`${BASE}/api/growth`).then(r=>r.json()),
    fetch(`${BASE}/api/share`).then(r=>r.json()),
    fetch(`${BASE}/api/segments`).then(r=>r.json()),
    fetch(`${BASE}/api/trends`).then(r=>r.json()),
    fetch(`${BASE}/api/declining`).then(r=>r.json()),
  ]);
  renderKPIs(kpis);
  renderMarket(market);
  renderTop(top);
  renderGrowth(growth);
  renderDeclining(declining);
  renderShare(share);
  renderSegs(segs);
  renderTrends(trendData);
  renderRH(market, top, growth, trendData);
  populateFilter(top.map(t=>t.actor));
  initFilters(top);
  initExplorer();
});

/* ── KPIs ── */
function renderKPIs(d){
  counter('kpi-eoy22', d.eoy22);
  counter('kpi-plat',  d.platforms);
  counter('kpi-total', d.total);
  const g=$('kpi-growth');
  if(g){ g.textContent=(d.growth>0?'+':'')+d.growth+'%'; if(d.growth<0)g.style.color='#e74c3c'; }
}
function counter(id,target){
  const el=$(id); if(!el)return;
  const t0=performance.now(), dur=1100;
  const tick=now=>{ const p=Math.min((now-t0)/dur,1),e=1-Math.pow(1-p,3); el.textContent=fmt(Math.round(e*target)); if(p<1)requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ── Market line ── */
function renderMarket(data){
  const ctx=$('c-market'); if(!ctx)return; destroy('market');
  charts.market = new Chart(ctx,{
    type:'line',
    data:{ labels:data.map(d=>d.fact_date), datasets:[{ data:data.map(d=>d.total),
      borderColor:'#F7941F', backgroundColor:'rgba(247,148,31,.08)',
      borderWidth:2.5, fill:true, tension:.35, pointRadius:3, pointHoverRadius:6, pointBackgroundColor:'#F7941F' }] },
    options:{ responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:c=>'  Subscribers: '+fmt(c.raw)}} },
      scales:{ x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},maxTicksLimit:8}},
               y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{callback:v=>fmtM(v),font:{size:10}}} } }
  });
}

/* ── Top platforms ── */
function renderTop(data){
  const ctx=$('c-top'); if(!ctx)return; destroy('top');
  charts.top = new Chart(ctx,{
    type:'bar',
    data:{ labels:data.map(d=>d.actor), datasets:[{ data:data.map(d=>d.subs),
      backgroundColor:data.map((_,i)=>PAL[i%PAL.length]), borderWidth:0, borderRadius:2 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:c=>'  Subscribers: '+fmt(c.raw)}} },
      scales:{ x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{callback:v=>fmtM(v),font:{size:10}}},
               y:{grid:{display:false},ticks:{font:{size:10}}} } }
  });
}

/* ── Growth ── */
function renderGrowth(data){
  const ctx=$('c-growth'); if(!ctx)return; destroy('growth');
  const d12=data.slice(0,12);
  /* Fixed height for consistent 3-col row */
  const wrap=ctx.closest('.chart-box');
  if(wrap){ wrap.style.height=''; }  // use CSS .tall = 360px
  charts.growth = new Chart(ctx,{
    type:'bar',
    data:{ labels:d12.map(d=>d.actor), datasets:[{ data:d12.map(d=>d.pct),
      backgroundColor:d12.map(d=>d.pct>=0?'rgba(26,158,92,.85)':'rgba(192,57,43,.85)'),
      borderWidth:0, borderRadius:2, barPercentage:0.72, categoryPercentage:0.85 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{
        label:c=>`  ${c.raw>0?'+':''}${c.raw}%`,
        afterLabel:c=>{ const d=d12[c.dataIndex]; return [`  Q4 2021: ${fmt(d.v21)}`, `  Q4 2022: ${fmt(d.v22)}`]; }
      }}},
      scales:{ x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{callback:v=>v+'%',font:{size:9}}},
               y:{grid:{display:false},ticks:{font:{size:9}}} } }
  });
}

/* ── Declining platforms ── */
function renderDeclining(data){
  const ctx=$('c-declining'); if(!ctx||!data||!data.length)return; destroy('declining');
  const sorted=[...data].sort((a,b)=>a.pct-b.pct);
  /* Use CSS .tall height — consistent with growth chart in same row */
  const wrap=ctx.closest('.chart-box');
  if(wrap){ wrap.style.height=''; }

  charts.declining = new Chart(ctx,{
    type:'bar',
    data:{
      labels: sorted.map(d=>d.actor),
      datasets:[{
        data: sorted.map(d=>d.pct),
        backgroundColor: sorted.map(()=>'rgba(192,57,43,.82)'),
        borderWidth:0, borderRadius:2,
        barPercentage:0.72, categoryPercentage:0.85,
      }]
    },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{...TT, callbacks:{
          label: c=>`  Change: ${c.raw}%`,
          afterLabel: c=>{
            const d=sorted[c.dataIndex];
            return [`  Start: ${fmt(d.v_first)} (${d.d_first})`, `  End: ${fmt(d.v_last)} (${d.d_last})`];
          }
        }}
      },
      scales:{
        x:{
          grid:{color:'rgba(0,0,0,0.04)'},
          ticks:{callback:v=>v+'%', font:{size:9}},
          max:0,
        },
        y:{grid:{display:false}, ticks:{font:{size:9}}}
      }
    }
  });
}

/* ── Share ── */
function renderShare(data){
  const ctx=$('c-share'); if(!ctx)return; destroy('share');
  const t8=data.platforms.slice(0,8), oth=data.platforms.slice(8).reduce((s,p)=>s+p.value,0);
  const items=[...t8,{actor:'All Others',value:oth,pct:+(oth/data.total*100).toFixed(2)}];
  const cols=[...PAL.slice(0,8),'#aab'];
  charts.share = new Chart(ctx,{
    type:'doughnut',
    data:{ labels:items.map(d=>d.actor), datasets:[{ data:items.map(d=>d.value),
      backgroundColor:cols, borderWidth:2, borderColor:'#fff', hoverOffset:8 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:c=>`  ${fmt(c.raw)}  (${items[c.dataIndex].pct}%)`}} } }
  });
  const leg=$('share-leg'); if(!leg)return;
  leg.innerHTML=items.map((d,i)=>`<div class="dl-item"><span class="dot" style="background:${cols[i]}"></span><span class="name">${d.actor}</span><span class="pct">${d.pct}%</span></div>`).join('');
}

/* ── Trends ── */
function renderTrends(data){
  const ctx=$('c-trends'); if(!ctx)return; destroy('trends');
  const actors=Object.keys(data);
  const allDates=[...new Set(actors.flatMap(a=>data[a].map(d=>d.date)))].sort();
  charts.trends = new Chart(ctx,{
    type:'line',
    data:{ labels:allDates, datasets:actors.map((actor,i)=>{
      const m=Object.fromEntries(data[actor].map(d=>[d.date,d.value]));
      return { label:actor, data:allDates.map(dt=>m[dt]??null),
        borderColor:PAL[i%PAL.length], backgroundColor:'transparent',
        borderWidth:2, pointRadius:2, pointHoverRadius:5, tension:.3, spanGaps:true };
    })},
    options:{ responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{ legend:{position:'bottom',labels:{boxWidth:12,padding:12,font:{size:10}}},
        tooltip:{...TT, callbacks:{label:c=>`  ${c.dataset.label}: ${fmt(c.raw)}`}} },
      scales:{ x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:9},maxTicksLimit:8}},
               y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{callback:v=>fmtM(v),font:{size:10}}} } }
  });
}

/* ── Segments ── */
function renderSegs(data){
  const grid=$('seg-grid'), bar=$('seg-bar'); if(!grid)return;
  const keys=Object.keys(data), total=keys.reduce((s,k)=>s+data[k].count,0);
  grid.innerHTML=keys.map((k,i)=>`<div class="seg-card"><div class="sl">${k}</div><div class="sn" style="color:${SEG[i]}">${data[k].count}</div><div class="ss">platforms</div></div>`).join('');
  if(bar) bar.innerHTML=keys.map((k,i)=>{const p=(data[k].count/total*100).toFixed(1);return `<div class="seg-bar-c" title="${k}: ${data[k].count}" style="width:${p}%;background:${SEG[i]}"></div>`;}).join('');
}

/* ── Research Highlight mini charts ── */
function renderRH(market, top, growth, trendRaw){
  /* RH1: market line (dark bg) */
  const c1=$('rh-market');
  if(c1) new Chart(c1,{
    type:'line',
    data:{ labels:market.map(d=>d.fact_date), datasets:[{ data:market.map(d=>d.total),
      borderColor:'#F7941F', backgroundColor:'rgba(247,148,31,.15)',
      borderWidth:2.5, fill:true, tension:.35, pointRadius:0 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:c=>' '+fmt(c.raw)}} },
      scales:{ x:{display:true,ticks:{color:'#555',font:{size:8},maxTicksLimit:6},grid:{color:'rgba(0,0,0,0.06)'}},
               y:{display:true,ticks:{color:'#555',font:{size:8},callback:v=>fmtM(v)},grid:{color:'rgba(0,0,0,0.06)'}} } }
  });

  /* RH2: top-5 vertical bar — x-axis labels hidden, icons shown in HTML strip below */
  const c2=$('rh-top5');
  if(c2){
    const t5=top.slice(0,5);
    new Chart(c2,{
      type:'bar',
      data:{ labels:t5.map(d=>d.actor), datasets:[{ data:t5.map(d=>d.subs),
        backgroundColor:PAL.slice(0,5), borderWidth:0, borderRadius:3 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{...TT, callbacks:{label:c=>'  '+fmt(c.raw)+' subscribers'}} },
        scales:{
          x:{ display:false },   // ← hidden: labels shown in HTML strip below instead
          y:{ grid:{color:'rgba(0,0,0,0.06)'},ticks:{callback:v=>fmtM(v),font:{size:8}} }
        }
      }
    });
    /* Icon + name strip — rendered in HTML outside canvas */
    const strip=$('rh-top5-icons');
    if(strip) strip.innerHTML=t5.map((d,i)=>{
      const dom=LOGOS[d.actor];
      // Short display name: first word only for space
      const shortName = d.actor.split(' ')[0];
      const icon=dom
        ?`<img src="${fav(dom)}" title="${d.actor}" style="width:22px;height:22px;border-radius:3px;border:1px solid #ddd;display:block;margin:0 auto 3px;" onerror="this.style.display='none'">`
        :`<span style="width:22px;height:22px;border-radius:3px;background:${PAL[i]};display:block;margin:0 auto 3px;"></span>`;
      return `<div style="text-align:center;flex:1;">${icon}<span style="font-size:9px;font-weight:700;color:#555;display:block;line-height:1.2;">${shortName}</span></div>`;
    }).join('');
  }

  /* RH3: growth mini bar */
  const c3=$('rh-growth');
  if(c3){
    const g6=growth.slice(0,6);
    new Chart(c3,{
      type:'bar',
      data:{ labels:g6.map(d=>d.actor.length>13?d.actor.slice(0,13)+'…':d.actor),
        datasets:[{ data:g6.map(d=>d.pct), backgroundColor:'#1a9e5c', borderWidth:0, borderRadius:3 }] },
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{...TT,callbacks:{label:c=>` +${c.raw}%`}} },
        scales:{ x:{grid:{display:false},ticks:{font:{size:8},color:'#555'}},
                 y:{grid:{color:'rgba(0,0,0,0.06)'},ticks:{callback:v=>v+'%',font:{size:8}}} } }
    });
  }

  /* RH4: Netflix vs challengers */
  const c4=$('rh-netflix');
  if(c4&&trendRaw){
    const watch=['Netflix','Peacock Premium','Paramount+'];
    const tCols={'Netflix':'#E50914','Peacock Premium':'#F7941F','Paramount+':'#083050'};
    const allDts=[...new Set(watch.flatMap(a=>(trendRaw[a]||[]).map(d=>d.date)))].sort();
    new Chart(c4,{
      type:'line',
      data:{ labels:allDts, datasets:watch.filter(a=>trendRaw[a]).map(actor=>{
        const m=Object.fromEntries(trendRaw[actor].map(d=>[d.date,d.value]));
        return { label:actor, data:allDts.map(dt=>m[dt]??null),
          borderColor:tCols[actor], backgroundColor:'transparent',
          borderWidth:2, pointRadius:0, tension:.3, spanGaps:true };
      })},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:true,position:'bottom',labels:{font:{size:8},boxWidth:10,padding:5}},
          tooltip:{...TT,callbacks:{label:c=>` ${c.dataset.label}: ${fmt(c.raw)}`}} },
        scales:{ x:{display:true,ticks:{font:{size:7},maxTicksLimit:5},grid:{color:'rgba(0,0,0,0.05)'}},
                 y:{display:true,ticks:{callback:v=>fmtM(v),font:{size:8}},grid:{color:'rgba(0,0,0,0.05)'}} } }
    });
  }
}

/* ── Filter ── */
function populateFilter(actors){
  const sel=$('f-platforms'); if(!sel)return;
  sel.innerHTML=actors.map((a,i)=>`<option value="${a}" ${i<9?'selected':''}>${a}</option>`).join('');
}
function initFilters(){
  $('btn-apply')?.addEventListener('click', async ()=>{
    const sel=$('f-platforms');
    const actors=sel?[...sel.selectedOptions].map(o=>o.value):[];
    if(!actors.length)return;
    const data=await fetch(`${BASE}/api/trends?actors=${encodeURIComponent(actors.join(','))}`).then(r=>r.json());
    renderTrends(data);
  });
  $('btn-reset')?.addEventListener('click',()=>{
    const sel=$('f-platforms');
    if(sel)[...sel.options].forEach((o,i)=>{o.selected=i<9;});
  });
  $('f-topn')?.addEventListener('change', async e=>{
    const top=await fetch(`${BASE}/api/top?n=${e.target.value}`).then(r=>r.json());
    renderTop(top);
  });
}

/* ── Explorer ── */
function initExplorer(){
  loadExplorer();
  $$('th.sortable').forEach(th=>{
    th.addEventListener('click',()=>{
      const f=th.dataset.f;
      state.sort===f ? state.order=state.order==='desc'?'asc':'desc' : (state.sort=f, state.order='desc');
      $$('th.sortable').forEach(t=>t.classList.remove('asc','desc'));
      th.classList.add(state.order);
      state.page=1; loadExplorer();
    });
  });
  $('ex-btn')?.addEventListener('click',()=>{ state.q=$('ex-q')?.value||''; state.page=1; loadExplorer(); });
  $('ex-q')?.addEventListener('keydown',e=>{ if(e.key==='Enter'){state.q=e.target.value;state.page=1;loadExplorer();} });
}

async function loadExplorer(){
  const {page,sort,order,q}=state;
  const url=`${BASE}/api/explorer?page=${page}&limit=20&sort=${sort}&order=${order}${q?'&q='+encodeURIComponent(q):''}`;
  const res=await fetch(url).then(r=>r.json());
  const tbody=$('ex-body'); if(!tbody)return;
  tbody.innerHTML=res.data.map((row,i)=>{
    const rank=(page-1)*20+i+1;
    const dom=LOGOS[row.actor];
    const icon=dom?`<img src="${fav(dom)}" alt="" onerror="this.outerHTML='<span class=\\'init\\'>${row.actor[0]}</span>'">`:`<span class="init">${row.actor[0]}</span>`;
    const gc=row.pct>0?'up':row.pct<0?'dn':'fl';
    const gs=row.pct!=null?`<span class="badge ${gc}">${row.pct>0?'+':''}${row.pct}%</span>`:'—';
    return `<tr><td>${rank}</td><td class="name"><span class="lc">${icon}${row.actor}</span></td><td>${fmt(row.v21)}</td><td>${fmt(row.v22)}</td><td>${fmt(row.added)}</td><td>${gs}</td></tr>`;
  }).join('');
  const info=$('ex-info'); if(info)info.textContent=`${fmt(res.total)} platforms`;
  renderPg(res);
}

function renderPg(res){
  const wrap=$('ex-pg'); if(!wrap)return;
  const {page,pages}=res; let h=``;
  h+=`<button class="pg-btn" onclick="goPage(${page-1})" ${page<=1?'disabled':''}>&larr;</button>`;
  const r=[]; for(let p=Math.max(1,page-2);p<=Math.min(pages,page+2);p++)r.push(p);
  if(r[0]>1){h+=`<button class="pg-btn" onclick="goPage(1)">1</button>`; if(r[0]>2)h+=`<button class="pg-btn" disabled>…</button>`;}
  r.forEach(p=>{h+=`<button class="pg-btn ${p===page?'active':''}" onclick="goPage(${p})">${p}</button>`;});
  if(r[r.length-1]<pages){if(r[r.length-1]<pages-1)h+=`<button class="pg-btn" disabled>…</button>`; h+=`<button class="pg-btn" onclick="goPage(${pages})">${pages}</button>`;}
  h+=`<button class="pg-btn" onclick="goPage(${page+1})" ${page>=pages?'disabled':''}>&rarr;</button>`;
  wrap.innerHTML=h;
}
window.goPage=p=>{state.page=p;loadExplorer();};

/* ── Tabs ── */
function initTabs(){
  $$('.wwd-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      $$('.wwd-tab').forEach(b=>b.classList.remove('active'));
      $$('.wwd-pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.pane)?.classList.add('active');
    });
  });
}
