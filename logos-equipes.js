/* Tournoi CSV V7.3 — Gestion des logos, accès propriétaire uniquement.
 * Mode demo=1: aucune requête Firebase et aucune écriture réelle.
 * Les tournois existants restent inchangés tant que l'utilisateur ne valide pas une équipe.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const demo = new URLSearchParams(location.search).get('demo') === '1' || location.protocol === 'file:';
  const S = { app:null, auth:null, db:null, user:null, events:[], active:null, teams:[], busy:false };
  const text = (tag, cls, val) => { const e=document.createElement(tag); if(cls)e.className=cls; e.textContent=String(val??'');return e; };
  function message(msg,ok=false){$('feedback').textContent=msg;$('feedback').className='alert'+(ok?' good':'');}
  function safeLogo(input) {
    const value=typeof input==='string'?input.trim():'';
    if(!value)return '';
    if(value.length>1500)throw Error('Adresse de logo trop longue (1 500 caractères maximum).');
    const own=(value==='./icon-512.png') || (/^\.\/logos\/[A-Za-z0-9_./-]+\.(png|jpe?g|webp)$/i.test(value) && !value.includes('..'));
    if(own)return value;
    let url;try{url=new URL(value);}catch{throw Error('Utilise une URL HTTPS ou un logo du dossier ./logos/.');}
    if(url.protocol!=='https:'||url.username||url.password||!/\.(?:png|jpe?g|webp)$/i.test(url.pathname))
      throw Error('Logo refusé : URL HTTPS sans identifiants, image PNG/JPG/WebP uniquement.');
    return url.href;
  }
  // Image locale : import visuel sûr, réduction client et téléchargement WebP.
  // AUCUN transfert d'identifiant GitHub/Firebase et AUCUN téléversement automatique.
  const prepared = new Map();
  function logoFilePath(team) {
    const clean = value => String(value || '').replace(/[^a-z0-9_-]/gi,'-').slice(0,52);
    return './logos/' + clean(S.active?.id) + '-' + clean(team.id) + '.webp';
  }
  async function optimizeLogoFile(file) {
    if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type))
      throw Error('Sélectionne un PNG, JPG ou WebP (pas de SVG ou GIF).');
    if (file.size > 6*1024*1024) throw Error('Image trop volumineuse (maximum 6 Mo).');
    const objectUrl = URL.createObjectURL(file);
    let img;
    try {
      img = await new Promise((resolve,reject)=>{
        const element=new Image();
        element.onload=()=>resolve(element);
        element.onerror=()=>reject(Error('Image illisible.'));
        element.src=objectUrl;
      });
      const w=img.naturalWidth,h=img.naturalHeight;
      if (!w||!h||w>6000||h>6000) throw Error('Dimensions de l’image non autorisées.');
      const ratio=Math.min(1,512/Math.max(w,h));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(w*ratio));
      canvas.height=Math.max(1,Math.round(h*ratio));
      const ctx=canvas.getContext('2d');
      if (!ctx) throw Error('Conversion non prise en charge sur cet appareil.');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const toBlob=quality=>new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
      let blob=await toBlob(.8);
      if (blob?.size>125000) blob=await toBlob(.55);
      if (!blob||blob.type!=='image/webp'||blob.size>125000)
        throw Error('Logo trop complexe après optimisation : utilise une image plus simple.');
      return blob;
    } finally {URL.revokeObjectURL(objectUrl);}
  }
  async function checkHostedLogo(url) {
    if(!url || demo || !url.startsWith('./logos/'))return;
    const res=await fetch(url,{method:'HEAD',cache:'no-store',credentials:'omit'});
    if(!res.ok)throw Error('Ce logo n’est pas encore publié dans le dossier logos/ du site. Télécharge le WebP et ajoute-le au dépôt avant de l’enregistrer.');
    const type=res.headers.get('content-type')||'';
    if(type && !/^image\/(webp|png|jpeg)\b/i.test(type))
      throw Error('Le fichier en ligne n’est pas reconnu comme une image.');
  }
  function imageBadge(team, url) {
    const badge=text('div','badge','');
    const initials=String(team.name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase();
    badge.append(text('span','initial',initials));
    try{
      const valid=safeLogo(url);
      if(valid){const img=document.createElement('img');img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
        img.src=valid;img.addEventListener('error',()=>img.remove(),{once:true});badge.append(img);}
    }catch(_){}
    return badge;
  }
  function demoStart(){
    document.body.classList.add('demo');$('modeLabel').textContent='PRÉVISUALISATION FICTIVE · SANS FIREBASE';
    $('offlineNote').textContent=' Démonstration locale : aucune modification réelle.';
    S.events=[{id:'demo-u10',category:'U10',date:'2027-06-05',title:'Tournoi U10'},
      {id:'demo-u11',category:'U11',date:'2027-06-05',title:'Tournoi U11'}];
    S.demoRecords={
      'demo-u10':[{id:'1',name:'CS La Verpillière',group:'Poule A',color:'#e8394e',logoUrl:'./icon-512.png'},
        {id:'2',name:'FC Bourgoin',group:'Poule A',color:'#e4b93f'},
        {id:'3',name:'US Villefontaine',group:'Poule B',color:'#619dbd'},
        {id:'4',name:'ES Frontonas',group:'Poule B',color:'#69b89a'}],
      'demo-u11':[{id:'5',name:'FC Genas',group:'Poule A',color:'#dd943e'},
        {id:'6',name:'CS La Verpillière',group:'Poule A',color:'#e8394e',logoUrl:'./icon-512.png'},
        {id:'7',name:'AS Pusignan',group:'Poule B',color:'#68a7d9'}]
    };
    $('workspace').classList.remove('hidden'); fillEvents();message('Démonstration prête. Tu peux tester les logos et la validation sans toucher à Firebase.',true);
  }
  function fillEvents(){
    const select=$('tournament');select.replaceChildren();
    const list=S.events.filter(e=>e && typeof e.id==='string' && /^[a-zA-Z0-9_-]{1,70}$/.test(e.id));
    list.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.category||'').localeCompare(String(b.category||'')));
    if(!list.length){select.append(new Option('Aucun tournoi disponible',''));$('teams').replaceChildren();return;}
    list.forEach(e=>select.append(new Option([e.category||'Catégorie',e.title||e.name||e.id,e.date||''].filter(Boolean).join(' · '),e.id)));
    select.value=list[0].id; loadSelected();
  }
  async function loadSelected(){
    const id=$('tournament').value;
    const event=S.events.find(e=>e.id===id);
    if(!event)return;
    S.active=event;
    if(demo){S.teams=(S.demoRecords[id]||[]).map(t=>({...t}));renderTeams();return;}
    message('Chargement des équipes…');
    try{
      const docId=id==='principal'?'cslv_main_data':'cslv_mt_'+id;
      const snap=await S.db.collection('tournaments').doc(docId).get();
      if(!snap.exists)throw Error('Tournoi absent de Firestore.');
      const source=snap.data()||{};
      const teamLogos=source.teamLogos && typeof source.teamLogos==='object' && !Array.isArray(source.teamLogos)?source.teamLogos:{};
      S.teams=(Array.isArray(source.teams)?source.teams:[]).map(t=>({
        ...t,logoUrl:Object.prototype.hasOwnProperty.call(teamLogos,String(t.id))
          ?String(teamLogos[String(t.id)]||''):String(t.logoUrl||'')
      }));
      renderTeams(); message(S.teams.length+' équipes chargées en lecture seule. Enregistrement uniquement sur ton clic.',true);
    }catch(e){message('Impossible de charger les équipes : '+e.message);$('teams').replaceChildren();}
  }
  function renderTeams(){
    const root=$('teams');root.replaceChildren();$('teamTitle').textContent='Équipes · '+(S.active?.category||'')+' ('+S.teams.length+')';
    if(!S.teams.length){root.append(text('p','muted','Aucune équipe inscrite.'));return;}
    S.teams.forEach(team=>{
      const row=text('div','team-row','');
      const ident=text('div','team-ident','');let badge=imageBadge(team,team.logoUrl);
      const label=text('div','','');label.append(text('b','',team.name||'Équipe'),text('small','',team.group||'Poule non définie'));
      ident.append(badge,label);
      const edit=text('div','logo-edit','');const id='logo-'+String(team.id).replace(/[^a-z0-9_-]/gi,'');
      const lbl=text('label','',"Adresse HTTPS de l’image (facultatif)");lbl.htmlFor=id;
      const input=document.createElement('input');input.type='text';input.inputMode='url';input.id=id;input.className='logo-field';input.placeholder='https://exemple.fr/blason.png';input.maxLength=1500;input.value=team.logoUrl||'';input.setAttribute('aria-label','Logo de '+team.name);
      const file=document.createElement('input');
      file.type='file';file.accept='image/png,image/jpeg,image/webp';
      file.setAttribute('aria-label','Choisir une image pour '+team.name);
      file.className='file-picker';
      const pick=text('label','pick-file','📷 Choisir une image');
      pick.append(file);
      const download=text('button','download-logo','⬇ Télécharger le logo optimisé');
      download.type='button';download.disabled=true;
      download.addEventListener('click',()=>{
        const item=prepared.get(String(S.active.id)+':'+String(team.id));
        if(!item)return;
        const link=document.createElement('a');
        link.href=item.preview;link.download=item.path.split('/').pop();
        document.body.append(link);link.click();link.remove();
        message('Logo prêt : '+link.download+'. Il faudra l’ajouter dans le dossier logos/ du dépôt avant de sauvegarder son adresse.',true);
      });
      file.addEventListener('change',async()=>{
        const selection=file.files?.[0];if(!selection)return;
        try {
          message('Préparation de '+selection.name+'…');
          const blob=await optimizeLogoFile(selection);
          const key=String(S.active.id)+':'+String(team.id);
          const previous=prepared.get(key);if(previous)URL.revokeObjectURL(previous.preview);
          const preview=URL.createObjectURL(blob);const path=logoFilePath(team);
          prepared.set(key,{blob,preview,path});
          input.value=path;download.disabled=false;
          const next=imageBadge(team,'');
          const img=document.createElement('img');img.src=preview;img.alt='';next.append(img);
          badge.replaceWith(next);badge=next;
          message('Logo optimisé ('+Math.round(blob.size/1024)+' Ko). Télécharge-le puis publie-le dans logos/ avant l’enregistrement Firebase.',true);
        }catch(e){message(e.message);}
      });
      edit.append(lbl,input,pick,download);
      const actions=text('div','actions','');const save=text('button','',demo?'Simuler':'Enregistrer');save.type='button';
      const clear=text('button','clear','Effacer');clear.type='button';
      clear.addEventListener('click',()=>{input.value='';const next=imageBadge(team,'');badge.replaceWith(next);badge=next;});
      input.addEventListener('change',()=>{const next=imageBadge(team,input.value);badge.replaceWith(next);badge=next;});
      save.addEventListener('click',async()=>{
        if(S.busy)return;
        let url;try{url=safeLogo(input.value);}catch(e){message(e.message);input.focus();return;}
        const old=typeof team.logoUrl==='string'?team.logoUrl:'';
        try{await checkHostedLogo(url);}catch(e){message(e.message);return;}
        if(old===url){message('Aucun changement pour '+team.name+'.',true);return;}
        if(demo){team.logoUrl=url;const found=S.demoRecords[S.active.id].find(t=>t.id===team.id);if(found)found.logoUrl=url;renderTeams();message('Simulation validée pour '+team.name+'. Rien envoyé à Firebase.',true);return;}
        if(!S.user||!S.user.emailVerified){message('Connexion administrateur vérifiée requise.');return;}
        if(!confirm('Enregistrer uniquement le logo de « '+team.name+' » ?'))return;
        S.busy=true;save.disabled=true;clear.disabled=true;
        try{
          const docId=S.active.id==='principal'?'cslv_main_data':'cslv_mt_'+S.active.id;
          const ref=S.db.collection('tournaments').doc(docId);
          await S.db.runTransaction(async tx=>{
            const snap=await tx.get(ref);
            if(!snap.exists||!Array.isArray(snap.data()?.teams))throw Error('Équipes introuvables.');
            const current=snap.data().teams;const idx=current.findIndex(t=>String(t.id)===String(team.id));
            if(idx<0||current[idx].name!==team.name)throw Error('Équipe modifiée entre-temps. Recharge le tournoi.');
            const logos=snap.data().teamLogos||{};
            const effective=Object.prototype.hasOwnProperty.call(logos,String(team.id))
              ?String(logos[String(team.id)]||''):String(current[idx].logoUrl||'');
            if(effective!==old)throw Error('Logo changé par ailleurs. Recharge avant de réessayer.');
            // Champs isolés des équipes, des matchs et des paramètres.
            // Firestore met à jour uniquement teamLogos/<id> ; aucune équipe ni score n'est réécrit.
            const fieldPath=new firebase.firestore.FieldPath('teamLogos',String(team.id));
            tx.update(ref,fieldPath,url);
          });
          team.logoUrl=url;message('Logo enregistré séparément pour '+team.name+'. Aucun match, score ou poule modifié.',true);renderTeams();
        }catch(e){message('Enregistrement refusé : '+e.message);}finally{S.busy=false;save.disabled=false;clear.disabled=false;}
      });
      actions.append(save,clear);row.append(ident,edit,actions);root.append(row);
    });
  }
  function verify(){
    const rows=[...$('teams').querySelectorAll('.team-row')];const problems=[];
    for(const row of rows){const input=row.querySelector('input');try{safeLogo(input.value);}catch(e){problems.push(e.message);}}
    if(problems.length){message('Vérification : '+problems.length+' adresse(s) invalide(s). '+problems[0]);return;}
    message('Vérification validée : '+rows.length+' équipe(s), images facultatives, aucune écriture automatique. '+(demo?'Mode DEMO confirmé.':'Compte propriétaire vérifié.'),true);
  }
  async function initLive(){
    try{
      const cfg=window.CSV_ORGANIZERS_CONFIG;
      if(!cfg||typeof firebase==='undefined')throw Error('Bibliothèques Firebase indisponibles.');
      S.app=firebase.apps.length?firebase.app():firebase.initializeApp(cfg.firebase);
      S.auth=S.app.auth();S.db=S.app.firestore();
      S.auth.onAuthStateChanged(async user=>{
        $('workspace').classList.add('hidden');$('loginArea').classList.add('hidden');
        if(!user||user.isAnonymous){$('loginArea').classList.remove('hidden');message('Connecte-toi avec le compte principal du CSV.');return;}
        try{
          await user.reload();await user.getIdToken(true);
          if(!user.emailVerified||user.uid!==cfg.ownerUid){$('loginArea').classList.remove('hidden');message('Accès réservé au responsable principal et à son adresse vérifiée.');return;}
          S.user=user;
          const snap=await S.db.collection('tournaments').doc('cslv_multi_catalog_v1').get();
          if(!snap.exists||!Array.isArray(snap.data()?.events))throw Error('Catalogue des tournois indisponible.');
          S.events=snap.data().events;
          $('workspace').classList.remove('hidden');fillEvents();
        }catch(e){message('Chargement impossible : '+e.message);}
      });
    }catch(e){message('Connexion indisponible : '+e.message);}
  }
  $('tournament').addEventListener('change',loadSelected);
  $('validate').addEventListener('click',verify);
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!S.auth)return;try{
      await S.auth.signInWithEmailAndPassword($('email').value.trim(),$('password').value);
      $('password').value='';
    }catch(err){message('Connexion refusée : '+err.message);}
  });
  if(demo)demoStart();else if(document.readyState==='complete')initLive();else window.addEventListener('load',initLive,{once:true});
})();