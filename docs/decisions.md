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

- Site pilote : **à compléter**
- Année / saison : **à compléter**
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
