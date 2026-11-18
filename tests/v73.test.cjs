'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const app = fs.readFileSync('app.js', 'utf8');
const experience = fs.readFileSync('experience-v73.js', 'utf8');

function functionFromApp(name) {
  const token = 'function ' + name + '(';
  const start = app.indexOf(token);
  assert.notEqual(start, -1, name + ' doit exister dans app.js');
  // Les fonctions sous test sont des déclarations pures au niveau principal.
  const end = app.indexOf('\n}', start);
  assert.notEqual(end, -1, name + ' doit avoir une fermeture');
  const declaration = app.slice(start, end + 2);
  const context = vm.createContext({});
  vm.runInContext(declaration, context, { timeout: 1000 });
  assert.equal(typeof context[name], 'function');
  return context[name];
}
const scoreInput = functionFromApp('csvV73ScoreInput');
const scoreStep = functionFromApp('csvV73ScoreStep');
const hasProtectedData = functionFromApp('csvMatchHasProtectedData');
const referencesTeam = functionFromApp('csvMatchReferencesTeam');

test('Scores: valeurs entières autorisées, non-renseignement distinct de zéro', () => {
  assert.equal(scoreInput(''), null);
  assert.equal(scoreInput('0'), 0);
  assert.equal(scoreInput('42'), 42);
  assert.equal(scoreInput('999'), 999);
  for (const bad of ['-1', '1000', '2.5', '3 buts', ' 8', '1e2']) {
    assert.equal(scoreInput(bad), undefined, 'Refus attendu: ' + bad);
  }
});
test('Scores: boutons tactiles bornés de 0 à 999', () => {
  assert.equal(scoreStep(null, 1), 1);
  assert.equal(scoreStep(null, -1), 0);
  assert.equal(scoreStep(0, -1), 0);
  assert.equal(scoreStep(2, 1), 3);
  assert.equal(scoreStep(999, 1), 999);
});
test('Intégrité: un match déjà renseigné ne peut pas être effacé à la légère', () => {
  assert.equal(hasProtectedData({ status: 'upcoming', score1: null, score2: null }), false);
  assert.equal(hasProtectedData({ status: 'finished', score1: 0, score2: 0 }), true);
  assert.equal(hasProtectedData({ status: 'live' }), true);
  assert.equal(hasProtectedData({ status: 'upcoming', score1: 0 }), true);
  assert.equal(hasProtectedData({ events: [{ type: 'goal' }] }), true);
  assert.equal(hasProtectedData({ mvp: 'Joueur 1' }), true);
});
test('Intégrité: équipes toujours référencées par les matchs', () => {
  assert.equal(referencesTeam({ team1Id: 't1', team2Id: 't2' }, 't1'), true);
  assert.equal(referencesTeam({ team1Id: 't1', team2Id: 't2' }, 't2'), true);
  assert.equal(referencesTeam({ winnerId: 't3' }, 't3'), true);
  assert.equal(referencesTeam({ loserTeamId: 't4' }, 't4'), true);
  assert.equal(referencesTeam({ team1Id: 't1', team2Id: 't2' }, 't5'), false);
});
test('Réglages publics: structure réelle analysable et sans données d’exemple inventées', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(experience, context, { timeout: 1000 });
  const config = context.window.CSV_V73_EXPERIENCE;
  assert.ok(config, 'Configuration publique chargée');
  assert.equal(typeof config.announcement, 'string');
  assert.equal(Array.isArray(config.services), true);
  assert.equal(Array.isArray(config.sponsors), true);
  assert.ok(config.services.length <= 8);
  assert.ok(config.sponsors.length <= 12);
  assert.equal(Object.isFrozen(config), true);
});
test('Navigation spectateur: sélection mémorisée et ouverture directe sont présentes', () => {
  assert.match(app, /cslv_viewer_team_/);
  assert.match(app, /const savedTeam = teams\.find\(t => t\.id === viewerTeamId\)/);
  assert.match(app, /Changer d’équipe/);
});

test('Contrôle visuel: script valide, données réelles et absence de Firebase', () => {
  const html = fs.readFileSync('controle-visuel-v73.html', 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]).filter(Boolean);
  assert.ok(scripts.length > 0, 'Script de contrôle présent');
  for (const script of scripts) new vm.Script(script);
  assert.match(html, /window\.CSV_V73_EXPERIENCE/);
  assert.doesNotMatch(html, /firebase-app-compat|firebase-firestore-compat/);
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
});


const previewBoot = fs.readFileSync('preview-v73-boot.js', 'utf8');
const previewHtml = fs.readFileSync('previsualisation-v73.html', 'utf8');
function previewFixture(configurable = true) {
  let originalWrites = 0;
  const originalStorage = {
    getItem() { return 'vraies données du navigateur'; },
    setItem() { originalWrites++; },
    removeItem() { originalWrites++; }
  };
  const fakeWindow = {};
  Object.defineProperty(fakeWindow, 'localStorage', {
    configurable, enumerable: true, value: originalStorage
  });
  Object.defineProperty(fakeWindow, 'sessionStorage', {
    configurable, enumerable: true, value: originalStorage
  });
  const context = vm.createContext({ window: fakeWindow, console: { error() {} } });
  vm.runInContext(previewBoot, context, { timeout: 1000 });
  return { window: fakeWindow, originalStorage, get originalWrites() { return originalWrites; } };
}
test('Prévisualisation: deux catégories fictives et stockage en mémoire uniquement', () => {
  const result = previewFixture();
  assert.equal(result.window.CSV_V73_PREVIEW_BOOT_OK, true);
  assert.equal(result.window.CSV_V73_ISOLATED_PREVIEW, true);
  assert.notEqual(result.window.localStorage, result.originalStorage);
  assert.notEqual(result.window.sessionStorage, result.originalStorage);
  assert.equal(result.originalWrites, 0);
  const get = key => JSON.parse(result.window.localStorage.getItem(key));
  const catalog = get('cslv_multi_catalog_v1');
  assert.equal(catalog.length, 2);
  assert.deepEqual(Array.from(catalog,x=>x.category), ['U10','U11']);
  assert.equal(get('cslv_teams').length, 16);
  assert.equal(get('cslv_matches').filter(m => m.stage.startsWith('Journée')).length, 24);
  assert.equal(get('cslv_mt_u11_apercu_teams').length, 8);
  assert.equal(get('cslv_mt_u11_apercu_matches').filter(m => m.stage.startsWith('Journée')).length, 12);
});
test('Prévisualisation: aucun match du jeu d’essai ne se superpose sur un terrain', () => {
  const storage = previewFixture().window.localStorage;
  const matches = [
    ...JSON.parse(storage.getItem('cslv_matches')),
    ...JSON.parse(storage.getItem('cslv_mt_u11_apercu_matches'))
  ];
  const scheduled = matches.filter(m => m.fieldId && m.startTime && m.endTime);
  const minute = value => Number(value.slice(0,2))*60+Number(value.slice(3,5));
  for(let i=0;i<scheduled.length;i++){
    for(let j=i+1;j<scheduled.length;j++){
      const a=scheduled[i],b=scheduled[j];
      if(a.fieldId !== b.fieldId) continue;
      assert.ok(minute(a.endTime)<=minute(b.startTime) || minute(b.endTime)<=minute(a.startTime),
        'Conflit de terrain entre ' + a.id + ' et ' + b.id);
    }
  }
});
test('Prévisualisation: isolation impossible = démarrage refusé sans retomber sur Firebase', () => {
  const { window } = previewFixture(false);
  assert.equal(window.CSV_V73_PREVIEW_BOOT_OK, false);
  assert.equal(window.CSV_V73_ISOLATED_PREVIEW, false);
  assert.match(window.CSV_V73_PREVIEW_ERROR, /isolable/);
});
test('Prévisualisation: configuration Cloud neutralisée pour le vrai code applicatif', () => {
  const start=app.indexOf('const CSV_V73_ISOLATED_PREVIEW =');
  const end=app.indexOf('// Production : aucune connexion aux émulateurs',start);
  assert.ok(start>=0 && end>start);
  const ctx=vm.createContext({
    window:{CSV_V73_ISOLATED_PREVIEW:true},
    DEFAULT_CLOUD_CONFIG:{projectId:'projet-officiel-factice'}
  });
  vm.runInContext(app.slice(start,end)+'\nthis.previewCloud=loadCloudConfig();',ctx);
  assert.equal(ctx.previewCloud,null);
  assert.match(app,/if \(CSV_V73_ISOLATED_PREVIEW\) throw new Error/);
  assert.match(app,/CSV_V73_ISOLATED_PREVIEW \|\| !\('serviceWorker' in navigator\)/);
  assert.match(app,/CSV_V73_ISOLATED_PREVIEW && csvCachedTournament\(current.id\)/);
  assert.match(app,/const welcomeLoading = !CSV_V73_ISOLATED_PREVIEW/);
  assert.match(app,/if \(CSV_V73_ISOLATED_PREVIEW\) \{\s*if \(options.manual\)/);
});
test('Prévisualisation: page non connectée, CSP strict et scripts valides', () => {
  assert.match(previewHtml,/connect-src 'none'/);
  assert.match(previewHtml,/preview-v73-boot\.js/);
  assert.match(previewHtml,/window\.CSV_V73_PREVIEW_BOOT_OK/);
  assert.doesNotMatch(previewHtml,/firebase-(?:app|auth|firestore)/);
  const blocks=[...previewHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(x=>x[1]).filter(Boolean);
  assert.ok(blocks.length>0);
  for(const code of blocks)new vm.Script(code);
  new vm.Script(previewBoot);
});

test('Prévisualisation: répartition des équipes et rencontres dans les bonnes poules', () => {
  const storage = previewFixture().window.localStorage;
  for (const [prefix, expected] of [['cslv_',4],['cslv_mt_u11_apercu_',2]]) {
    const teams=JSON.parse(storage.getItem(prefix+'teams'));
    const matches=JSON.parse(storage.getItem(prefix+'matches'));
    const groups=Array.from(new Set(teams.map(t=>t.group))).sort();
    assert.equal(groups.length,expected,'Nombre de poules');
    assert.deepEqual(groups,Array.from({length:expected},(_,i)=>'Poule '+String.fromCharCode(65+i)));
    for(const group of groups){
      assert.equal(teams.filter(t=>t.group===group).length,4,group+' doit avoir 4 équipes');
      assert.equal(matches.filter(m=>m.group===group).length,6,group+' doit avoir 6 rencontres');
    }
    const teamById=new Map(teams.map(t=>[t.id,t]));
    for(const match of matches.filter(m=>m.stage.startsWith('Journée'))){
      assert.equal(teamById.get(match.team1Id)?.group,match.group,match.id+' équipe 1');
      assert.equal(teamById.get(match.team2Id)?.group,match.group,match.id+' équipe 2');
    }
  }
});

test('Prévisualisation: tableau principal et classements fictifs préparés, sans qualifications anticipées', () => {
  const storage=previewFixture().window.localStorage;
  for(const [prefix,quarterCount,rankingCount] of [['cslv_',4,4],['cslv_mt_u11_apercu_',0,2]]){
    const matches=JSON.parse(storage.getItem(prefix+'matches'));
    const ko=matches.filter(m=>m.group==='Phase Finale Principale');
    const classement=matches.filter(m=>m.group==='Tournoi Classement');
    assert.equal(ko.filter(m=>m.stage.startsWith('Quart')).length,quarterCount);
    assert.equal(ko.filter(m=>m.stage.startsWith('Demi')).length,2);
    assert.equal(ko.filter(m=>m.stage==='Grande Finale').length,1);
    assert.equal(ko.filter(m=>m.id.endsWith('ko-bronze')).length,1);
    assert.equal(classement.length,rankingCount);
    for(const m of [...ko,...classement]){
      assert.equal(m.status,'pending');
      assert.equal(m.team1Id,null);
      assert.equal(m.team2Id,null);
      assert.equal(m.score1,null);
      assert.equal(m.score2,null);
      assert.ok(m.placeholder1 && m.placeholder2);
      assert.ok(m.source1 && m.source2);
    }
  }
  const u10=JSON.parse(storage.getItem('cslv_matches'));
  const quarter=u10.find(m=>m.id==='principal-ko-q1');
  assert.equal(quarter.source1.group,'Poule A');
  assert.equal(quarter.source1.position,0);
  assert.equal(quarter.source2.group,'Poule B');
  assert.equal(quarter.source2.position,1);
});

test('Finales: le filtre visuel affiche le match pour la troisième place même avec un identifiant préfixé', () => {
  assert.match(app, /m\.id === 'ko-bronze' \|\| \/3\(\?:ème\|e\)/);
  const sample=JSON.parse(previewFixture().window.localStorage.getItem('cslv_matches'));
  const bronze=sample.find(m=>m.stage==='Match 3ème / 4ème place');
  assert.ok(bronze);
  assert.notEqual(bronze.id,'ko-bronze');
  const display=m=>m.group==='Phase Finale Principale' &&
    (m.stage.includes('Quart') || m.stage.includes('Demi') ||
     m.stage.includes('Huitième') || m.id==='ko-bronze' ||
     /3(?:ème|e)\s*\/\s*4/.test(m.stage||''));
  assert.equal(display(bronze),true);
});

test('Classement général: aucune médaille ni podium avant la fin des matchs', () => {
  assert.match(app, /finalTable\.finished \? "\\uD83C\\uDFC6 Classement final du tournoi" : "\\uD83D\\uDCCA Classement général provisoire"/);
  assert.match(app, /finalTable\.finished && r\.position === 1 \? '🥇'/);
  assert.match(app, /finalTable\.finished && r\.position === 2 \? '🥈'/);
  assert.match(app, /finalTable\.finished && r\.position === 3 \? '🥉'/);
  assert.match(app, /finalTable\.finished && r\.position <= 3 \?/);
});

test('Navigation spectateur: le même onglet est conservé lorsqu’on change de catégorie', () => {
  assert.match(app, /const \[viewerActiveTab, setViewerActiveTab\] = useState\('matches'\)/);
  assert.match(app, /viewerActiveTab: viewerActiveTab, onViewerTabChange: setViewerActiveTab/);
  assert.match(app, /const chooseViewerTab = id => \{ setActiveTab\(id\); if \(onViewerTabChange\) onViewerTabChange\(id\); \}/);
  assert.match(app, /setActiveTab\(viewerActiveTab \|\| 'matches'\)/);
  assert.match(app, /id: 'myTeam', icon: '👟', text: 'Mon équipe'/);
});
test('Programme: les matchs programmés passent avant les finales sans heure', () => {
  const start = app.indexOf('const csvViewerMatchOrder =');
  const end = app.indexOf('\n};', start);
  assert.ok(start >= 0 && end > start);
  const ctx=vm.createContext({});
  vm.runInContext(app.slice(start,end+3)+'\nthis.order=csvViewerMatchOrder;',ctx);
  const rows=[
    {id:'quart',stage:'Quart de Finale 1'},
    {id:'poule-2',startTime:'09:20',stage:'Journée 2'},
    {id:'poule-1',startTime:'09:00',stage:'Journée 1'},
    {id:'finale',stage:'Grande Finale'}
  ].sort(ctx.order);
  assert.deepEqual(rows.slice(0,2).map(m=>m.id),['poule-1','poule-2']);
  assert.equal(rows.slice(2).every(m=>!m.startTime),true);
  assert.match(app, /visibleMatches\.slice\(\)\s*\.sort\(csvViewerMatchOrder\)/);
});
