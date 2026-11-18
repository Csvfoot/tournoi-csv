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
