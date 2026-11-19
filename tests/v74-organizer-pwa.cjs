// Exécute les gestionnaires distribués avec des doubles locaux, sans compte ni réseau.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function extract(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, 'Gestionnaire introuvable : ' + start);
  return source.slice(first, last);
}

function runHandler(dependencies, ...sections) {
  return vm.runInNewContext(sections.join('\n'), { URL, ...dependencies });
}

async function organizer() {
  const writes = [];
  const notices = [];
  const day = '2027-06-05';
  const current = { id: 'u10', date: day, published: false };
  const other = { id: 'u11', date: '2027-06-06', published: false };
  const teams = [{ id: 'a', name: 'CSV', players: ['Joueur'] }, { id: 'b', name: 'Frontonas' }];
  let writeError;
  const recordWrite = async (id, value, options) => {
    if (writeError) throw writeError;
    writes.push({ id, value: structuredClone(value), options });
  };
  const db = {
    collection: name => {
      assert.equal(name, 'tournaments');
      return { doc: id => ({ id, set: (value, options) => recordWrite(id, value, options) }) };
    },
    runTransaction: callback => callback({
      get: async () => ({ exists: true, data: () => ({ teams }) }),
      update: (doc, value) => writes.push({ id: doc.id, value: structuredClone(value) })
    })
  };
  const state = {
    userRole: 'editor', csvHasOwnerSession: () => true, requireHub: () => true, dbRef: { current: db }, cloudStatus: 'online',
    tournament: current, tournamentDocId: id => 'event_' + id,
    showToast: message => notices.push(message), setTeams: () => {}
  };
  const logoHelper = extract('function csvSafeLogoUrl(', 'function CsvTeamLogo(');
  const logoHandler = extract('const csvUpdateTeamLogo =', 'const csvUploadTeamLogo =');
  const logo = 'data:image/png;base64,AAAA';
  runHandler(state, logoHelper, logoHandler, `csvUpdateTeamLogo("a", ${JSON.stringify(logo)});`);
  await new Promise(setImmediate);
  assert.equal(writes[0].id, 'event_u10');
  assert.deepEqual(writes[0].value.teams, [{ ...teams[0], logoUrl: logo }, teams[1]]);
  assert.match(notices.at(-1), /Logo du club enregistré/);

  const sponsorHandler = extract('const csvSaveSponsors =', 'const [csvSponsorDraft,');
  runHandler(state, logoHelper, sponsorHandler,
    'csvSaveSponsors("Partenaire CSV | https://cdn.example/logo.png | https://club.example");');
  await new Promise(setImmediate);
  assert.deepEqual(writes[1].value.config.sponsors, [{
    name: 'Partenaire CSV', logoUrl: 'https://cdn.example/logo.png', url: 'https://club.example'
  }]);
  assert.equal(writes[1].options.merge, true);

  const editor = { ...state, csvHasOwnerSession: () => false };
  runHandler(editor, logoHelper, logoHandler, 'csvUpdateTeamLogo("a", "https://cdn.example/logo.png");');
  runHandler(editor, logoHelper, sponsorHandler, 'csvSaveSponsors("Partenaire");');
  assert.equal(writes.length, 2);

  const originalMatch = { id: 'm1', group: 'Poule A', fieldId: 'f1', status: 'pending',
    startTime: '09:00', endTime: '09:15' };
  const updatedMatch = { ...originalMatch, status: 'finished', score1: 2, score2: 1 };
  let savedMatches;
  runHandler({
    ...state, navigator: { onLine: true }, editingMatch: updatedMatch, matches: [originalMatch],
    fields: [{ id: 'f1', name: 'Honneur' }], config: {}, teams,
    activeGroupNames: ['Poule A'], csvMatchAudit: () => null, setMatches: () => {}, setEditingMatch: () => {},
    broadcastUpdate: (config, fields, teams, matches) => { savedMatches = matches; }
  }, extract('const saveMatchDetails =', '// Statistiques des SCORES'), 'saveMatchDetails();');
  assert.deepEqual(structuredClone(savedMatches[0]), { ...updatedMatch, fieldName: 'Honneur' });

  let scorePayload;
  runHandler({
    ...editor, firebase: { apps: [{}], auth: () => ({ currentUser: {} }) },
    csvIsApprovedOrganizer: () => true, isRemoteUpdate: { current: false },
    dbRef: { current: { collection: () => ({ doc: () => ({ set: async value => {
      scorePayload = value;
    } }) }) } }, savedMatches
  }, extract('const broadcastUpdate =', 'const timeToMinutes ='),
  'broadcastUpdate({}, [], [], savedMatches, null, true);');
  assert.deepEqual(Object.keys(scorePayload).sort(), ['matches', 'updatedAt']);
  assert.equal(scorePayload.matches[0].score1, 2);

  const publicationState = {
    ...state, hubIsEditor: true, current, catalog: [current, other], hubStatus: 'online',
    loadedDocs: { u10: true }, records: { u10: { matches: [updatedMatch] } },
    sharedFields: [], csvReadableDay: date => date, window: { confirm: () => true },
    setCatalog: () => {}, setPublicationNotice: state.showToast
  };
  const publish = dependencies => runHandler(dependencies,
    extract('const csvDayIsFullyPublished =', 'const csvNewDayPublication ='),
    extract('const planningMinutes =', '\nconst '),
    extract('const planningOverlap =', '// V6.0 — diagnostic commun'),
    extract('const toggleDayPublication =', 'const addTournament ='), 'toggleDayPublication();');
  await publish({ ...publicationState, csvHasOwnerSession: () => false });
  assert.equal(writes.length, 2);
  await publish({ ...publicationState, loadedDocs: {} });
  assert.match(notices.at(-1), /chargement complet/);
  await publish({ ...publicationState, records: { u10: { matches: [updatedMatch, { ...updatedMatch, id: 'm2' }] } } });
  assert.match(notices.at(-1), /1 conflit/);
  assert.equal(writes.length, 2);
  await publish(publicationState);
  assert.deepEqual(writes[2].value.events, [{ ...current, published: true }, other]);
  assert.match(notices.at(-1), /Journée publiée/);
  writeError = new Error('écriture refusée');
  await publish(publicationState);
  assert.match(notices.at(-1), /Publication non enregistrée/);
  assert.equal(writes.length, 3);
  console.log('OK organisateur simulé : logo, sponsors, score et publication');
}

async function pwa() {
  const scope = 'https://preview.example/tournoi-csv/';
  const stores = new Map();
  const handlers = {};
  const key = request => request.url || String(request);
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { put: async (request, response) => store.set(key(request), response),
        match: async request => store.get(key(request)) };
    }
  };
  let offline = false;
  let activated = false;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), {
    Request, Response, URL, caches,
    fetch: async request => {
      if (offline || !request.url.startsWith(scope)) throw new Error('Hors connexion');
      const name = new URL(request.url).pathname.slice(new URL(scope).pathname.length);
      return new Response(fs.readFileSync(path.join(root, name || 'index.html')));
    },
    self: {
      registration: { scope }, addEventListener: (event, handler) => { handlers[event] = handler; },
      skipWaiting: async () => {}, clients: { claim: async () => { activated = true; } }
    }
  });
  for (const name of ['tournoi-csv-shell-v7.2', 'tournoi-csv-shell-v7.3', 'other-app'])
    await caches.open(name);
  for (const event of ['install', 'activate']) {
    let pending;
    handlers[event]({ waitUntil: promise => { pending = promise; } });
    await pending;
  }
  assert(activated);
  assert.deepEqual((await caches.keys()).sort(), ['other-app', 'tournoi-csv-shell-v7.4.24']);
  const cache = await caches.open('tournoi-csv-shell-v7.4.24');
  for (const file of ['app.js?v=7.4.24', 'styles.css?v=7.4.24', 'spectateur.html', 'organisateur.html'])
    assert(await cache.match(new URL(file, scope)), 'Fichier absent du cache : ' + file);
  offline = true;
  let response;
  handlers.fetch({ request: new Request(scope + 'app.js?v=7.4.24'), respondWith: promise => { response = promise; } });
  assert.match(await (await response).text(), /csvUpdateTeamLogo/);
  handlers.fetch({ request: new Request('https://firestore.googleapis.com/example'),
    respondWith: () => assert.fail('La requête Firestore est interceptée') });
  console.log('OK PWA simulée : remplacement des anciens caches et JS V7.4 hors ligne');
}

Promise.all([organizer(), pwa()]).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
