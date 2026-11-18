# Prévisualisation V7.3 — procédure de test sans toucher au site officiel

## Ce qui est prêt
- La branche de développement `develop-v73` contient `previsualisation-v73.html` (vrai code spectateur) et `preview-v73-boot.js` (24 équipes fictives, 36 matchs).
- Les écritures et lectures Firebase sont désactivées en prévisualisation. Les stockages locaux et de session sont remplacés par des espaces temporaires en mémoire.
- La CSP refuse toute connexion sortante via JavaScript (`connect-src 'none'`).
- Le processus `.github/workflows/paquet-preview-v73.yml` vérifie les scripts puis prépare un artefact téléchargeable. **Il ne publie pas le site.**

## A. Récupérer les fichiers depuis GitHub

1. Ouvrir https://github.com/Csvfoot/tournoi-csv/actions.
2. Dans les workflows, sélectionner « V7.3 - Préparer aperçu isolé (sans déploiement) ».
3. Ouvrir la dernière exécution réussie sur `develop-v73`, si elle est disponible.
4. Dans « Artifacts », télécharger `tournoi-csv-v73-preview-isolee`.
5. Décompresser le fichier ZIP et conserver le contenu ensemble.

Si aucune exécution n'est visible, vérifier dans les paramètres du dépôt que GitHub Actions est activé. Selon les paramètres de GitHub, un workflow qui n'existe pas encore sur la branche par défaut peut ne pas être proposé à l'exécution manuelle. Ne pas fusionner la branche uniquement pour lancer ce workflow.

## B. Prévisualisation locale sur Windows (option avant tout hébergement)

Ouvrir un terminal Windows dans le dossier extrait, puis lancer `py -m http.server 8000` (si Python est installé). Aller sur `http://localhost:8000`.

Ne pas ouvrir directement `index.html` par un chemin `file://` : les règles du navigateur peuvent être différentes.

## C. Obtenir une adresse HTTPS indépendante pour Windows et iPhone

Une solution manuelle simple est **Netlify Drop**, https://app.netlify.com/drop, qui accepte le dossier ou ZIP du site et fournit une URL HTTPS. C'est un service tiers : l'utilisateur doit décider de publier le paquet sur ce service. Aucun accès GitHub ni Firebase n'est nécessaire pour y déposer le dossier. Il ne faut envoyer **que** le paquet d'aperçu isolé, jamais le dossier complet du dépôt ni une sauvegarde des tournois.

1. Sur Windows, ouvrir le service Netlify Drop.
2. Glisser le ZIP `tournoi-csv-v73-preview-isolee` téléchargé depuis GitHub, ou le dossier décompressé, dans la zone de dépôt.
3. Ouvrir l'adresse HTTPS fournie.
4. Vérifier l'accueil « PRÉVISUALISATION V7.3 — DONNÉES FICTIVES », les catégories U10 et U11, « Mon équipe », les matchs, les poules et les informations pratiques.
5. Ouvrir **le même lien** sur l'iPhone. Valider les interactions réelles et la mise en page.

L'adresse n'est **pas créée automatiquement par ChatGPT**. Elle ne doit pas être annoncée comme fonctionnelle avant d'avoir été ouverte et vérifiée réellement.

## D. Ce qui reste interdit sans validation

- Ne jamais fusionner `develop-v73` dans `main` pour obtenir une prévisualisation.
- Ne jamais activer GitHub Pages sur cette branche à la place de l'hébergement officiel.
- Ne jamais copier de vraies données (scores, joueurs, comptes ou export Firebase) dans le paquet.
- Ne pas utiliser le paquet de test pour organiser un vrai tournoi : données fictives et non persistantes.
- Vérifier les erreurs JavaScript, affichage mobile et ordinateur, absence de connexion Firebase et absence de modification des données officielles **avant** toute publication.

## Critères de validation

- [ ] Workflow d'assemblage réellement exécuté avec succès (GitHub Actions).
- [ ] ZIP récupéré, décompressé et servi sans fichiers manquants.
- [ ] Page d'accueil visible et catégories U10/U11 accessibles.
- [ ] « Mon équipe » : première sélection, réouverture, changement de club.
- [ ] Résultats, poules, phases finales et logos sans erreur bloquante.
- [ ] Consultation sur Windows et iPhone, y compris petits écrans.
- [ ] Aucun trafic vers Firebase ni mise en cache persistante liée à la prévisualisation.
- [ ] Validation explicite avant la future publication officielle.
