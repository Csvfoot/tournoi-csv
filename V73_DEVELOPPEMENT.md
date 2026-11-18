# Tournoi CSV V7.3 — chantier en cours

Branche : `develop-v73` (ne pas déployer sur `main` sans validation).

## Première évolution — logos facultatifs
- `ecran.js` et `ecran.css` : logos à côté des équipes sur les matchs et classements, repli sur une pastille de couleur.
- `app.js` : logos sur fiches d'équipes, « Mon équipe », matchs chronologiques/par terrain, poules, classement final et phases finales.
- `logos-equipes.html`, `logos-equipes.css`, `logos-equipes.js` : page de gestion des logos réservée au compte principal.
- `gestion-organisateurs.html` : lien administrateur vers cette page.
- Champ de données facultatif : `teams[].logoUrl` ; les équipes sans logo conservent leur présentation.

## Sécurité et intégrité
- URLs HTTPS d'images PNG/JPEG/WebP ou chemins relatifs `./logos/` ; aucun HTML non fiable.
- Gestionnaire réservé au UID propriétaire Firebase avec adresse vérifiée ; les règles Firestore restent l'autorité définitive.
- Enregistrement d'un logo à la fois par transaction ; ne met à jour que `teams`, jamais `matches` ou `config`.
- Les comptes organisateurs secondaires ne reçoivent aucun droit nouveau par cette évolution.
- `?demo=1` : aperçu fictif sans écriture Firebase.

## À vérifier avant publication
1. Tester l'ajout et le retrait d'un logo dans un projet Firebase de développement/émulateur. Vérifier : propriétaire autorisé, organisateur secondaire et spectateur refusés.
2. Vérifier l'absence de conflits avec une mise à jour simultanée des scores, notamment la synchronisation du tableau organisateur.
3. Tester les logos manquants, liens cassés, mobile, iPad et écran TV.
4. Préparer une solution d'hébergement des logos sous le domaine officiel ; ne pas stocker d'images base64 dans les documents Firestore.
5. Mettre à jour les paramètres de cache PWA et les étiquettes de version avant publication.
6. `app.jsx` est une ancienne source (V6.x) et n'est pas synchronisée avec `app.js` utilisé en V7.2. Ne **pas** régénérer `app.js` à partir de cet ancien fichier avant réconciliation.

## Suite V7.3
- Accueil spectateur plus direct.
- Fiche « Mon équipe » mise en avant et calendrier filtrable.
- Sponsors, informations pratiques, navigation mobile.
- Saisie de score plus agréable.
- Harmonisation des couleurs et composants, y compris vue TV.
- Tests et sauvegarde avant tout déploiement.

Aucun changement de règles Firebase et aucune publication de la V7.3 ne sont inclus dans ces commits.
