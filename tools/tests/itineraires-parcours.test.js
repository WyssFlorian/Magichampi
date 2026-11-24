// Test Playwright : mode dessin, appui long, parcours enregistrés (charger, GPX, supprimer) et intégration à la sauvegarde manuelle. iPhone 13
// usage : node tools/tests/itineraires-parcours.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 await p.screenshot({path:'/tmp/wp0.png'});
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const cand=[];for(let i=0;i<g.SX.length;i+=Math.floor(g.SX.length/4000)||1)if(inW(i)&&g.cls[g.SE[i]]>=4)cand.push(i);
  const mid=cand[Math.floor(cand.length/2)],d=(i,j)=>Math.hypot((g.SX[i]-g.SX[j]),(g.SY[i]-g.SY[j]));
  const near=(k,r1,r2)=>{for(const i of cand)if(d(i,k)>r1&&d(i,k)<r2)return i;return -1};
  const A=mid,W1=near(A,700,1200),B=near(W1,700,1200);
  const go=async()=>{$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  const clickAt=ll=>{const pt=map.latLngToContainerPoint(ll),r=map.getContainer().getBoundingClientRect();map.getContainer().dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:r.left+pt.x,clientY:r.top+pt.y}))};
  ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  // 1. clic simple hors mode dessin : rien n'est ajouté
  clickAt(mk(W1));await sleep(200);o.noAdd=ITIN.WP.length===0;
  // 2. mode dessin : chaque appui ajoute un point
  const c=$('it-draw');c.checked=true;c.dispatchEvent(new Event('change'));o.drawOn=ITIN.drawMode();o.ban=($('it-bt')||{}).textContent;
  clickAt(mk(W1));await sleep(1500);o.drawn=ITIN.WP.length;o.stillOn=ITIN.drawMode();
  c.checked=false;c.dispatchEvent(new Event('change'));o.drawOff=!ITIN.drawMode();clickAt(mk(W1));await sleep(200);o.afterOff=ITIN.WP.length;
  // 3. appui long tactile
  const cont=map.getContainer(),rr=cont.getBoundingClientRect(),pt=map.latLngToContainerPoint(mk(near(B,500,1000)>=0?near(B,500,1000):W1));
  const mkT=(t)=>new TouchEvent(t,{bubbles:true,cancelable:true,touches:t==='touchend'?[]:[new Touch({identifier:1,target:cont,clientX:rr.left+pt.x,clientY:rr.top+pt.y})],changedTouches:[new Touch({identifier:1,target:cont,clientX:rr.left+pt.x,clientY:rr.top+pt.y})]});
  const n0=ITIN.WP.length;cont.dispatchEvent(mkT('touchstart'));await sleep(300);cont.dispatchEvent(mkT('touchend'));await sleep(500);o.shortTap=ITIN.WP.length===n0;
  cont.dispatchEvent(mkT('touchstart'));await sleep(1000);cont.dispatchEvent(mkT('touchend'));await sleep(2500);o.longAdded=ITIN.WP.length===n0+1;
  await go();
  // 4. enregistrement, rechargement, GPX, suppression
  const len0=ITIN.last.len;$('it-sname').value='Test parcours';$('it-save').click();await sleep(200);
  o.saved=ITIN.savedList().length;o.listed=$('it-slist').querySelectorAll('.it-wp').length;
  ITIN.WP.slice().forEach(()=>{});$('it-clr').click();await sleep(200);o.cleared=!ITIN.last;
  $('it-slist').querySelector('button[data-a=load]').click();await sleep(500);
  o.reloaded=!!ITIN.last&&Math.abs(ITIN.last.len-len0)<1&&ITIN.WP.length===n0+1;
  let gp='';const orig=URL.createObjectURL;URL.createObjectURL=f=>{f.text().then(t=>gp=t);return orig(f)};Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});
  const nav=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)o.dl=this.download;else nav.call(this)};
  $('it-slist').querySelector('button[data-a=gpx]').click();await sleep(400);o.gpx=/<trkpt /.test(gp)&&(gp.match(/<wpt /g)||[]).length===n0+1;
  // 5. sauvegarde manuelle : parcours inclus, restauration sans doublon, ancien format accepté
  const lst=ITIN_SAVED.list();const backup={app:'champi-coins',v:2,coins:[],parcours:lst};
  const file=new File([JSON.stringify(backup)],'b.json',{type:'application/json'});
  await bkRestore(file);o.dupMsg=$('bk-msg').textContent;o.afterDup=ITIN.savedList().length;
  ITIN_SAVED.merge([]);const del=$('it-slist').querySelector('button[data-a=del]');del.click();del.click();await sleep(100);o.deleted=ITIN.savedList().length===0;
  await bkRestore(file);o.restored=ITIN.savedList().length===1;o.restMsg=$('bk-msg').textContent;
  await bkRestore(new File([JSON.stringify({app:'champi-coins',v:1,coins:[]})],'old.json'));o.oldOk=!/Ce n'est pas/.test($('bk-msg').textContent)&&ITIN.savedList().length===1;
  return o});
 console.log('  ',JSON.stringify(r));
 ok(r.noAdd,'un simple appui n\'ajoute plus de point hors mode dessin');
 ok(r.drawOn&&/Mode dessin/.test(r.ban)&&r.drawn===1&&r.stillOn,'mode dessin : un appui = un point, le mode reste actif : '+r.ban);
 ok(r.drawOff&&r.afterOff===1,'mode dessin désactivé : plus d\'ajout');
 ok(r.shortTap&&r.longAdded,'appui court sans effet, appui long ajoute un point');
 ok(r.saved===1&&r.listed===1,'parcours enregistré et listé');
 ok(r.cleared&&r.reloaded,'rechargement du parcours enregistré (même longueur, points de passage restaurés)');
 ok(r.gpx&&/\.gpx$/.test(r.dl),'GPX du parcours enregistré : '+r.dl);
 ok(r.afterDup===1,'restauration d\'une sauvegarde : pas de doublon ('+r.dupMsg+')');
 ok(r.deleted&&r.restored,'suppression puis restauration depuis la sauvegarde : '+r.restMsg);
 ok(r.oldOk,'ancien fichier de sauvegarde sans parcours accepté');
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();process.exit(fail?1:0)})();
