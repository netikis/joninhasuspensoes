# Joninha Suspensões — Deploy (GitHub + Vercel)

## Segredos (mesmo padrão do HM Automotivo)

| Arquivo | Vai pro GitHub? |
|---|---|
| `.env` | **Não** (gitignore) |
| `firebase-env.js` | **Não** (gerado no build) |
| `.env.example` | Sim (só nomes, sem valores) |
| `firebase-env.example.js` | Sim (modelo vazio) |
| `firebase-config.js` | Sim (chave web pública do Firebase — sem senha) |

## 1) Local (PC)

1. Copie `.env.example` → `.env` e preencha as chaves
2. Rode:
   ```bash
   npm run build
   ```
3. Abra `index.html` (ou sirva a pasta). O `firebase-env.js` / `firebase-config.js` são criados.

## 2) GitHub

```bash
git init
git add .
git commit -m "Joninha Suspensões — base com Firebase via env"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/joninha-suspensoes.git
git push -u origin main
```

Confirme que `.env` e `firebase-env.js` **não** entraram no commit.

## 3) Vercel

1. Importar o repositório
2. **Settings → Environment Variables** — criar as mesmas do `.env`:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Deploy — o build roda `npm run build` e gera `firebase-env.js` só no servidor.

## 4) Firebase Console

- Authentication → método **E-mail/senha** → criar usuário admin
- Firestore Database → criar banco
- **Regras obrigatórias** (assinatura + login funcionário + resto autenticado). Cole isto em Firestore → Regras → Publicar:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      /* Assinatura: cliente abre o link sem login e assina */
      match /joninha_assinaturas/{token} {
        allow read, write: if true;
      }
      /* Login do funcionário no celular: leitura pública (só hash), escrita só admin */
      match /joninha_logins_func/{doc} {
        allow read: if true;
        allow write: if request.auth != null;
      }
      /* Resto do sistema: só com login */
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
  ```
- Authentication → Settings → **Authorized domains**: adicionar o domínio da Vercel
- Depois de publicar as regras: no sistema, **Sistema → Blindagem** → **Enviar logins à nuvem**, e no celular **Atualizar logins da nuvem**.

## 5) Blindagem (checklist no próprio sistema)

Menu **Sistema → Blindagem / Diagnóstico**:
- mostra a versão do build (`1.2.0-blindagem`)
- testa Firebase, login funcionário, leitura da coleção `joninha_logins_func`
- copia as regras Firebase
- reenvia logins com **hash** (senha em texto **não** sobe mais na nuvem)

## 6) Assinatura do cliente (`assinar-joninha.html`)

**Sim — esse arquivo também sobe no GitHub** (e vai para a Vercel no deploy).

Fluxo:
1. Na oficina, com login Firebase, clique em **Enviar nota** / gerar link
2. O sistema grava o documento em `joninha_assinaturas` na nuvem
3. Envie o link por WhatsApp (ex.: `https://seu-app.vercel.app/assinar-joninha.html?t=...`)
4. Cliente abre no celular, assina; a oficina vê no histórico (sync automática)

## Observação

Chaves Web do Firebase aparecem no navegador depois do deploy (é normal). O que importa é **não versionar o `.env`** e proteger o banco com **login + regras**.
**Não deixe** `FIREBASE CHAVE.txt` no GitHub.