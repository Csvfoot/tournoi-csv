(() => {
  'use strict';
  const {SETTINGS_KEY,SETTINGS_DEFAULTS,validateSettings,readSettings,
    readableDay,categoryOf,publishedEvents,daysFor,defaultDay,connect,demoEvents}=window.CSV_TV_CONFIG;
  const $=id=>document.getElementById(id);
  const checks=()=>[...document.querySelectorAll('input[name=view]')];
  const demo=document.body.dataset.screenMode==='demo';
  const screenPage=demo?'./APERCU_ECRAN_LOCAL.html':'./ecran.html';
  let catalogue=null;
  let current=readSettings();
  const choices=new Intl.Collator('fr',{numeric:true});
  const status=(message,kind='')=>{
    $('status').className='status '+kind;
    $('status').textContent=message;
  };
  const getSettings=()=>validateSettings({
    day:$('day').value,categories:$('categories').value,
    rotationSeconds:$('rotation').value,upcomingLimit:$('limit').value,
    views:checks().filter(c=>c.checked).map(c=>c.value),showPartners:$('show-partners').checked
  });
  function setOptions(select, options, preferred) {
    select.replaceChildren(...options.map(([value,label])=>new Option(label,value)));
    select.value=options.some(([value])=>value===preferred)?preferred:options[0]?.[0]||'';
  }
  function updateCategories(preferred) {
    const day=$('day').value||defaultDay(daysFor(catalogue));
    const categories=[...new Set(catalogue.filter(event=>event.date===day).map(event=>categoryOf(event.category)))].sort(choices.compare);
    setOptions($('categories'), [['both','Toutes les catégories'],...categories.map(category=>[category,category])], preferred);
    $('category-help').textContent=day ? categories.join(' · ') : 'Aucune journée publiée.';
  }
  function showPreview() {
    const url=new URL(screenPage,location.href);
    url.searchParams.set('configuration',JSON.stringify(getSettings()));
    if($('preview').src!==url.href)$('preview').src=url.href;
  }
  function refreshForm(preferred) {
    const days=daysFor(catalogue);
    const automatic=defaultDay(days);
    setOptions($('day'),[['',automatic?'Automatique · '+readableDay(automatic):'Aucune journée publiée'],
      ...days.map(day=>[day,readableDay(day)])],preferred.day);
    updateCategories(preferred.categories);
    $('selection').disabled=!days.length;
    $('save').disabled=!days.length;
    $('reset').disabled=!days.length;
    if(days.length)showPreview();
  }
  function setFields(settings) {
    $('limit').value=String(settings.upcomingLimit);
    $('rotation').value=String(settings.rotationSeconds);
    $('show-partners').checked=settings.showPartners;
    checks().forEach(c=>{c.checked=settings.views.includes(c.value);});
    if(catalogue)refreshForm(settings);
  }
  function receive(events) {
    const preferred=catalogue?getSettings():current;
    catalogue=publishedEvents(events);
    refreshForm(preferred);
    const dates=daysFor(catalogue);
    status(dates.length ? (demo?'Journées de démonstration chargées.':'Journées publiées chargées.') :
      'Aucune journée publiée pour le moment.', dates.length?'':'error');
  }
  $('settings').addEventListener('change',event=>{
    if(!catalogue?.length)return;
    if(event.target===$('day'))updateCategories($('categories').value);
    if(!checks().some(c=>c.checked)){
      status('Sélectionne au moins une rubrique.', 'error');
      return;
    }
    showPreview();
    status('Aperçu mis à jour. Enregistre pour appliquer les réglages à l’écran TV.');
  });
  function save(settings) {
    try{
      localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
      current=settings;
      status('Réglages enregistrés et appliqués dans ce navigateur.', 'ok');
    }catch{status('Impossible d’enregistrer les réglages dans ce navigateur.', 'error');}
  }
  $('settings').addEventListener('submit',event=>{
    event.preventDefault();
    if(!catalogue?.length)return;
    if(!checks().some(c=>c.checked))return status('Sélectionne au moins une rubrique.', 'error');
    save(getSettings());
  });
  $('reset').addEventListener('click',()=>{
    setFields(SETTINGS_DEFAULTS);
    save(getSettings());
  });
  $('open-screen').href=screenPage;
  setFields(current);
  if(demo)receive(demoEvents);
  else {
    const unavailable=()=>status('Impossible de charger les journées publiées. Recharge la page pour réessayer.', 'error');
    try{
      connect().collection('tournaments').doc('cslv_multi_catalog_v1')
        .onSnapshot(snapshot=>{if(snapshot.exists)receive(snapshot.data()?.events);else receive([]);},unavailable);
    }catch{unavailable();}
  }
})();
