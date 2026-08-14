#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  IMPORT DE LA TABLE CIQUAL (ANSES) VERS LA TABLE `foods`
#
#  USAGE
#      python3 scripts/importer-ciqual.py <fichier téléchargé sur ciqual.anses.fr>
#
#  Formats acceptés, sans renommer le fichier :
#      — l'archive .7z publiée par l'ANSES   ← c'est celle du site
#      — une archive .zip des mêmes XML
#      — un dossier contenant les XML déjà extraits
#      — le classeur Excel .xlsx
#
#  Ce que le script produit : sql/2026-08-14-aliments-ciqual.sql, à jouer dans
#  Supabase comme les autres migrations. Il n'écrit RIEN en base lui-même —
#  une base de production ne se modifie pas depuis un script de moulinette.
#
#  Le .7z demande py7zr (`pip install py7zr`) ; tout le reste tourne avec la
#  bibliothèque standard.
#
#  LICENCE DES DONNÉES : la table Ciqual est publiée en OpenData par l'ANSES.
#  Sa redistribution dans ce dépôt est libre ; on cite la source dans le SQL.
# ═══════════════════════════════════════════════════════════════════════════

import io
import os
import re
import sys
import zipfile
import unicodedata
import xml.etree.ElementTree as ET

SORTIE = "sql/2026-08-14-aliments-ciqual.sql"
SORTIE_JSON = "sql/data/aliments-ciqual-2025.json"
SORTIE_NIVEAUX = "sql/2026-08-15-niveaux-aliments.sql"


def sans_accent(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "")
                   if unicodedata.category(c) != "Mn").lower()


# ── Lecture des teneurs ────────────────────────────────────────────────────
#
# Ciqual n'écrit pas que des nombres. On y trouve « traces », « - » (non
# déterminé), « < 0,5 » (inférieur au seuil de quantification), et la virgule
# décimale française. Traiter « traces » comme 0 est le choix juste : à
# l'échelle d'une assiette, des traces ne pèsent rien. Traiter « - » comme 0
# serait faux — c'est une donnée manquante, et un aliment dont l'énergie est
# manquante n'a rien à faire dans un générateur de diète : il est écarté.
def teneur(v):
    if v is None:
        return None
    t = str(v).strip().replace("\xa0", "").replace(" ", "")
    if t in ("", "-"):
        return None
    if sans_accent(t).startswith("traces"):
        return 0.0
    t = t.lstrip("<").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


# ── Reconnaissance des constituants ────────────────────────────────────────
#
# On identifie les colonnes par leur NOM, pas par leur code : un code qui bouge
# produirait des diètes fausses en silence, et une diète fausse ne se voit pas
# à l'œil.
#
# DEUX PIÈGES, tous deux constatés sur le fichier 2025 :
#
#  1. Les parenthèses portent l'information. « Energie … (kcal/100 g) » et
#     « Energie … (kJ/100 g) » ne diffèrent QUE par elles. Les retirer avant de
#     comparer — ce qui semble raisonnable, ce n'est « que » l'unité — confond
#     les deux et vide tout l'import.
#
#  2. Plusieurs constituants portent la même macro. Le fichier 2025 contient
#     328 « Energie, Règlement UE 1169/2011 (kcal) » ET 333 « Energie, N x
#     facteur Jones, avec fibres (kcal) » ; de même 25000 « Protéines, N x
#     facteur de Jones » et 25003 « Protéines, N x 6.25 ». Sans priorité, le
#     dernier lu écrase le premier, au hasard de l'ordre du fichier.
#     D'où le rang : 0 gagne toujours sur 1.
#
#     On retient l'énergie du Règlement UE parce que c'est le chiffre imprimé
#     sur les emballages : le coach et le coaché peuvent le vérifier.
MOTIFS = [
    ("kcal",    r"energie.*1169.*\bkcal\b",   0),
    ("kcal",    r"energie.*\bkcal\b",         1),
    ("protein", r"^proteines.*jones",         0),
    ("protein", r"^proteines\b",              1),
    ("carbs",   r"^glucides\b",               0),
    ("fat",     r"^lipides\b",                0),
    ("fiber",   r"^fibres\s+alimentaires\b",  0),
]


def reconnaitre(nom):
    """Renvoie (clé, rang) ou (None, None). Rang bas = plus prioritaire."""
    n = sans_accent(nom).strip()
    for cle, motif, rang in MOTIFS:
        if re.search(motif, n):
            return cle, rang
    return None, None


# ── Rôle de l'aliment dans un repas ────────────────────────────────────────
#
# Le rôle décide de la place de l'aliment dans un repas : porteur de protéines,
# de glucides ou de lipides, ou légume/fruit servi en portion fixe.
#
# ON PASSE PAR LES CODES DE SOUS-GROUPE, PAS PAR LEURS NOMS. Le groupe de
# premier niveau de Ciqual s'appelle « fruits, légumes, légumineuses et
# oléagineux » : n'importe quel mot-clé y matche n'importe quoi, et une banane
# en ressort classée matière grasse. Les 66 sous-groupes, eux, ont des codes
# stables et sans ambiguïté. La table ci-dessous est donc explicite et se
# relit ligne à ligne — ce qu'une liste d'expressions régulières ne permet pas.
#
# « autre » n'est pas une poubelle : c'est un rôle que le GÉNÉRATEUR NE TIRE
# JAMAIS. Les plats composés, les confiseries et les sauces restent dans la
# base — le coach peut les ajouter à la main — mais l'app ne proposera pas
# 80 g de chocolat comme féculent d'un dîner.
ROLE_PAR_SSGRP = {
    # 01 — entrées et plats composés : jamais tirés automatiquement
    "0101": "autre", "0102": "autre", "0103": "autre",
    "0104": "autre", "0105": "autre", "0106": "autre",
    # 02 — fruits, légumes, légumineuses et oléagineux
    "0201": "legume",          # légumes
    "0202": "feculent",        # pommes de terre et autres tubercules
    "0203": "feculent",        # légumineuses
    "0204": "fruit",           # fruits
    "0205": "matiere_grasse",  # fruits à coque et graines oléagineuses
    # 03 — produits céréaliers
    "0301": "feculent",        # pâtes, riz et céréales
    "0302": "feculent",        # pains et assimilés
    "0303": "autre",           # biscuits apéritifs
    "0304": "feculent",        # farines
    "0305": "autre",           # pâtes à tarte
    # 04 — viandes, oeufs, poissons
    "0401": "proteine", "0402": "proteine", "0403": "proteine",
    "0404": "proteine", "0405": "proteine", "0406": "proteine",
    "0407": "proteine", "0408": "proteine", "0409": "proteine",
    "0410": "proteine",        # oeufs
    "0411": "proteine",        # alternatives végétales aux produits carnés
    # 05 — produits laitiers
    "0501": "proteine",        # laits
    "0502": "proteine",        # produits laitiers frais
    "0503": "proteine",        # fromages
    "0504": "matiere_grasse",  # crèmes — laitier par le rayon, gras par la macro
    # 06 — eaux et boissons
    "0601": "autre", "0602": "autre", "0603": "autre",
    # 07 — produits sucrés
    "0701": "autre", "0702": "autre", "0703": "autre", "0704": "autre",
    "0705": "autre",           # viennoiseries
    "0706": "autre",           # biscuits sucrés
    "0707": "feculent",        # céréales de petit-déjeuner
    "0708": "autre",           # barres céréalières
    "0709": "autre",           # gâteaux et pâtisseries
    # 08 — glaces et sorbets
    "0801": "autre", "0802": "autre", "0803": "autre",
    # 09 — matières grasses
    "0901": "matiere_grasse", "0902": "matiere_grasse", "0903": "matiere_grasse",
    "0904": "matiere_grasse", "0905": "matiere_grasse",
    # 10 — aides culinaires et ingrédients divers
    "1001": "autre", "1002": "autre", "1003": "autre", "1004": "autre",
    "1005": "autre", "1006": "autre", "1007": "autre", "1008": "autre",
    "1009": "proteine",        # ingrédients pour végétariens (tofu, seitan…)
    "1010": "autre",           # tartinables végétariens
}

# Groupes entièrement écartés : ils n'ont rien à faire dans une diète adulte.
GROUPES_EXCLUS = {"11"}        # aliments infantiles

# Repli quand un code de sous-groupe est inconnu — une version future de Ciqual
# peut en ajouter. On retombe alors sur le nom, puis sur les macros.
GROUPES_PAR_NOM = [
    (r"huile|matieres? grasses|beurre|margarine|creme",           "matiere_grasse"),
    (r"fruits? a coque|graines oleagineuses|oleagineux",          "matiere_grasse"),
    (r"^fruits|fruits crus|fruits secs|compotes",                 "fruit"),
    (r"pommes? de terre|tubercules|legumineuses",                 "feculent"),
    (r"legumes",                                                  "legume"),
    (r"cerealiers|cereales|pain|pates|riz|farines",               "feculent"),
    (r"viandes|volailles|poissons|produits de la mer|oeufs"
     r"|charcuteries|abats|mollusques|crustaces",                 "proteine"),
    (r"laitiers|laits|fromages|yaourts",                          "proteine"),
    (r"boissons|eaux|sucres|confiseries|chocolats|sauces"
     r"|condiments|epices|herbes|glaces|sorbets",                 "autre"),
]

# Ciqual range les pommes de terre et les légumineuses avec les légumes dans
# certaines nomenclatures. Dans une assiette ce sont des féculents, et ils
# reviennent trop souvent pour être laissés faux.
FECULENTS_PAR_NOM = (r"pommes? de terre|patate douce|lentille|pois chiche"
                     r"|haricot (blanc|rouge|noir)|flageolet|quinoa|semoule"
                     r"|boulgour|feve seche|pois casse")


# Protéines écartées du TIRAGE AUTOMATIQUE — elles restent dans la base, donc
# cherchables et ajoutables à la main par le coach, mais l'app ne les propose
# jamais d'elle-même. Constaté sur le fichier réel : sans ce filtre, les six
# protéines les moins coûteuses pour une collation étaient du blanc d'œuf cru,
# de la poudre d'œuf et de l'isolat de soja — le générateur en programmait une
# fois sur trois.
#
# Deux raisons de sortir le CRU, et la seconde est la plus importante :
#   — personne ne mange 150 g de poulet cru ;
#   — les macros du cru et du cuit diffèrent nettement, la cuisson concentrant
#     l'aliment par perte d'eau. Programmer l'entrée « cuit » lève l'ambiguïté
#     sur la façon de peser.
PROTEINES_HORS_TIRAGE = r"\b(cru|crue|crus|crues)\b|en poudre|isolat|deshydrat|lyophilis"


def role_de(nom_aliment, ssgrp_code, libelles, p, c, f):
    role = ROLE_PAR_SSGRP.get((ssgrp_code or "").strip())
    if role == "proteine" and re.search(PROTEINES_HORS_TIRAGE, sans_accent(nom_aliment)):
        return "autre"
    if role:
        return role
    if re.search(FECULENTS_PAR_NOM, sans_accent(nom_aliment)):
        return "feculent"
    for libelle in libelles:
        g = sans_accent(libelle or "")
        if not g:
            continue
        for motif, r in GROUPES_PAR_NOM:
            if re.search(motif, g):
                return r
    kp, kc, kf = (p or 0) * 4, (c or 0) * 4, (f or 0) * 9
    if kf >= kp and kf >= kc:
        return "matiere_grasse"
    return "proteine" if kp >= kc else "feculent"


# ── Coût et préparation ────────────────────────────────────────────────────
#
# Ciqual ne contient NI PRIX NI TEMPS DE PRÉPARATION. Ce qui suit est donc une
# estimation par famille d'aliments, pas un relevé. Elle est assumée comme
# telle : le coach corrige n'importe quel aliment depuis son espace, et sa
# correction survit aux réimports.
#
# Le défaut est 2 dans les deux axes — « ni cher ni gratuit, ni instantané ni
# long ». C'est le bon défaut : il ne fait jamais entrer un aliment coûteux
# dans une diète à budget serré par simple absence de classement.
#
# On classe par NOM et par sous-groupe, dans cet ordre : le nom est plus précis
# (« Boeuf, steak haché 5% » et « Boeuf, filet » sont dans le même sous-groupe
# et n'ont pas le même prix au kilo).

COUT_1 = (  # bon marché : la base de n'importe quelle diète abordable
    r"\boeufs?\b|\bp[âa]tes\b|\briz\b|semoule|boulgour|\bpain\b|farine"
    r"|pomme de terre|patate douce|lentille|pois chiche|haricot (blanc|rouge|noir)"
    r"|flageolet|f[èe]ve|pois casse|\blait\b|fromage blanc|petit suisse|yaourt"
    r"|skyr|\bthon\b.*conserve|sardine|maquereau|\bcarotte|\boignon|\bchou\b"
    r"|\bcourgette|\bpoireau|navet|betterave|banane|\bpomme\b|poire\b"
    r"|huile d'?(olive|tournesol|colza)|flocons? d'avoine|\bavoine\b|son de ble"
    r"|cacahu[èe]te|arachide|\bthon\b"
)
COUT_3 = (  # cher : ce qui n'a pas sa place dans une diète à budget serré
    r"saint[- ]jacques|homard|langouste|crevette|gambas|crabe|[ée]crevisse"
    r"|huitre|hu[îi]tre|noix de p[ée]toncle|caviar|\boursin"
    r"|foie gras|magret|canard|\boie\b|gibier|chevreuil|sanglier|biche"
    r"|filet de boeuf|entrec[ôo]te|faux[- ]filet|c[ôo]te de boeuf|tournedos"
    r"|\bveau\b|\bagneau\b|\bris de\b"
    r"|saumon fum[ée]|truite fum[ée]|bar\b|\bsole\b|turbot|lotte|saint[- ]pierre"
    r"|noix de cajou|\bpistache|\bamande|noix de p[ée]can|noisette|macadamia"
    r"|\bquinoa\b|graines de chia|spiruline|\bavocat"
    r"|parmesan|comt[ée]|beaufort|roquefort|mozzarella di bufala"
)
PREP_1 = (  # rien à faire : on ouvre, on sert
    r"conserve|appertis|\bcru\b|\bcrue\b|nature\b|yaourt|fromage|\blait\b"
    r"|skyr|petit suisse|\bpain\b|biscotte|c[ée]r[ée]ales de petit|\bmiel\b"
    r"|confiture|\bhuile\b|\bbeurre\b|margarine|amande|noisette|cacahu"
    r"|noix de cajou|noix du bresil|cerneaux de noix|\bpistache"
    r"|jambon|surgel|\bcompote|\bfruit"
)
PREP_3 = (  # long : trempage, mijotage, ou plat à monter
    r"s[èe]che?s?\b|\bsec\b|\bcrue?s? ?,? ?[àa] cuire"
    r"|pot[- ]au[- ]feu|bourguignon|blanquette|mijot|braise|confit"
    r"|g[âa]teau|tarte|p[âa]tisserie|souffl[ée]|gratin|lasagne|hachis"
)


def niveaux(nom, ssgrp_code, role):
    n = sans_accent(nom)
    cout = 3 if re.search(COUT_3, n) else (1 if re.search(COUT_1, n) else 2)
    prep = 3 if re.search(PREP_3, n) else (1 if re.search(PREP_1, n) else 2)
    # « Pâtes sèches, standard, cuites » : le mot « sèches » décrit le produit
    # acheté, pas ce qu'il reste à faire. Un aliment que Ciqual donne DÉJÀ cuit
    # ne peut pas être classé long — dix minutes d'eau bouillante, pas trois
    # heures. Sans ce garde-fou, toutes les pâtes sortent d'une diète « rapide ».
    if prep == 3 and re.search(r"\b(cuit|cuite|cuits|cuites|bouilli|bouillie)\b", n):
        prep = 2
    # Un fruit sec se mange tel quel, quoi que son nom laisse croire.
    if role == "fruit" and prep == 3:
        prep = 1
    # Les légumes et fruits frais sont bon marché par défaut, sauf exception
    # déjà attrapée ci-dessus (l'avocat, par exemple).
    if role in ("legume", "fruit") and cout == 2:
        cout = 1
    # Un légume ou un féculent qui doit cuire n'est jamais « immédiat », même si
    # son nom contient « nature ».
    if role in ("legume", "feculent") and prep == 1 and not re.search(r"conserve|surgel|\bcru", n):
        prep = 2
    return cout, prep


# Repas où l'aliment est proposé par défaut. Le coach peut le changer aliment
# par aliment : ce n'est qu'un point de départ, choisi pour éviter les
# absurdités du type cabillaud au petit-déjeuner.
TOUS_REPAS = ["petit_dejeuner", "collation_matin", "dejeuner", "collation", "diner"]
SALES = ["dejeuner", "diner"]
SSGRP_SALES = {"0101", "0102", "0103", "0104", "0105", "0106",   # plats composés
               "0201",                                           # légumes
               "0401", "0402", "0403", "0404", "0405", "0406",
               "0407", "0408", "0409", "0411"}                   # viandes, poissons


def repas_de(role, ssgrp_code, libelles):
    if (ssgrp_code or "").strip() in SSGRP_SALES:
        return SALES
    if ssgrp_code and ssgrp_code.strip() in ROLE_PAR_SSGRP:
        return TOUS_REPAS
    g = sans_accent(" ".join(l or "" for l in libelles))
    if re.search(r"viandes|volailles|poissons|charcuteries|mollusques|crustaces"
                 r"|entrees et plats composes|produits de la mer", g):
        return SALES
    return SALES if role == "legume" else TOUS_REPAS


# ── Lecture des XML ────────────────────────────────────────────────────────
#
# On donne les OCTETS à ElementTree, jamais une chaîne déjà décodée : les
# fichiers de l'ANSES commencent par un BOM UTF-8, et une chaîne qui débute par
# un BOM fait échouer l'analyse (« XML declaration not at start of entity »).
# Passer les octets laisse ElementTree lire lui-même la déclaration d'encodage.
def _parse(nom, contenu):
    try:
        return ET.fromstring(contenu)
    except ET.ParseError as e:
        raise SystemExit(f"Le fichier « {nom} » de l'archive est illisible : {e}")


def _txt(el, *noms):
    for n in noms:
        t = el.find(n)
        if t is not None and t.text is not None:
            v = t.text.strip()
            if v:
                return v
    return None


def lire_xml(fichiers):
    """fichiers : dict nom -> bytes."""
    def trouver(motif, obligatoire=True):
        for nom in sorted(fichiers):
            if re.match(motif, nom, re.I):
                return nom
        if obligatoire:
            raise SystemExit(f"Aucun fichier « {motif} » dans l'archive.\n"
                             f"Fichiers présents : {', '.join(sorted(fichiers))}")
        return None

    # Groupes : une ligne par triplet (groupe, sous-groupe, sous-sous-groupe).
    # Les NOMS ne sont QUE là — la table des aliments ne porte que des codes.
    grp_nom, ssgrp_nom, ssssgrp_nom = {}, {}, {}
    n = trouver(r"alim_grp", obligatoire=False)
    if n:
        for el in _parse(n, fichiers[n]):
            g, s, q = _txt(el, "alim_grp_code"), _txt(el, "alim_ssgrp_code"), _txt(el, "alim_ssssgrp_code")
            if g:
                grp_nom.setdefault(g, _txt(el, "alim_grp_nom_fr"))
            if s:
                ssgrp_nom.setdefault(s, _txt(el, "alim_ssgrp_nom_fr"))
            if q:
                ssssgrp_nom.setdefault(q, _txt(el, "alim_ssssgrp_nom_fr"))

    n = trouver(r"alim_(?!grp)")
    aliments = {}
    for el in _parse(n, fichiers[n]):
        code = _txt(el, "alim_code")
        if code:
            aliments[code] = {
                "nom": _txt(el, "alim_nom_fr"),
                "grp": _txt(el, "alim_grp_code"),
                "ssgrp": _txt(el, "alim_ssgrp_code"),
                "ssssgrp": _txt(el, "alim_ssssgrp_code"),
            }

    # Constituants : on ne garde qu'un code par macro, le mieux classé.
    n = trouver(r"const")
    meilleur = {}   # clé -> (rang, code)
    for el in _parse(n, fichiers[n]):
        code, nom = _txt(el, "const_code"), _txt(el, "const_nom_fr")
        if not (code and nom):
            continue
        cle, rang = reconnaitre(nom)
        if cle and (cle not in meilleur or rang < meilleur[cle][0]):
            meilleur[cle] = (rang, code)
    consts = {code: cle for cle, (_, code) in meilleur.items()}

    # Compositions : ~260 000 lignes, 69 Mo. On lit en FLUX et on libère chaque
    # élément au fur et à mesure — construire l'arbre entier tiendrait en
    # mémoire, mais sans raison.
    n = trouver(r"compo")
    par_aliment = {}
    flux = ET.iterparse(io.BytesIO(fichiers[n]), events=("end",))
    for _, el in flux:
        if el.tag.upper() != "COMPO":
            continue
        cle = consts.get(_txt(el, "const_code") or "")
        alim = _txt(el, "alim_code")
        if cle and alim:
            par_aliment.setdefault(alim, {})[cle] = teneur(_txt(el, "teneur"))
        el.clear()

    sortie = []
    for code, a in aliments.items():
        if (a["grp"] or "") in GROUPES_EXCLUS:
            continue
        libelles = [ssssgrp_nom.get(a["ssssgrp"] or ""), ssgrp_nom.get(a["ssgrp"] or ""),
                    grp_nom.get(a["grp"] or "")]
        libelles = [l for l in libelles if l and l != "-"]
        sortie.append((a["nom"], a["ssgrp"], libelles, par_aliment.get(code, {}), code))
    return sortie, consts


# ── Lecture du format Excel (.xlsx) ────────────────────────────────────────
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def lire_xlsx(chemin):
    with zipfile.ZipFile(chemin) as z:
        partages = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{NS}si"):
                partages.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
        feuille = next(n for n in z.namelist() if re.match(r"xl/worksheets/sheet1\.xml$", n))
        lignes = []
        for row in ET.fromstring(z.read(feuille)).iter(f"{NS}row"):
            cellules = {}
            for c in row.findall(f"{NS}c"):
                col = re.match(r"[A-Z]+", c.get("r") or "")
                v = c.find(f"{NS}v")
                if c.get("t") == "s" and v is not None:
                    txt = partages[int(v.text)]
                elif c.get("t") == "inlineStr":
                    txt = "".join(t.text or "" for t in c.iter(f"{NS}t"))
                else:
                    txt = v.text if v is not None else None
                if col:
                    cellules[col.group()] = txt
            lignes.append(cellules)
    return lignes


def depuis_xlsx(lignes):
    if not lignes:
        return [], {}
    entete = lignes[0]
    colonnes, rangs = {}, {}
    col_nom = col_grp = col_ssgrp = col_ssgrp_code = None
    for lettre, titre in entete.items():
        t = sans_accent(titre or "")
        if "alim_nom_fr" in t or t == "nom de l'aliment":
            col_nom = col_nom or lettre
        if "ssgrp_code" in t:
            col_ssgrp_code = col_ssgrp_code or lettre
        if "ssgrp_nom_fr" in t:
            col_ssgrp = col_ssgrp or lettre
        elif "grp_nom_fr" in t:
            col_grp = col_grp or lettre
        cle, rang = reconnaitre(titre or "")
        if cle and (cle not in rangs or rang < rangs[cle]):
            colonnes[cle], rangs[cle] = lettre, rang
    if not col_nom or "kcal" not in colonnes:
        raise SystemExit("Colonnes non reconnues dans le classeur.\n"
                         "Colonnes vues : " + ", ".join(str(v)[:40] for v in entete.values() if v))
    sortie = []
    for l in lignes[1:]:
        nom = (l.get(col_nom) or "").strip()
        if not nom:
            continue
        vals = {k: teneur(l.get(lettre)) for k, lettre in colonnes.items()}
        libelles = [l.get(col_ssgrp) or "", l.get(col_grp) or ""]
        sortie.append((nom, l.get(col_ssgrp_code), [x for x in libelles if x], vals, None))
    return sortie, colonnes


# ── Entrée : .7z, .zip, dossier ou .xml ────────────────────────────────────
def collecter_xml(chemin):
    fichiers = {}
    if os.path.isdir(chemin):
        for f in os.listdir(chemin):
            if f.lower().endswith(".xml"):
                fichiers[f] = open(os.path.join(chemin, f), "rb").read()
    elif chemin.lower().endswith(".7z"):
        try:
            import py7zr
        except ImportError:
            raise SystemExit("L'archive est au format .7z : installe py7zr d'abord\n"
                             "    pip install py7zr")
        # py7zr n'expose pas de lecture en mémoire stable d'une version à
        # l'autre : on extrait dans un dossier temporaire, qu'on efface après.
        import tempfile
        import shutil
        tmp = tempfile.mkdtemp(prefix="ciqual-")
        try:
            with py7zr.SevenZipFile(chemin) as z:
                z.extractall(tmp)
            for racine, _, noms in os.walk(tmp):
                for n in noms:
                    if n.lower().endswith(".xml"):
                        fichiers[n] = open(os.path.join(racine, n), "rb").read()
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    elif chemin.lower().endswith(".zip"):
        with zipfile.ZipFile(chemin) as z:
            for n in z.namelist():
                if n.lower().endswith(".xml"):
                    fichiers[os.path.basename(n)] = z.read(n)
    else:
        fichiers[os.path.basename(chemin)] = open(chemin, "rb").read()
    if not fichiers:
        raise SystemExit(f"Aucun fichier XML trouvé dans {chemin}")
    return fichiers


def echapper(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: python3 scripts/importer-ciqual.py <archive Ciqual>")
    chemin = sys.argv[1]
    if not os.path.exists(chemin):
        raise SystemExit(f"Fichier introuvable : {chemin}")

    if chemin.lower().endswith(".xlsx"):
        brut, consts = depuis_xlsx(lire_xlsx(chemin))
    else:
        brut, consts = lire_xml(collecter_xml(chemin))

    manquantes = [k for k in ("kcal", "protein", "carbs", "fat") if k not in set(consts.values())]
    if manquantes:
        raise SystemExit("Constituants introuvables dans le fichier : " + ", ".join(manquantes))

    retenus = []
    ecartes = {"macros manquantes": 0, "sans nom": 0}
    for nom, ssgrp, libelles, vals, code in brut:
        if not nom:
            ecartes["sans nom"] += 1
            continue
        kcal, p, c, f = vals.get("kcal"), vals.get("protein"), vals.get("carbs"), vals.get("fat")
        # L'énergie et les trois macros sont indispensables : le solveur divise
        # par elles. Une valeur manquante ne se rattrape pas, on écarte.
        if kcal is None or p is None or c is None or f is None:
            ecartes["macros manquantes"] += 1
            continue
        role = role_de(nom, ssgrp, libelles, p, c, f)
        cout, prep = niveaux(nom, ssgrp, role)
        retenus.append({"code": code, "nom": nom, "role": role,
                        "repas": repas_de(role, ssgrp, libelles),
                        "kcal": kcal, "p": p, "c": c, "f": f, "fibres": vals.get("fiber"),
                        "cout": cout, "prep": prep})

    if not retenus:
        raise SystemExit("Aucun aliment exploitable n'a été extrait.")

    os.makedirs("sql", exist_ok=True)
    with io.open(SORTIE, "w", encoding="utf-8") as out:
        out.write(f"""-- ═══════════════════════════════════════════════════════════════════════════
--  FORGE COACHING — BASE D'ALIMENTS (table Ciqual de l'ANSES)
--
--  GÉNÉRÉ AUTOMATIQUEMENT par scripts/importer-ciqual.py — ne pas modifier à
--  la main : la prochaine génération écraserait la correction. Corriger le
--  script, ou l'aliment depuis l'espace coach.
--
--  Source : table Ciqual, Agence nationale de sécurité sanitaire de
--  l'alimentation, de l'environnement et du travail (ANSES), publiée en
--  OpenData sur ciqual.anses.fr.
--
--  {len(retenus)} aliments retenus.
--  Écartés : {', '.join(f'{v} {k}' for k, v in ecartes.items() if v) or 'aucun'}.
--
--  Le rôle « autre » n'est jamais tiré par le générateur : plats composés,
--  confiseries et sauces restent disponibles à la main, sans risquer de se
--  retrouver en féculent d'un dîner.
--
--  IDEMPOTENT : relançable sans risque. Les aliments de la base commune sont
--  reconnus par leur code Ciqual ; ceux créés depuis l'espace coach portent un
--  coach_id et ne sont jamais touchés.
--
--  PRÉREQUIS : sql/2026-08-14-diete-personnalisee.sql doit avoir été joué.
-- ═══════════════════════════════════════════════════════════════════════════

""")
        # Format compact : `meal_types` a déjà sa valeur par défaut en base
        # (les cinq repas). La répéter sur 3 286 lignes ajouterait 300 Ko pour
        # rien. On ne corrige ensuite que les aliments salés, en un seul UPDATE.
        for i in range(0, len(retenus), 500):
            valeurs = []
            for a in retenus[i:i + 500]:
                fibres = "null" if a["fibres"] is None else f'{a["fibres"]:g}'
                code = "null" if not a["code"] else echapper(a["code"])
                valeurs.append(f'({code},{echapper(a["nom"])},{echapper(a["role"])},'
                               f'{a["kcal"]:g},{a["p"]:g},{a["c"]:g},{a["f"]:g},{fibres},'
                               f'{a["cout"]},{a["prep"]})')
            out.write("insert into public.foods\n"
                      "  (ciqual_code, name, role, kcal_100, protein_100, carbs_100, fat_100, fiber_100,\n"
                      "   cost_level, prep_level)\n"
                      "values\n" + ",\n".join(valeurs) +
                      "\non conflict (ciqual_code) where coach_id is null and ciqual_code is not null\n"
                      "do update set name = excluded.name, role = excluded.role,\n"
                      "              kcal_100 = excluded.kcal_100, protein_100 = excluded.protein_100,\n"
                      "              carbs_100 = excluded.carbs_100, fat_100 = excluded.fat_100,\n"
                      "              fiber_100 = excluded.fiber_100,\n"
                      "              cost_level = excluded.cost_level,\n"
                      "              prep_level = excluded.prep_level;\n\n")

        sales = [a["code"] for a in retenus if a["repas"] == SALES and a["code"]]
        if sales:
            out.write("-- Aliments salés : proposés au déjeuner et au dîner seulement.\n"
                      "update public.foods set meal_types = array['dejeuner','diner']\n"
                      " where coach_id is null and ciqual_code in (\n  " +
                      ",".join(echapper(c) for c in sales) + ");\n\n")
        out.write("-- ── Contrôle ──────────────────────────────────────────────────────────────\n"
                  "-- select role, count(*) from public.foods where coach_id is null group by 1 order by 2 desc;\n")

    # Même liste, second format. Le JSON sert au chargement direct par la base
    # (Postgres va le chercher sur GitHub via l'extension http) ; le SQL sert au
    # chemin manuel, par l'éditeur SQL de Supabase. Les deux sortent de
    # `retenus` : il ne peut pas y avoir deux vérités.
    os.makedirs(os.path.dirname(SORTIE_JSON), exist_ok=True)
    with io.open(SORTIE_JSON, "w", encoding="utf-8") as fh:
        import json
        json.dump([{k: v for k, v in (
            ("c", a["code"]), ("n", a["nom"]), ("r", a["role"]),
            ("k", a["kcal"]), ("p", a["p"]), ("g", a["c"]), ("l", a["f"]),
            ("f", a["fibres"]), ("s", 1 if a["repas"] == SALES else None),
            ("co", a["cout"]), ("pr", a["prep"]),
        ) if v is not None} for a in retenus], fh, ensure_ascii=False, separators=(",", ":"))

    # Troisième sortie : les seuls niveaux de coût et de préparation, pour
    # mettre à jour une base d'aliments DÉJÀ chargée sans avoir à recoller les
    # 300 Ko du fichier complet. Groupé par couple (coût, préparation) : neuf
    # instructions au lieu de 3 286, et le fichier tient dans un copier-coller.
    couples = {}
    for a in retenus:
        if a["code"]:
            couples.setdefault((a["cout"], a["prep"]), []).append(a["code"])
    with io.open(SORTIE_NIVEAUX, "w", encoding="utf-8") as fh:
        fh.write("-- ═══════════════════════════════════════════════════════════════════════════\n"
                 "--  FORGE COACHING — NIVEAUX DE COÛT ET DE PRÉPARATION DES ALIMENTS\n"
                 "--\n"
                 "--  GÉNÉRÉ par scripts/importer-ciqual.py. À jouer APRÈS\n"
                 "--  sql/2026-08-15-diete-praticite.sql, sur une base d'aliments déjà chargée.\n"
                 "--  IDEMPOTENT. Ne touche que la base commune : les aliments que le coach a\n"
                 "--  créés ou corrigés lui-même ne sont jamais écrasés.\n"
                 "--\n"
                 "--  1 = bon marché / immédiat · 2 = moyen · 3 = cher / long.\n"
                 "--  Ce sont des estimations par famille d'aliments, pas des relevés de prix.\n"
                 "-- ═══════════════════════════════════════════════════════════════════════════\n\n")
        for (co, pr), codes in sorted(couples.items()):
            fh.write(f"-- coût {co}, préparation {pr} — {len(codes)} aliments\n"
                     f"update public.foods set cost_level = {co}, prep_level = {pr}\n"
                     f" where coach_id is null and ciqual_code in (\n  "
                     + ",".join(echapper(c) for c in codes) + ");\n\n")
        fh.write("-- ── Contrôle ──────────────────────────────────────────────────────────────\n"
                 "-- select cost_level, prep_level, count(*) from public.foods\n"
                 "--  where coach_id is null group by 1,2 order by 1,2;\n")

    par_role = {}
    for a in retenus:
        par_role[a["role"]] = par_role.get(a["role"], 0) + 1
    print(f"\n{SORTIE_JSON}  ({os.path.getsize(SORTIE_JSON) // 1024} Ko)")
    print(f"{SORTIE_NIVEAUX}  ({os.path.getsize(SORTIE_NIVEAUX) // 1024} Ko)")
    print(f"{SORTIE}")
    print(f"  {len(retenus)} aliments retenus")
    for k, v in sorted(par_role.items(), key=lambda x: -x[1]):
        print(f"    {v:>5}  {k}")
    for k, v in ecartes.items():
        if v:
            print(f"  écartés : {v} ({k})")
    for axe, cle in (("coût", "cout"), ("préparation", "prep")):
        r = {}
        for a in retenus:
            r[a[cle]] = r.get(a[cle], 0) + 1
        print(f"  {axe:<12} " + "  ".join(f"niveau {k} : {r.get(k, 0)}" for k in (1, 2, 3)))
    print(f"  taille : {os.path.getsize(SORTIE) // 1024} Ko")


if __name__ == "__main__":
    main()
