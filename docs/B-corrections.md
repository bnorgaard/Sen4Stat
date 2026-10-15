# Objectif B — Journal des corrections

Chaque correction est une copie modifiée d'un fichier d'`upstream/` placée sous
`src/web/` ; `git diff --no-index upstream/eo-data-services-1.6.0/<chemin> src/web/<chemin>`
montre la modification. Les fins de ligne d'origine (CRLF) sont conservées.

Déploiement : copier le fichier dans `/usr/share/sen2agri/sen2agri-services/`
au même chemin, après sauvegarde de l'original. Les fichiers statiques sont
servis tels quels, sans redémarrage. Ces copies seront écrasées par une mise à
jour du zip des services (B7) : à réappliquer après chaque mise à jour.

Mesures avant/après avec la sonde de B0 ([B0-mesures.md](B0-mesures.md)).

## B4 — Minuteurs de la page Monitoring (15/10/2026)

Fichier : [`src/web/static/admin/fragments/monitoring.fragment.html`](../src/web/static/admin/fragments/monitoring.fragment.html)
(+18 / −5 lignes). Une seule copie de ce fragment existe, dans `admin/`.

**Problème** : le `setInterval` de 60 s qui rafraîchit l'historique des jobs
est recréé à chaque visite et jamais arrêté ; les boucles `setTimeout` de
200 s se dédoublent quand on revient sur la page avant leur échéance.

**Correction** : un numéro de visite (`window.monitoringVisit`). Une boucle ne
continue que si elle appartient à la visite la plus récente et que la page est
affichée (`isActive()`) ; sinon le `setInterval` s'arrête de lui-même, sans
requête. Le fonctionnement dans l'onglet Monitoring de System overview est
conservé (`data-chash` réécrit en `#systemoverview`).

`pagingGo` n'est pas modifié : `pager.js`, rechargé à chaque visite juste avant
le script du fragment, redéfinit la fonction, si bien que l'enveloppe ne
s'accumule pas (contrairement à l'hypothèse du cadrage).

**Tests sur `eostat-12m`** :

| Test | Avant | Après |
|---|---|---|
| Requêtes de Monitoring sur une autre page, après 3 visites | 6 en 13 s | 0 en 73 s |
| Rafraîchissement sur la page Monitoring (4ᵉ visite), en 68 s | — | chargement à 0 s, un rafraîchissement à 60 s |
| Onglet Monitoring de System overview | — | chargé normalement (31 sites, 10 lignes d'historique) |

**Déploiement** : en place sur `eostat-12m` ; original sauvegardé dans
`~/web-fixes/monitoring.fragment.html.orig`. Retour arrière :

```
sudo cp ~/web-fixes/monitoring.fragment.html.orig /usr/share/sen2agri/sen2agri-services/static/admin/fragments/monitoring.fragment.html
```

**Constat annexe** : la page Produits laisse un gestionnaire de
redimensionnement actif après qu'on l'a quittée (`products.js:1519`,
`getMapPanPercentage`, erreur dans la console). Non corrigé.
