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

## Étape 7 — prévisualisation du vrai spectateur isolée (18 novembre 2026)
- Page `previsualisation-v73.html` : charge **le vrai `app.js` V7.3** en mode spectateur, avec les CSS réels, sans charger les SDK Firebase ni le service worker.
- Drapeau `CSV_V73_ISOLATED_PREVIEW` : `loadCloudConfig()` renvoie `null` et la fonction de connexion Firebase refuse explicitement de fonctionner en mode aperçu. La page impose également `connect-src 'none'` par CSP : elle n'autorise aucune connexion Firestore.
- Script `preview-v73-boot.js` : remplace `window.localStorage` par une Map en mémoire **avant** le démarrage de l'application ; si cette isolation du stockage échoue, la page refuse de charger `app.js`. Ainsi, aucune clé du cache du site officiel n'est touchée.
- Données explicitement fictives : U10 (16 équipes, 4 poules), U11 (8 équipes, 2 poules), 4 terrains et 36 matchs au total. Quelques scores fictifs terminés, les autres à venir. Ces données servent à tester la vraie navigation, la fiche « Mon équipe » et les classements ; elles ne proviennent jamais de Firebase.
- Contrôles réalisés par exécution du bootstrap : 10 contrôles réussis, notamment 2 catégories/24 équipes/36 rencontres, aucun conflit de terrain, références d'équipes cohérentes, configuration Cloud nulle, refus de démarrer si le stockage navigateur n'est pas isolable.
- Correctif complémentaire : la page d'accueil spectateur ne reste plus bloquée en « chargement » quand Firebase est volontairement désactivé. L'actualisation serveur est également neutralisée en mode aperçu, sans message d'erreur trompeur.
- La page de prévisualisation renvoie vers le panneau séparé qui vérifie les **réglages publics réellement chargés** (`experience-v73.js`).
- La suite `tests/v73.test.cjs` contient maintenant des tests pérennes couvrant cet isolement ; leur exécution automatique par GitHub Actions doit encore être confirmée dans l'interface GitHub.
- **Important** : la page est bien enregistrée dans `develop-v73`, mais **elle n'est pas encore déployée**. Le lien GitHub vers le code n'est pas un lien de prévisualisation utilisable sur iPhone. Avant d'annoncer un site de test accessible, mettre en place un hébergement distinct, puis contrôler le rendu réel et les interactions sur téléphone et ordinateur. Ne surtout pas remplacer la publication officielle par la branche `develop-v73`.

## Étape 8 — paquet de prévisualisation distribuable (18 novembre 2026)
- Workflow `.github/workflows/paquet-preview-v73.yml` ajouté : contrôle JavaScript et tests Node, création d'un répertoire statique `dist-preview-v73/` avec la vraie application de test, puis archivage comme artifact `tournoi-csv-v73-preview-isolee` (sans déploiement). GitHub Actions doit encore confirmer l'exécution réussie et la présence de l'artefact.
- `preview-v73-boot.js` isole désormais **localStorage et sessionStorage** dans une mémoire temporaire commune ; échec de l'un ou de l'autre = refus de charger l'application. Tests mis à jour.
- Vérifications directes supplémentaires réalisées : 8/8 sur les scripts, le stockage, les 24 équipes et 36 matchs, l'absence de déploiement dans le workflow et la CSP réseau.
- `GUIDE_PREVISUALISATION_V73.md` explique le téléchargement de l'artefact GitHub, un essai local Windows, et la mise à disposition facultative via un hébergement HTTPS distinct, tel que Netlify Drop. Une URL publique ne doit pas être annoncée tant qu'elle n'existe pas et n'a pas été réellement testée.
- **Ne pas déployer ce dossier sur GitHub Pages officiel** ni mélanger les données de production et de test.

## Étape 9 — défaut réel découvert pendant le test Mac : poules fictives (18 novembre 2026)
- Retour utilisateur : « Poules » montrait les 16 équipes U10 dans la poule A et la poule B vide.
- Cause : le générateur de démonstration `preview-v73-boot.js` renseignait `matches[].group` mais omettait `teams[].group`. Le moteur de classement s'appuie sur la poule affectée à chaque équipe, avec repli historique vers « Poule A ».
- Correction limitée **aux données fictives** : `group` ajouté à chaque équipe au moment de sa création. U10 : 4 poules A/B/C/D de 4 équipes, 6 matchs par poule. U11 : 2 poules A/B de 4 équipes.
- Test ajouté dans `tests/v73.test.cjs` : nombre de poules, tailles de groupes, nombre de matchs et cohérence des groupes de chaque adversaire.
- Vérification directe du générateur effectuée : 24 équipes et 36 matchs avec groupes cohérents, 4+2 poules correctement réparties.
- **Important** : télécharger le nouvel artefact GitHub Actions après le commit, puis arrêter/relaisser le serveur local sur le dossier fraîchement décompressé. Un ancien dossier conserve l'ancien générateur.

## Étape 10 — tableau des finales absent dans l’aperçu Mac (18 novembre 2026)
- Retour utilisateur : l'onglet « Finales » affichait uniquement les titres sans aucune rencontre.
- Cause confirmée : le jeu de démonstration comportait les 36 rencontres de poules mais **aucun match** `Phase Finale Principale` ni `Tournoi Classement`. L'interface filtre correctement les rencontres existantes ; l'absence de tableau était due aux données d'essai.
- Correction du **bootstrap fictif uniquement** : U10, 4 quarts croisés A1–B2, B1–A2, C1–D2, D1–C2, deux demi-finales, grande finale, troisième place et quatre rencontres de classement ; U11, deux demies croisées, grande finale, troisième place et deux classements.
- Les qualifications restent vides avant la fin des poules : `team1Id`, `team2Id`, scores et tirs au but sont `null`. Des `source1`/`source2` et intitulés « 1e Poule A » ou « Vainqueur du match précédent » expliquent les emplacements.
- Le bootstrap comporte maintenant 36 matchs de poules **plus 18 matchs de tableau / classement** (54 au total). Tests automatisés mis à jour : les conflits ignorent les matchs non planifiés, les affectations d'équipes sont testées sur les matchs de poules, et un test spécifique vérifie la structure du tableau.
- Vérification directe : 24 matchs de poules, 8 matchs du tableau principal et 4 classements en U10 ; 12 matchs de poules, 4 matchs du tableau principal et 2 classements en U11 ; aucune qualification anticipée.
- **Pour tester sur Mac** : télécharger le dernier paquet GitHub Actions réussi, décompresser dans un nouveau dossier, arrêter le serveur local précédent, puis relancer depuis ce dossier. Le lien de l’ancien dossier conservera les anciens fichiers.

## Étape 11 — affichage du classement général provisoire (18 novembre 2026)
- Capture réelle Mac : 16 équipes affichées dans le classement général avec des médailles 1–3 alors que les poules et finales fictives restent inachevées.
- Correctif d'interface dans `app.js` : titre « Classement général provisoire » lorsque `finalTable.finished` est faux ; aucun podium ni surlignage de médaillés avant la fin de toutes les rencontres. Une fois le calendrier achevé, titre final et médailles reviennent.
- Aucun changement de calcul de points, de résultats, d'affectation d'équipe ou de Firebase. Test de non-régression ajouté dans `tests/v73.test.cjs`.
- À revoir dans une évolution ultérieure : présenter explicitement le classement provisoire par niveau de qualification, éviter de faire passer une position inter-poules pour une place définitive.

## Étape 12 — retours ergonomie iPhone 16 (18 novembre 2026)
- Test sur format 393×852 : « Mon club » au lieu de « Mon équipe » ; le changement U10/U11 réinitialisait l’onglet « Poules », « Finales » ou « Statistiques » sur « Matchs » ; les finales fictives sans horaire s’affichaient avant les matchs de poule.
- **Libellé** : navigation mobile spectateur toujours « Mon équipe ».
- **Onglet conservé** : `viewerActiveTab` déplacé au niveau de `MultiTournamentShell`, transmis à `TournamentApp` et mis à jour lors des clics dans les navigations spectateur desktop, mobile et menu « Plus ». Il reste en mémoire lors du changement de catégorie. Les raccourcis de l’accueil continuent d’ouvrir volontairement l’écran demandé ; un ancien raccourci est effacé lorsqu’on choisit une autre catégorie.
- **Ordre des matchs** : ajout de `csvViewerMatchOrder`, qui trie d'abord les matchs avec horaire valide `HH:mm`, puis les rencontres sans horaire. Cette correction ne change pas les horaires ni l’ordre enregistré dans Firebase. La vue chronologique et la vue par terrain l’emploient.
- Deux tests de non-régression ajoutés dans `tests/v73.test.cjs` : continuité d’onglet et priorité aux matchs planifiés.
- Scripts relus sur GitHub, syntaxe JavaScript contrôlée ; validation réelle sur Mac/iPhone **à refaire après téléchargement du nouvel artefact**.

## Étape 13 — arbre des finales responsive (18 novembre 2026)
- Nouvelle interface `CsvV73Bracket` directement branchée sur l'onglet `Finales` de l'application réelle, sans dépendance nouvelle. Elle lit les matchs existants : aucune création de qualification, aucun score ou horaire fictif supplémentaire.
- Ordinateur : colonnes par tour (huitièmes si applicables, quarts, demies, finale), cartes équipe / logo / score / statut et indicateurs de connexion graphiques. Tablette : colonnes compactes.
- Mobile (jusqu'à 767 px) : boutons tactiles de 44 px pour choisir le tour à voir ; un seul tour affiché à la fois pour éviter un défilement horizontal de l'arbre.
- Match pour la troisième place dans un panneau séparé, matchs de classement dans un autre ; les poules et les résultats ne changent pas.
- `experience-v73.css` enrichi pour les écrans et `tests/v73.test.cjs` complété de contrôles de la structure rendue et des styles responsive.
- Vérification directe de création du composant avec React simulé : navigation mobile présente, colonnes desktop présentes, bronze et classements séparés, cartes des rencontres rendues.
- **À valider visuellement dans le navigateur et sur iPhone** après téléchargement du paquet GitHub Actions : espacement des colonnes, lisibilité des équipes, absence de débordement et passage entre tours.
- Cette étape est uniquement dans `develop-v73`. `main` et Firebase sont inchangés.

## Étape 14 — diagnostics de planification et tests renforcés (18 novembre 2026)
- Contrôles automatiques ajoutés aux tests V7.3 : conflit entre deux matchs sur un terrain, chevauchement d'une même équipe sur deux terrains, absence de conflit entre catégories distinctes utilisant un même ID local, réservation de créneau, absence de conflit pour deux créneaux contigus, pause de rotation 0 et 5 minutes.
- **Défaut corrigé** : l'indicateur de conflits dans le tableau de bord organisateur comptait les *matchs impliqués* et non les *paires de collisions*. Il appelle désormais `planningConflictPairs(...).length`, qui compte chaque paire réellement conflictuelle, notamment lorsque trois matchs se chevauchent sur un terrain (3 paires au lieu de 2 matchs comptés).
- Vérification directe : trois matchs simultanés sur le même terrain donnent 3 paires ; déplacer un match sur un terrain différent réduit ce nombre à 1 paire ; la syntaxe JavaScript du code et des tests reste valide.
- Les tests n'effacent ni matchs ni résultats et n'ouvrent aucun accès Firebase. La prochaine validation fonctionnelle doit se faire avec un scénario d'organisation isolé avant toute publication.
