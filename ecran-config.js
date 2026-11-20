(() => {
  'use strict';
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
    views: ['results', 'standings', 'upcoming', 'finals'], showPartners: true, day: ''
  });
  function validateSettings(input) {
    const source=input && typeof input==='object' && !Array.isArray(input)?input:{};
    const rotationSeconds=[5,10,15,20,30].includes(Number(source.rotationSeconds))?Number(source.rotationSeconds):10;
    const upcomingLimit=[1,2,3,4].includes(Number(source.upcomingLimit))?Number(source.upcomingLimit):2;
    const categories=categoryOf(source.categories)||'both';
    const allowed=SETTINGS_DEFAULTS.views;
    const views=Array.isArray(source.views)?allowed.filter(x=>source.views.includes(x)):allowed.slice();
    return {rotationSeconds,upcomingLimit,categories,views:views.length?views:allowed.slice(),showPartners:source.showPartners!==false,day:isDay(source.day)?source.day:''};
  }
  function readSettings(){
    try{return validateSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null'));}
    catch(e){return validateSettings(null);}
  }
  const readableDay = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Journée du tournoi';
    return new Date(value + 'T12:00:00').toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  };
  const today = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  function categoryOf(value) {
    const label=String(value || '').trim().toUpperCase().slice(0,60);
    if (!label) return null;
    if (label==='BOTH') return 'both';
    const ageGroup=/^U[\s-]*(\d{1,2})$/.exec(label);
    return ageGroup ? 'U'+ageGroup[1] : label;
  }

  function isDay(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const date=new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function publishedEvents(events) {
    return (Array.isArray(events)?events:[]).filter(event=>event &&
      /^[a-z0-9_-]{1,70}$/.test(event.id||'') && event.published!==false &&
      isDay(event.date) && categoryOf(event.category));
  }
  const daysFor=events=>[...new Set(events.map(event=>event.date))].sort();
  function defaultDay(days) {
    const now=today();
    return days.find(day=>day>=now)||days.at(-1)||'';
  }
  function connect() {
    if(typeof firebase==='undefined'||typeof firebase.firestore!=='function')throw new Error('Connexion Firebase indisponible.');
    const app=firebase.apps.find(app=>app.name==='csv-ecran-geant')||firebase.initializeApp(FIREBASE_CONFIG,'csv-ecran-geant');
    if(app.options.projectId!==FIREBASE_CONFIG.projectId)throw new Error('Projet Firebase inattendu.');
    return app.firestore();
  }
  const demoEvents=[
    ['2027-06-05',['U10','U11']],['2027-06-06',['U8','U9']],['2027-06-12',['U12','U13']]
  ].flatMap(([date,categories])=>categories.map(category=>({id:'demo-'+date+'-'+category.toLowerCase(),date,category,published:true})));
  window.CSV_TV_CONFIG={SETTINGS_KEY,SETTINGS_DEFAULTS,validateSettings,readSettings,
    readableDay,categoryOf,isDay,publishedEvents,daysFor,defaultDay,connect,demoEvents};
})();
