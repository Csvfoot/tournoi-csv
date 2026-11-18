# Tournoi CSV V7.3 — chantier en cours

Branche : `develop-v73` (ne pas déployer sur `main` sans validation).

## Première évolution — logos facultatifs
- `ecran.js` et `ecran.css` : logos à côté des équipes sur les matchs et classements, repli sur une pastille de couleur.
- `app.js` : logos sur fiches d'équipes, « Mon équipe », matchs chronologiques/par terrain, poules, classement final et phases finales.
- `logos-equipes.html`, `logos-equipes.css`, `logos-equipes.js` : page de gestion des logos réservée au compte principal.
- `gestion-organisateurs.html` : lien administrateur vers cette page.
- Champ de données canonique : `tournaments/{id}.teamLogos[teamId]` (champ séparé). La lecture reste compatible avec l’ancien champ facultatif `teams[].logoUrl`. Les équipes sans logo conservent leur présentation.

## Sécurité et intégrité
- URLs HTTPS d'images PNG/JPEG/WebP ou chemins relatifs `./logos/` ; aucun HTML non fiable.
- Gestionnaire réservé au UID propriétaire Firebase avec adresse vérifiée ; les règles Firestore restent l'autorité définitive.
- Enregistrement d'un logo à la fois par transaction ; modifie uniquement le chemin Firestore `teamLogos.<teamId>`, jamais `teams`, `matches` ou `config`.\n- Import de fichiers PNG/JPEG/WebP : conversion client en WebP (512 px max, 125 Ko max), téléchargement local puis hébergement séparé ; aucun jeton GitHub exposé dans l'application.\n- Vérification des adresses en HTTPS et de la présence en ligne avant tentative d'enregistrement (fichiers `./logos/`).
- Les comptes organisateurs secondaires ne reçoivent aucun droit nouveau par cette évolution.
- `?demo=1` : aperçu fictif sans écriture Firebase.

## À vérifier avant publication
1. Tester le champ `teamLogos` dans l'émulateur Firestore avant publication. Vérifier : propriétaire autorisé, organisateur secondaire et spectateur refusés.
2. Vérifier l'absence de conflits avec une mise à jour simultanée des scores, notamment la synchronisation du tableau organisateur.
3. Tester les logos manquants, liens cassés, mobile, iPad et écran TV.
4. Décider d'un hébergement sécurisé pour les logos et, si nécessaire, préparer une intégration Cloud Storage soumise à règles et tests. L'import optimisé est pour le moment local, sans téléversement automatique. Ne pas stocker d'images base64 dans Firestore.
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

## Vérifications du 18 novembre 2026
- Syntaxe JavaScript vérifiée pour `app.js`, `ecran.js`, `logos-equipes.js` et `reglages-ecran.js` sur `develop-v73`.
- Prévisualisation autonome testée par navigateur : 4 équipes U10, 3 U11, validation des paramètres, URL dangereuse refusée, image locale convertie en WebP (7,2 Ko), téléchargement WebP, absence de débordement sur 390 px, aucune exception JS.
- Ces essais ne remplacent **pas** les tests des règles Firebase ni une validation sur les appareils réels.

## Étape 3 — sponsors et informations pratiques (18 novembre 2026)
- Fichiers publics `experience-v73.js` et `experience-v73.css` chargés sur `index.html` et `spectateur.html` (branche de développement seulement).
- Configurations **optionnelles** : annonce, informations utiles, partenaires (nom, mention, logo et lien HTTPS). Aucune fausse information réelle tant qu'elles ne sont pas renseignées.
- Accueil spectateur « Matchs » : volet « Infos pratiques » alimenté par la catégorie/date/terrains de la journée et les services configurés, ainsi que grille responsive des partenaires.
- Aucune modification des résultats, catégories, règles Firestore, comptes ou scores.
- Validation des liens HTTPS sans identifiants ; logos HTTPS PNG/JPG/WebP ou chemin `./logos/` ; texte ajouté au DOM par React, sans HTML brut.
- Prévisualisation autonome avec **données fictives**, testée à 1280 et 390 px : changement U10/U11, ajout de partenaire, rejet de `javascript:`, vérification des réglages et absence d'erreur JS ou de débordement.
- **À faire avant production** : renseignement de vrais partenaires et informations pratiques, vérification de l'intégration au React réel, cache/service worker, contrôles Firestore de `teamLogos`, tests sur téléphones/TV et sauvegarde.

## Étape 4 — éditeur de réglages publics (18 novembre 2026)
- `reglages-publics-v73.html` : formulaire pour annonces, services et partenaires, chargé à partir de `experience-v73.js` réellement présent sur la branche.
- Aperçu instantané, vérification des liens HTTPS et des logos, limites de champs et export local du fichier `experience-v73.js` uniquement après validation.
- Aucun accès Firebase, aucun changement de scores, aucune publication et aucun secret requis. L'export est un téléchargement : la mise en ligne éventuelle reste une opération distincte.
- À vérifier sur navigateur réel : ouverture de l'éditeur, modification d'un service et d'un partenaire, rejet d'URL non HTTPS, téléchargement du fichier, puis intégration manuelle du fichier exporté dans une branche de test.

## Étape 5 — navigation mobile « Mon équipe » (18 novembre 2026)
- Le bouton « Mon équipe » de la barre de navigation spectateur ouvre directement le calendrier si une équipe valide a déjà été sélectionnée et mémorisée sur cet appareil.
- Lorsqu'aucune équipe reconnue n'est mémorisée, le sélecteur d'équipe existant s'ouvre comme auparavant.
- Le calendrier affiche un bouton « Changer d'équipe » pour revenir au sélecteur, et un bouton de fermeture accessible de 44 px.
- Aucune modification des matchs, scores, Firebase ou droits organisateur ; l'identifiant d'équipe reste enregistré seulement en local comme auparavant.
- app.js relu sur GitHub après commit ; analyse syntaxique JavaScript réussie.
- **Tests à réaliser** : première sélection, deuxième ouverture, changement d'équipe, sélection supprimée du tournoi, rechargement de la page et affichage mobile.

## Étape 6 — tests de non-régression et contrôle visuel (18 novembre 2026)
- Nouvelle suite Node.js autonome `tests/v73.test.cjs` : scores 0 à 999, contrôle des champs vides, bornes +/−, préservation des matchs renseignés, références d'équipes, configuration publique et ouverture de « Mon équipe ».
- Workflow `.github/workflows/verification-v73.yml` : exécution demandée sur push de `develop-v73` uniquement, avec permission minimale `contents: read`; aucune publication ni authentification Firebase.
- Nouveau `controle-visuel-v73.html` : panneau de contrôle responsive qui lit la configuration **réelle** de `experience-v73.js` sur la branche déployée localement, sans inventer de sponsors et sans importer Firebase. Il réaffiche l'annonce, les services et partenaires et liste les validations de structure et de liens.
- Vérification directe effectuée sur GitHub : le panneau est bien présent, son JavaScript inline a une syntaxe valide, la configuration publique est bien lue, aucun SDK Firebase n'est chargé. Une analyse statique et 9 vérifications unitaires directes ont réussi. Exécution du workflow GitHub Actions et tests sur appareils réels **encore à confirmer**.
- La version de développement contient toujours l'identifiant du **projet Firebase officiel** dans `app.js` : il serait dangereux de l'héberger sur une URL de prévisualisation non isolée, car les authentifications et les écritures pourraient concerner les vraies données. **Ne pas déployer l'application complète V7.3 tant qu'un environnement Firebase de test distinct (ou une isolation effective des accès) n'est pas prêt et vérifié.**
- En attendant, le contrôle visuel et l'éditeur de réglages publics sont entièrement séparés de Firebase et ne peuvent modifier les tournois.
