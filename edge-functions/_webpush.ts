// ═══════════════════════════════════════════════════════════════════════════════
//  WEB PUSH — chiffrement et signature, sans aucune dépendance
//
//  Implémente les deux normes nécessaires à l'envoi d'une notification push :
//    · RFC 8291 — chiffrement du contenu (aes128gcm)
//    · RFC 8292 — authentification du serveur auprès d'Apple / Google (VAPID)
//
//  POURQUOI PAS UNE BIBLIOTHÈQUE : l'environnement de développement n'a pas accès
//  aux registres de modules, une dépendance ne pourrait donc pas être vérifiée
//  avant déploiement. Tout passe ici par la cryptographie native (WebCrypto),
//  disponible à l'identique dans Deno et dans Node — ce qui permet de tester ce
//  fichier exact hors ligne (voir edge-functions/_webpush.test.mjs).
// ═══════════════════════════════════════════════════════════════════════════════

const enc = new TextEncoder();

export function b64urlToBytes(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(b) {
  let bin = "";
  const arr = new Uint8Array(b);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── Génération d'une paire de clés VAPID ─────────────────────────────────────
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey: bytesToB64url(pub), privateKey: jwk.d };
}

// Reconstitue la clé privée de signature à partir du seul paramètre "d".
// La clé publique s'en déduit, mais WebCrypto exige x et y : on les recalcule
// depuis la clé publique stockée à côté.
async function importVapidPrivate(privateD, publicKeyB64) {
  const pub = b64urlToBytes(publicKeyB64);         // 0x04 || X(32) || Y(32)
  const jwk = {
    kty: "EC", crv: "P-256", d: privateD,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// ── RFC 8292 — jeton VAPID ───────────────────────────────────────────────────
export async function buildVapidHeader({ endpoint, publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(enc.encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,   // 12 h, maximum toléré : 24 h
    sub: subject,
  })));
  const data = enc.encode(`${header}.${payload}`);
  const key = await importVapidPrivate(privateKey, publicKey);
  // ECDSA renvoie déjà la signature au format brut r||s (64 octets), attendu par JWS.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data));
  const jwt = `${header}.${payload}.${bytesToB64url(sig)}`;
  return `vapid t=${jwt}, k=${publicKey}`;
}

// ── RFC 8291 — chiffrement du contenu ────────────────────────────────────────
export async function encryptPayload({ payload, p256dh, auth, salt, serverKeys }) {
  const uaPublic = b64urlToBytes(p256dh);      // clé publique du navigateur, 65 octets
  const authSecret = b64urlToBytes(auth);      // secret partagé, 16 octets

  // Paire éphémère du serveur pour cet envoi (fournie en test, tirée au sort sinon)
  const kp = serverKeys || await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));

  // Secret partagé ECDH entre le serveur et le navigateur
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, kp.privateKey, 256));

  const hkdf = async (ikm, saltBytes, info, longueur) => {
    const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: saltBytes, info }, k, longueur * 8));
  };

  // Matériel de clé, lié aux deux clés publiques : personne d'autre ne peut le recalculer
  const keyInfo = concat(enc.encode("WebPush: info"), new Uint8Array([0]), uaPublic, asPublic);
  const ikm = await hkdf(ecdh, authSecret, keyInfo, 32);

  const sel = salt || crypto.getRandomValues(new Uint8Array(16));
  const cek   = await hkdf(ikm, sel, concat(enc.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])), 16);
  const nonce = await hkdf(ikm, sel, concat(enc.encode("Content-Encoding: nonce"),     new Uint8Array([0])), 12);

  // 0x02 = marqueur de dernier enregistrement (padding délimiteur de la RFC)
  const clair = concat(enc.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, clair));

  // En-tête aes128gcm : salt(16) | taille d'enregistrement(4) | longueur clé(1) | clé serveur(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

// ── Envoi effectif ───────────────────────────────────────────────────────────
export async function sendPush({ subscription, payload, vapid }) {
  const body = await encryptPayload({
    payload,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
  });
  const authorization = await buildVapidHeader({
    endpoint: subscription.endpoint,
    publicKey: vapid.publicKey,
    privateKey: vapid.privateKey,
    subject: vapid.subject,
  });
  const rep = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal",
    },
    body,
  });
  // 404 et 410 signifient que l'abonnement est mort : le navigateur a été
  // désinstallé ou les notifications révoquées. L'appelant doit le supprimer.
  return { ok: rep.ok, status: rep.status, perime: rep.status === 404 || rep.status === 410 };
}
