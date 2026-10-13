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
