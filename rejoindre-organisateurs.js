/* Inscription isolée de la session principale: app Firebase nommée. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.CSV_ORGANIZERS_CONFIG;
  // App nommée pour ne jamais déconnecter le propriétaire sur son propre appareil.
  const app = firebase.apps.find(a => a.name === 'csv-join') || firebase.initializeApp(cfg.firebase, 'csv-join');
  const auth = app.auth(); const db = app.firestore();
  const msg = (message, ok = false) => { $('alert').textContent = message; $('alert').className = 'msg' + (ok ? ' ok' : ''); };
  const friendlyError = err => {
    if (err && err.code === 'auth/email-already-in-use') return 'Ce compte existe déjà : utilise le formulaire 2.';
    if (err && err.code === 'auth/weak-password') return 'Choisis un mot de passe plus robuste.';
    if (err && err.code === 'permission-denied') return 'Les droits d’inscription ne sont pas encore activés sur Firestore.';
    return err.message || String(err);
  };
  $('registerForm').addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('registerBtn'); btn.disabled = true;
    try {
      const name = $('displayName').value.trim();
      const email = $('email').value.trim().toLowerCase();
      if (name.length < 2) throw Error('Indique ton prénom et ton nom.');
      const result = await auth.createUserWithEmailAndPassword(email, $('password').value);
      await result.user.updateProfile({displayName: name});
      await result.user.sendEmailVerification();
      $('requestEmail').value = email; $('requestName').value = name; $('password').value = '';
      msg('Compte créé. Vérifie l’e-mail reçu, puis utilise le formulaire 2 pour transmettre ta demande.', true);
    } catch (err) { msg(friendlyError(err)); }
    finally { btn.disabled = false; await auth.signOut().catch(() => {}); }
  });
  $('requestForm').addEventListener('submit', async e => {
    e.preventDefault(); const btn = $('requestBtn'); btn.disabled = true;
    try {
      const email = $('requestEmail').value.trim().toLowerCase();
      const name = $('requestName').value.trim();
      if (name.length < 2 || name.length > 80) throw Error('Indique un nom entre 2 et 80 caractères.');
      const result = await auth.signInWithEmailAndPassword(email, $('requestPassword').value);
      await result.user.reload(); await result.user.getIdToken(true);
      if (!result.user.emailVerified) {
        await result.user.sendEmailVerification();
        throw Error('Ton adresse n’est pas encore validée. Un e-mail de confirmation vient d’être renvoyé.');
      }
      const uid = result.user.uid;
      if (result.user.email.toLowerCase() !== email) throw Error('Adresse de compte différente.');
      const ref = db.collection('organizer_requests').doc(uid);
      const existing = await ref.get({source:'server'});
      if (!existing.exists) {
        await ref.set({email:result.user.email, displayName:name, status:'pending', createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      }
      $('requestPassword').value = '';
      msg('Demande enregistrée. Le responsable du CSV doit maintenant l’approuver.', true);
    } catch (err) { msg(friendlyError(err)); }
    finally { btn.disabled = false; await auth.signOut().catch(() => {}); }
  });
})();
