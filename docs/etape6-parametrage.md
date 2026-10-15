# Étape 6 — Paramétrage et image Docker

Fichiers :

- [`src/sql/tessera-migration.sql`](../src/sql/tessera-migration.sql) : clés
  `processor.s4s_crop_mapping.tessera-root` et `tessera-version`, leurs entrées
  `config_metadata` (catégorie 30, comme les autres clés du processeur), et la
  mention du jeton `tessera` dans la description de `features-filter`.
  Peut être appliquée plusieurs fois.
- [`src/sql/tessera-rollback.sql`](../src/sql/tessera-rollback.sql) : annule
  exactement la migration.
- [`src/docker/Dockerfile`](../src/docker/Dockerfile) : image dérivée de
  `sen4x/crop-map-s4s:0.5.0`, avec `crop-map-s4s.py` et `tessera_features.py`
  de `src/crop-map-s4s/` copiés dans `/usr/local/bin`.

Nom de l'image : `crop-map-s4s:0.5.0-tessera`, local à chaque machine (l'espace
`sen4x/` de Docker Hub n'est pas le nôtre). Sur une installation à plusieurs
nœuds, l'image doit exister sur chaque nœud qui exécute le traitement.

## 1. Construire l'image (sur la machine Sen4Stat)

Copier les fichiers depuis le poste :

```
ssh <machine> 'mkdir -p ~/tessera-image'
scp src/crop-map-s4s/crop-map-s4s.py src/crop-map-s4s/tessera_features.py src/docker/Dockerfile <machine>:tessera-image/
```

Puis, sur la machine :

```
docker build -t crop-map-s4s:0.5.0-tessera ~/tessera-image
docker run --rm crop-map-s4s:0.5.0-tessera python3 /usr/local/bin/crop-map-s4s.py --help
```

La seconde commande doit afficher l'aide du script, ce qui prouve que
`tessera_features` est bien importé.

## 2. Appliquer la migration

Sauvegarder d'abord les deux tables concernées :

```
pg_dump -U postgres -d sen4stat -t config -t config_metadata > ~/config_avant_tessera.sql
psql -U postgres -d sen4stat -v ON_ERROR_STOP=1 -f tessera-migration.sql
```

## 3. Vérifier le montage de `/eodata`

Le conteneur lanceur lit TESSERA dans `/eodata`. La clé
`general.orchestrator.docker_add_mounts` doit contenir `/eodata:/eodata` :

```
psql -U postgres -d sen4stat -c "select value from config where key = 'general.orchestrator.docker_add_mounts' and site_id is null"
```

## 4. Basculer sur la nouvelle image

```
psql -U postgres -d sen4stat -c "update config set value = 'crop-map-s4s:0.5.0-tessera', last_updated = now() where key = 'general.orchestrator.s4s-crop-type-mapping.docker_image' and site_id is null"
```

Noter auparavant la valeur d'origine (`sen4x/crop-map-s4s:0.5.0` en v4.0).
Ensuite, ajouter `tessera` au filtre de features du site, dans l'interface ou
dans la clé `processor.s4s_crop_mapping.features-filter`.

## 5. Retour arrière

1. Remettre l'image d'origine dans
   `general.orchestrator.s4s-crop-type-mapping.docker_image` ;
2. appliquer `tessera-rollback.sql` ;
3. optionnel : retirer `tessera` des filtres de features (sinon il est ignoré
   sans erreur par le script d'origine) et supprimer l'image
   (`docker image rm crop-map-s4s:0.5.0-tessera`).

En dernier recours, la sauvegarde `~/config_avant_tessera.sql` contient les
tables `config` et `config_metadata` d'avant la migration.
