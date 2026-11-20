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
    { id: 'upcoming', label: 'Prochains matchs', eyebrow: 'À SUIVRE', caption: 'Prochains matchs · horaires et terrains' },
    { id: 'finals', label: 'Phases finales', eyebrow: 'LE TABLEAU FINAL', caption: 'Qualifications · demi-finales · finale · matchs de classement' },
    { id: 'partners', label: 'Partenaires', eyebrow: 'MERCI À NOS PARTENAIRES', caption: 'Ils soutiennent le tournoi' }
  ];
  const {SETTINGS_KEY,validateSettings,readSettings,readableDay,categoryOf,isDay,
    publishedEvents,daysFor,defaultDay,connect,demoEvents}=window.CSV_TV_CONFIG;
  const params=new URLSearchParams(location.search);
  const preview=readPreviewSettings(params.get('configuration'));
  function readPreviewSettings(raw) {
    if(!raw)return null;
    try{return validateSettings(JSON.parse(raw));}catch{return null;}
  }
  let screenSettings=preview||readSettings();
  const rotationMs=()=>screenSettings.rotationSeconds*1000;
  const selectedCategories=()=>[...new Set(state.events.map(e=>categoryOf(e.category)))];
  const selectedViews=()=>VIEWS.filter(v=>v.id==='partners'?screenSettings.showPartners:screenSettings.views.includes(v.id));
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
  let requestedView = params.get('view');
  const isDemo = document.body.dataset.screenMode === 'demo' || params.get('demo') === '1';
  const dayParam = isDay(params.get('day')) ? params.get('day') : '';
  const catParam = categoryOf(params.get('category'));
  const eventParam = params.get('event');
  const fullDay = params.get('categories') === 'day' || Boolean(dayParam && !catParam && !eventParam);
  const chosenDay=()=>dayParam||(eventParam||catParam||fullDay?'':screenSettings.day);
  let catalogueSnapshot, catalogueDb;
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
  function safeLogoUrl(value) {
    if(typeof value!=='string'||value.length>24000)return '';
    if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value))return value;
    try { const url=new URL(value);return url.protocol==='https:'?url.href:''; }
    catch { return ''; }
  }
  function logoImage(src, className, onError) {
    const image=E('img',className);
    image.alt='';
    image.referrerPolicy='no-referrer';
    image.addEventListener('error',onError,{once:true});
    image.src=src;
    return image;
  }
  function teamMark(team) {
    const fallback=E('span','team-dot');
    fallback.style.setProperty('--team-color',color(team));
    const src=safeLogoUrl(team?.logoUrl);
    if(!src)return fallback;
    const image=logoImage(src,'tv-team-logo',()=>image.replaceWith(fallback));
    return image;
  }
  function standingsName(team) {
    const node=E('span','standings-name');
    return add(node,teamMark(team),E('span','standings-club',safe(team.name)));
  }
  function renderPartners(view,partners,page,pageCount) {
    ROOT.replaceChildren(section(view,pageCount>1?`${view.caption} · page ${page+1}/${pageCount}`:view.caption));
    const grid=E('div','tv-partner-grid');
    grid.style.setProperty('--partner-columns',Math.min(3,partners.length));
    for(const partner of partners) {
      const card=E('article','tv-partner');
      const src=safeLogoUrl(partner.logoUrl);
      if(src) {
        const image=logoImage(src,'tv-partner-logo',()=>image.remove());
        card.append(image);
      }
      card.append(E('h2','',safe(partner.name)));
      grid.append(card);
    }
    ROOT.append(grid);
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
    add(a,teamMark(teamA),E('span','',teamName(m.team1Id,data,m.placeholder1)));
    const b=E('div','team away');
    add(b,E('span','',teamName(m.team2Id,data,m.placeholder2)),teamMark(teamB));
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
        add(row,E('span','rank'+(i<2?' lead':''),i+1), standingsName(r.team),
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
      add(row,E('span','rank'+(i<2?' lead':''),i+1),standingsName(r.team),
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
    if (!events.length) return [];
    const slides=[];
    for(const view of selectedViews()){
      if(view.id==='standings'||view.id==='upcoming'){
        const entries=events.map(event=>({category:categoryOf(event.category),event}));
        for(const batch of chunk(entries,2)){
          const parts=batch.map(({category,event})=>{
            const data=event?(records.get(event.id)||{teams:[],matches:[],config:{}}):{teams:[],matches:[],config:{}};
            const items=view.id==='standings'?rankGroups(data):
              arr(data.matches).filter(m=>!statusDone(m)&&!phase(m)).sort(timeCompare).slice(0,screenSettings.upcomingLimit);
            return {category,event,data,pages:view.id==='upcoming'?[items]:chunk(items,2)};
          });
          const pageCount=Math.max(1,...parts.map(p=>p.pages.length));
          for(let page=0;page<pageCount;page++){
            slides.push({view,dual:true,
              panels:parts.map(p=>({category:p.category,event:p.event,data:p.data,
                items:p.pages[page]||[],pageAvailable:page<p.pages.length})),
              page,pageCount});
          }
        }
        continue;
      }
      for(const event of events){
        const data=records.get(event.id)||{teams:[],matches:[],config:{}};
        const matches=arr(data.matches);
        if(view.id==='results'){
          const items=matches.filter(statusDone).sort((a,b)=>timeCompare(b,a)).slice(0,6);
          slides.push({view,event,data,items,page:0,pageCount:1});
        }else if(view.id==='partners'){
          const partners=arr(data.config?.sponsors).filter(p=>typeof p?.name==='string'&&p.name.trim());
          if(partners.length) {
            const pages=chunk(partners,6);
            pages.forEach((items,page)=>slides.push({view,event,data,items,page,pageCount:pages.length}));
          }
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
      CATEGORY.textContent=categoryOf(slide.event.category)||'Tournoi';
      DAY.textContent=readableDay(slide.event.date);
      LABEL.textContent=`${slide.view.label} · ${CATEGORY.textContent}`;
      if(slide.view.id==='partners')renderPartners(slide.view,slide.items,slide.page,slide.pageCount);
      else renderMatches(slide.view,slide.data,slide.items,slide.view.id,
        slide.view.id==='results'?'Les premiers scores s’afficheront dès qu’un match sera terminé.':
          'Les phases finales apparaîtront après génération du tableau.',
        slide.page,slide.pageCount);
    }
    DOTS.replaceChildren();
    state.slides.forEach((s,i)=>{
      const dot=E('span','progress-dot'+(i===state.index?' active':''));
      dot.title=s.dual?`${s.view.label} · ${s.panels.map(p=>p.category).join(' - ')}`:`${s.view.label} · ${categoryOf(s.event.category)||''}`;
      DOTS.append(dot);
    });
  }
  function slideKey(s){return s?`${s.view.id}|${s.dual?s.panels.map(p=>p.event?.id || p.category).join(','):s.event.id}|${s.page}`:'';}
  function resetSlides() {
    const previous=slideKey(state.slides[state.index]);
    const slides=createSlides(state.events,state.records);
    state.slides=slides;
    const requested=slides.findIndex(s=>s.view.id===requestedView);
    state.index=requested>=0?requested:Math.max(0,slides.findIndex(s=>slideKey(s)===previous));
    if(requested>=0){requestedView=null;state.nextAt=Date.now()+rotationMs();}
    if(!slides.length){
      CATEGORY.textContent='Tournoi';
      DAY.textContent=chosenDay() ? readableDay(chosenDay()) : 'Journée du tournoi';
      ROOT.replaceChildren(empty('Aucune catégorie publiée', chosenDay()
        ? 'Aucun tournoi correspondant aux réglages pour cette journée.'
        : 'Les catégories apparaîtront après publication.'));
      DOTS.replaceChildren();
    }else currentSlide();
  }
  function chooseEvents(all) {
    const published=publishedEvents(all);
    const category=catParam||(fullDay?'both':screenSettings.categories);
    const eligible=published.filter(event=>eventParam?event.id===eventParam:
      category==='both'||categoryOf(event.category)===category);
    const picked=chosenDay()||defaultDay(daysFor(eventParam||catParam?eligible:published));
    return eligible.filter(event=>event.date===picked)
      .sort((a,b)=>categoryOf(a.category).localeCompare(categoryOf(b.category),'fr',{numeric:true}));
  }
  function unsubscribeRecords() {for(const u of state.unsubscribe)try{u();}catch(e){}state.unsubscribe=[];}
  function useCatalogSnapshot(snap,db) {
    if(!snap.exists)throw new Error('Catalogue non disponible dans Firebase.');
    const raw=snap.data()||{};
    if(!Array.isArray(raw.events))throw new Error('Catégories du tournoi indisponibles.');
    catalogueSnapshot=snap;
    catalogueDb=db;
    const events=chooseEvents(raw.events);
    const ids=events.map(e=>e.id).join('|');
    const before=state.events.map(e=>e.id).join('|');
    state.events=events;
    state.fromCache=Boolean(snap.metadata?.fromCache);
    if(before!==ids){
      unsubscribeRecords();
      state.connected=false;
      connection('waiting','ACTUALISATION…');
      ROOT.replaceChildren(empty('Chargement du programme','Récupération des matchs de la journée sélectionnée.'));
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
      const db=connect();
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
    return {teams,matches,config:{pointsWin:3,pointsDraw:1,pointsLoss:0,
      sponsors:[{name:'Partenaire de démonstration'}]}};
  }
  function refreshDemo(){
    const events=chooseEvents(eventParam&&catParam&&dayParam
      ? [{id:eventParam,category:catParam,date:dayParam,published:true}]
      : demoEvents);
    state.events=events;
    state.records.clear();
    for(const event of events)state.records.set(event.id,demoFixtures(event.category));
    state.connected=true;
    resetSlides();
  }
  function startDemo(){
    refreshDemo();
    const nav=E('nav','demo-switcher');
    nav.setAttribute('aria-label','Navigation de la démonstration');
    for(const view of selectedViews()){
      if(!state.slides.some(slide=>slide.view.id===view.id))continue;
      const b=E('button','demo-link',view.label);
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
    getSelection:()=>({day:state.events[0]?.date||'',categories:selectedCategories()}),
    getSettings:()=>JSON.parse(JSON.stringify(screenSettings)),
    getSlides:()=>state.slides.map(s=>({view:s.view.id,category:s.dual?s.panels.map(p=>p.category).join(' - '):s.event.category,page:s.page})),
    getUpcomingCounts:()=>state.slides.filter(s=>s.view.id==='upcoming'&&s.dual).flatMap(s=>s.panels.map(p=>({category:p.category,count:p.items.length}))),
    getMode:()=>isDemo?'DEMO':'LECTURE FIREBASE',
    getCountdown:()=>COUNTDOWN.textContent,
    next:()=>step(1), pause:()=>togglePause(),
    goto:(id)=>{const index=state.slides.findIndex(s=>s.view.id===id);if(index>=0){state.index=index;currentSlide();return true;}return false;}
  };
  window.addEventListener('storage',e=>{
    if(e.key!==SETTINGS_KEY||preview)return;
    screenSettings=readSettings();
    state.nextAt=Date.now()+rotationMs();
    if(isDemo)refreshDemo();
    else if(catalogueSnapshot)useCatalogSnapshot(catalogueSnapshot,catalogueDb);
  });
})();
