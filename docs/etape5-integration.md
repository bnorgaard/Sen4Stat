# Étape 5 — Intégration de TESSERA dans `crop-map-s4s.py`

Fichiers :

- [`src/crop-map-s4s/crop-map-s4s.py`](../src/crop-map-s4s/crop-map-s4s.py) :
  copie de `upstream/crop-map-s4s-0.5.0/crop-map-s4s.py`, +103 / −5 lignes ;
  `git diff --no-index upstream/crop-map-s4s-0.5.0/crop-map-s4s.py src/crop-map-s4s/crop-map-s4s.py`
  montre toutes les modifications ;
- [`src/crop-map-s4s/tessera_features.py`](../src/crop-map-s4s/tessera_features.py) :
  module chargé par le script (même dossier) ;
- [`experiments/etape5/verifier_tessera_vm.py`](../experiments/etape5/verifier_tessera_vm.py) :
  outil de test sur une machine Sen4Stat, hors produit.

## 1. Comportement

Sans le jeton `tessera` dans `features-filter`, le traitement est identique à
l'upstream. Avec le jeton :

1. **Contrôle de disponibilité**, juste après la recherche de la saison et
   avant tout appel Docker. L'année retenue est celle qui contient la plus
   grande partie de la saison (la plus récente en cas d'égalité). Sont
   exigées toutes les cellules de 0,1° qui recouvrent à la fois une tuile S2
   du site et la géométrie du site (`site.geog`). En cas de manque :
   `logging.error` et code de sortie 1 ; le message apparaît dans
   System overview → Monitoring → Jobs history → [output], colonne « Errors ».
   Exemple :

   > TESSERA v1.0 embeddings for 2026 are not available on CreoDias (no
   > directory /eodata/geoAI-embeddings/Tessera/Tessera-Embeddings-v1.0/2026).
   > Remove 'tessera' from processor.s4s_crop_mapping.features-filter or
   > choose a season covered by TESSERA.

2. **Recalage**, par tuile S2, dans le dossier de travail du job :
   `TESSERA_<tuile>_<année>_<version>.tif` (128 bandes Int16, valeurs int8
   inchangées) et `…_scales.tif` (Float32, 0 = pas de donnée). Méthode de
   l'étape 3 : plus proche voisin, reprojection exacte, une cellule par pixel.
   Les fichiers sont écrits sous un nom `.part` et renommés seulement si la
   vérification passe ; un fichier déjà présent est réutilisé.
3. **Features** : 128 bandes `TESSERA_<année>_000` à `_127` ajoutées après S1
   dans `bands_<tuile>.vrt`. Ce sont des bandes dérivées (fonction GDAL `mul`)
   qui calculent `valeur × échelle` à la lecture : l'embedding déquantifié,
   sans fichier supplémentaire.

Clés lues en base, avec leurs valeurs par défaut si absentes ou vides :
`processor.s4s_crop_mapping.tessera-root` (`/eodata/geoAI-embeddings/Tessera`)
et `processor.s4s_crop_mapping.tessera-version` (`v1.0`).

## 2. Pourquoi Int16

GDAL 3.3 n'a pas de type entier signé sur 8 bits : il lit les valeurs
TESSERA entre 0 et 255 (vérifié sur `eostat-12m` : min 0, max 255 sur une
bande). Une bande dérivée calculerait donc des embeddings faux pour toutes les
valeurs négatives. Le stockage en Int16 conserve les valeurs exactes.

## 3. Tests

### Sur ce poste (fausses tuiles, GDAL 3.12) : 24/24

Choix de l'année (dont une saison à cheval sur deux ans) ; contrôle de
disponibilité (racine absente, année absente, cellule manquante dans le site,
cellule manquante hors du site) ; recalage en Int16 (valeurs négatives,
réutilisation) ; bandes dérivées égales à `int16 × échelle` ; test négatif
(interpolation bilinéaire refusée, aucun fichier livré) ; `write_tile_vrts`
avec TESSERA seul, combiné avec `sr10` (ordre et noms des bandes), et sans
TESSERA.

### Sur `eostat-12m` (image 0.5.0, GDAL 3.3.2), 13/10/2026

| Test | Résultat |
|---|---|
| Disponibilité, site 91, 2024 | 6 tuiles (31UER, 31UES, 31UFR, 31UFS, 31UGR, 31UGS), de 21 à 148 cellules nécessaires, 0 manquante |
| Disponibilité, 2026 forcé | message attendu |
| Recalage d'une fenêtre de 1 500 × 1 500 pixels de 31UFS | 6 cellules, 36 pixels vérifiés, 20 s |
| Bandes dérivées lues par GDAL 3.3 | 200 points, écart 0 |
| Bandes dérivées lues par erdy 0.2.5 (`sample-extraction`, comme en production) | 200 points sur 200, écart 0 |
| Bandes dérivées lues par OTB 8.1.1 (`PixelValue`) | valeurs identiques à l'attendu |

## 4. Limites connues

- **Disque** : environ 31 Go par tuile S2 dans le dossier de travail du job
  (Int16 non compressé, comme les autres features du job).
- **Durée** : environ 18 minutes par tuile, extrapolé de la fenêtre de test ;
  non mesuré sur une tuile complète. Les tuiles sont traitées l'une après
  l'autre.
- Si `S1_<tuile>.vrt` manque pour une tuile alors que des features S1 sont
  demandées, le contrôle nom/position des bandes TESSERA arrête le job
  (`assert`) au lieu de produire des features décalées.
- Le recalage de l'étape 3 (`src/tessera/aligner_tessera_s2.py`) et ce module
  partagent du code dupliqué ; seul le module est utilisé en production.
- Sur `eostat-12m`, l'orchestrateur ancien ne transmet pas `--job-id` : les
  clés sont alors lues dans `v_site_config`.
