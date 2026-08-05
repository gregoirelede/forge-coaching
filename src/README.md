# Dossier `src/`

## `training-app.jsx` — la source unique de vérité

4 762 lignes de JSX qui produisent la totalité de l'`index.html` déployé.
**C'est le seul fichier à modifier.** L'`index.html` de la racine est un produit du
build : toute retouche faite directement dessus sera écrasée au build suivant.

## Construire

```bash
npm install      # une seule fois par machine ou par session cloud
node build.mjs   # reconstruit index.html et lance les contrôles
```

Le build s'interrompt de lui-même si l'une des transformations ne s'applique plus ou
si un contrôle de la Partie E échoue. Un build qui va au bout est un build sain.

## Test de non-régression de référence

Sur la source v7b **non modifiée**, `node build.mjs` produit un `index.html` de
**456 617 octets, identique à l'octet près** à celui en production. C'est la preuve
que le pipeline est juste.

Après toute modification du `build.mjs`, refaire ce test : reprendre la version v7b de
`training-app.jsx` (via `git show`), builder, et vérifier l'égalité avec l'`index.html`
de production. S'ils diffèrent, le build a dérivé.

## Ce que le build attend de ce fichier

Quatre éléments doivent s'y trouver textuellement, sinon le build s'arrête avec un
message explicite (voir les transformations dans `build.mjs`) :

1. La ligne d'import React : `import { useState, useEffect, ... } from "react";`
2. Le bloc `let _supabase = null, _supabasePromise = null;` suivi de la fonction
   `getSupabase` se terminant par `return _supabasePromise;`
3. La déclaration `export default function ForgeCoachingApp()`
4. `SUPABASE_CONFIG.url` avec son suffixe `/rest/v1/`, retiré au build

## Piège à connaître

La fonction `getSupabase` de la source utilise un `import()` dynamique vers esm.sh.
**C'est normal** : le build le remplace par le client UMD chargé du CDN. Ce
remplacement doit impérativement conserver
`auth: { persistSession: true, autoRefreshToken: true }`, sans quoi les coachés
seraient déconnectés à chaque fermeture de l'app. Le build vérifie ce point et refuse
de produire un fichier sans lui.
