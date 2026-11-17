/* TOURNOI CSV — espace propriétaire; autorisation effective par les règles Firestore. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.CSV_ORGANIZERS_CONFIG;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg.firebase);
  const auth = app.auth();
  const db = app.firestore();
  const ownerUid = cfg.ownerUid;
  let detach = [];
  const show = (message, ok = false) => {
    $('alert').textContent = message;
    $('alert').className = 'msg' + (ok ? ' ok' : '');
  };
  const item = (record, kind) => {
    const div = document.createElement('div'); div.className = 'person';
    const meta = document.createElement('div');
    const name = document.createElement('b'); name.textContent = record.displayName || record.email || 'Organisateur';
    const email = document.createElement('small'); email.textContent = record.email || '';
    meta.append(name, email); div.appendChild(meta);
    const actions = document.createElement('div'); actions.className = 'row';
    if (kind === 'request') {
      const approve = document.createElement('button'); approve.type = 'button'; approve.textContent = 'Autoriser';
      approve.addEventListener('click', async () => {
        if (!confirm('Autoriser ' + record.email + ' à modifier les tournois ?')) return;
        approve.disabled = true;
        try {
          // UID issu du document de demande : jamais d'autorisation par simple e-mail.
          await db.collection('organizers').doc(record.uid).set({
            email: record.email, displayName: record.displayName || '',
            role: 'editor', active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: ownerUid
          });
          await db.collection('organizer_requests').doc(record.uid).delete();
          show('Accès accordé à ' + record.email + '.', true);
        } catch (e) { show('Autorisation non appliquée : ' + e.message); approve.disabled = false; }
      });
      const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'danger'; reject.textContent = 'Refuser';
      reject.addEventListener('click', async () => {
        if (!confirm('Refuser et supprimer cette demande ?')) return;
        reject.disabled = true;
        try { await db.collection('organizer_requests').doc(record.uid).delete(); show('Demande refusée.', true); }
        catch (e) { reject.disabled = false; show('Erreur : ' + e.message); }
      });
      actions.append(approve, reject);
    } else {
      const badge = document.createElement('span'); badge.className = 'pill ' + (record.active ? 'green' : 'red'); badge.textContent = record.active ? 'Actif' : 'Suspendu';
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = record.active ? 'danger' : 'secondary'; toggle.textContent = record.active ? 'Suspendre' : 'Réactiver';
      toggle.addEventListener('click', async () => {
        if (!confirm((record.active ? 'Suspendre' : 'Réactiver') + ' l’accès de ' + record.email + ' ?')) return;
        toggle.disabled = true;
        try { await db.collection('organizers').doc(record.uid).update({active: !record.active}); show('Accès mis à jour.', true); }
        catch (e) { toggle.disabled = false; show('Erreur : ' + e.message); }
      });
      actions.append(badge, toggle);
    }
    div.appendChild(actions); return div;
  };
  const render = (target, docs, kind) => {
    const box = $(target); box.replaceChildren();
    const filtered = docs.filter(d => kind === 'request' ? d.status === 'pending' : d.role === 'editor');
    if (!filtered.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = kind === 'request' ? 'Aucune demande en attente.' : 'Aucun autre organisateur pour le moment.'; box.append(p); return; }
    filtered.forEach(d => box.append(item(d, kind)));
  };
  auth.onAuthStateChanged(async user => {
    detach.forEach(f => f()); detach = [];
    $('dashboard').classList.add('hidden');
    $('loginBox').classList.add('hidden');
    if (!user || user.isAnonymous) { $('loading').textContent = 'Connecte-toi avec ton compte administrateur.'; $('loginBox').classList.remove('hidden'); return; }
    try {
      await user.reload(); await user.getIdToken(true);
      if (auth.currentUser !== user || !user.emailVerified || user.uid !== ownerUid) {
        $('loading').textContent = 'Accès réservé au responsable principal du Tournoi CSV. Connecte-toi avec le compte administrateur.';
        $('loginBox').classList.remove('hidden');
        return;
      }
      $('loading').classList.add('hidden'); $('dashboard').classList.remove('hidden');
      detach.push(db.collection('organizer_requests').orderBy('createdAt', 'desc').onSnapshot(
        q => render('requests', q.docs.map(d => ({uid:d.id,...d.data()})), 'request'),
        e => show('Demandes indisponibles : vérifie les règles Firestore (' + e.message + ')')));
      detach.push(db.collection('organizers').onSnapshot(
        q => render('editors', q.docs.map(d => ({uid:d.id,...d.data()})), 'editor'),
        e => show('Organisateurs indisponibles : vérifie les règles Firestore (' + e.message + ')')));
    } catch (e) { $('loading').textContent = 'Vérification impossible : ' + e.message; }
  });
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    try { await auth.signInWithEmailAndPassword($('ownerEmail').value.trim(), $('ownerPassword').value); $('ownerPassword').value = ''; }
    catch (err) { show('Connexion impossible : ' + err.message); }
  });
  $('copyLink').addEventListener('click', () => {
    const url = new URL('./rejoindre-organisateurs.html', location.href).href;
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => show('Lien copié.', true), () => window.prompt('Copie ce lien :', url));
    else window.prompt('Copie ce lien :', url);
  });
})();
