# Étape 3 — Prototype d'alignement TESSERA → grille S2

Script : [`src/tessera/aligner_tessera_s2.py`](../src/tessera/aligner_tessera_s2.py).
Choix de méthode : voir [decisions.md](decisions.md), section « Étape 3 ».

## 1. Ce que fait le script

Pour une tuile S2 (EPSG, coin supérieur gauche, 10 980 × 10 980 pixels de
10 m) et une année :

1. liste les cellules TESSERA de 0,1° dont l'intérieur recouvre la tuile, et
   calcule le chemin de chaque tuile source, sans lister de dossier ;
2. pour chaque cellule, sélectionne les pixels S2 dont le centre est dans la
   cellule, rééchantillonne la tuile source au plus proche voisin (reprojection
   exacte, `-et 0`, sans aperçus) et ne recopie que ces pixels ;
3. écrit `TESSERA_<tuile>_<année>_<version>.tif` (int8, bandes `TESSERA_000` à
   `TESSERA_127`) et `…_scales.tif` (Float32, 0 = pas de donnée), compressés en
   ZSTD, avec les métadonnées de provenance ;
4. vérifie le résultat de façon indépendante : pour environ 2 000 pixels tirés au
   hasard et 3 pixels de bord par cellule, recalcule le pixel source attendu et
   compare à l'octet près ; contrôle que chaque pixel de la tuile appartient à
   une cellule. Code de sortie 1 au moindre écart.

Compatible Python 3.8, numpy 1.17 et GDAL 3.3 (image `sen4x/crop-map-s4s:0.5.0`),
sans dépendance nouvelle.

Exemple, sur `eostat-12m` :

```
docker run --rm -u $(id -u):$(id -g) -v /eodata:/eodata:ro \
  -v ~/tessera-proto-src:/src:ro -v /mnt/scratch/tessera-proto:/mnt/scratch/tessera-proto \
  sen4x/crop-map-s4s:0.5.0 python3 /src/aligner_tessera_s2.py \
  --tile 31UFS --epsg 32631 --ulx 600000 --uly 5700000 --year 2024 \
  --bands 1 2 3 --lonlat-bbox 4.5 50.6 4.8 50.8 --output-dir /mnt/scratch/tessera-proto
```

## 2. Construction de la grille TESSERA (confirmée)

Une tuile TESSERA est l'emprise de sa cellule de 0,1° projetée dans la zone UTM
de son centre, sans arrondi à 10 m. Reconstruite ainsi, la tuile
`grid_4.65_50.65` donne exactement l'origine (612 990,916 ; 5 617 843,020) et la
taille (732 × 1 128) relevées par `gdalinfo`.

## 3. Tests

### Sur ce poste, avec de fausses tuiles TESSERA (GDAL 3.12)

Tuiles fabriquées selon la règle du §2, dans un dossier temporaire hors dépôt.

| Test | Résultat |
|---|---|
| Zone 31 autour de Louvain, une tuile absente | OK ; la zone absente reste à 0 |
| Sous-ensemble de bandes (1, 2, 3, 128) | OK |
| Coin nord-est de 31UFS, cellules en UTM 32 | OK ; 2 800 pixels vérifiés dont 800 en bord de cellule |
| Filtre `--lonlat-bbox` | OK |
| Test négatif : interpolation bilinéaire forcée | Le contrôle échoue (2 012 erreurs, code 1), comme attendu |

Défauts trouvés et corrigés pendant les tests :

- une 4ᵉ bande marquée comme canal alpha : `PHOTOMETRIC=MINISBLACK` ;
- des cellules qui ne faisaient que toucher la zone étaient retenues : le test
  exige désormais que les intérieurs se recouvrent (`Intersects` et non
  `Touches`).

### Sur `eostat-12m`, vraies tuiles, image 0.5.0 (13/10/2026)

- 31UFS est recouverte par **180 cellules** ; essai sur les 6 cellules autour de
  Louvain-la-Neuve, bandes 1 à 3 : environ 1 s par cellule, `CHECK OK` sur
  2 018 pixels.
- Extrait de 10 × 10 km (origine 609 000 ; 5 619 000) contenant les frontières
  4,6° E et 50,7° N :
  - grille identique à celle du L2A `TCI_10m` du 03/06/2024 ;
  - échelles de 0,036 à 0,123, sans 0 ni NaN : aucun trou aux frontières ;
  - comparaison exhaustive avec la tuile source `grid_4.65_50.65` :
    517 752 pixels, 0 différence ;
  - contrôle visuel dans QGIS par Boris : superposition exacte avec le TCI.

## 4. Limites et suites

- Le passage complet (128 bandes, 180 cellules) n'a pas été lancé, par décision
  du 13/10/2026 : le volume du fichier et la durée restent à mesurer. Un fichier
  de 128 bandes sur 10 980 × 10 980 pixels est par ailleurs peu pratique à ouvrir
  dans QGIS.
- Avec GDAL 3.7 ou plus, `PIXELTYPE=SIGNEDBYTE` est déprécié au profit du type
  `Int8` ; à adapter si l'image change de version de GDAL.
- Lors de l'intégration (étape 5), ce code alimentera le point d'insertion P2 ;
  les noms de bandes `TESSERA_000` à `TESSERA_127` sont prévus pour le bloc de
  bandes P3.
