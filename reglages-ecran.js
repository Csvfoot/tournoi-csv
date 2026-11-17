/* Prévisualisation fonctionnelle et validation de réglages 100 % locaux.
   Aucun SDK Firebase, aucun appel réseau, aucune modification des tournois. */
(() => {
  'use strict';
  const KEY='csv.screen.v72.display.settings';
  const DEFAULTS={rotationSeconds:10,upcomingLimit:2,categories:'both',views:['results','standings','upcoming','finals']};
  const $=id=>document.getElementById(id);
  const checks=()=>[...document.querySelectorAll('input[name=view]')];
  const safeRead=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&typeof v==='object'?v:DEFAULTS;}catch(e){return DEFAULTS;}};
  function setFields(v){
    $('categories').value=v.categories||'both';$('limit').value=String(v.upcomingLimit||2);
    $('rotation').value=String(v.rotationSeconds||10);
    checks().forEach(c=>{c.checked=(v.views||DEFAULTS.views).includes(c.value);});
  }
  const form=()=>({categories:$('categories').value,upcomingLimit:Number($('limit').value),rotationSeconds:Number($('rotation').value),views:checks().filter(c=>c.checked).map(c=>c.value)});
  const status=(message,kind='')=>{$('status').className='status '+kind;$('status').textContent=message;};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  let loadToken=0;
  async function testPreview(expected) {
    const token=++loadToken;
    const iframe=$('preview');
    iframe.src='./APERCU_ECRAN_LOCAL.html?validation='+Date.now();
    return new Promise(resolve=>{
      let attempts=0;
      const check=()=>{
        if(token!==loadToken)return resolve(false);
        let api;
        try{api=iframe.contentWindow.CSV_SCREEN_TEST;}catch(e){}
        if(!api){if(attempts++<100)return setTimeout(check,100);status('⚠️ Moteur de prévisualisation indisponible : ouvre cette page avec le serveur local du pack.', 'error');return resolve(false);}
        try{
          const persisted=safeRead(),actual=api.getSettings(),slides=api.getSlides();
          const categories=expected.categories==='both'?['U10','U11']:[expected.categories];
          const views=expected.views;
          const failures=[];
          if(!equal(persisted,expected))failures.push('Enregistrement local incohérent');
          if(!equal(actual,expected))failures.push('Réglages non appliqués dans l’écran');
          if(api.getMode()!=='DEMO')failures.push('Affichage non isolé de Firebase');
          const actualViews=[...new Set(slides.map(x=>x.view))];
          if(!views.every(v=>actualViews.includes(v))||actualViews.some(v=>!views.includes(v))) failures.push('Rubriques non conformes');
          const upcoming=api.getUpcomingCounts();
          if(views.includes('upcoming')){
            if(upcoming.length!==categories.length)failures.push('Nombre de catégories sur la page matchs incorrect');
            for(const c of categories){const n=upcoming.find(x=>x.category===c)?.count;if(n!==expected.upcomingLimit) failures.push('Prochains matchs '+c+' : attendu '+expected.upcomingLimit+', obtenu '+String(n));}
          }
          if(!failures.length){
            const timestamp=new Date().toLocaleString('fr-FR');
            status('✅ RÉGLAGES VALIDÉS · '+timestamp+'\n'+categories.join(' - ')+' · '+expected.upcomingLimit+' matchs/catégorie · rotation '+expected.rotationSeconds+' s\n'+views.length+' rubriques · données fictives · persistance locale confirmée', 'ok');resolve(true);
          }else{status('⛔ Vérification non validée :\n• '+failures.join('\n• '),'error');resolve(false);}
        }catch(e){status('⛔ Erreur de validation : '+e.message,'error');resolve(false);}
      };
      setTimeout(check,200);
    });
  }
  $('save').addEventListener('click',()=>{
    const value=form();if(!value.views.length)return status('⛔ Sélectionne au moins une rubrique.','error');
    try{localStorage.setItem(KEY,JSON.stringify(value));}
    catch(e){return status('⛔ Impossible d’enregistrer dans ce navigateur : '+e.message,'error');}
    testPreview(value);
  });
  $('check').addEventListener('click',()=>testPreview(form()));
  $('reset').addEventListener('click',()=>{setFields(DEFAULTS);try{localStorage.setItem(KEY,JSON.stringify(DEFAULTS));}catch(e){return status('⛔ Sauvegarde impossible : '+e.message,'error');}testPreview(DEFAULTS);});
  const saved=safeRead();setFields(saved);status('Réglages trouvés dans le navigateur. Vérification en cours…');testPreview(form());
})();
