const {chromium,devices}=require('playwright');
(async()=>{
 const region=process.argv[2]||'ple', cpu=+(process.argv[3]||4);
 const b=await chromium.launch();
 const iph=devices['iPhone 13'];
 const ctx=await b.newContext({...iph});
 const p=await ctx.newPage();
 p.on('pageerror',e=>console.log('ERR',e.message));
 const cdp=await ctx.newCDPSession(p);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
 const t0=Date.now();
 await p.goto(`http://localhost:8765/?r=${region}`,{waitUntil:'load'});
 await p.waitForFunction(()=>typeof render==='function'&&typeof G!=='undefined'&&G&&window.meta,{timeout:180000}).catch(e=>console.log('wait fail'));
 await p.waitForTimeout(4000);
 console.log('load ms',Date.now()-t0);
 // instrument
 await p.evaluate(()=>{
  window.__T={};
  const names=['render','classesFor','staticFor','renderObs','renderSquares','renderCoins','renderSpeciesList','updateUrbanBus','updateBestNow','huntUpdate','hardUpdate','updateLegend'];
  names.forEach(n=>{const f=window[n];if(typeof f!=='function')return;window[n]=function(...a){const t=performance.now();try{return f.apply(this,a)}finally{const d=performance.now()-t;const o=window.__T[n]||(window.__T[n]={ms:0,n:0});o.ms+=d;o.n++}}});
 });
 const res={};
 async function click(label,sel){
  await p.evaluate(()=>{window.__T={}});
  const t=await p.evaluate(async(sel)=>{const el=document.querySelector(sel);const t=performance.now();el.click();await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));return performance.now()-t},sel);
  await p.waitForTimeout(1500);
  const T=await p.evaluate(()=>window.__T);
  console.log(`\n== ${label}: ${t.toFixed(0)} ms (click->frame)`);
  Object.entries(T).forEach(([k,v])=>console.log(`   ${k}: ${v.ms.toFixed(0)} ms x${v.n}`));
 }
 console.log('state',await p.evaluate(()=>JSON.stringify({sp:state.sp,tiers:state.tiers,mode:state.mode,view:state.view,cells:meta.rows*meta.cols})));
 await click('Bons (tier2) on','#tiers input[data-tier="2"]');
 await click('Bons off','#tiers input[data-tier="2"]');
 await click('Stars off? (add 3 then remove 1)','#tiers input[data-tier="3"]');
 await p.evaluate(()=>{state.sp="multi";saveState();render()});
 await p.waitForTimeout(2000);
 await click('MULTI: tier2 on','#tiers input[data-tier="2"]');
 await click('MULTI: tier3 on','#tiers input[data-tier="3"]');
 await click('MULTI: tier2 off','#tiers input[data-tier="2"]');
 await b.close();
})();
