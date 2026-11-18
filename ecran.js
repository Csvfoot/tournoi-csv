/* Tournoi CSV · Mode Écran Géant V7.2.3 — lecture seule.
   Aucune authentification organisateur et aucune opération d'écriture Firestore.
   L'affichage des journées publiées est un filtre d'interface ; les règles
   Firestore restent la seule frontière de sécurité pour les données. */
(() => {
  'use strict';
  const ROTATION_MS = 10000; // réglage initial validé; peut être ajusté localement
  const VIEWS = [
    { id: 'results', label: 'Derniers résultats', eyebrow: 'LES SCORES', caption: 'Rencontres terminées · actualisation automatique' },
    { id: 'standings', label: 'Classements', eyebrow: 'CLASSEMENT DES POULES', caption: 'Points · matchs joués · différence de buts' },
    { id: 'upcoming', label: 'Prochains matchs', eyebrow: 'À SUIVRE', caption: 'Prochains matchs U10 et U11 · horaires et terrains' },
    { id: 'finals', label: 'Phases finales', eyebrow: 'LE TABLEAU FINAL', caption: 'Qualifications · demi-finales · finale · matchs de classement' }
  ];
  // Configuration cliente déjà publique dans la V7.1 officielle (GitHub Pages).
  // Une clé API Firebase Web n'accorde pas de permission d'écriture.
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBYFQkkpiDs-7dkiTHZOIgKgh8cqonuYTk',
    projectId: 'tournoi-cs-la-verpilliere',
    authDomain: 'tournoi-cs-la-verpilliere.firebaseapp.com'
  };
  // Réglages LOCAUX de cet écran, jamais synchronisés vers Firestore.
  // En cas de contenu invalide, retour garanti aux valeurs validées par défaut.
  const SETTINGS_KEY = 'csv.screen.v72.display.settings';
  const SETTINGS_DEFAULTS = Object.freeze({
    rotationSeconds: 10, upcomingLimit: 2, categories: 'both',
    views: ['results', 'standings', 'upcoming', 'finals']
  });
  function validateSettings(input) {
    const source=input && typeof input==='object' && !Array.isArray(input)?input:{};
    const rotationSeconds=[5,10,15,20,30].includes(Number(source.rotationSeconds))?Number(source.rotationSeconds):10;
    const upcomingLimit=[1,2,3,4].includes(Number(source.upcomingLimit))?Number(source.upcomingLimit):2;
    const categories=['both','U10','U11'].includes(source.categories)?source.categories:'both';
    const allowed=SETTINGS_DEFAULTS.views;
    const views=Array.isArray(source.views)?allowed.filter(x=>source.views.includes(x)):allowed.slice();
    return {rotationSeconds,upcomingLimit,categories,views:views.length?views:allowed.slice()};
  }
  function readSettings(){
    try{return validateSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null'));}
    catch(e){return validateSettings(null);}
  }
  let screenSettings=readSettings();
  const rotationMs=()=>screenSettings.rotationSeconds*1000;
  const selectedCategories=()=>catParam?[catParam]:screenSettings.categories==='both'?['U10','U11']:[screenSettings.categories];
  const selectedViews=()=>VIEWS.filter(v=>screenSettings.views.includes(v.id));
  const ROOT = document.getElementById('screen-content');
  const STATUS = document.getElementById('screen-connection');
  const CATEGORY = document.getElementById('screen-category');
  const DAY = document.getElementById('screen-day');
  const DOTS = document.getElementById('screen-dots');
  const LABEL = document.getElementById('screen-slide-label');
  const COUNTDOWN = document.getElementById('screen-countdown');
  const PAUSE = document.getElementById('screen-pause');
  const CLOCK = document.getElementById('screen-clock');
  const FULLSCREEN = document.getElementById('screen-fullscreen');
  const params = new URLSearchParams(location.search);
  const isDemo = document.body.dataset.screenMode === 'demo' || params.get('demo') === '1';
  const dayParam = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : null;
  const catParam = /^(U10|U11)$/i.test(params.get('category') || '') ? params.get('category').toUpperCase() : null;
  const state = {
    events: [], records: new Map(), unsubscribe: [], slides: [], index: 0,
    paused: false, nextAt: Date.now() + rotationMs(), connected: false,
    fromCache: false, missing: new Set(), message: ''
  };
  const E = (tag, className = '', value = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== null && value !== undefined) node.textContent = String(value);
    return node;
  };
  const add = (parent, ...nodes) => { for (const node of nodes) if (node) parent.append(node); return parent; };
  const arr = v => Array.isArray(v) ? v : [];
  const safe = (v, fallback = '—') => v === null || v === undefined || String(v).trim() === '' ? fallback : String(v).slice(0,120);
  const readableDay = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Journée du tournoi';
    return new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  };
  const today = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const categoryOf = v => {
    const s = String(v || '').toUpperCase().replace(/\s|-/g,'');
    if (/^U10\b/.test(s) || s === 'U10') return 'U10';
    if (/^U11\b/.test(s) || s === 'U11') return 'U11';
    return null;
  };
  const matchMinutes = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? (+m[1])*60+(+m[2]) : -1; };
  const timeCompare = (a,b) => (matchMinutes(a.startTime) < 0 ? 9999 : matchMinutes(a.startTime)) - (matchMinutes(b.startTime) < 0 ? 9999 : matchMinutes(b.startTime)) || safe(a.id,'').localeCompare(safe(b.id,''));
  const statusDone = m => m && m.status === 'finished' && m.score1 != null && m.score2 != null && Number.isFinite(+m.score1) && Number.isFinite(+m.score2);
  const inProgress = m => ['live','in_progress','in-progress'].includes(m?.status);
  const phase = m => !String(m?.stage || '').startsWith('Journée') || ['Phase Finale Principale','Phase Finale','Tournoi Classement','Tournoi Consolante'].includes(m?.group);
  const groupNames = data => [...new Set([...arr(data.teams).map(t => String(t.group || 'Poule A')),...arr(data.matches).filter(m => !phase(m)).map(m => String(m.group || 'Poule A'))])].sort((a,b)=>a.localeCompare(b,'fr'));
  const color = team => /^#[0-9a-fA-F]{6}$/.test(team?.color || '') ? team.color : '#d33c4b';
  function connection(mode, message) {
    STATUS.className = 'live-indicator '+mode;
    STATUS.replaceChildren(E('span','signal-dot'),document.createTextNode(message));
  }
  function startHeader() {
    CLOCK.textContent = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    if (isDemo) {
      const banner = E('div','demo-ribbon','APERÇU FICTIF · AUCUNE DONNÉE RÉELLE');
      document.body.append(banner);
      connection('waiting','MODE DÉMO');
    }
  }
  function empty(title, message) {
    const wrap = E('div','empty-state');
    add(wrap,E('div','empty-icon','⚽'),E('h1','',title),E('p','',message));
    return wrap;
  }
  const section = (view, desc = '') => {
    const header=E('div','section-head');
    const lead=E('div');
    add(lead,E('div','section-overline',view.eyebrow),E('h1','section-title',view.label));
    add(header,lead,E('div','section-description',desc || view.caption));
    return header;
  };
  function teamName(id, data, placeholder) {
    const team=arr(data.teams).find(t=>t.id===id);
    return team ? safe(team.name,'Équipe') : safe(placeholder,'À déterminer');
  }
  // V7.3 : logo facultatif des équipes, sans changement du modèle Firebase.
  // Ne jamais insérer directement une URL dans du HTML : l'image est créée via le DOM.
  function teamLogo(team) {
    if (!team || typeof team.logoUrl !== 'string') return '';
    const src = team.logoUrl.trim();
    if (!src || src.length > 1500) return '';
    try {
      const u = new URL(src, location.href);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname))) return '';
      if (src.startsWith('/') && !src.startsWith('//')) return '';
      if (!/^https:\/\//i.test(src) && !/^\.\/logos\/[a-zA-Z0-9_./-]+\.(?:png|webp|jpg|jpeg)$/i.test(src)) return '';
      return u.href;
    } catch (_) { return ''; }
  }
  function teamBadge(team) {
    const badge = E('span', 'csv-team-badge');
    const dot = E('span', 'team-dot');
    dot.style.setProperty('--team-color', color(team));
    badge.append(dot);
    const logo = teamLogo(team);
    if (logo) {
      const img = E('img', 'csv-team-logo');
      img.src = logo; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => img.remove(), { once: true });
      badge.append(img);
    }
    return badge;
  }
  function teamNameCell(team) {
    const cell = E('span', 'standings-name csv-team-name');
    cell.append(teamBadge(team), E('span', 'csv-team-text', safe(team?.name)));
    return cell;
  }
  function makeMatchCard(m, data, kind) {
    const wrap=E('article','match-card');
    const meta=E('div','match-meta');
    const left=E('div','',safe(m.startTime,'Heure à venir'));
    const field=E('div','field',safe(m.fieldName,m.group || 'Terrain à déterminer'));
    add(meta,left,field);
    const mid=E('div','match-main');
    const teamA=arr(data.teams).find(t=>t.id===m.team1Id);
    const teamB=arr(data.teams).find(t=>t.id===m.team2Id);
    const a=E('div','team home');
    add(a,teamBadge(teamA),E('span','',teamName(m.team1Id,data,m.placeholder1)));
    const b=E('div','team away');
    add(b,E('span','',teamName(m.team2Id,data,m.placeholder2)),teamBadge(teamB));
    const scored = statusDone(m) || (inProgress(m) && m.score1 != null && m.score2 != null);
    const scoreboard=E('div','score'+(scored?'':' pending'),scored ? `${m.score1} – ${m.score2}` : 'VS');
    add(mid,a,scoreboard,b);
    const bottom=E('div','match-bottom');
    add(bottom,E('span','',safe(m.stage,m.group || 'Match')),
      E('span','state-chip'+(statusDone(m)?'':' pending'),statusDone(m)?'TERMINÉ':inProgress(m)?'EN COURS':kind==='upcoming'?'À VENIR':'PROGRAMMÉ'));
    add(wrap,meta,mid,bottom);
    return wrap;
  }
  function renderMatches(view, data, matches, kind, emptyText, pageIndex = 0, pageCount = 1) {
    ROOT.replaceChildren();
    add(ROOT,section(view,pageCount>1?`${view.caption} · page ${pageIndex+1}/${pageCount}`:view.caption));
    if (!matches.length) {ROOT.append(empty('Aucune rencontre à afficher',emptyText));return;}
    const grid=E('div',kind==='upcoming'?'fixtures-grid':kind==='finals'?'finals-grid':'results-grid');
    for (const m of matches) grid.append(makeMatchCard(m,data,kind));
    ROOT.append(grid);
  }
  function rankGroups(data) {
    const groups=groupNames(data),rules=data.config || {},teams=arr(data.teams),matches=arr(data.matches);
    return groups.map(group => {
      const rows=teams.filter(t=>String(t.group||'Poule A')===group).map(t=>({team:t,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,points:0}));
      const byId=new Map(rows.map(r=>[r.team.id,r]));
      for(const m of matches) {
        if(!String(m.stage||'').startsWith('Journée')||!statusDone(m))continue;
        const x=Number(m.score1),y=Number(m.score2);
        for(const [id,gf,ga] of [[m.team1Id,x,y],[m.team2Id,y,x]]){
          const r=byId.get(id);if(!r)continue;
          r.played++;r.gf+=gf;r.ga+=ga;
          if(gf>ga){r.won++;r.points+=Number(rules.pointsWin??3);}
          else if(gf<ga){r.lost++;r.points+=Number(rules.pointsLoss??0);}
          else {r.drawn++;r.points+=Number(rules.pointsDraw??1);}
        }
      }
      rows.forEach(r=>{r.gd=r.gf-r.ga;});
      rows.sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||safe(a.team.name).localeCompare(safe(b.team.name),'fr'));
      return {name:group,rows};
    });
  }
  function renderStandings(view,data,groups,pageIndex,pageCount) {
    ROOT.replaceChildren();
    ROOT.append(section(view,pageCount>1?`${view.caption} · page ${pageIndex+1}/${pageCount}`:view.caption));
    if (!groups.length||groups.every(g=>g.rows.length===0)) {ROOT.append(empty('Classement à venir','Les équipes apparaîtront dès leur inscription.'));return;}
    const grid=E('div','standings-grid'+(groups.length<=2?' pools-few':''));
    for(const group of groups){
      const card=E('section','pool-card');
      const hdr=E('div','pool-title');add(hdr,E('span','',group.name),E('span','pool-caption',`${group.rows.length} équipes`));card.append(hdr);
      const columns=E('div','standings-header');
      for(const t of ['#','Équipe','MJ','BP','DB','PTS']) columns.append(E('span',t==='#'?'rank':t==='Équipe'?'standings-name':'stat',t));
      card.append(columns);
      group.rows.slice(0,6).forEach((r,i)=>{
        const row=E('div','standings-row');
        add(row,E('span','rank'+(i<2?' lead':''),i+1), teamNameCell(r.team),
          E('span','stat',r.played),E('span','stat',r.gf),E('span','stat',r.gd>0?'+'+r.gd:r.gd),E('span','stat points',r.points));
        card.append(row);
      });
      grid.append(card);
    }
    ROOT.append(grid);
  }

  // Sur téléviseur, les deux catégories sont présentées simultanément sur
  // les écrans Classements et Prochains matchs, sans modifier les résultats.
  function compactPoolCard(group) {
    const card=E('section','pool-card compact-pool');
    const hdr=E('div','pool-title');
    add(hdr,E('span','',group.name),E('span','pool-caption',`${group.rows.length} équipes`));
    card.append(hdr);
    const columns=E('div','standings-header');
    for(const t of ['#','Équipe','MJ','BP','DB','PTS'])
      columns.append(E('span',t==='#'?'rank':t==='Équipe'?'standings-name':'stat',t));
    card.append(columns);
    for(const [i,r] of group.rows.entries()) {
      const row=E('div','standings-row');
      add(row,E('span','rank'+(i<2?' lead':''),i+1),teamNameCell(r.team),
        E('span','stat',r.played),E('span','stat',r.gf),
        E('span','stat',r.gd>0?'+'+r.gd:r.gd),E('span','stat points',r.points));
      card.append(row);
    }
    return card;
  }
  function renderParallel(view,panels,pageIndex,pageCount) {
    ROOT.replaceChildren();
    const label=panels.map(p=>p.category).join(' - ');
    const detail=`${label} sur une même page`+(pageCount>1?` · page ${pageIndex+1}/${pageCount}`:'');
    ROOT.append(section(view,detail));
    const layout=E('div','parallel-layout'+(panels.length===1?' single-category':''));
    for(const panel of panels){
      const col=E('section','category-panel '+panel.category.toLowerCase());
      const header=E('div','category-panel-head');
      add(header,E('div','category-emblem',panel.category),
        E('div','category-subtitle',view.id==='standings'?'CLASSEMENTS DES POULES':'PROCHAINS MATCHS'));
      col.append(header);
      const body=E('div','category-panel-content '+(view.id==='standings'?'parallel-pools':'parallel-fixtures'));
      if(!panel.event){
        body.append(E('div','parallel-empty',`Aucun tournoi ${panel.category} publié pour cette journée.`));
      }else if(!panel.items.length){
        const reason=!panel.pageAvailable?'Pas d’autres rencontres sur cette page.':
          view.id==='standings'?'Poules en cours de préparation.':'Aucun match de poule à venir.';
        body.append(E('div','parallel-empty',reason));
      }else if(view.id==='standings'){
        for(const group of panel.items)body.append(compactPoolCard(group));
      }else{
        for(const match of panel.items)body.append(makeMatchCard(match,panel.data,'upcoming'));
      }
      col.append(body);layout.append(col);
    }
    ROOT.append(layout);
  }

  function chunk(values,count) { const out=[];for(let i=0;i<values.length;i+=count)out.push(values.slice(i,i+count));return out.length?out:[[]]; }
  function createSlides(events,records) {
    const slides=[];
    const categories=selectedCategories();
    for(const view of selectedViews()){
      if(view.id==='standings'||view.id==='upcoming'){
        const parts=categories.map(category=>{
          const event=events.find(e=>categoryOf(e.category)===category);
          const data=event?(records.get(event.id)||{teams:[],matches:[],config:{}}):{teams:[],matches:[],config:{}};
          const items=view.id==='standings'?rankGroups(data):
            arr(data.matches).filter(m=>!statusDone(m)&&!phase(m)).sort(timeCompare).slice(0,screenSettings.upcomingLimit);
          // Une seule page « Prochains matchs » : 2 par catégorie par défaut, configurable sur cet appareil.
          // Les autres matchs restent dans Firestore et ne sont pas affichés ici.
          return {category,event,data,pages:view.id==='upcoming'?[items]:chunk(items,2)};
        });
        const pageCount=Math.max(1,...parts.map(p=>p.pages.length));
        for(let page=0;page<pageCount;page++){
          slides.push({view,dual:true,
            panels:parts.map(p=>({category:p.category,event:p.event,data:p.data,
              items:p.pages[page]||[],pageAvailable:page<p.pages.length})),
            page,pageCount});
        }
        continue;
      }
      for(const event of events){
        const data=records.get(event.id)||{teams:[],matches:[],config:{}};
        const matches=arr(data.matches);
        if(view.id==='results'){
          const items=matches.filter(statusDone).sort((a,b)=>timeCompare(b,a)).slice(0,6);
          slides.push({view,event,data,items,page:0,pageCount:1});
        }else if(view.id==='finals'){
          const finals=matches.filter(phase).sort(timeCompare);
          const pages=chunk(finals,6);
          pages.forEach((items,page)=>slides.push({view,event,data,items,page,pageCount:pages.length}));
        }
      }
    }
    return slides;
  }
  function currentSlide() {
    if(!state.slides.length){
      CATEGORY.textContent=selectedCategories().join(' - ');
      LABEL.textContent='Résultats · Classements · Prochains matchs · Phases finales';
      return;
    }
    state.index=Math.max(0,Math.min(state.index,state.slides.length-1));
    const slide=state.slides[state.index];
    if(slide.dual){
      CATEGORY.textContent=slide.panels.map(p=>p.category).join(' - ');
      const active=slide.panels.find(p=>p.event);
      if(active)DAY.textContent=readableDay(active.event.date);
      LABEL.textContent=`${slide.view.label} · ${CATEGORY.textContent}`;
      renderParallel(slide.view,slide.panels,slide.page,slide.pageCount);
    }else{
      CATEGORY.textContent=categoryOf(slide.event.category)||'U10 - U11';
      DAY.textContent=readableDay(slide.event.date);
      LABEL.textContent=`${slide.view.label} · ${CATEGORY.textContent}`;
      renderMatches(slide.view,slide.data,slide.items,slide.view.id,
        slide.view.id==='results'?'Les premiers scores s’afficheront dès qu’un match sera terminé.':
          'Les phases finales apparaîtront après génération du tableau.',
        slide.page,slide.pageCount);
    }
    DOTS.replaceChildren();
    state.slides.forEach((s,i)=>{
      const dot=E('span','progress-dot'+(i===state.index?' active':''));
      dot.title=s.dual?`${s.view.label} · U10 - U11`:`${s.view.label} · ${categoryOf(s.event.category)||''}`;
      DOTS.append(dot);
    });
  }
  function slideKey(s){return s?`${s.view.id}|${s.dual?'dual':s.event.id}|${s.page}`:'';}
  function resetSlides() {
    const previous=slideKey(state.slides[state.index]);
    const slides=createSlides(state.events,state.records);
    state.slides=slides;
    state.index=Math.max(0,slides.findIndex(s=>slideKey(s)===previous));
    if(!slides.length){
      ROOT.replaceChildren(empty('Aucune catégorie publiée','Le mode Écran Géant attend des catégories U10 ou U11 publiées.'));
      DOTS.replaceChildren();
    }else currentSlide();
  }
  function chooseEvents(all) {
    const eligible=arr(all).filter(e=>e && typeof e.id==='string' && /^[a-z0-9_-]{1,70}$/.test(e.id) &&
      e.published!==false && /^\d{4}-\d{2}-\d{2}$/.test(e.date||'') && categoryOf(e.category) && selectedCategories().includes(categoryOf(e.category)));
    const dates=[...new Set(eligible.map(e=>e.date))].sort();
    const picked=dayParam && dates.includes(dayParam) ? dayParam : dates.find(d=>d>=today())||dates[dates.length-1];
    return eligible.filter(e=>e.date===picked).sort((a,b)=>(categoryOf(a.category)||'').localeCompare(categoryOf(b.category)||''));
  }
  function unsubscribeRecords() {for(const u of state.unsubscribe)try{u();}catch(e){}state.unsubscribe=[];}
  function useCatalogSnapshot(snap,db) {
    if(!snap.exists)throw new Error('Catalogue non disponible dans Firebase.');
    const raw=snap.data()||{};
    if(!Array.isArray(raw.events))throw new Error('Catégories du tournoi indisponibles.');
    const events=chooseEvents(raw.events);
    const ids=events.map(e=>e.id).join('|');
    const before=state.events.map(e=>e.id).join('|');
    state.events=events;
    state.fromCache=Boolean(snap.metadata?.fromCache);
    if(before!==ids){
      unsubscribeRecords();
      state.records=new Map();
      state.missing=new Set(events.map(e=>e.id));
      for(const event of events){
        const docId=event.id==='principal'?'cslv_main_data':'cslv_mt_'+event.id;
        const unsub=db.collection('tournaments').doc(docId).onSnapshot({includeMetadataChanges:true},
          doc=>{
            if(doc.exists) {
              const d=doc.data()||{};
              state.records.set(event.id,{teams:arr(d.teams),matches:arr(d.matches),config:d.config||{}});
            } else state.records.set(event.id,{teams:[],matches:[],config:{}});
            state.missing.delete(event.id);
            state.fromCache=Boolean(doc.metadata?.fromCache);
            state.connected=state.missing.size===0&&!state.fromCache;
            connection(state.connected?'':'waiting',state.connected?'EN DIRECT':'ACTUALISATION…');
            resetSlides();
          },err=>{state.connected=false;connection('error','CONNEXION PERDUE');console.error('Lecture catégorie indisponible',err);});
        state.unsubscribe.push(unsub);
      }
      if(!events.length){state.connected=true;connection('','EN DIRECT');resetSlides();}
    }else{
      state.connected=!snap.metadata?.fromCache && state.missing.size===0;
      connection(state.connected?'':'waiting',state.connected?'EN DIRECT':'ACTUALISATION…');
      resetSlides();
    }
  }
  async function startFirebase(){
    try{
      if(typeof firebase==='undefined' || typeof firebase.firestore!=='function')throw new Error('Bibliothèques Firebase indisponibles.');
      const app=firebase.apps.find(a=>a.name==='csv-ecran-geant')||firebase.initializeApp(FIREBASE_CONFIG,'csv-ecran-geant');
      if(app.options.projectId!=='tournoi-cs-la-verpilliere')throw new Error('Projet Firebase inattendu.');
      const db=app.firestore();
      db.collection('tournaments').doc('cslv_multi_catalog_v1').onSnapshot({includeMetadataChanges:true},
        snap=>{try{useCatalogSnapshot(snap,db);}catch(e){state.connected=false;connection('error','DONNÉES INDISPONIBLES');ROOT.replaceChildren(empty('Programme indisponible',e.message));}},
        err=>{state.connected=false;connection('error','CONNEXION PERDUE');ROOT.replaceChildren(empty('Connexion impossible','Vérifiez la connexion Internet et les autorisations de lecture Firestore.'));console.error('Lecture catalogue indisponible',err);});
    }catch(err){connection('error','HORS LIGNE');ROOT.replaceChildren(empty('Connexion impossible',err.message||'Vérifiez Internet puis actualisez la page.'));}
  }
  function demoFixtures(cat){
    const n=cat==='U10'?1:11;
    const team=(id,name,group,color)=>({id:'t'+id,name,group,color});
    const names=cat==='U10'
      ? ['CSV La Verpillière','FC Bourgoin','AS Saint-Quentin','US Villefontaine','ES Frontonas','FC L’Isle-d’Abeau','O. Nord-Isère','FC Vallée du Guiers']
      : ['Entente Frontonas','AS Pusignan','FC Genas','CS La Verpillière','US Colombier','FC Heyrieux','Stade Nord-Isère','ES Saint-Quentin'];
    const colors=['#de3e49','#edbc40','#4da2ed','#8a6bd2','#60c3a7','#ef7b50','#fbcd65','#60ade1'];
    const teams=names.map((name,i)=>team(n+i,name,i<4?'Poule A':'Poule B',colors[i]));
    const m=(id,a,b,group,stage,startTime,fieldName,s1=null,s2=null)=>({id,team1Id:teams[a]?.id||null,team2Id:teams[b]?.id||null,group,stage,startTime,fieldName,score1:s1,score2:s2,status:s1===null?'pending':'finished'});
    const fA=cat==='U10'?'Terrain Honneur':'Terrain 3';
    const fB=cat==='U10'?'Terrain Annexe':'Terrain 4';
    const u11=cat==='U11';
    const matches=[m('m1',0,1,'Poule A','Journée 1','09:13',fA,u11?1:2,u11?0:1),m('m2',2,3,'Poule A','Journée 1','09:43',fB,u11?3:0,u11?1:0),m('m3',4,5,'Poule B','Journée 1','10:13',fA,u11?1:3,u11?2:1),m('m4',6,7,'Poule B','Journée 1','10:43',fB,u11?2:1,u11?2:0),m('m5',0,2,'Poule A','Journée 2','11:13',fA,u11?2:2,u11?2:0),m('m6',1,3,'Poule A','Journée 2','11:43',fB,u11?0:1,u11?2:1),m('m7',4,6,'Poule B','Journée 2','12:13',fA),m('m8',5,7,'Poule B','Journée 2','12:43',fB),m('m9',0,3,'Poule A','Journée 3','13:13',fA),m('m10',1,2,'Poule A','Journée 3','13:43',fB),m('semi1',0,4,'Phase Finale Principale','Demi-Finale 1','15:13',fA),m('semi2',2,5,'Phase Finale Principale','Demi-Finale 2','15:43',fB),m('fin',null,null,'Phase Finale Principale','Grande Finale','16:43',fA)];
    matches[matches.length-1].placeholder1='Vainqueur demi-finale 1';
    matches[matches.length-1].placeholder2='Vainqueur demi-finale 2';
    return {teams,matches,config:{pointsWin:3,pointsDraw:1,pointsLoss:0}};
  }
  function startDemo(){
    const demoDate='2027-06-05';
    const events=[{id:'demo-u10',category:'U10',date:demoDate,published:true},{id:'demo-u11',category:'U11',date:demoDate,published:true}].filter(e=>selectedCategories().includes(categoryOf(e.category)));
    state.events=events;
    for(const event of events)state.records.set(event.id,demoFixtures(event.category));
    state.connected=true;
    resetSlides();
    const chosen=params.get('view');
    if(['standings','upcoming','results','finals'].includes(chosen)){
      const idx=state.slides.findIndex(s=>s.view.id===chosen);
      if(idx>=0){state.index=idx;currentSlide();}
    }
    const nav=E('nav','demo-switcher');
    nav.setAttribute('aria-label','Navigation de la démonstration');
    for(const view of selectedViews()){
      const b=E('button','demo-link',view.id==='standings'?'Poules U10 - U11':view.id==='upcoming'?'Matchs U10 - U11':view.label);
      b.type='button';
      b.addEventListener('click',()=>{
        const i=state.slides.findIndex(s=>s.view.id===view.id);
        if(i>=0){state.index=i;state.nextAt=Date.now()+rotationMs();currentSlide();}
      });
      nav.append(b);
    }
    document.body.append(nav);
  }
  function step(n){if(!state.slides.length)return;state.index=(state.index+n+state.slides.length)%state.slides.length;currentSlide();state.nextAt=Date.now()+rotationMs();}
  function togglePause(){state.paused=!state.paused;PAUSE.textContent=state.paused?'▶':'Ⅱ';PAUSE.setAttribute('aria-label',state.paused?'Reprendre le défilement':'Mettre en pause le défilement');state.nextAt=Date.now()+rotationMs();}
  function tick(){
    CLOCK.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    if(!state.paused && state.slides.length && Date.now()>=state.nextAt)step(1);
    COUNTDOWN.textContent=state.paused?'PAUSE':Math.max(0,Math.ceil((state.nextAt-Date.now())/1000))+' s';
  }
  PAUSE.addEventListener('click',togglePause);
  FULLSCREEN.addEventListener('click',()=>{ if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});});
  document.addEventListener('keydown',ev=>{
    if(ev.target instanceof HTMLElement && ['INPUT','TEXTAREA'].includes(ev.target.tagName))return;
    if(ev.code==='Space'){ev.preventDefault();togglePause();}
    else if(ev.key==='ArrowRight'){step(1);}else if(ev.key==='ArrowLeft'){step(-1);}
    else if(ev.key.toLowerCase()==='f'){FULLSCREEN.click();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)state.nextAt=Date.now()+rotationMs();});
  startHeader();tick();setInterval(tick,1000);
  if(isDemo)startDemo();else startFirebase();
  // API limitée aux tests automatisés : lecture de l'état, aucune écriture.
  window.CSV_SCREEN_TEST={
    getSettings:()=>JSON.parse(JSON.stringify(screenSettings)),
    getSlides:()=>state.slides.map(s=>({view:s.view.id,category:s.dual?s.panels.map(p=>p.category).join(' - '):s.event.category,page:s.page})),
    getUpcomingCounts:()=>state.slides.filter(s=>s.view.id==='upcoming'&&s.dual).flatMap(s=>s.panels.map(p=>({category:p.category,count:p.items.length}))),
    getMode:()=>isDemo?'DEMO':'LECTURE FIREBASE',
    getCountdown:()=>COUNTDOWN.textContent,
    next:()=>step(1), pause:()=>togglePause(),
    goto:(id)=>{const index=state.slides.findIndex(s=>s.view.id===id);if(index>=0){state.index=index;currentSlide();return true;}return false;}
  };
  window.addEventListener('storage',e=>{
    if(e.key===SETTINGS_KEY){screenSettings=readSettings();state.nextAt=Date.now()+rotationMs();resetSlides();}
  });
})();
