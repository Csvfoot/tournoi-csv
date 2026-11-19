// Smoke test d'intégration spectateur V7.4, sans aucune écriture.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg',
  '.jpeg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data) => {
    if(err){res.writeHead(404);return res.end('Fichier absent');}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  });
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto('http://127.0.0.1:'+port+'/spectateur.html',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(response.status(),200);
    let loaded=false;
    try { await page.waitForFunction(()=>{
      const x=document.body.innerText||'';
      return x.includes('Le football se vit ici.') ||
        x.includes('JOURNÉE DU TOURNOI') || x.includes('Aucune journée publiée');
    },{timeout:30000});loaded=true; }catch(e){}
    // L'application peut afficher immédiatement le squelette avant la réponse Firebase.
    // Observer son état stabilisé, sans écrire dans le projet Firebase.
    await page.waitForTimeout(12000);
    const text=(await page.locator('body').innerText()).slice(0,1200);
    const stillSyncing = text.includes('Synchronisation du programme') ||
        text.includes('Récupération des journées publiées');
    console.log('Synchronisation Firebase encore affichée après 12 s:', stillSyncing);
    fs.mkdirSync(path.join(root,'test-artifacts'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-artifacts','v74-page-spectateur-reelle.png'),fullPage:true});
    console.log('Entrée HTML:',response.status(),'| Interface chargée:',loaded);
    console.log('Libellés visibles:',text.replace(/\s+/g,' ').slice(0,250));
    console.log('Erreurs JS:',errors.slice(0,8));
    assert(loaded,'La page spectateur complète n’a pas quitté son écran de chargement');
    assert(errors.filter(e=>/ReferenceError|TypeError|is not defined|Cannot read properties/.test(e)).length===0,
      'Erreur JavaScript dans la page complète : '+errors.join(' | '));
    await page.close();
    // Porte d'entrée organisateur sans compte : seul l'écran de connexion doit être accessible.
    const organizer = await browser.newPage({viewport:{width:390,height:844}});
    const organizerErrors=[];
    organizer.on('pageerror',e=>organizerErrors.push(e.message));
    const orgResponse=await organizer.goto('http://127.0.0.1:'+port+'/organisateur.html',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(orgResponse.status(),200);
    await organizer.getByRole('heading',{name:'Espace organisateur'}).waitFor({timeout:30000});
    assert.equal(await organizer.getByRole('textbox',{name:'Adresse e-mail'}).count(),1);
    assert.equal(await organizer.locator('input[type="password"]').count(),1);
    assert.equal(await organizer.getByText('Connexion Firebase organisateur obligatoire').count(),1);
    assert.equal(await organizer.getByRole('button',{name:'Se connecter'}).count(),1);
    await organizer.screenshot({path:path.join(root,'test-artifacts','v74-organisateur-acces.png'),fullPage:true});
    assert.equal(organizerErrors.filter(x=>/ReferenceError|TypeError|is not defined/.test(x)).length,0,
      'Erreur à la porte organisateur '+organizerErrors.join(';'));
    console.log('OK ouverture organisateur : authentification obligatoire, pas de saisie sans compte');
    await organizer.close();
    // Un lien forgé role=editor n'accorde pas de privilège sur le portail public.
    const forged=await browser.newPage({viewport:{width:390,height:844}});
    const view=await forged.goto('http://127.0.0.1:'+port+'/spectateur.html?role=editor',
      {waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(view.status(),200);
    await forged.getByRole('main',{name:'Accueil CSV Spectateur'}).waitFor({timeout:30000});
    assert.equal(await forged.getByRole('heading',{name:'Espace organisateur'}).count(),0);
    console.log('OK lien public role=editor : reste spectateur');
    await forged.close();
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
