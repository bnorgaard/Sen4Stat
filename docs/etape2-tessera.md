# Étape 2 — Fiche du jeu TESSERA sur CreoDias

Exploration en lecture seule de `/eodata/geoAI-embeddings/Tessera`, depuis
`eostat-12m`, le 13/10/2026. Les sorties brutes sont dans `data/etape2/` (non
versionné).

## 1. Arborescence

```
/eodata/geoAI-embeddings/
├── Embeddings-Seamless-Data/      (non exploré)
├── MajorTOM/                      (non exploré)
└── Tessera/
    ├── Tessera-Embeddings-v1.0/
    │   ├── 2017/ … 2025/          (9 années)
    │   │   └── Tessera_{année}_v1.0_grid_{lon}_{lat}/
    │   │       ├── grid_{lon}_{lat}.tif
    │   │       └── grid_{lon}_{lat}_scales.tif
    └── Tessera-Embeddings-v1.1/
        └── 2017/ … 2025/          (9 années, nommage des tuiles inconnu)
```

- Aucun dossier `landmasks/` ni fichier d'index au niveau des versions.
- **Les dossiers d'années ne doivent pas être listés.** Ils contiennent toutes
  les tuiles de l'année, et même `find … | head` reste bloqué : le montage
  semble énumérer tout le dossier avant de répondre. On accède donc aux tuiles
  par leur **chemin calculé**.
- Nom de tuile : centre de la cellule de 0,1°, avec deux décimales, par exemple
  `grid_4.65_50.65` pour la cellule 4,6-4,7° E / 50,6-50,7° N.
- v1.1 : le chemin `Tessera_2024_v1.1_grid_4.65_50.65` n'existe pas. Soit le
  nommage diffère, soit la tuile n'est pas couverte.

## 2. Format (tuile v1.0, 2024, `grid_4.65_50.65`)

| Propriété | `grid_X_Y.tif` | `grid_X_Y_scales.tif` |
|---|---|---|
| Taille | 732 × 1 128 pixels | identique |
| Projection | UTM 31N (EPSG:32631) | identique |
| Pixel | 10 m | identique |
| Origine | (612 990,916 ; 5 617 843,020) | identique |
| Bandes | 128, entiers signés 8 bits | 1, Float32 |
| Stockage | COG, ZSTD (prédicteur 2), entrelacement par pixel, blocs 512 | COG, ZSTD (prédicteur 3) |
| Nodata, noms de bandes, échelle/décalage | aucun | aucun |
| Taille du fichier | 108,9 Mo | 3,25 Mo |

Une tuile de 2018 (`grid_7.65_47.75`) a la même structure : 113,8 Mo et
3,41 Mo.

## 3. Points d'attention pour l'intégration

1. **Type int8 avec GDAL 3.3.** Dans l'image `crop-map-s4s:0.5.0`, GDAL lit les
   bandes comme des octets non signés (`Type=Byte`, `PIXELTYPE=SIGNEDBYTE`). Il
   faut réinterpréter les valeurs en int8 (`.view(numpy.int8)`), sinon −1 est
   lu comme 255.
2. **Déquantification** (hypothèse, d'après la documentation de TESSERA v1) :
   `embedding = int8 × échelle`, avec une échelle par pixel commune aux 128
   dimensions.
3. **Grille décalée.** L'origine est décalée de 0,92 m en x et de 3,02 m en y
   par rapport à une grille de 10 m. Le passage sur la grille des tuiles S2
   demande un rééchantillonnage ; au plus proche voisin, l'écart est inférieur à
   5 m.
4. **Chevauchement.** Le rectangle UTM (7 320 × 11 280 m) déborde de la cellule
   géographique : son coin inférieur gauche est à 4,5966° E. Les tuiles voisines
   se recouvrent, et il faudra une règle de mosaïque.
5. **Zone UTM** (hypothèse) : chaque tuile est dans la zone UTM de son centre.
   Près d'une limite de zone, il faudra reprojeter vers l'EPSG de la tuile S2.
6. **Volume.** Une tuile S2 (110 × 110 km) recouvre environ 155 cellules de 0,1°
   à 50° N, soit environ 17 Go de données source par année. Le nombre de
   cellules, et donc le volume, varie avec la latitude.
7. **Aperçus.** Les COG contiennent des aperçus réduits (366 × 564, 183 × 282).
   Ils n'ont pas de sens pour des embeddings et ne doivent pas être lus.

## 4. Non vérifié

Le contrôle des valeurs (lecture d'une tuile, déquantification, statistiques)
n'a pas été fait, par décision du 13/10/2026 ; il se fera de fait au prototype
de l'étape 3. Restent donc à confirmer :

- les plages de valeurs et la formule de déquantification ;
- le codage des pixels sans donnée (mer, absence de couverture) ;
- le contenu des pixels hors de la cellule géographique ;
- le nommage et le contenu de v1.1, et les différences avec v1.0 ;
- la licence de la copie CreoDias.
