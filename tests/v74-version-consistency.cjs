// Contrôle V7.4 : l'application web installée doit récupérer la même version
// sur ordinateur, iPhone et en mode hors connexion.
const fs=require('node:fs'),assert=require('node:assert/strict');
const files=['index.html','spectateur.html','organisateur.html'];
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const worker=fs.readFileSync('sw.js','utf8');
const version=(app.match(/const CSV_APP_VERSION = '([^']+)'/)||[])[1];
assert.equal(version,'7.4');
for(const f of files){
 const s=fs.readFileSync(f,'utf8');
 assert.match(s,new RegExp('app\\.js\\?v='+version.replace('.','\\.')));
 assert.match(s,new RegExp('styles\\.css\\?v='+version.replace('.','\\.')));
 assert.match(s,/V7\.4/);
}
assert.match(worker,/tournoi-csv-shell-v7\.4/);
assert.match(worker,/\.\/app\.js\?v=7\.4/);
assert.match(worker,/\.\/styles\.css\?v=7\.4/);
assert.match(worker,/!own&&!external/);
assert.match(css,/\.csv-v74-welcome/);
assert.match(css,/\.csv-v74-rounds/);
assert.match(css,/\.csv-v74-tv-board/);
for(const f of ['manifest.webmanifest','manifest-spectateur.webmanifest','manifest-organisateur.webmanifest']){
 const m=JSON.parse(fs.readFileSync(f,'utf8'));
 assert.match(JSON.stringify(m),/V7\.4/);
}
console.log('OK cohérence V7.4 : HTML, CSS, JS, PWA, cache, manifestes');