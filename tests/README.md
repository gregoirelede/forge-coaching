# Tests — Forge Coaching

Ces tests ouvrent l'app dans un **vrai navigateur** (Chromium, via Playwright) et
jouent les parcours à la place d'un humain. Ils servent de filet avant chaque
déploiement : l'app est en production, une régression se paie en séances perdues.

## Lancer

```bash
npm test                 # toute la série
npm test -- push         # seulement les tests dont le nom contient « push »
```

Le lanceur démarre lui-même un serveur HTTP sur la racine du dépôt. C'est
indispensable : l'app ne peut pas joindre Supabase en `file://` (Partie C.2 du
CLAUDE.md, piège n°4), et un service worker ne s'enregistre pas non plus.

Prérequis : `npm install`, plus Playwright et son Chromium disponibles sur la
machine. Sur la VM de travail, Chromium est déjà installé
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — **ne pas lancer
`playwright install`**.

## Ce que couvre chaque série

| Fichier | Ce qu'il vérifie |
|---|---|
| `test-sprint1.mjs` | Écran d'erreur réseau (le mode démo ne fuit plus vers un vrai coaché), écran de connexion, `persistSession`, polices auto-hébergées, icônes servies |
| `test-pwa.mjs` | Manifest, enregistrement du service worker, démarrage hors-ligne, **bannière de mise à jour** de bout en bout |
| `test-theme.mjs` | Modes Clair / Sombre / Automatique, variables CSS, couleur de la barre d'état, contraste d'accessibilité |
| `test-push-ui.mjs` | Le réglage Notifications dans Profil : activation, ce qui part en base, bouton de test, désactivation, cas iPhone, cas bloqué par le téléphone |
| `test-push-coach.mjs` | L'envoi d'une notification depuis l'espace coach : garde-fous de saisie, ce qui part à l'Edge Function, et les trois issues (envoyé / aucun appareil abonné / refus du serveur) |
| `test-push-sw.mjs` | Les gestionnaires `push` et `notificationclick` du `sw.js` **livré**, hors navigateur |
| `test-push.mjs` | Qu'un message push injecté par le protocole de débogage réveille bien le service worker installé |

Le chiffrement des notifications a son propre test, à côté du code qu'il
vérifie : `node edge-functions/_webpush.test.mjs`.

## Une limite de la machine de test, à connaître

**Le Chromium sans interface de la VM refuse l'autorisation de notification**,
par toutes les voies possibles : `grantPermissions` de Playwright,
`Browser.grantPermissions` et `Browser.setPermission` du protocole CDP, profil
persistant sur disque, `--headless=new`. `Notification.permission` reste
obstinément à `denied`.

L'**affichage** réel d'une notification est donc invérifiable ici. La couverture
est répartie autrement :

- `test-push.mjs` prouve que le message parvient au worker et que le
  gestionnaire s'exécute **jusqu'à l'appel d'affichage** — c'est le refus
  d'autorisation lui-même qui le prouve, le navigateur ne pouvant refuser que ce
  qu'on lui a demandé ;
- `test-push-sw.mjs` prouve **avec quels arguments exacts** cet appel est fait,
  en chargeant le `sw.js` livré dans un environnement simulé.

Ce qui reste à vérifier sur un vrai téléphone : que la notification s'affiche
bien, et qu'un clic dessus ramène au premier plan. Sur iPhone, **uniquement
depuis l'app installée sur l'écran d'accueil** — règle d'Apple.

## Captures d'écran

Les tests déposent leurs captures dans `tests/captures/`, qui n'est pas suivi
par Git. Utile pour contrôler la charte visuelle à l'œil après une modification.
