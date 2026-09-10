# outils/ — l'atelier couleur

Ce dossier ne fait pas partie de l'app livrée. Il sert à **construire et
éprouver** une palette avant de la déployer, conformément à la méthode retenue
le 10 septembre 2026 : maquettes d'abord, déploiement ensuite.

| Fichier | Rôle |
|---|---|
| `couleur.py` | OKLCH ↔ sRGB et contraste WCAG, sans aucune dépendance |
| `palettes.py` | Les variantes de palette, et l'émission d'un `theme.css` complet |
| `palettes/*.css` | Les `theme.css` produits, prêts à être copiés sur `src/theme.css` |
| `maquettes.mjs` | Rend chaque variante sur les écrans réels et photographie |
| `planche.mjs` | Assemble les captures en planches comparatives |

## Pourquoi OKLCH et pas HSL

En HSL, deux couleurs de même « L » n'ont pas du tout la même clarté perçue : un
jaune à 50 % éclate, un bleu à 50 % est sombre. Une rampe HSL à pas régulier
donne donc des marches inégales — c'est exactement ce qui fait qu'une palette
« ne tient pas ensemble ». OKLCH est perceptuellement uniforme.

## Se servir de l'atelier

```bash
python3 outils/palettes.py                 # rapport de contraste des variantes
node outils/maquettes.mjs A-sable-approfondi B-vert-ancrage C-sable-chaud
node outils/planche.mjs                    # planches comparatives
```

`maquettes.mjs` **restaure la palette d'origine et reconstruit `index.html`**
en sortant, quoi qu'il arrive : le dépôt ne doit jamais rester dans l'état
d'une maquette.

Il attend un serveur sur `127.0.0.1:8099` servant la racine du dépôt — le même
que celui des tests.

## Ce que les maquettes ont déjà rattrapé

Deux défauts que le nuancier ne montrait pas, et que seule la mise en surface a
révélés :

1. **La barre d'onglets devenait illisible** en variante B — vert foncé sur vert
   foncé. Ses libellés lisaient `--accent`, qui n'a plus de sens quand la barre
   elle-même est verte. D'où `--barre-tx` et `--barre-tx-actif`.
2. **Les teintes claires viraient au bonbon.** Elles sortaient de la même rampe
   que les tons soutenus, où la courbe de chroma monte vers le haut : juste pour
   un aplat de 40 px, faux pour un fond de carte. Elles sont désormais tirées à
   part, à chroma bas.

C'est précisément à ça que sert l'étape maquette : ces deux-là seraient partis
en production.
