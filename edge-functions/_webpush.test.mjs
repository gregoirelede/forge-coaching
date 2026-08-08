// ═══════════════════════════════════════════════════════════════════════════════
//  TEST DU CHIFFREMENT WEB PUSH — hors ligne, sans service de notification
//
//  On ne peut pas envoyer une vraie notification depuis l'environnement de
//  développement. Mais on peut prouver que le chiffrement est correct : ce test
//  joue le rôle du navigateur destinataire. Il fabrique une fausse inscription,
//  chiffre un message avec _webpush.ts, puis le DÉCHIFFRE en appliquant la
//  RFC 8291 à l'envers. Si le texte d'origine ressort, le format est bon et
//  Apple comme Google l'accepteront.
//
//  Lancer :  node edge-functions/_webpush.test.mjs
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const ici = dirname(fileURLToPath(import.meta.url));

// On charge le fichier de production tel quel : c'est bien ce code-là qu'on teste.
const source = readFileSync(join(ici, "_webpush.ts"), "utf8");
const module = await import("data:text/javascript;base64," +
  Buffer.from(source).toString("base64"));
const { encryptPayload, buildVapidHeader, generateVapidKeys, b64urlToBytes, bytesToB64url } = module;

const enc = new TextEncoder();
const dec = new TextDecoder();
let ko = 0;
const ok = (c, m) => { if (!c) ko++; console.log(`  ${c ? "OK   " : "ECHEC"}  ${m}`); };
const concat = (...p) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0; for (const x of p) { out.set(x, o); o += x.length; } return out;
};

// ── On joue le navigateur : il possède une paire de clés et un secret ────────
const navigateur = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", navigateur.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

const abonnement = {
  endpoint: "https://web.push.apple.com/QWERTY123",
  p256dh: bytesToB64url(uaPublic),
  auth: bytesToB64url(authSecret),
};

const MESSAGE = JSON.stringify({ titre: "Séance du jour", corps: "Push A t'attend. 7 exercices." });

console.log("\n─── Chiffrement (RFC 8291) ───");
const corps = await encryptPayload({ payload: MESSAGE, p256dh: abonnement.p256dh, auth: abonnement.auth });

// ── Analyse de l'en-tête aes128gcm ───────────────────────────────────────────
const salt = corps.slice(0, 16);
const rs = new DataView(corps.buffer, corps.byteOffset + 16, 4).getUint32(0);
const idlen = corps[20];
const asPublic = corps.slice(21, 21 + idlen);
const chiffre = corps.slice(21 + idlen);

ok(salt.length === 16, `sel de 16 octets`);
ok(rs === 4096, `taille d'enregistrement annoncée : ${rs}`);
ok(idlen === 65, `clé publique du serveur : ${idlen} octets`);
ok(asPublic[0] === 4, `point non compressé (premier octet 0x0${asPublic[0]})`);
// Longueur en OCTETS, pas en caractères : « Séance » compte des accents sur 2 octets.
const octetsMessage = enc.encode(MESSAGE).length;
ok(chiffre.length === octetsMessage + 1 + 16,
   `chiffré = ${octetsMessage} octets de message + délimiteur + signature GCM = ${chiffre.length}`);

// ── Déchiffrement, du point de vue du navigateur ─────────────────────────────
console.log("\n─── Déchiffrement, côté navigateur ───");
const cleServeur = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: cleServeur }, navigateur.privateKey, 256));

const hkdf = async (ikm, saltBytes, info, n) => {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: saltBytes, info }, k, n * 8));
};

const keyInfo = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
const ikm = await hkdf(ecdh, authSecret, keyInfo, 32);
const cek   = await hkdf(ikm, salt, concat(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
const nonce = await hkdf(ikm, salt, concat(enc.encode("Content-Encoding: nonce"),     new Uint8Array([0])), 12);

let clair = null, erreur = null;
try {
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  clair = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, chiffre));
} catch (e) { erreur = e; }

ok(!erreur, `déchiffrement réussi${erreur ? " → " + erreur.message : ""}`);
if (clair) {
  ok(clair[clair.length - 1] === 2, "délimiteur de dernier enregistrement (0x02) présent");
  const texte = dec.decode(clair.slice(0, -1));
  ok(texte === MESSAGE, "le message d'origine est restitué à l'identique");
  if (texte !== MESSAGE) console.log("     attendu :", MESSAGE, "\n     obtenu  :", texte);
}

// ── Un mauvais secret doit échouer : preuve que le chiffrement protège ───────
console.log("\n─── Le chiffrement protège bien ───");
const mauvais = crypto.getRandomValues(new Uint8Array(16));
const ikmFaux = await hkdf(ecdh, mauvais, keyInfo, 32);
const cekFaux = await hkdf(ikmFaux, salt, concat(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
let dechiffreQuandMeme = false;
try {
  const aes = await crypto.subtle.importKey("raw", cekFaux, "AES-GCM", false, ["decrypt"]);
  await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, chiffre);
  dechiffreQuandMeme = true;
} catch {}
ok(!dechiffreQuandMeme, "un tiers sans le secret d'authentification ne peut pas lire le message");

// ── Jeton VAPID (RFC 8292) ───────────────────────────────────────────────────
console.log("\n─── Jeton VAPID (RFC 8292) ───");
const vapid = await generateVapidKeys();
ok(b64urlToBytes(vapid.publicKey).length === 65, `clé publique : ${b64urlToBytes(vapid.publicKey).length} octets`);
ok(b64urlToBytes(vapid.privateKey).length === 32, `clé privée : ${b64urlToBytes(vapid.privateKey).length} octets`);

const entete = await buildVapidHeader({
  endpoint: abonnement.endpoint, publicKey: vapid.publicKey,
  privateKey: vapid.privateKey, subject: "mailto:test@forge.app",
});
ok(entete.startsWith("vapid t=") && entete.includes(", k="), "en-tête au format « vapid t=..., k=... »");

const jwt = entete.slice("vapid t=".length).split(", k=")[0];
const [h, p, s] = jwt.split(".");
const tete = JSON.parse(dec.decode(b64urlToBytes(h)));
const charge = JSON.parse(dec.decode(b64urlToBytes(p)));
ok(tete.alg === "ES256", `algorithme : ${tete.alg}`);
ok(charge.aud === "https://web.push.apple.com", `destinataire : ${charge.aud} (origine seule, sans le chemin)`);
ok(charge.exp > Date.now() / 1000 && charge.exp < Date.now() / 1000 + 86400, "expiration dans la fenêtre autorisée (< 24 h)");
ok(b64urlToBytes(s).length === 64, `signature brute r||s : ${b64urlToBytes(s).length} octets`);

// Vérification cryptographique de la signature avec la clé publique
const pub = b64urlToBytes(vapid.publicKey);
const cleVerif = await crypto.subtle.importKey("jwk", {
  kty: "EC", crv: "P-256", x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true,
}, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
const valide = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cleVerif,
  b64urlToBytes(s), enc.encode(`${h}.${p}`));
ok(valide, "la signature est vérifiée par la clé publique correspondante");

console.log(`\n${ko === 0 ? "TOUS LES CONTROLES SONT PASSES." : ko + " CONTROLE(S) EN ECHEC."}`);
process.exit(ko === 0 ? 0 : 1);
