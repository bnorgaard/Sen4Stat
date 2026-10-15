# B0 — Mesures de la réactivité de l'interface

Mesures faites le 15/10/2026 sur `eostat-12m` (interface d'administration
`/ui/admin/sap.html`, depuis le poste de Boris), sans aucune modification.
Données brutes dans `data/B0/` (non versionné).

## 1. Le front de la 12M et la v4.0

1 207 des 1 224 fichiers de `static/` sont identiques à la copie v4.0
d'`upstream/` ; 13 diffèrent, surtout autour d'une bibliothèque de frise
chronologique (`timeline`, remplacée par `lite-timeline` en v4.0). Les pages
Dashboard, Monitoring, System overview, Statistiques et Analytical dashboard
sont identiques ; pour Sites, Produits et Custom jobs, les problèmes mesurés
existent aussi en v4.0 (vérifié dans le code). **Les mesures valent pour la
v4.0, et les corrections porteront sur la copie `upstream/`.**

## 2. Navigateur

Méthode : sonde JavaScript en lecture seule (requêtes, synchrones ou non,
durées, tailles ; minuteurs ; tâches longues) et API Performance, fenêtre
1 440 × 900, 8 à 25 s par page.

| Page | Requêtes | Poids par visite | Scripts rechargés en synchrone | Blocage synchrone | Remarques |
|---|---|---|---|---|---|
| Dashboard | 46 | 209 Ko | 4 bibliothèques + 30 `/sites/seasons` | 1,3 s | `/sites/` : 1,2 s au premier appel |
| Produits | 60 | 2,7 Mo | 11, dont `ol.js` (917 Ko) et `ol-ext.js` (1 Mo) | 0,8 s | `html2canvas` chargé depuis Internet, sans cache |
| Sites | 39 | 4,9 Mo | 6, dont `/rois/countries` (3,8 Mo) et `ol.js` | 0,4 s | 30 `/sites/seasons` asynchrones |
| Analytical dashboard | 21 | 3,6 Mo | 14, dont `ol.js` deux fois | 0,8 s | |
| Statistiques | 11 | 1,1 Mo | 6, dont `nv.d3.js` (757 Ko, non minifié) | 0,4 s | |
| System overview | 6 | 111 Ko | 2 | 0,1 s | `/refresh/resources` toutes les 10 s, environ 315 ms |
| Monitoring | 8 | 28 Ko | 1 | — | `setInterval` de 60 s jamais arrêté |
| Custom jobs | 27 en 76 s | — | 3 | 0,1 s | 15 `/jobs/custom/parameters` |

Sur la session : 228 requêtes AJAX, dont 85 synchrones, soit 4,3 s de blocage
cumulé de l'interface.

Après trois visites de Monitoring, trois minuteurs restent actifs : sur la page
Custom jobs, `/jobs/count` et `/jobs/history` ont été appelés à 44 s, 49 s et
57 s.

## 3. Serveur HTTP et journaux

- Aucune compression (`Content-Encoding` absent) pour JavaScript, CSS, HTML et
  JSON ; `ol.js` part en 939 Ko.
- Cache : `Cache-Control: max-age=3600, must-revalidate, no-transform` et
  `Last-Modified`, pas d'`ETag`. Le cache est rendu inutile pour les scripts
  des fragments, rechargés avec `?_=horodatage`.
- Journaux : niveaux `TRACE` pour `ro.cs.tao`, `ro.cs.eo` et `org.esa.sen4cap` ;
  570 lignes dans le journal système en une heure.

## 4. Base de données

- `node_resource_log` : 1 051 145 lignes depuis le 26/09/2024, 1 nœud, 150 Mo,
  jamais purgée ; seul index sur `timestamp`.
- `select distinct node_name` (parcours complet, lu depuis le disque) : 102 ms.
- `sp_get_dashboard_server_resource_data()` : 235 ms par appel, toutes les 10 s
  tant que System overview est ouvert. La fonction n'utilise pourtant que les
  15 dernières minutes.
- `pg_stat_statements` : non installé (l'activer demande un redémarrage de
  PostgreSQL).
- Parcours complets les plus lourds (`pg_stat_user_tables`) : `event`,
  13,8 millions de parcours et 1 650 milliards de lignes lues pour
  458 408 lignes ; `fmask_history`, 6 millions de parcours. Charge de fond,
  hors interface (hypothèse : orchestrateur ou ordonnanceur).

## 5. Verdicts

| Piste | Verdict | Impact mesuré |
|---|---|---|
| B1 Scripts rechargés sans cache | Confirmée, problème principal | 85 requêtes synchrones, 4,3 s de blocage ; jusqu'à 4,9 Mo par visite |
| B2 `html2canvas` externe | Confirmée | Faible en temps ; l'export échoue sans accès Internet |
| B3 AJAX synchrones en boucle | Confirmée sur le Dashboard (30 requêtes) ; non mesurée sur Statistiques (déclenchée par une action) | Environ 1 s de blocage sur le Dashboard |
| B4 Minuteurs qui fuient | Confirmée | Une boucle de plus à chaque visite de Monitoring, active sur toutes les pages |
| B5 Compression et cache | Compression absente : confirmée ; en-têtes de cache : présents | Volumes divisibles par 3 à 10 avec compression (estimation) ; journaux `TRACE` à faible volume |
| B6 Requête lourde toutes les 10 s | Confirmée | 235 ms par appel, en croissance avec la table |
| B7 Trois copies du front | Confirmée (structure) | Les mesures portent sur `admin/` |
| Nouveau : `/rois/countries` | 3,8 Mo chargés en synchrone à chaque visite de Sites | |
| Nouveau : table `event` | Charge de fond de la base | Hors interface |

## 6. Ordre de correction proposé

Du plus sûr au plus délicat, avec le gain attendu :

| Ordre | Correction | Fichiers | Risque | Gain attendu |
|---|---|---|---|---|
| 1 | B4 : arrêter les minuteurs de Monitoring en quittant la page | `monitoring.fragment.html` | Faible | Plus de requêtes fantômes |
| 2 | B1 : laisser le navigateur mettre en cache les scripts des fragments (filtre jQuery pour les seuls scripts) | un fichier JS commun | Faible | Visites suivantes : quelques Ko au lieu de plusieurs Mo |
| 3 | B5 : activer la compression HTTP | `config/application.properties`, redémarrage du service | Faible | Volumes divisés par 3 à 10 (à mesurer) |
| 4 | B2 : copie locale de `html2canvas` | `products.fragment.html` + un fichier ajouté | Faible | Export indépendant d'Internet |
| 5 | `/rois/countries` : ne charger les contours qu'une fois par session | `sites.fragment.html` | Moyen | 3,8 Mo et environ 0,1 s de blocage par visite de Sites |
| 6 | B6 : purge de `node_resource_log` et requête limitée aux 15 dernières minutes | migration SQL | Moyen | 235 ms → à mesurer, et arrêt de la croissance |
| 7 | B3 : remplacer la boucle synchrone du Dashboard par des requêtes parallèles | `dashboard.fragment.html` | Moyen | Environ 1 s de blocage en moins |

Chaque correction devra être reportée dans les copies du front concernées
(B7) et mesurée avant et après, avec la même méthode.
