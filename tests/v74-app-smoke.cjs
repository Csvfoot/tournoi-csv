// Smoke test d'intégration spectateur V7.4, sans aucune écriture.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data) => {
    if(err){res.writeHead(404);return res.end('Fichier absent');}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  });
});

function alternationFixture() {
  const day = '2027-06-05';
  const field = {id:'a',name:'Terrain Honneur'};
  const events = [
    {id:'principal',category:'U10',title:'Tournoi U10',date:day,published:true},
    {id:'u11',category:'U11',title:'Tournoi U11',date:day,published:true}
  ];
  const record = (pause, cat) => ({
    config:{name:'Tournoi '+cat,format:'groups_knockout',breakDuration:pause,startTime:'09:00',
      duration:10,pointsWin:3,pointsDraw:1,pointsLoss:0},
    teams:[{id:'a',name:'CSV '+cat,group:'Poule A',color:'#d00'},
      {id:'b',name:'Frontonas '+cat,group:'Poule A',color:'#db0'}],
    matches:[{id:'fixture',status:'pending',group:'Poule A',stage:'Journée 1',
      team1Id:'a',team2Id:'b',fieldId:field.id,fieldName:field.name,startTime:'10:00',endTime:'10:10'}]
  });
  return {
    'tournaments/cslv_multi_catalog_v1':{events,fields:[field]},
    'tournaments/cslv_main_data':record(2,'U10'),
    'tournaments/cslv_mt_u11':record(4,'U11'),
    'organizers/test-organizer':{active:true,role:'editor',email:'fixture@example.invalid'}
  };
}

function restFixture() {
  const docs = alternationFixture();
  const record = docs['tournaments/cslv_main_data'];
  const base = record.matches[0];
  record.teams = 'abcdef'.split('').map(id=>({id,name:'Équipe '+id.toUpperCase(),group:'Poule A',color:'#d00'}));
  record.matches = [
    ['a','b','09:00','09:10'], ['a','c','09:20','09:30'],
    ['e','f','10:10','10:20'], ['a','d','11:30','11:40']
  ].map(([team1Id,team2Id,startTime,endTime],i)=>({...base,id:'poule-'+i,team1Id,team2Id,startTime,endTime}));
  docs['tournaments/cslv_mt_u11'].matches = [];
  return docs;
}

function matchesPreviewFixture() {
  const docs = restFixture();
  const record = docs['tournaments/cslv_main_data'];
  record.matches[0].stage = 'Journée 4';
  record.matches[1].stage = 'Journée 2';
  const base = record.matches[0];
  const phases = [
    ['ko-qf','Quart de finale 1','13:00','13:10','Phase Finale Principale'],
    ['ko-semi','Demi-finale 1','14:00','14:10','Phase Finale Principale'],
    ['rank-7-8','Classement 7ème / 8ème place','14:30','14:40','Tournoi Classement'],
    ['rank-9-10','Classement 9ème / 10ème place','14:45','14:55','Tournoi Classement'],
    ['ko-bronze','Match pour la 3e place','15:15','15:25','Phase Finale Principale'],
    ['ko-final','Grande Finale','16:00','16:10','Phase Finale Principale']
  ];
  record.matches.push(...phases.map(([id,stage,startTime,endTime,group])=>
    ({...base,id,stage,startTime,endTime,group})));
  return docs;
}

function installPlanningFixture({docs: values, organizer}) {
    const subscribers = new Set();
    let docs = values;
    const copy = value => JSON.parse(JSON.stringify(value));
    const snapshot = key => ({exists:!!docs[key],data:()=>docs[key] && copy(docs[key]),metadata:{fromCache:false}});
    window.__planningSnapshots = values => {
      docs = values;
      for (const send of subscribers) send();
    };
    const db = {
      collection: name => ({doc: id => {
        const key = name+'/'+id;
        return {
          key, get:async()=>snapshot(key),
          onSnapshot:(options,callback)=>{
            const notify = typeof options==='function'?options:callback;
            const send = ()=>notify(snapshot(key));
            subscribers.add(send);
            queueMicrotask(()=>{if(subscribers.has(send))send();});
            return ()=>subscribers.delete(send);
          },
          set:async value=>window.__planningUpdate([[key,value]])
        };
      }}),
      runTransaction:async run=>{
        const pending=[];
        await run({get:async ref=>snapshot(ref.key),update:(ref,value)=>pending.push([ref.key,value])});
        await window.__planningUpdate(pending);
      }
    };
    const user = {uid:'test-organizer',email:'fixture@example.invalid',emailVerified:true,isAnonymous:false,
      reload:async()=>{},getIdToken:async()=>''};
    const auth = {
      currentUser: (organizer ?? location.pathname.includes('organisateur'))?user:{isAnonymous:true},
      onAuthStateChanged: callback=>{
        const timer=setTimeout(()=>callback(auth.currentUser),0);
        return ()=>clearTimeout(timer);
      }
    };
    if (!localStorage.getItem('csv.screen.v72.display.settings'))
      localStorage.setItem('csv.screen.v72.display.settings',JSON.stringify({views:['upcoming'],showPartners:false}));
    const firestore = Object.assign(()=>db,{FieldValue:{arrayUnion:(...values)=>values}});
    window.firebase = {
      apps:[],auth:()=>auth,firestore,
      app:()=>window.firebase.apps[0],
      initializeApp:(options,name)=>{const app={options,name,firestore:()=>db};window.firebase.apps.push(app);return app;}
    };
  }

async function verifyAlternation(browser, url) {
  const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const docs = alternationFixture();
  const day = docs['tournaments/cslv_multi_catalog_v1'].events[0].date;
  await context.route('**/*', async route => {
    const request = new URL(route.request().url());
    if (request.origin===url) return route.continue();
    const react = {
      '/ajax/libs/react/18.2.0/umd/react.production.min.js':'react',
      '/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js':'react-dom'
    }[request.pathname];
    if (react) return route.fulfill({contentType:'text/javascript',
      path:path.join(path.dirname(require.resolve(react)),'umd',request.pathname.split('/').pop())});
    return route.fulfill({body:'',contentType:'text/javascript'});
  });
  await context.exposeBinding('__planningUpdate', async (_, changes) => {
    for (const [key, value] of changes) docs[key]={...docs[key],...value};
    await Promise.all(context.pages().map(page => page.evaluate(values => {
      if (window.__planningSnapshots) window.__planningSnapshots(values);
    }, docs)));
  });
  await context.addInitScript(installPlanningFixture, {docs});
  async function expectText(page, value) {
    await page.waitForFunction(text=>document.body.innerText.includes(text),value,{timeout:15000,polling:100});
  }
  async function screenshot(page, name) {
    fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-artifacts','alternance-'+name+'.png')});
  }
  try {
    const organizer = await context.newPage();
    await organizer.goto(url+'/organisateur.html');
    await organizer.getByRole('button',{name:/Planning général/}).click({timeout:20000});
    const spectator = await context.newPage();
    await spectator.goto(url+'/spectateur.html?day='+day+'&tournament=u11');
    await spectator.getByRole('button',{name:'Entrer dans le tournoi'}).click({timeout:1200}).catch(()=>{});
    const tv = await context.newPage();
    tv.on('console',message=>{ if (message.type()==='error') console.error('TV:',message.text()); });
    tv.on('pageerror',error=>console.error('TV:',error.stack));
    await tv.goto(url+'/ecran.html?day='+day+'&view=upcoming');
    try { await expectText(tv,'10:00'); }
    catch (error) {
      console.error('TV:',await tv.locator('body').innerText(),await tv.evaluate(()=>window.CSV_SCREEN_TEST?.getUpcomingCounts()));
      throw error;
    }
    try { await expectText(spectator,'10:00'); }
    catch (error) {
      console.error('Spectateur:',(await spectator.locator('body').innerText()).slice(0,2000));
      throw error;
    }
    organizer.on('dialog',dialog=>dialog.accept());
    await organizer.getByRole('button',{name:'Prévisualiser',exact:true}).click();
    await expectText(organizer,'U10 2 min · U11 4 min');
    await organizer.getByRole('button',{name:"Confirmer l'alternance"}).click();
    await expectText(organizer,'Alternance appliquée');
    assert.equal(docs['tournaments/cslv_main_data'].matches[0].startTime,'09:00');
    assert.equal(docs['tournaments/cslv_mt_u11'].matches[0].startTime,'09:12');
    await expectText(organizer,'09:12');
    await screenshot(organizer,'planning');
    await organizer.getByRole('button',{name:/Saisie journée/}).click();
    await expectText(organizer,'09:12');
    await screenshot(organizer,'saisie-journee');
    await expectText(spectator,'09:12');
    await screenshot(spectator,'spectateur');
    await expectText(tv,'09:12');
    await screenshot(tv,'tv');
    await organizer.getByRole('button',{name:/Tournoi.*Préparation et résultats/}).click();
    await organizer.getByRole('button',{name:'U11',exact:true}).click();
    await organizer.getByRole('button',{name:/^📅 Matchs$/}).filter({visible:true}).click();
    await expectText(organizer,'09:12');
    await screenshot(organizer,'matchs');
    console.log('OK propagation planning général, Matchs, spectateur et écran TV sur les mêmes snapshots.');
    const settings = await context.newPage();
    await settings.goto(url+'/reglages-ecran.html');
    await settings.locator('#day').selectOption(day);
    await settings.locator('#categories').selectOption('U11');
    await settings.frameLocator('#preview').locator('#screen-category').filter({hasText:/^U11$/}).waitFor();
    await settings.getByRole('button',{name:'Enregistrer'}).click();
    await settings.locator('#status').getByText(/Réglages enregistrés/).waitFor();
    await tv.goto(url+'/ecran.html');
    await tv.locator('#screen-category').filter({hasText:/^U11$/}).waitFor();
    await expectText(tv,'09:12');
    console.log('OK choix de la journée, aperçu de la catégorie et application des réglages sur l’écran TV.');

  } finally { await context.close(); }
}


function writePlanningPreview({title, instructions, filename, docs}) {
  const read = name => fs.readFileSync(path.join(root,name),'utf8');
  const lib = name => fs.readFileSync(path.join(path.dirname(require.resolve(name)),
    'umd',name+'.production.min.js'),'utf8');
  const bundle = lib('react')+'\n'+lib('react-dom');
  const script = source => '<script>'+source.replace(/<\/script/gi,'<\\/script')+'</script>';
  const css = name => '<style>'+read(name)+'</style>';
  const modes = {organisateur:'organizer',spectateur:'spectator',ecran:'tv'};
  const frames = Object.fromEntries(Object.entries(modes).map(([page, mode]) => {
    let html=read(page+'.html');
    html=html.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>\s*/gi,'')
      .replace(/<link\b[^>]*>/gi,'')
      .replace('</head>',css(mode==='tv'?'ecran.css':'styles.css')+'</head>');
    for (const file of ['apple-touch-icon.png','icon-512.png','renard-galop.webp']) {
      const data=fs.readFileSync(path.join(root,file)).toString('base64');
      html=html.replaceAll('./'+file,'data:image/'+(file.endsWith('webp')?'webp':'png')+';base64,'+data);
    }
    const setup=script('parent.initializeFixture(window,'+JSON.stringify(mode)+','+
      installPlanningFixture.toString()+');');
    const app=script(mode==='tv'?read('ecran-config.js')+'\n'+read('ecran.js'):bundle+'\n'+read('app.js'));
    html=html.replace('</body>',setup+app+'</body>');
    return [page, Buffer.from(html).toString('base64')];
  }));
  const bootstrap = ((frames, docs) => {
    const targets = new Map();
    const values = new Map();
    const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),
      removeItem:key=>values.delete(key)};
    window.initializeFixture = (frame, mode, install) => {
      Object.defineProperty(frame,'localStorage',{value:storage});
      Object.defineProperty(frame,'sessionStorage',{value:storage});
      frame.history.replaceState=()=>{};
      frame.__planningUpdate=async changes=>{
        for (const [key,value] of changes) {
          const config=value.config?{...docs[key]?.config,...value.config}:docs[key]?.config;
          docs[key]={...docs[key],...value,...(config?{config}:{})};
        }
        for (const target of targets.values()) target.__planningSnapshots?.(docs);
      };
      targets.set(mode, frame);
      install.call(frame,{docs,organizer:mode==='organizer'});
    };
    for (const iframe of document.querySelectorAll('iframe')) {
      iframe.srcdoc=new TextDecoder().decode(Uint8Array.from(atob(frames[iframe.id]),ch=>ch.charCodeAt(0)));
    }
    for (const button of document.querySelectorAll('nav button')) {
      button.onclick=()=>{
        for (const iframe of document.querySelectorAll('iframe')) iframe.hidden=iframe.id!==button.dataset.screen;
        for (const tab of document.querySelectorAll('nav button')) tab.setAttribute('aria-pressed',String(tab===button));
      };
    }
  }).toString();
  const preview='<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>Tournoi CSV · '+title+'</title><style>'+
    'body{margin:0;background:#39101a;color:#fff4df;font:16px system-ui;display:flex;flex-direction:column;height:100dvh}'+
    'header{padding:12px 16px}p{margin:0 0 8px}button{font:inherit;background:#581728;color:#fff4df;border:1px solid #c68734;border-radius:8px;padding:.45rem .75rem;margin-right:6px}'+
    'button[aria-pressed=true]{background:#ffcc48;color:#39101a}iframe{width:100%;flex:1;min-height:0;border:0}</style>'+
    '<header><p><strong>'+title+' · Tournoi CSV</strong> · Données fictives</p>'+
    '<p>'+instructions+'</p>'+
    '<nav aria-label="Vues de test"><button data-screen="organisateur" aria-pressed="true">Organisateur</button>'+
    '<button data-screen="spectateur" aria-pressed="false">Spectateur</button>'+
    '<button data-screen="ecran" aria-pressed="false">Écran TV</button></nav></header>'+
    '<iframe id="organisateur" title="Organisateur"></iframe><iframe id="spectateur" title="Spectateur" hidden></iframe>'+
    '<iframe id="ecran" title="Écran TV" hidden></iframe>'+
    script('('+bootstrap+')('+JSON.stringify(frames)+','+JSON.stringify(docs)+');');
  fs.writeFileSync(path.join(root,'test-artifacts',filename),preview);
}

async function verifyAlternationPreview(browser) {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>console.error('Aperçu:',error.stack));
  try {
    const {pathToFileURL}=require('node:url');
    await page.goto(pathToFileURL(path.join(root,'test-artifacts','apercu-alternance.html')).href);
    const organizer=page.frameLocator('#organisateur');
    await organizer.getByRole('button',{name:/Planning général/}).click({timeout:15000});
    await organizer.getByRole('button',{name:'Prévisualiser',exact:true}).click();
    await organizer.getByRole('button',{name:"Confirmer l'alternance"}).click();
    await organizer.getByText(/Alternance appliquée/).waitFor();
    await page.getByRole('button',{name:'Écran TV',exact:true}).click();
    await page.frameLocator('#ecran').getByText('09:12',{exact:true}).waitFor({timeout:15000});
    console.log('OK aperçu HTML autonome ouvert depuis le disque, propagation jusqu’à l’écran TV.');
  } finally { await page.close(); }
}

async function verifyRestPreview(browser) {
  writePlanningPreview({ title:'Rééquilibrage des repos', filename:'apercu-reequilibrage.html', docs:restFixture(),
    instructions:'Ouvre Planning général, puis clique sur « Proposer un rééquilibrage des repos ».' });
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  try {
    const {pathToFileURL} = require('node:url');
    await page.goto(pathToFileURL(path.join(root,'test-artifacts','apercu-reequilibrage.html')).href);
    const organizer = page.frameLocator('#organisateur');
    await organizer.getByRole('button',{name:/Planning général/}).click({timeout:15000});
    const plan = organizer.getByRole('button',{name:'Proposer un rééquilibrage des repos'});
    const apply = organizer.getByRole('button',{name:'Appliquer les échanges'});
    await plan.click();
    await organizer.getByText(/Repos courts .*1 → 0/).waitFor({timeout:8000});
    await organizer.getByText(/Attentes longues .*1 → 0/).waitFor({timeout:8000});
    await organizer.getByRole('combobox',{name:'Longue attente'}).selectOption('75');
    await apply.waitFor({state:'hidden',timeout:8000});
    await plan.click();
    await page.screenshot({path:path.join(root,'test-artifacts','reequilibrage-repos.png')});
    await apply.click();
    await organizer.getByText(/Rééquilibrage appliqué/).waitFor({timeout:8000});
    await plan.click();
    await organizer.getByText(/Aucun échange de matchs de poule/).waitFor({timeout:8000});
    console.log('OK rééquilibrage : seuils pris en compte, aperçu, application et nouveau bilan.');
  } finally { await page.close(); }
}

async function verifyMatchesPreview(browser) {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  try {
    const {pathToFileURL} = require('node:url');
    await page.goto(pathToFileURL(path.join(root,'test-artifacts','apercu-matchs-poules-finales.html')).href);
    const organizer = page.frameLocator('#organisateur');
    await organizer.getByRole('button',{name:/^📅 Matchs$/}).filter({visible:true}).click({timeout:15000});
    const badges = organizer.locator('.csv-v74-calendar-label');
    await badges.first().waitFor();
    const labels = await badges.allTextContents();
    assert.equal(labels[0],'Poule A · Journée 1');
    assert(labels.indexOf('Classement · 9e–10e places') < labels.indexOf('Classement · 7e–8e places'));
    assert(labels.includes('Classement · 9e–10e places'));
    console.log('OK Matchs organisateur : journées et ordre des places.');
  } finally { await page.close(); }
}

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto('http://127.0.0.1:'+port+'/spectateur.html',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response.status(),200);
    let loaded=false;
    try { await page.waitForFunction(()=>{
      const x=document.body.innerText||'';
      return x.includes('Le football se vit ici.') ||
        x.includes('JOURNÉE DU TOURNOI') || x.includes('Aucune journée publiée');
    },{timeout:30000});loaded=true; }catch(e){}
    // L'application peut afficher immédiatement le squelette avant la réponse Firebase.
    // Observer son état stabilisé, sans écrire dans le projet Firebase.
    await page.waitForTimeout(12000);
    const text=(await page.locator('body').innerText()).slice(0,1200);
    const stillSyncing = text.includes('Synchronisation du programme') ||
        text.includes('Récupération des journées publiées');
    console.log('Synchronisation Firebase encore affichée après 12 s:', stillSyncing);
    fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-artifacts','v74-page-spectateur-reelle.png'),fullPage:true});
    console.log('Entrée HTML:',response.status(),'| Interface chargée:',loaded);
    console.log('Libellés visibles:',text.replace(/\s+/g,' ').slice(0,250));
    console.log('Erreurs JS:',errors.slice(0,8));
    assert(loaded,'La page spectateur complète n’a pas quitté son écran de chargement');
    assert(errors.filter(e=>/ReferenceError|TypeError|is not defined|Cannot read properties/.test(e)).length===0,
      'Erreur JavaScript dans la page complète : '+errors.join(' | '));
    await page.close();
    // Porte d'entrée organisateur sans compte : seul l'écran de connexion doit être accessible.
    const organizer = await browser.newPage({viewport:{width:390,height:844}});
    const organizerErrors=[];
    organizer.on('pageerror',e=>organizerErrors.push(e.message));
    const orgResponse=await organizer.goto('http://127.0.0.1:'+port+'/organisateur.html',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(orgResponse.status(),200);
    await organizer.getByRole('heading',{name:'Espace organisateur'}).waitFor({timeout:30000});
    assert.equal(await organizer.getByRole('textbox',{name:'Adresse e-mail'}).count(),1);
    assert.equal(await organizer.locator('input[type="password"]').count(),1);
    assert.equal(await organizer.getByText('Connexion Firebase organisateur obligatoire').count(),1);
    assert.equal(await organizer.getByRole('button',{name:'Se connecter'}).count(),1);
    await organizer.screenshot({path:path.join(root,'test-artifacts','v74-organisateur-acces.png'),fullPage:true});
    assert.equal(organizerErrors.filter(x=>/ReferenceError|TypeError|is not defined/.test(x)).length,0,
      'Erreur à la porte organisateur '+organizerErrors.join(';'));
    console.log('OK ouverture organisateur : authentification obligatoire, pas de saisie sans compte');
    await organizer.close();
    // Un lien forgé role=editor n'accorde pas de privilège sur le portail public.
    const forged=await browser.newPage({viewport:{width:390,height:844}});
    const view=await forged.goto('http://127.0.0.1:'+port+'/spectateur.html?role=editor',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(view.status(),200);
    await forged.getByRole('main',{name:'Accueil CSV Spectateur'}).waitFor({timeout:30000});
    assert.equal(await forged.getByRole('heading',{name:'Espace organisateur'}).count(),0);
    console.log('OK lien public role=editor : reste spectateur');
    await forged.close();
    await verifyAlternation(browser, 'http://127.0.0.1:'+port);
    writePlanningPreview({ title:'Test des pauses', filename:'apercu-alternance.html', docs:alternationFixture(),
      instructions:'Dans Organisateur, ouvre Planning général, puis prévisualise et confirme l’alternance.' });
    await verifyAlternationPreview(browser);
    await verifyRestPreview(browser);
    writePlanningPreview({ title:'Matchs, poules et phases finales', filename:'apercu-matchs-poules-finales.html', docs:matchesPreviewFixture(),
      instructions:'Dans Organisateur ou Spectateur, explore les matchs, les poules et les phases finales avec ces données fictives.' });
    await verifyMatchesPreview(browser);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
