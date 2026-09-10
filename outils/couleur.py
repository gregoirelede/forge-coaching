# ═══════════════════════════════════════════════════════════════════════════
#  OKLCH → sRGB, et vérification de contraste.
#
#  Pourquoi OKLCH et pas HSL : en HSL, deux couleurs de même « L » n'ont pas
#  du tout la même clarté perçue — un jaune à 50 % éclate, un bleu à 50 %
#  est sombre. Une rampe HSL à pas régulier donne donc des marches inégales,
#  et c'est exactement ce qui fait qu'une palette « ne tient pas ensemble ».
#  OKLCH est perceptuellement uniforme : un pas de L y vaut le même pas de
#  clarté quelle que soit la teinte.
#
#  Sans dépendance : la VM n'a pas accès aux registres de paquets.
# ═══════════════════════════════════════════════════════════════════════════
import math

def _oklab_vers_lineaire(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_**3, m_**3, s_**3
    return (
        +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )

def _gamma(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

def _dans_gamut(rgb):
    return all(-0.0001 <= c <= 1.0001 for c in rgb)

def oklch_hex(L, C, H):
    """L en 0..1, C en 0..0.4, H en degrés. Réduit le chroma si hors gamut sRGB
    — sinon la conversion « clipperait » et changerait la teinte en douce."""
    h = math.radians(H)
    c = C
    for _ in range(200):
        rgb = _oklab_vers_lineaire(L, c * math.cos(h), c * math.sin(h))
        if _dans_gamut(rgb):
            break
        c -= 0.002
        if c < 0:
            c = 0
            rgb = _oklab_vers_lineaire(L, 0, 0)
            break
    return "#" + "".join(f"{max(0, min(255, round(_gamma(max(0.0, min(1.0, v))) * 255))):02X}" for v in rgb)

# ── Contraste WCAG 2.2 ──────────────────────────────────────────────────────
def _lum(hexa):
    h = hexa.lstrip("#")
    canaux = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    canaux = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in canaux]
    return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2]

def contraste(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi + 0.05) / (lo + 0.05), 2)

def rampe(H, C_max, tons, courbe_chroma=None):
    """Une rampe à pas de clarté RÉGULIERS. Le chroma suit une courbe en cloche :
    au maximum vers le milieu, réduit aux extrêmes — sinon les tons très clairs
    virent au fluo et les très sombres deviennent boueux."""
    sortie = {}
    for nom, L in tons.items():
        # Cloche centrée sur L = 0.55, là où l'œil accepte le plus de chroma.
        facteur = courbe_chroma(L) if courbe_chroma else (1 - abs(L - 0.55) / 0.55) ** 0.6
        sortie[nom] = oklch_hex(L, C_max * max(0.12, facteur), H)
    return sortie

# ── sRGB → OKLCH, pour ancrer une rampe sur une couleur existante ───────────
def _degamma(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex_oklch(hexa):
    h = hexa.lstrip("#")
    r, g, b = [_degamma(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    C = math.sqrt(a * a + bb * bb)
    H = math.degrees(math.atan2(bb, a)) % 360
    return round(L, 4), round(C, 4), round(H, 1)
