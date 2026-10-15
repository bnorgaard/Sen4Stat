# Journal des décisions

Les hypothèses sont signalées comme telles ; elles sont mises à jour quand
elles sont vérifiées.

## Étape 0 — Espace de travail (13/10/2026)

### Dépôt

- Dépôt git privé, hébergé sur le compte personnel de Boris ; branche `main`.
- Commits : Claude propose le message, Boris valide.
- Structure `upstream/` (référence intacte), `src/`, `experiments/`, `docs/`,
  `data/` (non versionné). Voir le [README](../README.md).
- Extraits du zip versionnés dès l'étape 0 : sous-ensemble de la distribution
  et front des services (`static/`, `config/`).
- Dépôt source de `scripts/crop-map-s4s.py` et
  `sen2agri-orchestrator/processor/s4s_croptypemappinghandler.cpp` : inconnu.
  La référence reste l'image Docker `sen4x/crop-map-s4s:0.5.0`.

### Machines

| Machine | Accès | Rôle |
|---|---|---|
| Poste local (ce dépôt) | git, Python 3.14, GDAL 3.12, QGIS 3.40 ; pas de Docker, pas de `/eodata` ; SSH vers les VM | Lecture et écriture du code, docs, contrôles QGIS sur extraits rapatriés |
| Machine de test Sen4Stat sur CreoDias | `/eodata` monté, sudo (à confirmer), Docker et image 0.5.0 accessibles | Étapes 1 à 7 |
| Machines locales avec accès EOData | `/eodata` en lecture, plus lent | Appoint |

- Installations logicielles possibles sur les machines de test.
- Instances de test disponibles : pas de modification sur une instance de production.

### Données

- Site pilote : `wallonia_24` (site 91), décidé le 13/10/2026
- Année / saison : 2024 (01/01 au 31/12) ; tuile S2 de test : 31UFS
- Données nécessaires (in situ, L2A, S1) disponibles selon Boris.

### TESSERA

- Si les embeddings sont lisibles directement dans `/eodata`, ils sont lus
  sans `geotessera` (numpy pour les `.npy`, landmask GeoTIFF pour la
  géoréférence).
- Hypothèse : le dossier CreoDias suit l'arborescence de Source Cooperative
  (`npy/v1/{année}/grid_X_Y/`, `landmasks/`). À vérifier à l'étape 2.

## Étape 1 — Lecture du classifieur (13/10/2026)

Livrable : [etape1-classifieur.md](etape1-classifieur.md).

- Image `sen4x/crop-map-s4s:0.5.0` téléchargée sur `eostat-12m` ; ses 7 scripts
  sont dans `upstream/crop-map-s4s-0.5.0/`.
- `eostat-12m` est une installation ancienne : sa base configure l'image
  `0.3.0`. Elle sert de poste Docker pour l'étape 1.
- **Point ouvert, à trancher avant l'étape 5** : instance Sen4Stat v4.0 pour
  les étapes 5 à 7 (mise à jour d'une instance existante avec `update.sh`, ou
  installation neuve).
- Montages : le script lit la clé globale `general.orchestrator.docker_add_mounts`.
  La clé `general.orchestrator.s4s-crop-type-mapping.docker_add_mounts` prévue au
  cadrage n'existe pas en v4.0.
- Les comparaisons avec et sans TESSERA devront réutiliser les mêmes points
  d'entraînement et de validation (`--keep-polygons`), le partage étant aléatoire.
- `geotessera` est exclu dans l'image (Python 3.8) : lecture directe des `.npy`.
- Vérifié sur le job 43193 de `eostat-12m` (site 91 `wallonia_24`, saison 2024) :
  la socket Docker est montée dans le lanceur ;
  `general.orchestrator.docker_add_mounts` vaut déjà
  `/eodata:/eodata,/mnt/scratch:/mnt/scratch`, donc `/eodata` est visible du
  lanceur et des conteneurs de calcul ; `--features` reçoit des jetons séparés ;
  `config_job` est une copie complète de la configuration.
- Écarts de cette instance ancienne avec la v4.0 : pas de `--job-id` ni de
  paramètres `--pix-*` transmis, pas de clés `classifier` / `catboost.*`,
  `processor.insitu.path` en `{year}` au lieu de `{season}`. Ils renforcent le
  besoin d'une instance v4.0 avant l'étape 5.

## Étape 2 — Jeu TESSERA sur CreoDias (13/10/2026)

Livrable : [etape2-tessera.md](etape2-tessera.md).

- Alias SSH de la machine de test : `eostat-12m`.
- Sur CreoDias, TESSERA est distribué en **GeoTIFF COG** (int8, 128 bandes,
  plus un fichier d'échelles Float32), géoréférencé en UTM : pas de `.npy`, et
  pas besoin de landmask pour la projection.
- Versions v1.0 et v1.1, années 2017 à 2025. Accès aux tuiles par chemin
  calculé uniquement (lister un dossier d'année bloque).
- Le contrôle des valeurs d'une tuile (2b) est sauté, par décision de Boris :
  les valeurs seront contrôlées au prototype de l'étape 3.
- **Point ouvert** : version à retenir. v1.0 est vérifiée ; le nommage de v1.1
  est inconnu.

## Étape 3 — Prototype d'alignement (13/10/2026)

- Version TESSERA retenue : **v1.0**, pour tout le projet.
- TESSERA est recalé sur la grille des tuiles S2. L'extraction sur la grille
  TESSERA a été écartée : elle aurait obligé à modifier toute la chaîne (rasters
  in situ, VRT, strates, produits) et empêché la configuration combinée de
  l'étape 4.
- Interpolation : **plus proche voisin**, en une seule opération, avec
  reprojection exacte (`-et 0`) et sans aperçus. Les vecteurs sont recopiés,
  jamais calculés.
- Chevauchement : un pixel S2 prend la tuile dont la cellule de 0,1° contient
  son centre.
- Absence de donnée : 0 dans les 128 bandes et échelle 0, déclarée comme nodata
  du fichier d'échelles.
- Prototype validé le 13/10/2026 : `CHECK OK` sur `eostat-12m`, comparaison
  exhaustive sans différence sur un extrait, superposition exacte avec le L2A
  dans QGIS. Voir [etape3-prototype.md](etape3-prototype.md).
- Le passage complet (128 bandes, 180 cellules) n'est pas lancé : le prototype
  est jugé démontré. Volume et durée restent à mesurer si besoin.

## Étape 4 — Mesure de la valeur ajoutée : sautée (13/10/2026)

- Décision de Boris : la valeur ajoutée de TESSERA est jugée déjà démontrée ;
  pas de comparaison hors Sen4Stat.

## Contrôle de disponibilité de TESSERA (13/10/2026, pour l'étape 5)

- Besoin : quand une classification est lancée avec `tessera` et que les
  embeddings n'existent pas sur CreoDias à cet endroit, l'interface doit le dire.
- Constat : le formulaire Custom jobs ne fait que créer le job ; l'erreur ne
  peut apparaître qu'à l'exécution. La sortie d'erreur du conteneur est
  enregistrée dans `step_resource_log.stderr_text` (vérifié sur `eostat-12m`)
  et affichée dans System overview → Monitoring → Jobs history → [output],
  colonne « Errors ».
- Décision : contrôle au tout début de `crop-map-s4s.py`, avant tout appel
  Docker, sur le modèle de l'erreur « No season found » (`logging.error` puis
  code de sortie 1).
- Règle : le dossier de l'année doit exister, et toutes les cellules de 0,1°
  qui recouvrent à la fois une tuile S2 du site et la géométrie du site
  (`site.geog`) doivent être présentes.
- Message en anglais, avec la version, l'année, la tuile, le nombre et les noms
  des cellules manquantes, et la marche à suivre.
- Améliorations de l'interface (texte des erreurs affiché en clair, erreurs
  HTTP du formulaire Custom jobs) : reportées au volet B.
- Constat annexe : le job 43193 (tâche 205938) a échoué ; son journal d'erreurs
  est noyé sous des avertissements `urllib3 … Connection pool is full`.

## Étape 5 — Intégration (13/10/2026)

Note : [etape5-integration.md](etape5-integration.md).

- TESSERA entre dans le classifieur **déquantifié à la volée** : bandes VRT
  dérivées (`valeur × échelle`, fonction GDAL `mul`).
- Les valeurs recalées sont stockées en **Int16** : GDAL 3.3 lit l'int8 sans
  signe (vérifié : min 0, max 255).
- Année : celle qui contient la plus grande partie de la saison. L'empilement
  de deux années (argument ou bouton) est reporté ; les noms de bandes portent
  déjà l'année (`TESSERA_2024_000`).
- Raster recalé dans le dossier de travail du job, comme les features S2.
- Clés lues : `tessera-root` et `tessera-version`, avec valeurs par défaut.
- Validé sur `eostat-12m` : contrôle de disponibilité ; lecture des bandes
  dérivées identique à l'attendu par GDAL 3.3, erdy 0.2.5 et OTB 8.1.1.
- Premiers tests sur `eostat-12m` ; le test de bout en bout se fera sur une
  installation plus récente.

## Étape 6 — Paramétrage et image Docker (13 et 15/10/2026)

Note : [etape6-parametrage.md](etape6-parametrage.md).

- Image dérivée : **`crop-map-s4s:0.5.0-tessera`**, locale à chaque machine
  (l'espace `sen4x/` de Docker Hub n'est pas le nôtre). Construite sur
  `eostat-12m` le 13/10/2026 ; `--help` fonctionne et les empreintes des deux
  scripts sont identiques à celles du dépôt.
- La bascule de `general.orchestrator.s4s-crop-type-mapping.docker_image` ne
  fait pas partie de la migration : elle se fera à l'étape 7, sur une
  installation récente. Pas de bascule sur `eostat-12m` (orchestrateur ancien).
- **À faire le jeudi 15/10/2026, sur `eostat-12m`** : sauvegarde de `config`
  et `config_metadata`, application de `tessera-migration.sql` (deux fois, pour
  vérifier qu'elle est rejouable), vérification, test de `tessera-rollback.sql`,
  puis réapplication de la migration, laissée en place.
- Tests SQL du 15/10/2026 sur `eostat-12m` : migration rejouable sans effet
  de bord, retour arrière exact. Réapplication de la migration laissée en
  place : à confirmer. Détail dans [etape6-parametrage.md](etape6-parametrage.md), §6.

## Objectif B — B0, mesures (15/10/2026)

Livrable : [B0-mesures.md](B0-mesures.md).

- L'objectif A est en pause à l'étape 7, faute d'installation récente.
- Mesures sur `eostat-12m`, interface d'administration, dans le navigateur
  intégré (connexion faite par Boris). Le front de la 12M est identique à
  98,6 % à la v4.0 ; les problèmes mesurés existent en v4.0.
- Pistes confirmées : B1 (problème principal), B2, B3, B4, B6, compression
  absente (B5). En-têtes de cache présents (B5 en partie infirmée).
- Nouveaux constats : `/rois/countries` (3,8 Mo synchrones par visite de
  Sites) ; charge de fond de la table `event` (hors interface).
- Ordre de correction proposé : B4, B1, compression, B2, `/rois/countries`,
  B6, B3 (du plus sûr au plus délicat).

## Objectif B — Corrections

Journal : [B-corrections.md](B-corrections.md).

- 15/10/2026, **B4** (minuteurs de Monitoring) : corrigée, testée et laissée en
  place sur `eostat-12m`. 0 requête fantôme au lieu de 6 en 13 s.
- 15/10/2026, **B1** (cache des scripts des fragments) : corrigée dans les
  trois routeurs, testée et laissée en place sur `eostat-12m`. Hors
  `/rois/countries`, environ 0,4 Mo transférés au lieu d'environ 8,8 Mo sur
  les 8 pages. B3 (Dashboard) devient le principal point bloquant.
- Constat : la version lite du front ne fonctionne pas, dès la v4.0
  d'origine (`readExtProjectCookie` absente). Non corrigé.
- 15/10/2026, **B5** (compression HTTP) : activée et laissée en place sur
  `eostat-12m`. Volumes divisés par 3 à 6 pour les textes, par 2,7 pour
  `/rois/countries` ; pas de gain de temps sur une liaison rapide pour cette
  grosse réponse JSON (compression à la volée, environ 14 Mo/s).
- 15/10/2026, **B3** (Dashboard) : requêtes de saisons parallèles, testée et
  laissée en place sur `eostat-12m`. Plus aucun blocage (1,3 à 3,2 s avant) ;
  onglets des processeurs affichés après environ 150 ms.
- 15/10/2026, **`/rois/countries`** : chargé au premier clic sur « Create new
  site » puis gardé pour la session ; testé et laissé en place sur
  `eostat-12m` (version du fichier propre à la 12M, même modification). Sites
  passe de 3,8 Mo à environ 28 Ko par visite.

