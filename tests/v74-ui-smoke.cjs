// Tests UI V7.4 — extraits du vrai app.js, sans connexion Firebase.
// Lancement : node tests/v74-ui-smoke.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit, devices } = require('playwright');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const component = name => {
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0, 'Composant absent : ' + name);
  const end = source.indexOf('\nfunction ', start + 9);
  return source.slice(start, end >= 0 ? end : source.indexOf('\nReactDOM.render', start));
};
const components = ['CsvSpectatorWelcome','CsvVisualHome','CsvVisualFinals','CsvTvBoard','CsvTeamOverview','StandingsTable','csvPlacementStart']
  .map(component).join('\n');
const fixture = {
  events:[{id:'u10',category:'U10',date:'2027-06-05'},{id:'u11',category:'U11',date:'2027-06-05'}],
  teams:[
    {id:'a',name:'CSV La Verpillière',group:'Poule A',color:'#ffcc44'},
    {id:'b',name:'ES Frontonas',group:'Poule A',color:'#d85768'},
    {id:'c',name:'US Villefontaine',group:'Poule B',color:'#5286e0'}
  ],
  matches:[
    {id:'m1',group:'Poule A',stage:'Journée 1',team1Id:'a',team2Id:'b',status:'live',
     startTime:'09:00',endTime:'09:15',fieldName:'Terrain Honneur',score1:1,score2:0},
    {id:'m2',group:'Poule B',stage:'Journée 1',team1Id:'b',team2Id:'c',status:'pending',
     startTime:'10:30',endTime:'10:45',fieldName:'Terrain Annexe',score1:null,score2:null},
    {id:'m3',group:'Poule A',stage:'Journée 1',team1Id:'b',team2Id:'a',status:'finished',
     startTime:'08:30',endTime:'08:45',fieldName:'Terrain Honneur',score1:0,score2:2},
    {id:'ko-qf',group:'Phase Finale Principale',stage:'Quart de finale 1',team1Id:'a',team2Id:'b',status:'pending',startTime:'13:00'},
    {id:'ko-bronze',group:'Phase Finale Principale',stage:'Match pour la 3e place',team1Id:'b',team2Id:'c',status:'pending',startTime:'15:45'},
    {id:'ko-semi',group:'Phase Finale Principale',stage:'Demi-Finale',team1Id:'a',team2Id:'c',
     status:'pending',startTime:'14:00',score1:null,score2:null},
    {id:'ko-final',group:'Phase Finale Principale',stage:'Grande Finale',
     placeholder1:'Vainqueur demi 1',placeholder2:'Vainqueur demi 2',
     status:'pending',startTime:'16:00',score1:null,score2:null},
    {id:'consolante',group:'Tournoi Consolante',stage:'Finale consolante',
     startTime:'15:30',team1Id:'a',team2Id:'b'},
    {id:'classement',group:'Tournoi Classement',stage:'Match pour la 5e place',
     startTime:'15:00',team1Id:'b',team2Id:'c'}
  ]
};
const realLogic = [
  ['const standingsFor =', '// Résultat d\'une rencontre'],
  ['const resultOf =', 'const buildFinalStandings'],
  ['const sortedMatchesForTeam =', 'const teamScheduleDiagnostics']
].map(([start,end]) => {
  const i = source.indexOf(start), j = source.indexOf(end,i+1);
  assert(i>=0 && j>i, 'Fonction métier inaccessible: '+start);
  return source.slice(i,j);
}).join('\n');
const deps = String.raw`
const React=window.React, ReactDOM=window.ReactDOM;
const csvSafeLogoUrl=src=>typeof src==='string'&&src.startsWith('https:')?src:'';
function CsvTeamLogo({team,size=32}) { return React.createElement('span',{style:{
  width:size,height:size,borderRadius:8,display:'inline-flex',alignItems:'center',
  justifyContent:'center',background:team.color||'#ffca43',color:'#000'
}},(team.name||'?').slice(0,2)); }
function ClubLogo(){return React.createElement('span',{style:{
  display:'inline-flex',fontSize:34,alignItems:'center',justifyContent:'center'
}},'⚽');}
const csvReadableDay=s=>s;
const planningMinutes = value => /^\d{1,2}:\d{2}$/.test(String(value||''))
  ? Number(value.split(':')[0])*60+Number(value.split(':')[1]) : -1;
` + realLogic;
const react = fs.readFileSync(path.join(root, 'node_modules/react/umd/react.production.min.js'), 'utf8');
const reactDom = fs.readFileSync(path.join(root, 'node_modules/react-dom/umd/react-dom.production.min.js'), 'utf8');
const documentHtml = [
  '<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<style>' + css.replaceAll('</style>', '<\\/style>') + '</style>',
  '</head><body style="margin:0;background:#18080f"><div id="root"></div>',
  '<script>' + react + '</script>',
  '<script>' + reactDom + '</script>',
  '<script>' + deps + components + '</script>',
  '<script>',
  'window.__fixture=' + JSON.stringify(fixture) + ';',
  'window.__root=ReactDOM.createRoot(document.getElementById("root"));',
  'window.__render = function(view, category) { const f=window.__fixture;',
  ' const event=f.events.find(e=>e.id===category)||f.events[0];',
  ' const teams=category==="u11"?f.teams.map(t=>({...t,name:t.name+" U11"})):f.teams;',
  ' const data={teams,matches:f.matches,config:{practicalInfo:"Buvette ouverte dès 9h",',
  ' sponsors:[{name:"Partenaire CSV",logoUrl:""}]}};',
  ' const props={day:"2027-06-05",dates:["2027-06-05"],events:f.events,activeId:event.id,',
  ' isLoading:false,offline:false,onChooseDay:()=>{},onChooseCategory:id=>window.__render("welcome",id),',
  ' onOpen:t=>window.__lastAction=t,onRefresh:()=>{},refreshing:false,',
  ' records:{[event.id]:data},readyRecords:{[event.id]:true},fields:[{id:"f1",name:"Terrain Honneur"}]};',
  ' const h = React.createElement;',
  ' let c = view.startsWith("finals")?h("main",{className:view==="finals-editor"?"csv-v74-organizer":"csv-v74-inline-view"},',
  ' h(CsvVisualFinals,{matches:data.matches,teams:data.teams,onEditMatch:view==="finals-editor"?()=>{}:undefined})):',
  ' view==="pools"?h("section",{className:"csv-v74-pool-card"},h(StandingsTable,{standings:teams.map(team=>',
  ' ({team,points:4,played:3,won:1,drawn:1,lost:1,gf:4,ga:4,gd:0}))})):',

  ' view==="team"?React.createElement(CsvTeamOverview,{team:data.teams[0],teams:data.teams,',
  ' matches:data.matches,config:data.config,groups:["Poule A","Poule B"]}):',
  ' view==="tv"?React.createElement(CsvTvBoard,{tournament:event,matches:data.matches,',
  ' teams:data.teams,onClose:()=>window.__render("welcome",category)}):',
  ' React.createElement(CsvSpectatorWelcome,props);',
  ' window.__root.render(c);',
  '}; window.__render("welcome","u10");',
  '</script></body></html>'
].join('\n');

async function main() {
  fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});
  const safari = process.argv.includes('--webkit');
  const browser = await (safari ? webkit.launch() : chromium.launch({headless:true,args:['--no-sandbox']}));
  const viewports = safari ? [{...devices['iPhone 15'], name:'webkit-iphone'}] : [
    {viewport:{width:1440,height:900},deviceScaleFactor:1,name:'desktop'},
    {viewport:{width:390,height:844},deviceScaleFactor:1,name:'iphone'}
  ];
  try {
    for(const { name, ...options } of viewports) {
      const page = await browser.newPage(options);
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await page.setContent(documentHtml,{waitUntil:'load'});
      await page.getByText('Le football se vit ici.').waitFor();
      assert((await page.getByText('CSV La Verpillière').count())>0,'Équipes visibles');
      await page.screenshot({path:path.join(root,'test-artifacts','v74-accueil-'+name+'.png'),fullPage:true});
      const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert(horizontalOverflow<=2,'Débordement horizontal '+name+': '+horizontalOverflow);
      await page.getByRole('button',{name:'U11'}).click();
      await page.getByText('Le football se vit ici.').waitFor();
      await page.evaluate(()=>window.__render('finals','u11'));
      await page.getByText('La route vers la finale').waitFor();
      await page.getByRole('region', { name: 'Consolante', exact: true }).getByText('Finale consolante · 15:30', { exact: true }).waitFor();
      await page.getByRole('region', { name: 'Matchs de classement', exact: true }).getByText('Match pour la 5e place · 15:00', { exact: true }).waitFor();
      for (const mode of ['finals','finals-editor']) {
        await page.evaluate(view=>window.__render(view,'u11'),mode);
        const rounds = page.getByRole('region', { name: 'Tableau des tours' });
        await rounds.getByRole('heading', { name: 'Grande finale' }).waitFor();
        const centers = await rounds.locator('h3').evaluateAll(headings=>headings.map(h=>{
          const rect=h.getBoundingClientRect();
          return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
        }));
        assert.equal(centers.length,4);
        const axis=name==='desktop'?'x':'y';
        assert(centers.every((p,i)=>!i||p[axis]>centers[i-1][axis]),'Tours en ordre dans '+mode+' '+name);
        assert.equal(await page.locator('.csv-v74-podium').count(),0);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),
          'Le tableau doit tenir dans l’écran');
        await page.screenshot({path:path.join(root,'test-artifacts','v74-'+mode+'-'+name+'.png'),fullPage:true});
      }
      await page.evaluate(()=>window.__render('pools','u11'));
      for (const label of ['G','N','P','BP','BC'])
        await page.getByRole('columnheader',{name:label,exact:true}).waitFor();
      assert(await page.locator('.csv-v74-pool-table').evaluate(table=>table.scrollWidth<=table.parentElement.clientWidth+2),
        'Toutes les statistiques doivent tenir dans la largeur de la poule');
      await page.evaluate(()=>window.__render('team','u11'));
      await page.getByText('CSV La Verpillière U11').waitFor();
      await page.evaluate(()=>window.__render('tv','u11'));
      await page.getByRole('heading', { name: '⚽ TOURNOI', exact: true }).waitFor();
      await page.screenshot({path:path.join(root,'test-artifacts','v74-tv-'+name+'.png'),fullPage:true});
      assert.deepEqual(errors,[],'Erreurs JavaScript '+name);
      await page.close();
      console.log('OK rendu '+name+' : accueil, changement U10/U11, finale, équipe, TV');
    }
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
