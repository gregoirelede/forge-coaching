#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
#  IMPORT DE LA TABLE CIQUAL (ANSES) VERS LA TABLE `foods`
#
#  USAGE
#      python3 scripts/importer-ciqual.py <fichier téléchargé sur ciqual.anses.fr>
#
#  Le fichier accepté est celui que l'ANSES publie, sans le renommer :
#      — l'archive XML  (.zip)   ← format conseillé
#      — le classeur Excel (.xlsx)
#
#  Ce que le script produit : sql/2026-08-14-aliments-ciqual.sql, à jouer dans
#  Supabase comme les autres migrations. Il n'écrit RIEN en base lui-même —
#  une base de production ne se modifie pas depuis un script de moulinette.
#
#  ZÉRO DÉPENDANCE : zipfile et ElementTree sont dans la bibliothèque standard.
#  C'est délibéré, la VM de travail n'a pas d'accès réseau vers PyPI.
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
    if t == "" or t == "-":
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
# On identifie les colonnes par leur NOM, pas par leur code. Les codes Ciqual
# sont stables en pratique, mais un import qui se casse silencieusement parce
# qu'un code a bougé produirait des diètes fausses — et une diète fausse ne se
# voit pas à l'œil. Le nom, lui, se vérifie.
#
# ATTENTION AUX PARENTHÈSES. On serait tenté de les retirer avant de comparer,
# elles ne contiennent « que » l'unité. Sauf que c'est là que se joue la
# distinction entre « Energie … (kcal/100 g) » et « Energie … (kJ/100 g) » :
# les effacer confond les deux, et tout l'import ressort vide. On compare donc
# sur le nom entier.
MOTIFS = [
    ("kcal",    r"energie.*\bkcal\b"),
    ("protein", r"^proteines\b"),
    ("carbs",   r"^glucides\b"),
    ("fat",     r"^lipides\b"),
    ("fiber",   r"^fibres\s+alimentaires\b"),
]


def reconnaitre(nom):
    n = sans_accent(nom).strip()
    for cle, motif in MOTIFS:
        if re.search(motif, n):
            return cle
    return None


# ── Rôle de l'aliment dans un repas ────────────────────────────────────────
#
# Le rôle décide de la place de l'aliment dans le repas : porteur de
# protéines, de glucides, de lipides, ou légume/fruit servi en portion fixe.
#
# L'ORDRE DE CETTE LISTE EST SIGNIFIANT, et c'est le piège du fichier Ciqual.
# Le groupe de premier niveau s'appelle « fruits, légumes, légumineuses et
# oléagineux » : n'importe lequel de ces mots-clés y matche, donc une banane
# classée sur le groupe ressort en matière grasse. On compare donc d'abord au
# SOUS-groupe (« fruits crus », « volailles », « huiles »), bien plus précis,
# et on ne retombe sur le groupe qu'à défaut.
#
# Même raison pour l'ordre : « fruits à coque et graines oléagineuses » commence
# par « fruits ». Les oléagineux doivent donc être testés AVANT les fruits,
# sans quoi les amandes deviennent un dessert.
GROUPES = [
    (r"huile|matieres? grasses|beurre|margarine|creme fraiche",     "matiere_grasse"),
    (r"fruits? a coque|graines oleagineuses|oleagineux",            "matiere_grasse"),
    (r"^fruits|fruits crus|fruits secs|fruits cuits|compotes",      "fruit"),
    (r"pommes? de terre|tubercules|legumineuses",                   "feculent"),
    (r"legumes",                                                    "legume"),
    (r"cerealiers|cereales|pain|pates|riz|farines|viennoiseries",   "feculent"),
    (r"viandes|volailles|poissons|produits de la mer|oeufs"
     r"|charcuteries|abats|mollusques|crustaces",                   "proteine"),
    (r"laitiers|laits|fromages|yaourts|desserts lactes",            "proteine"),
    (r"sucres|confiseries|chocolats|miel|confitures",               "feculent"),
    (r"boissons|eaux|jus",                                          "autre"),
    (r"aides culinaires|condiments|epices|herbes|sauces",           "autre"),
]

# Ciqual range les pommes de terre et les légumineuses avec les légumes. Dans
# une assiette ce sont des féculents, et ils reviennent trop souvent pour être
# laissés faux : on les rattrape par le nom, avant tout le reste.
FECULENTS_PAR_NOM = (r"pommes? de terre|patate douce|lentille|pois chiche|haricot (blanc|rouge|noir)"
                     r"|flageolet|quinoa|semoule|boulgour|feve seche|pois casse")


def role_de(nom_aliment, sous_groupe, groupe, p, c, f):
    if re.search(FECULENTS_PAR_NOM, sans_accent(nom_aliment)):
        return "feculent"
    # Le sous-groupe d'abord, le groupe seulement s'il n'a rien donné.
    for libelle in (sous_groupe, groupe):
        g = sans_accent(libelle or "")
        if not g:
            continue
        for motif, role in GROUPES:
            if re.search(motif, g):
                return role
    # Sans classification exploitable : la macro dominante en calories tranche.
    kp, kc, kf = (p or 0) * 4, (c or 0) * 4, (f or 0) * 9
    if kf >= kp and kf >= kc:
        return "matiere_grasse"
    return "proteine" if kp >= kc else "feculent"


# Repas où l'aliment est proposé par défaut. Le coach peut le changer aliment
# par aliment depuis l'espace coach : ce n'est qu'un point de départ, choisi
# pour éviter les absurdités du type cabillaud au petit-déjeuner.
TOUS_REPAS = ["petit_dejeuner", "collation_matin", "dejeuner", "collation", "diner"]
SALES = ["dejeuner", "diner"]


def repas_de(role, sous_groupe, groupe):
    g = sans_accent((sous_groupe or "") + " " + (groupe or ""))
    if re.search(r"viandes|volailles|poissons|charcuteries|abats|entrees et plats composes"
                 r"|mollusques|crustaces|produits de la mer", g):
        return SALES
    if role == "legume":
        return SALES
    return TOUS_REPAS


# ── Lecture du format XML ──────────────────────────────────────────────────
def lire_xml(fichiers):
    """fichiers : dict nom -> bytes. Renvoie (aliments, constituants, compos, groupes)."""
    # Un fichier illisible ne doit JAMAIS passer inaperçu : sans ce garde-fou,
    # une archive dont un seul fichier est mal formé produit une base
    # d'aliments silencieusement vide, et on cherche longtemps pourquoi.
    def charger(motif, obligatoire=True):
        vus = []
        for nom, contenu in fichiers.items():
            if not re.search(motif, nom, re.I):
                continue
            vus.append(nom)
            derniere = None
            # Ciqual publie en ISO-8859-1 ou UTF-8 selon les millésimes.
            for enc in ("utf-8", "latin-1"):
                try:
                    return ET.fromstring(contenu.decode(enc))
                except (UnicodeDecodeError, ET.ParseError) as e:
                    derniere = e
            if obligatoire:
                raise SystemExit(f"Le fichier « {nom} » de l'archive est illisible : {derniere}")
        if obligatoire and not vus:
            raise SystemExit(f"Aucun fichier ne correspond à « {motif} » dans l'archive.\n"
                             f"Fichiers présents : {', '.join(fichiers)}")
        return None

    def lignes(racine):
        return list(racine) if racine is not None else []

    def champ(el, *noms):
        for n in noms:
            t = el.find(n)
            if t is not None and t.text is not None:
                return t.text.strip()
        return None

    aliments, groupes, consts, compos = {}, {}, {}, []

    # Les groupes sont un confort : sans eux le rôle se déduit des macros.
    r = charger(r"alim_?grp|group", obligatoire=False)
    for el in lignes(r):
        code = champ(el, "alim_grp_code", "ALIM_GRP_CODE")
        nom = champ(el, "alim_grp_nom_fr", "ALIM_GRP_NOM_FR")
        if code:
            groupes[code] = nom

    r = charger(r"(^|[^g])alim(ent)?[^g]*\.xml|^alim")
    for el in lignes(r):
        code = champ(el, "alim_code", "ALIM_CODE")
        if not code:
            continue
        aliments[code] = {
            "nom": champ(el, "alim_nom_fr", "ALIM_NOM_FR"),
            "grp": champ(el, "alim_grp_code", "ALIM_GRP_CODE"),
            "ssgrp_nom": champ(el, "alim_ssgrp_nom_fr", "ALIM_SSGRP_NOM_FR"),
        }

    r = charger(r"const")
    for el in lignes(r):
        code = champ(el, "const_code", "CONST_CODE")
        nom = champ(el, "const_nom_fr", "CONST_NOM_FR")
        if code and nom:
            cle = reconnaitre(nom)
            if cle:
                consts[code] = cle

    r = charger(r"compo")
    for el in lignes(r):
        compos.append((
            champ(el, "alim_code", "ALIM_CODE"),
            champ(el, "const_code", "CONST_CODE"),
            champ(el, "teneur", "TENEUR"),
        ))
    return aliments, groupes, consts, compos


# ── Lecture du format Excel (.xlsx) ────────────────────────────────────────
#
# Un .xlsx est une archive zip de XML : on la lit avec la bibliothèque
# standard plutôt que d'imposer openpyxl, absent de la VM.
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def lire_xlsx(chemin):
    with zipfile.ZipFile(chemin) as z:
        partages = []
        if "xl/sharedStrings.xml" in z.namelist():
            racine = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in racine.findall(f"{NS}si"):
                partages.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
        feuille = next(n for n in z.namelist() if re.match(r"xl/worksheets/sheet1\.xml$", n))
        racine = ET.fromstring(z.read(feuille))
        lignes = []
        for row in racine.iter(f"{NS}row"):
            cellules = {}
            for c in row.findall(f"{NS}c"):
                ref = c.get("r") or ""
                col = re.match(r"[A-Z]+", ref)
                v = c.find(f"{NS}v")
                txt = None
                if c.get("t") == "s" and v is not None:
                    txt = partages[int(v.text)]
                elif c.get("t") == "inlineStr":
                    txt = "".join(t.text or "" for t in c.iter(f"{NS}t"))
                elif v is not None:
                    txt = v.text
                if col:
                    cellules[col.group()] = txt
            lignes.append(cellules)
    return lignes


def depuis_xlsx(lignes):
    if not lignes:
        return []
    entete = lignes[0]
    colonnes = {}   # lettre -> clé
    col_nom = col_grp = col_ssgrp = None
    for lettre, titre in entete.items():
        t = sans_accent(titre or "")
        if "alim_nom_fr" in t or t == "nom de l'aliment" or "nom_fr" in t and "grp" not in t and "ssgrp" not in t:
            col_nom = col_nom or lettre
        if "ssgrp_nom_fr" in t:
            col_ssgrp = col_ssgrp or lettre
        elif "grp_nom_fr" in t:
            col_grp = col_grp or lettre
        cle = reconnaitre(titre or "")
        if cle:
            colonnes.setdefault(cle, lettre)
    if not col_nom or "kcal" not in colonnes:
        raise SystemExit(
            "Colonnes non reconnues dans le classeur.\n"
            "Colonnes vues : " + ", ".join(str(v)[:40] for v in entete.values() if v)
        )
    sortie = []
    for l in lignes[1:]:
        nom = (l.get(col_nom) or "").strip()
        if not nom:
            continue
        vals = {k: teneur(l.get(lettre)) for k, lettre in colonnes.items()}
        sortie.append((nom, l.get(col_ssgrp) or "", l.get(col_grp) or "", vals, None))
    return sortie


def depuis_xml(chemin):
    fichiers = {}
    if chemin.lower().endswith(".zip"):
        with zipfile.ZipFile(chemin) as z:
            for n in z.namelist():
                if n.lower().endswith(".xml"):
                    fichiers[os.path.basename(n)] = z.read(n)
    else:
        fichiers[os.path.basename(chemin)] = open(chemin, "rb").read()

    aliments, groupes, consts, compos = lire_xml(fichiers)
    if not aliments:
        raise SystemExit("Aucun aliment lu. Le fichier n'a pas la structure Ciqual attendue.\n"
                         "Fichiers dans l'archive : " + ", ".join(fichiers))
    par_aliment = {}
    for alim_code, const_code, val in compos:
        cle = consts.get(const_code)
        if cle and alim_code:
            par_aliment.setdefault(alim_code, {})[cle] = teneur(val)

    sortie = []
    for code, a in aliments.items():
        vals = par_aliment.get(code, {})
        sortie.append((a["nom"], a.get("ssgrp_nom") or "", groupes.get(a["grp"]) or "", vals, code))
    return sortie


# ── Écriture du SQL ────────────────────────────────────────────────────────
def echapper(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__ or "usage: importer-ciqual.py <fichier>")
    chemin = sys.argv[1]
    if not os.path.exists(chemin):
        raise SystemExit(f"Fichier introuvable : {chemin}")

    if chemin.lower().endswith(".xlsx"):
        brut = depuis_xlsx(lire_xlsx(chemin))
    else:
        brut = depuis_xml(chemin)

    retenus, ecartes = [], {"macros manquantes": 0, "sans nom": 0, "infantile": 0}
    for nom, sous_groupe, groupe, vals, code in brut:
        if not nom:
            ecartes["sans nom"] += 1
            continue
        if re.search(r"aliment.*infantile|bebe|nourrisson|lait.*1er age|2eme age", sans_accent(nom)):
            ecartes["infantile"] += 1
            continue
        kcal, p, c, f = vals.get("kcal"), vals.get("protein"), vals.get("carbs"), vals.get("fat")
        # L'énergie et les trois macros sont indispensables : le solveur divise
        # par elles. Une valeur manquante ne se rattrape pas, on écarte.
        if kcal is None or p is None or c is None or f is None:
            ecartes["macros manquantes"] += 1
            continue
        role = role_de(nom, sous_groupe, groupe, p, c, f)
        retenus.append({
            "code": code, "nom": nom, "role": role,
            "repas": repas_de(role, sous_groupe, groupe),
            "kcal": kcal, "p": p, "c": c, "f": f, "fibres": vals.get("fiber"),
        })

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
--  Écartés : {', '.join(f'{v} {k}' for k, v in ecartes.items() if v)}.
--
--  IDEMPOTENT : relançable sans risque. Les aliments de la base commune sont
--  reconnus par leur code Ciqual ; ceux que TU as créés depuis l'espace coach
--  portent un coach_id et ne sont jamais touchés.
--
--  PRÉREQUIS : sql/2026-08-14-diete-personnalisee.sql doit avoir été joué.
-- ═══════════════════════════════════════════════════════════════════════════

""")
        for i in range(0, len(retenus), 500):
            paquet = retenus[i:i + 500]
            out.write("insert into public.foods\n"
                      "  (coach_id, ciqual_code, name, role, meal_types, kcal_100, protein_100, carbs_100, fat_100, fiber_100)\n"
                      "values\n")
            valeurs = []
            for a in paquet:
                repas = "array[" + ",".join(echapper(r) for r in a["repas"]) + "]"
                fibres = "null" if a["fibres"] is None else f'{a["fibres"]:g}'
                code = "null" if not a["code"] else echapper(a["code"])
                valeurs.append(
                    f'  (null, {code}, {echapper(a["nom"])}, {echapper(a["role"])}, {repas}, '
                    f'{a["kcal"]:g}, {a["p"]:g}, {a["c"]:g}, {a["f"]:g}, {fibres})'
                )
            out.write(",\n".join(valeurs))
            out.write("\non conflict (ciqual_code) where coach_id is null and ciqual_code is not null\n"
                      "do update set name = excluded.name, role = excluded.role,\n"
                      "              meal_types = excluded.meal_types, kcal_100 = excluded.kcal_100,\n"
                      "              protein_100 = excluded.protein_100, carbs_100 = excluded.carbs_100,\n"
                      "              fat_100 = excluded.fat_100, fiber_100 = excluded.fiber_100;\n\n")

        out.write("-- ── Contrôle ──────────────────────────────────────────────────────────────\n"
                  "-- select role, count(*) from public.foods where coach_id is null group by 1 order by 2 desc;\n")

    par_role = {}
    for a in retenus:
        par_role[a["role"]] = par_role.get(a["role"], 0) + 1
    print(f"\n{SORTIE}")
    print(f"  {len(retenus)} aliments retenus")
    for k, v in sorted(par_role.items(), key=lambda x: -x[1]):
        print(f"    {v:>5}  {k}")
    for k, v in ecartes.items():
        if v:
            print(f"  écartés : {v} ({k})")
    print(f"  taille : {os.path.getsize(SORTIE) // 1024} Ko")


if __name__ == "__main__":
    main()
