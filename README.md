# Sen4Stat v4.0 — TESSERA et réactivité de l'interface

Projet d'amélioration du système Sen4Stat v4.0, à partir de la distribution
`Sen4StatDistribution_v4.0.zip`.

- **Objectif A** : utiliser les embeddings TESSERA (disponibles sur CreoDias
  dans `/eodata/geoAI-embeddings/Tessera`) comme features du processeur de
  carte des cultures `s4s_crop_mapping`.
- **Objectif B** : améliorer la réactivité de l'interface web
  (`sen2agri-services`), en mesurant avant de modifier.

Le cadrage complet est dans [docs/PROMPT_Sen4Stat_TESSERA.md](docs/PROMPT_Sen4Stat_TESSERA.md),
les décisions prises en cours de route dans [docs/decisions.md](docs/decisions.md).

## Règles de travail

- Une étape à la fois : proposition, accord, réalisation, test, feu vert.
- Pas de modification hors périmètre ; les idées annexes sont signalées puis décidées ensemble.
- Les faits non vérifiés sont notés comme hypothèses.
- Un commit par étape validée.

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `upstream/` | Fichiers de référence d'origine, jamais modifiés |
| `upstream/distribution-v4.0/` | Sous-ensemble du zip : docs, SQL, migrations, scripts d'installation |
| `upstream/eo-data-services-1.6.0/` | `static/` et `config/` du zip des services |
| `src/` | Nos modifications, créées à l'étape qui en a besoin |
| `experiments/` | Évaluations de l'étape 4 (scripts, configs, rapports légers) |
| `docs/` | Livrables et notes |
| `data/` | Données locales, non versionnées |

Aucune donnée (rasters, embeddings, in situ, modèles) n'est versionnée.

Exclus de l'extraction (restent dans le zip) : RPM, `licenses/`,
`additional_packages/`, `gadm_tables_data.sql` (3 Go), `shape_tiles_l8.sql`,
l'installeur OTB, et les jars des services (`lib/`).

## Avancement

### Objectif A — TESSERA

| Étape | Intitulé | État |
|---|---|---|
| 0 | Espace de travail | terminée |
| 1 | Lire le code du classifieur (image `sen4x/crop-map-s4s:0.5.0`) | terminée |
| 2 | Explorer `/eodata/geoAI-embeddings/Tessera` | terminée |
| 3 | Prototype d'alignement TESSERA → grille S2 | terminée |
| 4 | Mesure de la valeur ajoutée (point de décision) | sautée |
| 5 | Intégration dans `crop-map-s4s.py` | terminée |
| 6 | Paramétrage et image Docker dérivée | à faire |
| 7 | Test de bout en bout | à faire |
| 8 | Documentation et retour arrière | à faire |

### Objectif B — Interface web

| Étape | Intitulé | État |
|---|---|---|
| B0 | Mesures (navigateur, `EXPLAIN ANALYZE`, `pg_stat_statements`) | à faire |
