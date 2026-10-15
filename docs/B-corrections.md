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

## B1 — Cache des scripts des fragments (15/10/2026)

Fichiers (+14 lignes chacun, identiques) :
[`src/web/static/assets/dist/js/router.js`](../src/web/static/assets/dist/js/router.js),
[`src/web/static/admin/assets/dist/js/router.js`](../src/web/static/admin/assets/dist/js/router.js),
[`src/web/static/admin/lite/assets/dist/js/router.js`](../src/web/static/admin/lite/assets/dist/js/router.js).
Les trois copies du front chargent jQuery 2.2.4 ; leurs routeurs sont
identiques sur `eostat-12m` et en v4.0.

**Problème** : quand le routeur insère un fragment avec `.html()`, jQuery
charge chaque `<script src>` par `jQuery._evalUrl`, en synchrone et sans cache
(`?_=horodatage`) : les bibliothèques sont retéléchargées à chaque visite.

**Correction** : `jQuery._evalUrl` est redéfini en tête du routeur, avec le
même chargement synchrone (ordre d'exécution inchangé) mais `cache: true`. Les
appels à l'API ne passent pas par cette fonction et ne sont pas concernés. Le
navigateur applique alors les en-têtes du serveur (`max-age=3600`,
`Last-Modified`) : cache pendant une heure, puis revalidation (304).

Le routeur lui-même est mis en cache une heure : après déploiement, la
correction est prise en compte après ce délai ou un rechargement forcé
(Ctrl+F5). Inversement, après une mise à jour du front, un navigateur peut
garder l'ancienne version d'un script jusqu'à une heure.

**Tests sur `eostat-12m`** (interface d'administration, 2ᵉ visite de chaque
page, cache rempli) :

| Page | Poids avant (B0) | Poids après | Scripts synchrones avant | après |
|---|---|---|---|---|
| Analytical dashboard | 3 629 Ko | 21 Ko | 779 ms | 282 ms |
| Produits | 2 687 Ko | 128 Ko | 782 ms | 192 ms |
| Statistiques | 1 124 Ko | 42 Ko | 399 ms | 129 ms |
| Sites | 4 859 Ko | 3 843 Ko (dont `/rois/countries`) | 419 ms | 126 ms |
| Dashboard | 209 Ko | 73 Ko | 4 bibliothèques | 57 ms |
| System overview, Monitoring, Custom jobs | 28 à 111 Ko | 22 à 78 Ko | ≤ 100 ms | ≤ 33 ms |

Plus aucun script avec `?_=horodatage`. Hors `/rois/countries`, les 8 pages
transfèrent environ 0,4 Mo au lieu d'environ 8,8 Mo. Aucune erreur nouvelle
dans la console.

**Restant** : sur le Dashboard, 3,2 s de blocage dues aux 30 requêtes
`/sites/seasons` synchrones (B3), environ 105 ms chacune ce jour-là (35 ms lors
de B0) ; c'est désormais le principal point bloquant.

**Autres copies** : l'interface utilisateur (`/ui/sap.html`) renvoie un compte
administrateur vers l'administration ; son routeur est déployé mais non testé
(il faudrait un compte non administrateur). La version lite
(`/ui/admin/lite/sap.html`) ne charge aucune page, avec ou sans correction :
son routeur appelle `readExtProjectCookie()`, fonction absente de son
`general-functions.js` (défaut d'origine, identique en v4.0). Non corrigé.

**Déploiement** : en place sur `eostat-12m` ; originaux sauvegardés dans
`~/web-fixes/router.ui.js.orig`, `router.admin.js.orig` et
`router.lite.js.orig`. Retour arrière :

```
S=/usr/share/sen2agri/sen2agri-services/static
sudo cp ~/web-fixes/router.ui.js.orig $S/assets/dist/js/router.js
sudo cp ~/web-fixes/router.admin.js.orig $S/admin/assets/dist/js/router.js
sudo cp ~/web-fixes/router.lite.js.orig $S/admin/lite/assets/dist/js/router.js
```

## B5 — Compression HTTP (15/10/2026)

Fichier : [`src/web/config/application.properties`](../src/web/config/application.properties)
(+3 lignes : `server.compression.enabled=true`). Les services utilisent
Spring Boot 2.7.18 avec Tomcat 9.0.83 intégré ; la liste de types compressés
par défaut couvre HTML, CSS, JavaScript, JSON et XML, à partir de 2 Ko.

Déploiement : la ligne est ajoutée au fichier existant de l'instance (dont la
version peut différer de la v4.0), puis le service `sen2agri-services` est
redémarré (interface indisponible environ une minute, sessions perdues).

**Tests sur `eostat-12m`** (ressources rechargées sans cache) :

| Ressource | Taille réelle | Transférée | Facteur |
|---|---|---|---|
| `ol.js` | 917 Ko | 224 Ko | 4,1 |
| `ol-ext.js` | 1 017 Ko | 230 Ko | 4,4 |
| `nv.d3.js` | 757 Ko | 129 Ko | 5,9 |
| `jquery.min.js` | 84 Ko | 29 Ko | 2,9 |
| `bootstrap.min.css` | 118 Ko | 19 Ko | 6,1 |
| `products.fragment.html` | 83 Ko | 20 Ko | 4,1 |
| `/rois/countries` (JSON) | 3 767 Ko | 1 376 Ko | 2,7 |

**Limite** : le serveur compresse à la volée, à environ 14 Mo/s de données
d'origine. Sur la connexion du poste de test (environ 28 Mo/s), un appel à
`/rois/countries` prend environ 340 ms (5 mesures stables : 30 ms d'attente,
270 ms de transfert), contre 132 ms sans compression lors de B0 (une seule
mesure, charge du serveur variable). La compression fait gagner du volume,
et du temps sur les liaisons plus lentes (en dessous d'environ 10 Mo/s,
estimation), mais pas sur une liaison rapide pour cette grosse réponse. Le
cas de `/rois/countries` relève de sa propre correction (chargement unique).

**Déploiement** : en place sur `eostat-12m` ; original sauvegardé dans
`~/web-fixes/application.properties.orig`. Retour arrière :

```
sudo cp ~/web-fixes/application.properties.orig /usr/share/sen2agri/sen2agri-services/config/application.properties
sudo systemctl restart sen2agri-services
```

## B3 — Requêtes synchrones du Dashboard (15/10/2026)

Fichier : [`src/web/static/admin/fragments/dashboard.fragment.html`](../src/web/static/admin/fragments/dashboard.fragment.html)
(+25 / −14 lignes ; BOM et CRLF conservés). Les deux autres copies du
fragment n'ont pas cette boucle (leurs appels synchrones sont des actions
isolées, ou dans la version lite, inutilisable).

**Problème** : `getSitesHtml` demandait les saisons de chaque site par une
requête synchrone (`async: false`), soit 30 requêtes à la suite. L'interface
était bloquée pendant ce temps, et l'affichage des onglets des processeurs
(`getProcessorsHtml`, appelé ensuite) attendait la fin des 30 requêtes.

**Correction** : `getSiteSeasons` n'est plus synchrone ; les requêtes partent
en parallèle et les saisons sont ajoutées dans l'ordre des sites une fois
toutes les réponses arrivées. Un échec isolé n'empêche pas l'affichage des
autres sites. Si un site a déjà été choisi dans le formulaire, ses saisons
sont rendues visibles.

**Tests sur `eostat-12m`** :

| | Avant (B0) | Avant (15/10, plus tard) | Après |
|---|---|---|---|
| Blocage par les requêtes synchrones de l'API | 1,3 s | 3,2 s | 0 ms |
| Tâches longues | 1,4 s | 1,1 s | 0 ms |
| Onglets des processeurs affichés | après les 30 requêtes | après les 30 requêtes | après 144 à 155 ms |
| Saisons chargées (arrière-plan) | — | — | 326 à 383 ms |

Liste des saisons du formulaire « nouveau job planifié » identique à celle
construite site par site (37 saisons, même ordre) ; le choix d'un site (76)
affiche ses 7 saisons. Aucune erreur dans la console. Validation préalable :
le code exact du fichier, compilé et exécuté sur une copie détachée du
formulaire, donnait la même liste que l'ancien code.

**Déploiement** : en place sur `eostat-12m` ; original sauvegardé dans
`~/web-fixes/dashboard.fragment.html.orig`. Retour arrière :

```
sudo cp ~/web-fixes/dashboard.fragment.html.orig /usr/share/sen2agri/sen2agri-services/static/admin/fragments/dashboard.fragment.html
```

## `/rois/countries` — Contours chargés à la demande (15/10/2026)

Fichier : [`src/web/static/admin/fragments/sites.fragment.html`](../src/web/static/admin/fragments/sites.fragment.html)
(+29 / −16 lignes ; CRLF conservés). Une seule copie, dans `admin/`.

**Problème** : à chaque visite de la page Sites, les contours des pays et
régions (`/rois/countries`, 3,8 Mo, 1,4 Mo compressés) étaient téléchargés en
synchrone. Ils ne servent qu'à la sélection continent / pays / région de la
boîte de dialogue « Add new site ».

**Correction** : la requête n'est plus faite à l'ouverture de la page mais au
premier clic sur « Create new site » (asynchrone, bouton désactivé pendant le
chargement) ; le résultat est gardé pour la session (`window.sitesRegionsRequest`),
y compris lors des visites suivantes de Sites. En cas d'échec, la section de
sélection est masquée comme auparavant, et la requête est retentée au clic
suivant.

**Version de `eostat-12m`** : ce fragment diffère de la v4.0 (gestion des
téléversements, sans rapport). La même modification a été appliquée au fichier
de la 12M par le script [`src/web/patches/sites_regions.py`](../src/web/patches/sites_regions.py),
réutilisable après une mise à jour des services ; elle est identique ligne pour
ligne (45 lignes ajoutées ou retirées).

**Tests sur `eostat-12m`** :

| | Avant (B0) | Après B1 | Après |
|---|---|---|---|
| Poids d'une visite de Sites | 4 859 Ko | 3 843 Ko | 26 à 29 Ko |
| Requêtes `/rois/countries` par visite | 1, synchrone | 1, synchrone | 0 |
| Blocage synchrone (scripts en cache) | 419 ms | 783 ms | environ 37 à 66 ms |

- Premier clic sur « Create new site » : une requête asynchrone (environ
  600 ms), boîte de dialogue ouverte avec 237 pays et 3 154 régions.
- Clic suivant, lors d'une autre visite de Sites : ouverture immédiate, sans
  nouvelle requête, mêmes listes.
- Boîte refermée sans rien créer ; aucune erreur dans la console.

(La sonde, installée deux fois faute de rechargement de la page, a compté
chaque requête en double ; les valeurs ci-dessus sont corrigées d'après la
liste des ressources du navigateur.)

**Déploiement** : en place sur `eostat-12m` ; original sauvegardé dans
`~/web-fixes/sites.fragment.html.orig`. Retour arrière :

```
sudo cp ~/web-fixes/sites.fragment.html.orig /usr/share/sen2agri/sen2agri-services/static/admin/fragments/sites.fragment.html
```

## B6 — Rétention de `node_resource_log` (15/10/2026)

Fichiers : [`src/sql/node-resource-log-retention.sql`](../src/sql/node-resource-log-retention.sql)
et [`src/sql/node-resource-log-retention-rollback.sql`](../src/sql/node-resource-log-retention-rollback.sql).
Correction en base, et non dans `src/web/`.

**Problème** : chaque nœud enregistre une mesure par minute dans
`node_resource_log` (`sp_insert_node_statistics`), et la table n'est jamais
purgée : 1 051 145 lignes depuis le 26/09/2024 sur `eostat-12m` (B0). Tant que
System overview est ouvert, `sp_get_dashboard_server_resource_data` est
appelée toutes les 10 s ; elle n'utilise que les 15 dernières minutes, mais
commence par un `select distinct node_name` sur toute la table (parcours
complet). Son coût croît avec la table.

**Correction** : `sp_insert_node_statistics` supprime, après chaque insertion,
les lignes de plus de 30 jours (environ une ligne par appel, par l'index sur
`timestamp`). Une erreur de suppression produit un `WARNING` sans annuler
l'insertion de la mesure. La fonction de la page n'est pas modifiée.
Le script de retour arrière réinstalle la fonction v4.0 à l'identique.

Conséquence : l'historique de plus de 30 jours est perdu ; la page n'en lit
que 15 minutes, et personne ne consulte l'historique long (choix du
15/10/2026). La fonction sera écrasée si les scripts de la base v4.0 sont
réappliqués (mise à jour) : à réinstaller ensuite.

**Déploiement sur `eostat-12m`**, dans cet ordre (la purge unique précède
l'installation, pour que le premier appel de l'agent n'ait pas un million de
lignes à supprimer) :

```
pg_dump -U postgres -d sen4stat -t node_resource_log -Fc -f ~/web-fixes/node_resource_log_avant_purge.dump
psql -U postgres -d sen4stat -c "delete from node_resource_log where timestamp < now() - interval '30 days'"
psql -U postgres -d sen4stat -c "vacuum analyze node_resource_log"
psql -U postgres -d sen4stat -v ON_ERROR_STOP=1 -f ~/web-fixes/node-resource-log-retention.sql
```

La fonction installée avant la correction était identique à la v4.0 (`\sf`).
L'installation affiche un `NOTICE` par paramètre (types `%TYPE` convertis),
comme le script d'origine.

**Tests sur `eostat-12m`** :

| | Avant | Après |
|---|---|---|
| Lignes | 1 051 145 (B0) | 42 492 (`DELETE 1008820`) |
| `select distinct node_name` | 99 ms (102 ms en B0) | 36 ms |
| `sp_get_dashboard_server_resource_data()`, 3 appels | 225 à 237 ms | 32 à 45 ms |
| Mesures de l'agent après installation | — | dernière mesure 27 s avant la vérification |
| Suppression continue par la fonction | — | 7 min après la purge, plus ancienne ligne 8 s après la limite des 30 jours ; 42 492 lignes à 3 min d'intervalle |

**Restant** : le fichier de la table garde sa taille (110 Mo pour 42 492
lignes) ; `VACUUM` rend l'espace réutilisable par les insertions suivantes
sans réduire le fichier, que le `select distinct` relit entièrement (36 ms).
Un `VACUUM FULL` le réduirait (verrou exclusif bref sur la table) ; non
fait, à décider.

**Déploiement** : en place sur `eostat-12m` ; table sauvegardée avant la purge
dans `~/web-fixes/node_resource_log_avant_purge.dump` (20 Mo). Retour arrière
de la fonction :

```
psql -U postgres -d sen4stat -v ON_ERROR_STOP=1 -f ~/web-fixes/node-resource-log-retention-rollback.sql
```

Les lignes supprimées peuvent être réinsérées depuis la sauvegarde, **après**
ce retour arrière (sinon la fonction les supprime de nouveau). Procédure non
testée : la sauvegarde est restaurée dans une base temporaire, puis seules les
lignes plus anciennes que la plus ancienne ligne restante sont recopiées.

```
createdb -U postgres nrl_restore
pg_restore -U postgres -d nrl_restore ~/web-fixes/node_resource_log_avant_purge.dump
M=$(psql -U postgres -d sen4stat -Atc "select min(timestamp) from node_resource_log")
psql -U postgres -d nrl_restore -c "\copy (select * from node_resource_log where timestamp < '$M') to pstdout" | psql -U postgres -d sen4stat -c "\copy node_resource_log from pstdin"
dropdb -U postgres nrl_restore
```
