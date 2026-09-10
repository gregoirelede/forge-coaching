# ═══════════════════════════════════════════════════════════════════════════
#  Les variantes de palette, construites en OKLCH.
#
#  Direction retenue par Greg le 10 septembre 2026 : approfondir Forest & Sand.
#  Trois leviers, issus du relevé de la Partie Q.4 :
#    1. le sable gagne une vraie profondeur tonale (10 points d'écart → 35+)
#    2. le vert de marque passe de 1 % à une surface réelle
#    3. un vrai neutre entre en scène, pour que le sable redevienne un choix
#
#  Quatrième décision, prise le même jour : le code couleur de la progression
#  quitte le vert. Il partageait sa teinte avec la marque (162° contre 157°,
#  12° d'écart) : dès que le vert décore, une bulle verte cesse de vouloir dire
#  « tu as progressé ». Il passe sur turquoise/corail. Bénéfice non demandé mais
#  réel : vert/rouge est le couple que ne distinguent pas les 8 % d'hommes
#  atteints de deutéranopie ; turquoise/corail se sépare aussi sur l'axe
#  bleu-jaune, donc reste lisible pour eux.
# ═══════════════════════════════════════════════════════════════════════════
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from couleur import oklch_hex, contraste, hex_oklch

# Clartés de référence, communes aux trois variantes : c'est le pas régulier
# qui fait tenir une rampe, pas les valeurs elles-mêmes.
TONS_SABLE = {"0": 0.995, "50": 0.975, "100": 0.952, "200": 0.925, "300": 0.885,
              "400": 0.830, "500": 0.760, "600": 0.660}
TONS_VERT  = {"50": 0.960, "100": 0.915, "200": 0.855, "300": 0.775, "400": 0.660,
              "500": 0.560, "600": 0.478, "700": 0.400, "800": 0.315, "900": 0.240,
              "950": 0.170}

def cloche(L, sommet=0.58, largeur=0.62, plancher=0.14):
    return max(plancher, (1 - abs(L - sommet) / largeur) ** 0.55)

def rampe(H, C, tons):
    return {n: oklch_hex(L, C * cloche(L), H) for n, L in tons.items()}

def plat(H, C, tons):
    """Pour le sable : pas de cloche. On veut une teinte CONSTANTE du plus clair
    au plus foncé, sinon les surfaces ne se lisent plus comme la même matière."""
    return {n: oklch_hex(L, C, H) for n, L in tons.items()}

VARIANTES = {
    "A-sable-approfondi": {
        "titre": "Sable approfondi",
        "resume": "Le sable devient une vraie couleur, le vert prend le bandeau et le hero.",
        "sable_H": 82, "sable_C": 0.022,
        "vert_H": 162, "vert_C": 0.105,
        "neutre_H": 82, "neutre_C": 0.004,
        "entete": "sable-50", "hero": "vert-700",
    },
    "B-vert-ancrage": {
        "titre": "Vert d'ancrage",
        "resume": "Le vert tient la navigation ET le hero : la marque se voit dès l'ouverture.",
        "sable_H": 82, "sable_C": 0.020,
        "vert_H": 160, "vert_C": 0.115,
        "neutre_H": 82, "neutre_C": 0.004,
        "entete": "vert-800", "hero": "vert-700",
    },
    "C-sable-chaud": {
        "titre": "Sable chaud",
        "resume": "Un sable plus ocre et un vert plus profond : le parti le plus éditorial.",
        "sable_H": 74, "sable_C": 0.032,
        "vert_H": 166, "vert_C": 0.098,
        "neutre_H": 74, "neutre_C": 0.005,
        "entete": "sable-100", "hero": "vert-800",
    },
}

# Le couple de la progression. Turquoise franc, loin du vert de marque ; corail
# chaud, loin du sable. Les deux à clarté proche, pour qu'aucun ne domine.
PROG_H_UP, PROG_C_UP = 196, 0.105
PROG_H_DOWN, PROG_C_DOWN = 28, 0.135

def construire(spec):
    s = plat(spec["sable_H"], spec["sable_C"], TONS_SABLE)
    v = rampe(spec["vert_H"], spec["vert_C"], TONS_VERT)
    n = plat(spec["neutre_H"], spec["neutre_C"], TONS_SABLE)
    up = rampe(PROG_H_UP, PROG_C_UP, TONS_VERT)
    dn = rampe(PROG_H_DOWN, PROG_C_DOWN, TONS_VERT)
    return {"sable": s, "vert": v, "neutre": n, "up": up, "dn": dn}

def rapport(nom, spec):
    p = construire(spec)
    s, v, up, dn = p["sable"], p["vert"], p["up"], p["dn"]
    print(f"\n{'═'*72}\n  {spec['titre'].upper()}  ({nom})\n  {spec['resume']}\n{'═'*72}")
    print(f"  Sable  {' '.join(s[k] for k in ['0','100','300','500','600'])}")
    print(f"  Vert   {' '.join(v[k] for k in ['100','300','500','700','900'])}")
    print(f"\n  Profondeur du sable : {round((0.995-0.660)*100)} points de clarté "
          f"(aujourd'hui : 10)")
    controles = [
        ("texte sur fond",            oklch_hex(0.262, 0.021, spec["vert_H"]), s["100"], 4.5),
        ("texte sur carte",           oklch_hex(0.262, 0.021, spec["vert_H"]), s["0"],   4.5),
        ("libellé de bouton",         "#FFFFFF", v["700"], 4.5),
        ("hero : texte sur vert",     "#FFFFFF", v[spec["hero"].split("-")[1]], 4.5),
        ("progression, texte",        up["800"], oklch_hex(0.930, 0.036, PROG_H_UP), 4.5),
        ("régression, texte",         dn["800"], oklch_hex(0.930, 0.042, PROG_H_DOWN), 4.5),
        ("carte détachée du fond",    s["0"],   s["100"], 1.06),
    ]
    print()
    ko = 0
    for libelle, a, b, seuil in controles:
        c = contraste(a, b)
        bon = c >= seuil
        if not bon: ko += 1
        print(f"  {'ok  ' if bon else 'ECHEC'} {libelle:<26} {c:>6}:1   (seuil {seuil})")
    return ko

if __name__ == "__main__":
    total = sum(rapport(n, s) for n, s in VARIANTES.items())
    print(f"\n{'─'*72}")
    print("Tous les contrôles de contraste passent." if total == 0
          else f"{total} contrôle(s) en échec — la variante n'est pas livrable en l'état.")

# ═══════════════════════════════════════════════════════════════════════════
#  Émission d'un theme.css complet.
#
#  Les couleurs des muscles et des phases ne sont PAS régénérées : elles sont
#  un code de repérage stable (Partie H, liste fermée), et les changer ferait
#  perdre à Greg des repères qu'il a dans l'œil depuis des mois. On ne touche
#  qu'à ce qui relève du décor et de la progression.
# ═══════════════════════════════════════════════════════════════════════════
import re

def _degrade(hexa, dL=0.045):
    L, C, H = hex_oklch(hexa)
    haut = oklch_hex(min(0.99, L + dL), C, H)
    bas = oklch_hex(max(0.02, L - dL), C * 0.96, H)
    return f"linear-gradient(180deg, {haut} 0%, {bas} 100%)"

def _rgba(hexa, a):
    h = hexa.lstrip("#")
    return f"rgba({int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)}, {a})"

def emettre(nom, spec, source):
    """Réécrit le theme.css d'origine en remplaçant les seules variables qui
    relèvent de cette décision. On part du fichier réel, donc rien de ce qui
    n'est pas listé ici ne peut être perdu par mégarde."""
    p = construire(spec)
    s, v, nt, up, dn = p["sable"], p["vert"], p["neutre"], p["up"], p["dn"]
    entete = v[spec["entete"].split("-")[1]] if spec["entete"].startswith("vert") \
             else s[spec["entete"].split("-")[1]]
    entete_vert = spec["entete"].startswith("vert")

    clair = {
        "--bg": s["100"], "--surface": s["0"], "--surface2": s["200"],
        "--input-bg": s["200"],
        "--border": _rgba(v["950"], "0.11"), "--border-strong": _rgba(v["950"], "0.22"),
        "--text": oklch_hex(0.262, 0.021, spec["vert_H"]), "--text-sub": oklch_hex(0.50, 0.012, spec["sable_H"]),
        "--text-muted": oklch_hex(0.635, 0.014, spec["sable_H"]),
        "--accent": v["600"], "--accent-dark": v["800"],
        # Les TEINTES CLAIRES ne peuvent pas sortir de la même rampe que les
        # tons soutenus. La courbe en cloche donne beaucoup de chroma vers le
        # haut, ce qui est juste pour un aplat de 40 px et faux pour un fond de
        # carte : en maquette, le vert clair virait menthe et le turquoise des
        # séries validées inondait la ligne en cyan. On les tire donc à part,
        # à chroma volontairement bas.
        "--accent-light": oklch_hex(0.930, 0.030, spec["vert_H"]),
        "--accent-text": "#FFFFFF", "--danger": dn["600"],
        "--shadow": _rgba(v["950"], "0.10"),
        "--btn-primaire": v["700"], "--btn-primaire-tx": "#FFFFFF",
        "--accent-a10": _rgba(v["600"], "0.09"), "--accent-a20": _rgba(v["600"], "0.21"),
        "--accent-a33": _rgba(v["600"], "0.33"), "--accent-a38": _rgba(v["600"], "0.38"),
        "--accent-light-a53": _rgba(oklch_hex(0.930, 0.030, spec["vert_H"]), "0.53"),
        "--cmp-up-bg": oklch_hex(0.930, 0.036, PROG_H_UP), "--cmp-up-border": up["600"], "--cmp-up-text": up["800"],
        "--cmp-down-bg": oklch_hex(0.930, 0.042, PROG_H_DOWN), "--cmp-down-border": dn["600"], "--cmp-down-text": dn["800"],
        "--set-done-bg": oklch_hex(0.962, 0.018, PROG_H_UP),
        "--scrim": _rgba(v["950"], "0.44"),
        "--bar-bg": _rgba(entete, "0.80" if entete_vert else "0.72"),
        "--bar-bg-opaque": _rgba(entete, "0.94" if entete_vert else "0.90"),
        # Nouvelles : la surface que prend la marque.
        "--entete-tx": "#FFFFFF" if entete_vert else v["950"],
        # La barre d'onglets partage le fond du bandeau : ses libellés doivent
        # donc savoir sur quoi ils sont posés. Sans ça, en variante B, l'onglet
        # actif était vert foncé sur vert foncé — invisible. Trouvé en maquette,
        # ce qui est exactement à quoi sert une maquette.
        "--barre-tx": _rgba("#FFFFFF", "0.72") if entete_vert else oklch_hex(0.635, 0.014, spec["sable_H"]),
        "--barre-tx-actif": "#FFFFFF" if entete_vert else v["700"],
        "--hero-bg": v[spec["hero"].split("-")[1]],
        # LE DÉGRADÉ DU HERO. Même teinte du haut au bas — seule la clarté
        # bouge, de ±0,045 en OKLCH. C'est de la lumière tombant du haut, et
        # c'est cohérent avec ce que les ombres --e1/--e2/--e3 affirment déjà :
        # une source lumineuse existe. Un aplat parfaitement uniforme la
        # contredit ; aucune matière réelle n'est uniforme sous une lumière.
        # À NE PAS CONFONDRE avec le dégradé retiré en v7z, qui traversait
        # 15,8° de teinte (#064E3B → #0D9488) : un écart de teinte se lit comme
        # un EFFET, un écart de clarté se lit comme du relief.
        "--hero-fond": _degrade(v[spec["hero"].split("-")[1]]),
        "--hero-tx": "#FFFFFF",
        "--hero-sub": _rgba("#FFFFFF", "0.72"),
    }
    # En sombre, on garde l'esprit : fonds vert-charbon, jamais noirs.
    sombre = {
        "--bg": oklch_hex(0.175, 0.016, spec["vert_H"]),
        "--surface": oklch_hex(0.238, 0.019, spec["vert_H"]),
        "--surface2": oklch_hex(0.295, 0.021, spec["vert_H"]),
        "--input-bg": oklch_hex(0.295, 0.021, spec["vert_H"]),
        "--border": "rgba(255, 255, 255, 0.10)", "--border-strong": "rgba(255, 255, 255, 0.22)",
        "--text": oklch_hex(0.955, 0.008, spec["sable_H"]),
        "--text-sub": oklch_hex(0.740, 0.013, spec["sable_H"]),
        "--text-muted": oklch_hex(0.605, 0.014, spec["sable_H"]),
        "--accent": v["400"], "--accent-dark": v["300"],
        "--accent-light": oklch_hex(0.315, 0.038, spec["vert_H"]),
        "--accent-text": "#FFFFFF", "--danger": dn["400"],
        "--shadow": "rgba(0, 0, 0, 0.55)",
        "--btn-primaire": v["550"] if "550" in v else oklch_hex(0.520, spec["vert_C"] * cloche(0.52), spec["vert_H"]),
        "--btn-primaire-tx": "#FFFFFF",
        "--accent-a10": _rgba(v["400"], "0.12"), "--accent-a20": _rgba(v["400"], "0.24"),
        "--accent-a33": _rgba(v["400"], "0.36"), "--accent-a38": _rgba(v["400"], "0.42"),
        "--accent-light-a53": _rgba(oklch_hex(0.315, 0.038, spec["vert_H"]), "0.53"),
        "--cmp-up-bg": oklch_hex(0.285, 0.045, PROG_H_UP), "--cmp-up-border": up["400"],
        "--cmp-up-text": up["300"],
        "--cmp-down-bg": oklch_hex(0.285, 0.055, PROG_H_DOWN), "--cmp-down-border": dn["400"],
        "--cmp-down-text": dn["300"],
        "--set-done-bg": oklch_hex(0.255, 0.030, PROG_H_UP),
        "--scrim": "rgba(0, 0, 0, 0.62)",
        "--bar-bg": _rgba(oklch_hex(0.225, 0.022, spec["vert_H"]), "0.76"),
        "--bar-bg-opaque": _rgba(oklch_hex(0.225, 0.022, spec["vert_H"]), "0.93"),
        "--entete-tx": oklch_hex(0.955, 0.008, spec["sable_H"]),
        "--barre-tx": oklch_hex(0.605, 0.014, spec["sable_H"]),
        "--barre-tx-actif": v["400"],
        "--hero-bg": oklch_hex(0.330, spec["vert_C"] * 0.85, spec["vert_H"]),
        "--hero-fond": _degrade(oklch_hex(0.330, spec["vert_C"] * 0.85, spec["vert_H"])),
        "--hero-tx": "#FFFFFF", "--hero-sub": _rgba("#FFFFFF", "0.72"),
    }

    css = source

    def bloc_de(entete):
        """Délimite un bloc par comptage d'accolades. Se repérer à la position
        des en-têtes ne marchait pas : le fichier contient un second `:root`
        pour les jetons de forme et de mouvement, après les palettes."""
        i = css.index(entete)
        j = css.index("{", i)
        n, k = 0, j
        while True:
            if css[k] == "{": n += 1
            elif css[k] == "}": n -= 1
            k += 1
            if n == 0: return i, k

    def remplacer(bloc, table):
        for cle, val in table.items():
            motif = re.compile(r'(?<![-\w])(' + re.escape(cle) + r'):\s*[^;]+;')
            if motif.search(bloc):
                bloc = motif.sub(lambda m: f"{m.group(1)}: {val};", bloc, count=1)
        return bloc

    def ajouter(bloc, table, cles):
        manquantes = [c for c in cles if f"  {c}:" not in bloc]
        if not manquantes:
            return bloc
        ajout = "\n".join(f"  {c}: {table[c]};" for c in manquantes)
        i = bloc.rindex("}")
        return bloc[:i] + f"  /* Surface de la marque ({spec['titre']}) */\n{ajout}\n" + bloc[i:]

    neuves = ["--entete-tx", "--barre-tx", "--barre-tx-actif", "--hero-bg", "--hero-fond", "--hero-tx", "--hero-sub"]
    # Du dernier au premier, pour que les positions restent valides.
    cibles = [(":root {", clair), (':root[data-theme="sombre"]', sombre),
              ("@media (prefers-color-scheme: dark)", sombre)]
    zones = sorted(((bloc_de(e), t) for e, t in cibles), key=lambda z: -z[0][0])
    for (i, k), table in zones:
        b = remplacer(css[i:k], table)
        b = ajouter(b, table, neuves)
        css = css[:i] + b + css[k:]
    return css
