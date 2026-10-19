(function(){
// ===== DEMO DATA (example data only — not real prices, PnL or wallets) =====
const COINS={
 Dacity:{t:'DACITY',e:'🐉',g:'#c33cff,#ff7a3c',p:'0.00378',mc:'$3.71M',ch:196.1,age:'1d',liq:'$240K',hold:'4,812',score:86,buy:['orangie','Rowdy','bystevenr'],sell:['Rowdy','jidn']},
 TORCH:{t:'TORCH',e:'💧',g:'#13d57a,#06402a',p:'0.00778',mc:'$7.78M',ch:102.5,age:'3d',liq:'$410K',hold:'9,204',score:91,buy:['orangie','Rowdy','Ansem']},
 LUKE:{t:'LUKE',e:'⚡',g:'#ff9a3c,#3c4cff',p:'0.000413',mc:'$401K',ch:11893,age:'6h',liq:'$88K',hold:'2,140',score:78,buy:['ansem','quanterty']},
 mucron:{t:'MUCRON',e:'🐭',g:'#ff6a88,#6a5cff',p:'0.000339',mc:'$322.6K',ch:8423,age:'4h',liq:'$61K',hold:'1,733',score:74,buy:['jidn','bystevenr']},
 WEFT:{t:'WEFT',e:'➶',g:'#2b2b33,#111',p:'0.000886',mc:'$844K',ch:935.7,age:'9h',liq:'$120K',hold:'2,980',score:69,buy:['tjr']},
 Gato:{t:'GATO',e:'🐱',g:'#f5d6a0,#b07a3c',p:'0.000854',mc:'$829.9K',ch:55.2,age:'2d',liq:'$140K',hold:'3,310',score:64,buy:['intentos']},
 FTR:{t:'FTR',e:'🚀',g:'#3c8cff,#ff3c5c',p:'0.00210',mc:'$2.01M',ch:-28.4,age:'1d',liq:'$190K',hold:'5,020',score:52,buy:['bystevenr','Rowdy'],sell:['bystevenr']},
 ELON:{t:'ELON',e:'👤',g:'#e8e8e8,#888',p:'0.00286',mc:'$2.85M',ch:12.0,age:'5d',liq:'$260K',hold:'6,450',score:61,buy:['Daumen']},
 CyberAxe:{t:'CAXE',e:'🪓',g:'#6a3cff,#1a0b40',p:'0.000408',mc:'$399.2K',ch:-3.7,age:'12h',liq:'$70K',hold:'1,240',score:48,buy:['Mitch']},
 CATE:{t:'CATE',e:'🪙',g:'#ffd23c,#c78a00',p:'0.0712',mc:'$68.6M',ch:-5.4,age:'40d',liq:'$2.1M',hold:'41,200',score:58,buy:['Jijo']},
 ANSEM:{t:'ANSEM',e:'🅰',g:'#ffcc00,#ff5c00',p:'0.106',mc:'$106M',ch:-8.0,age:'90d',liq:'$4.4M',hold:'88,100',score:55,buy:['orangie']},
 FROGGO:{t:'FROGGO',e:'🐸',g:'#5cff8a,#0a5c3a',p:'0.000410',mc:'$410K',ch:38.0,age:'2h',liq:'$52K',hold:'980',score:31,buy:['kuba_sol'],sell:[]},
};
const TRADERS={
 orangie:{c:'#ff8a3c,#ff3c7a',pnl:184320,sol:1094,wr:71,tr:412,hold:'38m',pl:[['Axiom',70],['FOMO',30]],f:'48.2K',tag:'KOL'},
 bystevenr:{c:'#9b5cff,#3c4cff',pnl:126800,sol:752,wr:68,tr:288,hold:'52m',pl:[['Photon',85],['Axiom',15]],f:'31.0K',tag:'KOL'},
 rowdy:{n:'Rowdy',c:'#3cc8ff,#1d3cff',pnl:98450,sol:584,wr:64,tr:531,hold:'21m',pl:[['GMGN',60],['Axiom',40]],f:'22.7K',tag:'Smart'},
 quanterty:{c:'#2fd67b,#0a5c3a',pnl:87210,sol:517,wr:73,tr:196,hold:'1h 12m',pl:[['Axiom',100]],f:'9.1K',tag:'Smart'},
 brezscales:{c:'#ff5a4e,#7a1d1d',pnl:64900,sol:385,wr:61,tr:344,hold:'44m',pl:[['FOMO',55],['Trojan',45]],f:'12.3K',tag:'KOL'},
 tjr:{c:'#3cc8ff,#0b5d75',pnl:52380,sol:311,wr:58,tr:227,hold:'2h 05m',pl:[['BullX',65],['Photon',35]],f:'18.8K',tag:'KOL'},
 intentos:{c:'#ff3c7a,#6a1d6a',pnl:41760,sol:248,wr:66,tr:402,hold:'17m',pl:[['Trojan',100]],f:'7.4K',tag:'Smart'},
 daumen:{n:'Daumen',c:'#ff8a3c,#7a3c1d',pnl:33140,sol:197,wr:62,tr:159,hold:'1h 31m',pl:[['GMGN',80],['BullX',20]],f:'5.2K',tag:'Smart'},
 mitch:{n:'Mitch',c:'#7c5cff,#2a1d6a',pnl:27590,sol:164,wr:57,tr:278,hold:'29m',pl:[['Axiom',50],['Photon',50]],f:'6.0K',tag:'Smart'},
 jijo:{n:'Jijo',c:'#ff6a4e,#6a1d1d',pnl:19880,sol:118,wr:55,tr:141,hold:'3h 10m',pl:[['FOMO',100]],f:'4.4K',tag:'KOL'},
 ansem:{n:'Ansem',c:'#ffcc00,#ff5c00',pnl:71200,sol:420,wr:59,tr:120,hold:'6h',pl:[['Axiom',60],['FOMO',40]],f:'610K',tag:'KOL'},
 murad:{n:'Murad',c:'#ff3c7a,#3c1d2a',pnl:15400,sol:91,wr:52,tr:38,hold:'4d',pl:[['Photon',100]],f:'540K',tag:'KOL'},
 toly:{n:'Toly',c:'#b07aff,#3c1d6a',pnl:2100,sol:12,wr:50,tr:9,hold:'2d',pl:[['FOMO',100]],f:'890K',tag:'KOL'},
 'elon musk':{n:'Elon Musk',c:'#e8e8ee,#555',pnl:0,sol:0,wr:0,tr:0,hold:'—',pl:[],f:'—',tag:'Famous',nowallet:1},
 jidn:{c:'#ff3c7a,#7a1d3c',pnl:22800,sol:135,wr:60,tr:510,hold:'14m',pl:[['GMGN',100]],f:'3.9K',tag:'Smart'},
 kuba_sol:{c:'#888,#333',pnl:-420,sol:-2.5,wr:41,tr:63,hold:'25m',pl:[['FOMO',100]],f:'120',tag:''},
};

Object.assign(COINS,{
 AIXBT:{t:'AIXBT',e:'🤖',g:'#3cc8ff,#1d3cff',p:'0.2140',mc:'$214M',ch:18.4,age:'210d',liq:'$6.8M',hold:'312K',score:72,buy:['orangie','quanterty']},
 GRIFFAIN:{t:'GRIFFAIN',e:'🦅',g:'#a78bfa,#1d1d6a',p:'0.0612',mc:'$61.2M',ch:9.1,age:'180d',liq:'$3.1M',hold:'98K',score:66,buy:['bystevenr']},
 ZEREBRO:{t:'ZEREBRO',e:'🧠',g:'#ff6ad5,#5c1d6a',p:'0.0388',mc:'$38.8M',ch:-4.2,age:'200d',liq:'$2.2M',hold:'71K',score:57,buy:['intentos']},
 DOGEAI:{t:'DOGEAI',e:'🐕',g:'#f5b83c,#7a4a00',p:'0.00921',mc:'$9.21M',ch:44.0,age:'20d',liq:'$640K',hold:'14K',score:76,buy:['Rowdy','tjr']},
 MARS:{t:'MARS',e:'🪐',g:'#ff7a3c,#6a1d0b',p:'0.00133',mc:'$1.33M',ch:212.0,age:'8h',liq:'$150K',hold:'2,410',score:81,buy:['orangie','Mitch']},
 MEW:{t:'MEW',e:'😺',g:'#9be15d,#1d6a3c',p:'0.00402',mc:'$402M',ch:3.3,age:'560d',liq:'$11M',hold:'190K',score:63,buy:['Jijo']},
 POPCAT:{t:'POPCAT',e:'😮',g:'#ffd6a0,#c76a3c',p:'0.311',mc:'$305M',ch:-2.1,age:'640d',liq:'$9.5M',hold:'120K',score:59,buy:['brezscales']},
 TRUMP:{t:'TRUMP',e:'🇺🇸',g:'#ff5a4e,#1d3cff',p:'8.42',mc:'$1.68B',ch:5.6,age:'270d',liq:'$80M',hold:'640K',score:62,buy:['Ansem']},
 VOTE:{t:'VOTE',e:'🗳',g:'#3c8cff,#ffffff',p:'0.000771',mc:'$771K',ch:66.0,age:'1d',liq:'$98K',hold:'1,880',score:70,buy:['Daumen']},
 MAGA:{t:'MAGA',e:'🧢',g:'#ff3c3c,#6a0b0b',p:'0.00560',mc:'$5.60M',ch:-12.0,age:'60d',liq:'$420K',hold:'22K',score:49,buy:['jidn'],sell:['jidn']},
 GIGA:{t:'GIGA',e:'🗿',g:'#d0d0d8,#3c3c48',p:'0.0244',mc:'$24.4M',ch:27.0,age:'300d',liq:'$1.4M',hold:'55K',score:68,buy:['tjr','quanterty']},
 PNUT:{t:'PNUT',e:'🐿',g:'#ffb03c,#7a3c0b',p:'0.218',mc:'$218M',ch:7.7,age:'340d',liq:'$7.2M',hold:'230K',score:61,buy:['bystevenr']},
 MOODENG:{t:'MOODENG',e:'🦛',g:'#ff9ad5,#7a3c6a',p:'0.104',mc:'$104M',ch:-6.5,age:'380d',liq:'$4.0M',hold:'88K',score:54,buy:['Mitch']},
});
const INFO={Dacity:['Dacity Dragon','Dragon meme · community takeover'],TORCH:['Torch Finance','Olympic-flame meme, CTO'],LUKE:['Luke Skywalker Coin','Movie meme, very new'],mucron:['Mucron Mouse','Tiny mouse meme'],WEFT:['Weft Protocol','AI agent meme'],Gato:['Gato Loco','Cat meme'],FTR:['Flying Tesla Roadster','Elon / space meme'],ELON:['Elon Mars Dog','Elon meme'],CyberAxe:['Cyber Axe','Cybertruck meme'],CATE:['Cate Coin','Cat meme · older'],ANSEM:['Ansem Coin','KOL meme'],FROGGO:['Froggo the Frog','Frog meme · high insider risk'],
 AIXBT:['aixbt by Virtuals','AI agent'],GRIFFAIN:['Griffain','AI agent'],ZEREBRO:['Zerebro','AI agent / art'],DOGEAI:['Doge AI Agent','AI × dog meme'],MARS:['Mars Mission','Space meme'],MEW:['cat in a dogs world','Cat meme'],POPCAT:['Popcat','Cat meme'],TRUMP:['Official Trump','Politics'],VOTE:['Vote Coin','Politics'],MAGA:['MAGA Hat','Politics'],GIGA:['Gigachad','Chad meme'],PNUT:['Peanut the Squirrel','Animal meme'],MOODENG:['Moo Deng','Hippo meme']};
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function ca(k){const r=seed('ca'+k);let a='';for(let i=0;i<40;i++)a+=B58[Math.floor(r()*58)];return a+'pump'}
const shortCa=a=>a.slice(0,4)+'…'+a.slice(-4);
function tokenImg(k,s=48){const C=COINS[k]||{g:'#8B5CF6,#22D3EE',t:k};const [c1,c2]=C.g.split(',');const r=seed('img'+k);const mono=(C.t||k).slice(0,C.t&&C.t.length<=4?C.t.length:2);
 const dots=[...Array(6)].map(()=>`<circle cx="${(r()*100).toFixed(0)}" cy="${(r()*100).toFixed(0)}" r="${(r()*14+4).toFixed(0)}" fill="#fff" opacity="${(r()*.12+.04).toFixed(2)}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/>${dots}<text x="50" y="${C.e?44:60}" font-size="${C.e?34:30}" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji">${C.e||''}</text><text x="50" y="${C.e?80:62}" font-size="${mono.length>3?15:19}" font-weight="800" text-anchor="middle" fill="#fff" font-family="Inter,Arial" letter-spacing="-.5" style="paint-order:stroke" stroke="#0006" stroke-width="2">${mono}</text></svg>`;
 return `<img src="data:image/svg+xml;utf8,${encodeURIComponent(svg)}" width="${s}" height="${s}" style="border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px #fff2,0 2px 10px #0007;display:block">`}
const POSTS=[
 {who:'Elon Musk',h:'elonmusk',l:'21.4K',txt:'Flying Tesla Roadster to Mars 🚀',phr:'tesla roadster',coin:'FTR',m:94,mv:48},
 {who:'Ansem',h:'blknoiz06',l:'2.1K',txt:'TORCH chart looks clean ngl',phr:'TORCH',coin:'TORCH',m:100,mv:17},
 {who:'Toly',h:'aeyakovenko',l:'890',txt:'cats on solana are undefeated',phr:'cats on solana',coin:'MEW',m:71,mv:-6},
 {who:'Murad',h:'MustStopMurad',l:'4.8K',txt:'the gigachads will be rewarded',phr:'gigachads',coin:'GIGA',m:88,mv:12},
 {who:'orangie',h:'orangie',l:'1.3K',txt:'ai agents szn is not over, doge ai looking strong',phr:'doge ai',coin:'DOGEAI',m:96,mv:31},
 {who:'Elon Musk',h:'elonmusk',l:'58.2K',txt:'Mars mission update soon',phr:'mars mission',coin:'MARS',m:91,mv:84},
 {who:'Rowdy',h:'rowdy',l:'640',txt:'the hippo just won’t die lol',phr:'hippo',coin:'MOODENG',m:79,mv:-3},
 {who:'Ansem',h:'blknoiz06',l:'3.3K',txt:'squirrel season is back?',phr:'squirrel',coin:'PNUT',m:83,mv:9},
];
function renderPosts(){return POSTS.map(p=>{const T=TRADERS[tkey(p.who)]||genTrader(p.who);const C=COINS[p.coin];const up=p.mv>=0;const mc=p.m>=90?'#34E07A':p.m>=80?'#22D3EE':'#f5b83c';
 return `<div class="card" style="margin-bottom:9px"><div class="tr-link" data-trader="${p.who}" style="display:flex;gap:9px;align-items:center">${av(p.who,32)}<div><b style="font-size:13.5px">${p.who} <span style="color:#3cc8ff;font-size:12px">✓</span></b><div class="g" style="font-size:11.5px">@${p.h} · ♥ ${p.l}</div></div><span style="margin-left:auto;font-size:16px">𝕏</span></div>
<div style="font-size:14px;margin:8px 0 8px;color:#ddd">“${p.txt.replace(new RegExp('('+p.phr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i'),'<mark style="background:#8B5CF633;color:#fff;border-radius:4px;padding:0 3px">$1</mark>')}”</div>
<div class="coin-link" data-coin="${p.coin}" style="display:flex;align-items:center;gap:9px;background:#16161d;border-radius:12px;padding:8px 10px;box-shadow:inset 0 0 0 1px #ffffff0d">${tokenImg(p.coin,30)}<div style="min-width:0"><div style="display:flex;align-items:center;gap:6px"><b style="font-size:13px">$${C.t}</b><span style="font-size:10.5px;font-weight:800;color:${mc};background:${mc}1f;box-shadow:inset 0 0 0 1px ${mc}55;padding:1px 6px;border-radius:999px">${p.m}% match</span></div><div class="g" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">“${p.phr}” → ${INFO[p.coin][0]} · MC ${C.mc}</div></div><div style="margin-left:auto;text-align:right;flex:none"><b class="${up?'up':'dn'}" style="font-size:15px">${up?'+':'−'}${Math.abs(p.mv)}%</b><div class="g" style="font-size:10.5px">15 min after</div></div></div></div>`}).join('')}
const PC={Axiom:'#e8e8ee',FOMO:'#7c5cff',Photon:'#3cc8ff',GMGN:'#2fd67b',BullX:'#f5b83c',Trojan:'#b07aff'};
const PL=Object.keys(PC);
const $=(q,r=document)=>[...r.querySelectorAll(q)];
const tkey=n=>n.trim().toLowerCase();
const isTrader=n=>tkey(n) in TRADERS;
const coinKey=n=>Object.keys(COINS).find(k=>k.toLowerCase()===n.trim().toLowerCase()||COINS[k].t===n.trim().replace('$','').toUpperCase());
function seed(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>((h=Math.imul(h^h>>>15,2246822507),h=Math.imul(h^h>>>13,3266489909),(h^=h>>>16)>>>0)/4294967296)}
const fmt=v=>(v<0?'−':'+')+'$'+Math.abs(v).toLocaleString('en-US');
const pct=v=>(v<0?'▼ ':'▲ ')+Math.abs(v).toLocaleString('en-US',{maximumFractionDigits:1})+'%';
function genCoin(n){const r=seed(n);const ch=Math.round((r()*300-60)*10)/10;return{t:n.toUpperCase(),e:'🪙',g:'#8B5CF6,#22D3EE',p:(r()*0.01).toFixed(5),mc:'$'+(r()*9+0.3).toFixed(2)+'M',ch,age:Math.ceil(r()*20)+'d',liq:'$'+Math.round(r()*400+40)+'K',hold:Math.round(r()*9000+800).toLocaleString(),score:Math.round(r()*40+50),buy:['orangie','quanterty']}}
function genTrader(n){const r=seed(n);return{n,c:'#8B5CF6,#22D3EE',pnl:Math.round(r()*40000),sol:Math.round(r()*200),wr:Math.round(r()*30+45),tr:Math.round(r()*400+20),hold:Math.round(r()*80+10)+'m',pl:[['Axiom',60],['FOMO',40]],f:(r()*20).toFixed(1)+'K',tag:''}}
function chart(name,up){const r=seed(name+'c');let y=up?185:60,pts=[];for(let i=0;i<=50;i++){y+=(up?-2.6:2.4)+(r()-.5)*14;y=Math.max(18,Math.min(205,y));pts.push([i*12,y])}
 const d='M'+pts.map(p=>p[0]+','+p[1].toFixed(0)).join(' L');const c=up?'#34E07A':'#FF5468';const [lx,ly]=pts[pts.length-1];
 return `<svg viewBox="0 0 600 220" width="100%" height="150" style="overflow:visible"><defs><linearGradient id="dA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>${[55,110,165].map(v=>`<line x1="0" x2="600" y1="${v}" y2="${v}" stroke="#fff" stroke-opacity=".05" stroke-dasharray="3 5"/>`).join('')}<line x1="0" x2="600" y1="${ly.toFixed(0)}" y2="${ly.toFixed(0)}" stroke="${c}" stroke-opacity=".45" stroke-dasharray="2 4"/><path d="${d} L600,220 L0,220Z" fill="url(#dA)"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="${lx}" cy="${ly.toFixed(0)}" r="11" fill="${c}" opacity=".25"/><circle cx="${lx}" cy="${ly.toFixed(0)}" r="5" fill="${c}" stroke="#07070B" stroke-width="2"/></svg>`}
const av=(n,s=24)=>{const T=TRADERS[tkey(n)]||genTrader(n);return `<i class="ua" style="width:${s}px;height:${s}px;font-size:${s*.45}px;background:linear-gradient(135deg,${T.c})">${(T.n||n)[0].toUpperCase()}</i>`};
const chip=([p,v])=>`<span class="chip"><em style="background:${PC[p]||'#888'};${p==='FOMO'?'color:#fff':''}">${p[0]}</em>${p} ${v}%</span>`;
const DEMO='<div class="dfoot">Demo · example data · not financial advice</div>';
function renderCoin(name){const k=coinKey(name);const C=k?COINS[k]:genCoin(name);const nm=k||name;const up=C.ch>=0;
 const bars=[['Smart traders in',`${C.buy.length} top traders · 1h`,Math.min(30,8+C.buy.length*7),30],['Liquidity',C.liq,Math.round(C.score/6),20],['Holders',C.hold,Math.round(C.score/6.5),20],['Rug risk','No mint · no freeze',Math.round(C.score/7),15],['Momentum',pct(C.ch)+' 24h',Math.round(C.score/8),15]];
 const sc=C.score,col=sc>=75?'#34E07A':sc>=50?'#f5b83c':'#FF5468';
 const sell=(C.sell&&C.sell.length)?`<div class="pg" style="margin-top:9px"><div class="warn"><div class="wh"><span class="wi">⚠</span><b>Smart money selling</b><time>live</time></div><div class="wl" style="margin-top:8px">${C.sell.map(s=>`<span class="tr-link" data-trader="${s}">${av(s,18)}${s} sold ${Math.round(seed(nm+s)()*60+40)}%</span>`).join('')}</div></div></div>`:'';
 const buyers=C.buy.map(b=>{const r=seed(nm+b);const T=TRADERS[tkey(b)]||genTrader(b);return `<div class="tr tr-link" data-trader="${b}" style="display:flex;align-items:center;gap:9px;padding:7px 0;font-size:14px">${av(b,28)}<b>${T.n||b}</b><span class="g" style="font-size:12px">${Math.ceil(r()*9)} buys · $${(r()*20+1).toFixed(1)}K</span><span class="${up?'up':'dn'}" style="margin-left:auto;font-weight:700">${up?'+':''}${Math.round(C.ch*(0.4+r()*0.5))}%</span></div>`}).join('');
 const I=INFO[nm]||[nm,'Meme'];const A=ca(nm);const stt=(a,b)=>`<div class="st" style="padding:9px 11px;min-width:0"><small style="display:block;white-space:nowrap">${a}</small><b style="display:block;font-size:14.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b}</b></div>`;const vol=(()=>{const m=C.liq.match(/([\d.]+)([KMB])/);let v=parseFloat(m[1])*{K:1e3,M:1e6,B:1e9}[m[2]]*3.1;return v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(2)+'M':'$'+(v/1e3).toFixed(0)+'K'})();
 return `<div class="pg" style="padding-top:6px;display:flex;align-items:center;gap:11px"><span class="back" style="font-size:20px">‹</span>${tokenImg(nm,46)}<div style="min-width:0"><b style="font-size:17px">${I[0]}</b><div class="g" style="font-size:12px">$${C.t} · ${C.age} old</div></div><img src="kyvo_mark.svg" width="28" height="28" style="display:block;flex:none;margin-left:auto;margin-right:8px"><span>☆</span></div>
<div class="pg" style="margin-top:8px;display:flex;align-items:center;gap:6px"><span class="ca" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#aaa;background:#14141b;box-shadow:inset 0 0 0 1px #ffffff12;padding:5px 8px 5px 10px;border-radius:999px;font-family:ui-monospace,Menlo,monospace">CA ${shortCa(A)}<span class="copy" data-ca="${A}" style="display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#ffffff12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2.4"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span></span><span class="g" style="font-size:11px">demo address</span></div>
<div class="pg" style="margin-top:8px"><b style="font-size:26px;letter-spacing:-.5px">${C.mc}</b> <span class="g">MC</span> <span class="${up?'up':'dn'}" style="font-size:14px;font-weight:700">${pct(C.ch)}</span></div>
<div class="pg" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px">${stt('Price','$'+C.p)}${stt('Liquidity',C.liq)}${stt('Holders',C.hold)}${stt('Age',C.age)}${stt('Vol 24h',vol)}${stt('Top 10',(seed(nm)()*20+12).toFixed(1)+'%')}</div>
<div class="pg">${chart(nm,up)}</div>${sell}
<div class="pg" style="margin-top:9px"><div class="card" style="padding:10px 14px 4px"><h4 style="margin-bottom:2px">Smart money bought</h4>${buyers}</div></div>
<div class="pg" style="margin-top:9px"><div class="card" style="padding:11px 14px"><h4 style="margin-bottom:6px">Info</h4><div style="font-size:13px;color:#ccc;line-height:1.45">${I[0]} ($${C.t}) — ${I[1]}. Launched ${C.age} ago on Solana.</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px">${['Mint revoked','Freeze off','LP '+(C.score>55?'locked':'unlocked'),'Dev holds '+(seed(nm+'d')()*4).toFixed(1)+'%'].map(x=>`<span class="chip" style="padding:4px 9px">${x}</span>`).join('')}</div></div></div>
<div class="pg" style="margin-top:9px"><div class="card" style="padding:11px 14px 3px"><div class="scorehd"><div class="ring2" style="background:conic-gradient(${col} 0 ${sc}%,#1d1d25 0)"><b style="color:${col}">${sc}</b></div><div><b style="font-size:15px">Signal score</b><div class="g" style="font-size:12px;margin-top:3px">${sc>=75?'Strong':sc>=50?'Medium':'Weak'} · updated 4s ago</div></div></div>${bars.map(([a,b,v,m])=>`<div class="sr"><div class="srt"><b>${a}</b><span class="g">${b}</span><em>${v}<span class="g">/${m}</span></em></div><div class="bar"><i style="width:${Math.round(v/m*100)}%;background:${v/m>=.8?'#2fd67b':'#f5b83c'}"></i></div></div>`).join('')}</div></div>
<div class="pg" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px">${['FOMO','Axiom','Photon','GMGN'].map((p,i)=>`<div class="plat" data-p="${p}" style="background:${i?'#1d1d25':'#7c5cff'};border-radius:10px;padding:10px 0;text-align:center;font-weight:800;font-size:12.5px">${p}</div>`).join('')}</div>${DEMO}`}
function renderTrader(name){const T=TRADERS[tkey(name)]||genTrader(name);const nm=T.n||name;const r=seed(nm);
 const trades=Object.keys(COINS).sort(()=>r()-.5).slice(0,5).map((k,i)=>{const C=COINS[k];const v=Math.round((r()*300-60));return `<div class="row coin-link" data-coin="${k}" style="padding:8px 2px"><div class="ic" style="width:34px;height:34px;font-size:16px;background:linear-gradient(135deg,${C.g})">${C.e}</div><div class="nm"><b style="font-size:14px">${k}</b><small>${['1h','4h','6h','1d','2d'][i]} ago</small></div><div class="mc"><b class="${v<0?'dn':'up'}" style="font-size:14px">${v<0?'−':'+'}${Math.abs(v)}%</b><small>${v<0?'−':''}$${(Math.abs(v)*r()*30+100).toFixed(0)}</small></div></div>`}).join('');
 const st=(k,v,c='')=>`<div class="card" style="padding:11px 12px"><div class="g" style="font-size:11.5px">${k}</div><b class="${c}" style="font-size:18px;display:block;margin-top:3px">${v}</b></div>`;
 return `<div class="pg" style="padding-top:6px;font-size:20px;display:flex;align-items:center;justify-content:space-between"><span class="back">‹</span><img src="kyvo_mark.svg" width="28" height="28" style="display:block;flex:none;"></div>
<div class="pg" style="display:flex;align-items:center;gap:14px;margin-top:6px"><div style="width:68px;height:68px;flex:none;border-radius:50%;background:linear-gradient(135deg,${T.c});display:grid;place-items:center;font-size:30px;font-weight:800;color:#000">${nm[0].toUpperCase()}</div>
<div><b style="font-size:22px">${nm}</b> ${T.tag?`<span class="tag" style="background:#8B5CF622;color:#C4B5FD">${T.tag}</span>`:''}<div style="margin-top:5px"><span class="tag buy">${T.nowallet?'𝕏 account · no linked wallet':'✓ Verified on-chain'}</span></div><div class="g" style="font-size:12px;margin-top:5px">@${nm.toLowerCase().replace(' ','')} · ${T.f} followers</div></div></div>
${T.pl.length?`<div class="pg" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><span class="g" style="font-size:12px;align-self:center">Trades on</span>${T.pl.map(chip).join('')}</div>`:''}
<div class="pg" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px">${st('Win rate',T.wr+'%',T.wr>=55?'up':'')}${st('7d PnL',fmt(T.pnl),T.pnl<0?'dn':'up')}${st('Avg hold',T.hold)}${st('Trades (7d)',T.tr.toLocaleString())}</div>
<div class="pg" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="btn-f" style="background:#fff;color:#000;text-align:center;padding:12px;border-radius:12px;font-weight:800">Follow</div><div class="btn-f" style="background:#7c5cff;text-align:center;padding:12px;border-radius:12px;font-weight:800">Alerts on</div></div>
<div class="pg" style="margin-top:16px"><b style="font-size:15px">Recent trades</b>${T.nowallet?'<div class="g" style="font-size:13px;margin-top:8px">No public wallet linked — only posts are tracked.</div>':trades}</div>${DEMO}`}
// ===== UI =====
const toastEl=document.getElementById('toast');let tt;
function toast(t){toastEl.textContent=t;toastEl.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>toastEl.classList.remove('on'),1800)}
let curCoin='Dacity';
function show(h){let [id,arg]=h.split('/');arg=arg&&decodeURIComponent(arg);
 if(id==='coin'){curCoin=arg||'Dacity';const s=document.getElementById('s-coin');s.innerHTML=renderCoin(curCoin);wire(s)}
 if(id==='trader'){const s=document.getElementById('s-trader');s.innerHTML=renderTrader(arg||'orangie');wire(s)}
 const s=document.getElementById('s-'+id)||document.getElementById('s-home');
 $('.scr').forEach(x=>x.classList.toggle('on',x===s));s.scrollTop=0;
 const tab=s.dataset.tab;$('.tb [data-tab]').forEach(d=>d.classList.toggle('on',d.dataset.tab===tab))}
function go(h){if(location.hash==='#'+h)show(h);else location.hash=h}
window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'home'));
function bind(el,fn){if(!el||el.dataset.b)return;el.dataset.b=1;el.classList.add('tap');el.addEventListener('click',e=>{e.stopPropagation();fn()})}
const back=()=>history.length>1?history.back():go('home');
function wire(sec){const id=sec.id.slice(2);
 $('.back',sec).forEach(el=>bind(el,back));
 $('[data-trader]',sec).forEach(el=>bind(el,()=>go('trader/'+encodeURIComponent(el.dataset.trader))));
 $('[data-coin]',sec).forEach(el=>bind(el,()=>go('coin/'+encodeURIComponent(el.dataset.coin))));
 $('.plat',sec).forEach(el=>bind(el,()=>toast('Demo: would open '+curCoin+' on '+el.dataset.p)));
 $('.copy',sec).forEach(el=>bind(el,()=>{try{navigator.clipboard.writeText(el.dataset.ca)}catch(e){}toast('Copied demo address '+shortCa(el.dataset.ca))}));
 $('.btn-f',sec).forEach(el=>bind(el,()=>toast('Demo only — '+el.textContent.trim()+' is not live yet')));}
{const fb=document.getElementById('s-famousB');const box=[...fb.querySelectorAll(':scope > .pg')].find(p=>p.querySelector('.card'));if(box){box.innerHTML='<div class="g" style="font-size:12px;margin:0 2px 8px">Posts are matched to coins by name/ticker similarity</div>'+renderPosts();wire(fb)}}
$('[data-go]').forEach(el=>bind(el,()=>go(el.dataset.go)));
$('.scr').forEach(sec=>{const id=sec.id.slice(2);if(id==='coin'||id==='trader')return;
 $('span,div,b',sec).forEach(el=>{if(el.children.length===0&&el.textContent.trim()==='‹')bind(el,back)});
 $('a,div,span',sec).forEach(el=>{const t=el.textContent.trim();const p=PL.find(p=>t===p||t===p[0]+p);if(p&&!el.querySelector('div'))bind(el,()=>{const c=(el.closest('.card,.row,.open')||sec).textContent;const k=Object.keys(COINS).find(k=>c.includes(k));toast('Demo: would open '+(k||'this coin')+' on '+p)})});
 $('span,div',sec).forEach(el=>{const t=el.textContent.trim();if(el.children.length<=1&&/^(\+ Follow|Follow|Following|Share|Share on X|Save image|Share my rank|\+ Add|Send)$/.test(t))bind(el,()=>toast('Demo only — '+t.replace('+ ','')+' is not live yet'))});
 $('b',sec).forEach(b=>{const t=b.textContent.replace(/✓/g,'').trim();if(isTrader(t))bind(b.closest('.row,.card,tr')||b.parentElement.parentElement,()=>go('trader/'+encodeURIComponent(t)))});
 $('b,span',sec).forEach(b=>{const t=b.textContent.trim();if(b.children.length===0&&(coinKey(t)||/^[A-Z]{3,9}$/.test(t)&&sec.id==='s-narratives'))bind(b.closest('.row')||b,()=>go('coin/'+encodeURIComponent(coinKey(t)||t)))});
});
$('#s-alerts .card').forEach(c=>{if(c.textContent.includes('KYVO')){const k=Object.keys(COINS).find(k=>c.querySelector('b')&&c.querySelector('b').textContent.includes(k));bind(c,()=>go('coin/'+(k||'Dacity')))}});
show(location.hash.slice(1)||'home');
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
