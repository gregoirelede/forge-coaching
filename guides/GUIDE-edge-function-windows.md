# Déployer une Edge Function depuis le PC Windows

> Cette opération ne peut **pas** se faire depuis une session Claude Code sur le web :
> elle exige le CLI Supabase installé sur ta machine. C'est la seule partie du projet
> qui reste manuelle.

## Une seule fois : installer le CLI

Le CLI Supabase s'installe avec Scoop, dans PowerShell :

```powershell
scoop install supabase
supabase login
```

`supabase login` ouvre le navigateur pour t'authentifier. Si la commande `supabase`
n'est pas reconnue juste après l'installation, ferme et rouvre PowerShell.

## Déployer ou mettre à jour une fonction

Les sources de référence sont dans le dossier `edge-functions/` de ce dépôt :
`create-coachee.ts` et `update-coachee.ts`.

1. Récupérer le fichier `.ts` depuis GitHub (bouton **Download raw file** sur la page
   du fichier).
2. Dans PowerShell, préparer l'arborescence attendue par le CLI :

```powershell
cd ~\Documents
mkdir -p supabase\functions\create-coachee
```

3. Placer le fichier dans ce dossier **en le renommant `index.ts`**. Le CLI exige ce
   nom précis : `supabase\functions\create-coachee\index.ts`.

4. Déployer :

```powershell
supabase functions deploy create-coachee --no-verify-jwt
```

Remplacer `create-coachee` par `update-coachee` pour l'autre fonction.

## Pourquoi `--no-verify-jwt`

Ce drapeau désactive la vérification automatique du jeton par la plateforme. Ce n'est
pas un trou de sécurité : les deux fonctions vérifient elles-mêmes, dans leur code,
que l'appelant est authentifié **et** que son profil a bien `role = 'coach'`. Sans ce
drapeau, l'appel depuis l'app échouerait avant même d'entrer dans la fonction.

## Les secrets

Ils sont **partagés entre toutes les fonctions** du projet et déjà configurés. Il n'y a
rien à refaire lors d'un redéploiement. Les trois utilisés sont :

| Secret | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet |
| `SUPABASE_ANON_KEY` | Vérifie l'identité de l'appelant |
| `SUPABASE_SERVICE_ROLE_KEY` | Crée et modifie les comptes Auth |

La clé `service_role` ne doit **jamais** sortir de cet emplacement : ni dans le dépôt,
ni dans une conversation, ni dans l'app.

## Vérifier que le déploiement a pris

Supabase → **Edge Functions** → la fonction doit être **ACTIVE** et son numéro de
version incrémenté. Test réel : espace coach → créer ou modifier un coaché de test,
puis vérifier dans **Table Editor → profiles** que la ligne est correcte.

## En cas d'erreur

| Message | Cause | Solution |
|---|---|---|
| `supabase` n'est pas reconnu | PATH pas encore rechargé | Fermer et rouvrir PowerShell |
| `Access token not provided` | Session CLI expirée | Relancer `supabase login` |
| `Entrypoint path does not exist` | Fichier mal nommé | Le fichier doit s'appeler `index.ts` |
