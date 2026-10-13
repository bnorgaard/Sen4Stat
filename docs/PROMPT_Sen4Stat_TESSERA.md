# Projet Sen4Stat × TESSERA — prompt de démarrage

> À coller au début d'une nouvelle session Claude Code ouverte dans `~/Bureau/Sen4Stat`.

---

## Rôle et règles de travail (à respecter strictement)

Tu m'accompagnes dans un projet d'amélioration du système Sen4Stat v4.0. On travaille en binôme, et c'est moi qui pilote :

- **Une étape à la fois.** Avant chaque étape, tu expliques ce que tu proposes, pourquoi, et quels fichiers seront touchés. Tu attends mon accord explicite avant de créer ou de modifier quoi que ce soit.
- **Pas d'initiative hors périmètre.** Tu ne fais aucun refactoring, aucun ajout de fichier ou de dépendance, aucune optimisation que je n'ai pas demandés. Si tu repères quelque chose d'utile, tu le signales en une ligne et on décide ensemble.
- **Chaque ajout est expliqué** : ce qu'il fait, comment il s'insère dans Sen4Stat et quelles hypothèses il pose. Le code est commenté sobrement, dans le style du code existant.
- **À la fin de chaque étape**, tu me donnes :
  1. ce qui a changé ;
  2. la procédure de test que **j'exécute moi-même**, avec les commandes et le résultat attendu ;
  3. les points à vérifier.

  On ne passe à l'étape suivante qu'après mon test et mon feu vert.
- **Je travaille sur plusieurs machines.** Ce poste n'a accès ni à `/eodata` ni au serveur Sen4Stat. Pour ce qui doit tourner sur la VM CreoDias ou sur le serveur, tu me donnes les commandes, je les exécute et je te colle le résultat.
- Les faits non vérifiés sont présentés comme des hypothèses.
- Tu réponds en français.

---

## Contexte (établi lors d'une première lecture du zip)

### La distribution

`Sen4StatDistribution_v4.0.zip` est une distribution RPM pour CentOS 7 / Rocky. Elle contient :

- **`sen2agri-app`** : l'orchestrateur C++/Qt compilé, le scheduler et l'executor ;
- **`sen2agri-processors`** : des scripts Python et R, et des applications OTB ;
- **`sen2agri-services/eo-data-services-1.6.0-*.zip`** : un backend Spring Boot 2.7, avec un front jQuery 2.2.4 et Bootstrap 3 dans `static/`. Il s'installe sous `/usr/share/sen2agri/sen2agri-services/` ;
- `install_script/database` et `install_script/migrations/sen4stat` : le schéma et la configuration SQL ;
- `docs/sum/Sen4Stat_SUM_v2.0.pdf` : le manuel utilisateur.

### Le processeur de carte des cultures (`s4s_crop_mapping`, id 20)

**Lancement**
- Il est lancé par `S4SCropTypeMappingHandler`, compilé dans l'orchestrateur.
- Ce handler exécute `crop-map-s4s.py` **dans l'image Docker `sen4x/crop-map-s4s:0.5.0`**, définie par la clé `general.orchestrator.s4s-crop-type-mapping.docker_image`.
- Ce script **n'est pas dans le zip**.

**Classification**
- Elle se fait **par pixel**, tuile S2 par tuile S2, sur une grille UTM à 10 m, avec un modèle par strate.
- Le classifieur est `rf` ou `catboost` (clé `processor.s4s_crop_mapping.classifier`).

**Choix des features**
- Les familles de features sont choisies par `processor.s4s_crop_mapping.features-filter`, parmi `sr10, sr20, vi, vis, sar, re, lai`.
- L'orchestrateur transmet cette valeur telle quelle au script, sous la forme `--features`.
- Hypothèse : un nouveau jeton `tessera` passerait donc **sans recompiler l'orchestrateur**.

**Paramètres**
- L'orchestrateur ne transmet qu'une liste figée de paramètres (`pix-min`, `smote-ratio`, `features-filter`, etc.).
- Hypothèse : le script lit le reste (`classifier`, `rf.*`, `catboost.*`) directement dans la base, à partir de `--job-id`. **À vérifier.**

**À ne pas confondre**
- Les scripts `crop-type-wrapper.py` et `crop_type.R` du zip appartiennent à la chaîne Sen4CAP, qui travaille par parcelle. Ils ne font **pas** partie de Sen4Stat.

### Code source public

- Le dépôt est https://github.com/Sen4CAP/Sen4CAP (GPL-3.0).
- Fichiers utiles : `scripts/crop-map-s4s.py` et `sen2agri-orchestrator/processor/s4s_croptypemappinghandler.cpp`.
- Ce dépôt est peut-être en retard sur la v4.0 (CatBoost en est absent). **La référence reste l'image Docker 0.5.0.**

### TESSERA

- Modèle de l'Université de Cambridge (arXiv:2506.20380).
- **Ce qu'il produit :** des embeddings annuels de 128 dimensions à 10 m, calculés à partir de séries temporelles S1 et S2.
- **Découpage :** des tuiles de 0,1°, chacune dans sa projection UTM.
- **Versions :**
  - v1.x : valeurs int8 et facteurs d'échelle float32 (fichiers `.npy` et `_scales.npy`) ;
  - v2 : embeddings « Matryoshka » de 16, 32, 64 ou 128 dimensions.
- Ne jamais mélanger les versions ou les variantes.
- Bibliothèque Python : `geotessera`, qui demande Python ≥ 3.12.
- Distribution officielle : Source Cooperative et AWS Open Data.
- **Sur CreoDias :** les embeddings sont dans `/eodata/geoAI-embeddings/Tessera`. Je n'ai pas trouvé de documentation publique de ce dossier : version, format et arborescence sont à confirmer à l'étape 2. La documentation CDSE de `/eodata/geoAI-embeddings/` ne cite que Major TOM.
- **Arborescence de référence** (Source Cooperative, vérifiée) :
  - `npy/v1/{année}/grid_X_Y/grid_X_Y.npy` : int8, forme (H, W, 128), environ 158 Mo par tuile ;
  - `grid_X_Y_scales.npy` à côté de chaque tuile ;
  - `landmasks/{v1,v1.1,v2}/grid_X_Y.tiff` : c'est ce fichier qui donne la projection UTM et la géoréférence de la tuile.

  Le dossier CreoDias suit peut-être la même structure. C'est à vérifier.

---

## Objectif A — TESSERA comme features de classification

Feuille de route. Chaque étape correspond à une session de travail, et je la valide avant de passer à la suivante.

**0. Espace de travail**

On décide ensemble :
- de la structure du dépôt (git, et des dossiers du type `upstream/`, `src/`, `experiments/`, `docs/`) ;
- de ce qu'on extrait du zip ;
- du rôle de chaque machine (poste local, VM CreoDias, serveur Sen4Stat) ;
- du site pilote et de l'année.

**1. Lire le vrai code du classifieur** (aucune modification de code)

- Récupérer `crop-map-s4s.py` dans l'image `sen4x/crop-map-s4s:0.5.0`. Je lance les commandes Docker.
- Le comparer à la version GitHub.
- Documenter le flux :
  - la sélection des pixels d'entraînement ;
  - la construction des features (noms, ordre, format) ;
  - l'entraînement et la prédiction ;
  - la lecture de la configuration.
- Livrable : un schéma du flux et la liste des points d'insertion possibles.

**2. Explorer `/eodata/geoAI-embeddings/Tessera`**

- Relever l'arborescence, la version (v1.1 ou v2), les années disponibles, le format, la projection et le masque terre/mer (landmask).
- Lire une tuile sur le site pilote, la déquantifier et contrôler les valeurs.
- Livrable : une fiche descriptive du jeu de données.

**3. Prototype isolé, hors Sen4Stat**

- Un script qui, pour une tuile S2 et une année, produit un raster TESSERA aligné sur la grille S2 :
  - projection UTM, 10 m, emprise tirée de `shape_tiles_s2` ;
  - rééchantillonnage au plus proche voisin ;
  - stockage compact : int8 avec les échelles, ou un sous-ensemble des dimensions.
- Test : superposer le résultat à un L2A dans QGIS et contrôler l'alignement pixel à pixel.

**4. Mesurer la valeur ajoutée, hors Sen4Stat**

- Avec les polygones in situ d'un site et d'une saison, entraîner RF puis CatBoost dans trois configurations :
  - les features actuelles ;
  - TESSERA seul ;
  - les deux combinés.
- Même échantillonnage et même validation pour les trois.
- **Point de décision :** on ne poursuit l'intégration que si le gain le justifie.

**5. Intégration dans `crop-map-s4s.py`**

- Ajouter le jeton `tessera` à `features-filter`.
- Charger et empiler les bandes.
- Gérer le nodata, le landmask et le chevauchement des tuiles.
- Choisir l'année d'embedding en fonction de la saison.

**6. Paramétrage et déploiement**

- Créer les clés `processor.s4s_crop_mapping.tessera-*` (chemin, version, année, nombre de dimensions) et leurs entrées `config_metadata`, dans un script de migration SQL.
- Construire une image Docker dérivée, par exemple `sen4x/crop-map-s4s:0.5.0-tessera`.
- Monter `/eodata` dans le conteneur avec la clé `general.orchestrator.s4s-crop-type-mapping.docker_add_mounts`.

**7. Test de bout en bout**

Lancer le traitement sur le site pilote depuis l'interface, puis comparer les rapports de validation avec et sans TESSERA.

**8. Documentation**

Notes d'installation et procédure de retour arrière.

### Points d'attention

- **Volume :** une tuile S2 sur 128 bandes pèse environ 15 Go en int8 et environ 60 Go en float32.
- **Mémoire :** RF et CatBoost avec 128 features supplémentaires.
- **Calendrier :** TESSERA suit l'année civile, alors que certaines saisons sont à cheval sur deux années.
- **Versions :** toujours la même version des embeddings d'un bout à l'autre.
- **Licence des données :** CC0 ou CC-BY-SA selon les sources, à clarifier.

---

## Objectif B — réactivité de l'interface web

Volet séparé, mêmes règles. On commence par **mesurer** avant de modifier :
- l'onglet Réseau et la console du navigateur ;
- `EXPLAIN ANALYZE` et `pg_stat_statements` côté base.

Ensuite, on applique les corrections une par une, en commençant par les moins risquées.

### Pistes identifiées

Elles viennent d'une lecture statique du code et restent à confirmer par la mesure. Les chemins sont relatifs à `/usr/share/sen2agri/sen2agri-services/`.

**B1. Les librairies JS sont rechargées à chaque navigation, en synchrone et sans cache.**
- Le routeur (`static/admin/assets/dist/js/router.js`) injecte chaque fragment avec `.html()`.
- jQuery 2.2.4 recharge alors chaque `<script src>` par une requête XHR synchrone, avec un paramètre `_=timestamp` qui empêche le cache.
- Exemple : la page Sites retélécharge `ol.js` (940 Ko) et 4 autres scripts à chaque visite.

**B2. `html2canvas` est chargé depuis Internet.**
- Dans `static/admin/fragments/products.fragment.html` (ligne 385), le script vient de `https://html2canvas.hertzen.com/...`.
- Si l'accès Internet est lent ou absent, la page Produits reste bloquée.

**B3. Des appels AJAX synchrones (`async: false`) sont faits en boucle.**
- `products.fragment.html`, lignes 533–575 : `getMarkers` et `getMarkerIndices`.
- `dashboard.fragment.html`, lignes 254–290 : une requête de saisons par site.
- `statistics.fragment.html`, lignes 322–350.

**B4. Des timers fuient.**
- `monitoring.fragment.html` crée un `window.setInterval` qui n'est jamais arrêté (ligne 400).
- Le même fichier ré-enveloppe `window.pagingGo` à chaque visite (lignes 393–397).
- Ce fragment est aussi rechargé dans l'onglet Monitoring de System Overview.
- Les boucles `setTimeout` ne vérifient que le hash de l'URL. Revenir sur une page moins de 60 s après l'avoir quittée lance donc une deuxième boucle en parallèle.

**B5. Le serveur n'optimise ni le transfert ni les logs.**
- Pas de compression gzip ni d'en-têtes de cache pour les fichiers statiques.
- Les logs sont au niveau TRACE pour `ro.cs.tao`, `ro.cs.eo` et `org.esa.sen4cap` (`config/application.properties`).

**B6. Une requête lourde tourne toutes les 10 s.**
- System Overview appelle `sp_get_dashboard_server_resource_data` toutes les 10 secondes.
- Cette fonction fait un `SELECT DISTINCT node_name` sur `node_resource_log`.
- Cette table n'est jamais purgée et n'est indexée que sur `timestamp`.

**B7. Le front existe en trois copies.**
- `static/`, `static/admin/` et `static/admin/lite/` : toute correction doit être reportée dans chacune.
- Ces fichiers sont écrasés à chaque mise à jour du zip de services, donc les correctifs doivent être versionnés à part.

---

## Pour démarrer

Commence par l'étape 0 de l'objectif A. Propose-moi une structure de travail et la liste des questions à trancher : machines, site pilote, année, accès Docker et accès à `/eodata`. Ne crée rien avant mon accord.
