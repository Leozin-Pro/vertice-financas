# Setup — Vértice Finanças (Supabase + Vercel)

Guia completo do zero ao deploy. Siga na ordem.

---

## 1. Criar conta no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **Start for free**
2. Faça login com GitHub ou Google
3. Clique em **New project**
   - **Organization**: sua conta pessoal
   - **Project name**: `vertice-financas` (ou o nome que quiser)
   - **Database password**: crie uma senha forte e **guarde** — você vai precisar
   - **Region**: escolha **South America (São Paulo)** se disponível, ou **US East**
4. Aguarde o projeto ser criado (~1-2 minutos)

---

## 2. Rodar o schema SQL

1. No painel do Supabase, clique em **SQL Editor** (menu lateral esquerdo)
2. Clique em **New query**
3. Abra o arquivo `scripts/schema.sql` deste projeto e copie todo o conteúdo
4. Cole no editor e clique em **Run** (ou `Ctrl+Enter`)
5. Verifique que aparece "Success. No rows returned" sem erros
6. Confirme no menu **Table Editor** que as tabelas `people`, `transactions`, `custom_categories`, `transaction_people` e `user_prefs` foram criadas

---

## 3. Configurar Google OAuth

### 3.1 — Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `vertice-financas`) ou use um existente
3. No menu, vá em **APIs & Services → Credentials**
4. Clique em **+ Create Credentials → OAuth client ID**
5. Se solicitado, configure a **OAuth consent screen** primeiro:
   - **User type**: External
   - Preencha o nome do app e e-mail de suporte
   - Em **Scopes**: adicione `.../auth/userinfo.email` e `.../auth/userinfo.profile`
   - Salve
6. De volta em **Create OAuth client ID**:
   - **Application type**: Web application
   - **Name**: `vertice-financas`
   - **Authorized JavaScript origins**: (deixe vazio por enquanto)
   - **Authorized redirect URIs**: Cole a URL do callback do Supabase:
     ```
     https://SEU-PROJETO-ID.supabase.co/auth/v1/callback
     ```
     Você encontra essa URL no Supabase em **Authentication → Providers → Google**
7. Clique em **Create** — anote o **Client ID** e **Client Secret**

### 3.2 — Supabase: ativar provider Google

1. No Supabase, vá em **Authentication → Providers**
2. Clique em **Google**
3. Ative o toggle **Enable Google provider**
4. Cole o **Client ID** e **Client Secret** do passo anterior
5. Salve

---

## 4. Configurar URLs de redirect

### No Supabase:

1. Vá em **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:3000` (desenvolvimento) — altere depois para a URL do Vercel em produção
3. **Redirect URLs**: adicione:
   - `http://localhost:3000`
   - `https://seu-app.vercel.app` (adicione depois do deploy)

### No Google Cloud Console:

1. Volte em **Credentials → seu OAuth client**
2. Adicione em **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - `https://seu-app.vercel.app` (depois do deploy)
3. Salve

---

## 5. Configurar variáveis de ambiente locais

1. Na raiz do projeto, copie o arquivo de exemplo:
   ```
   cp .env.example .env.local
   ```
2. No Supabase, vá em **Settings → API**
3. Copie os valores:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API keys → anon public** → `VITE_SUPABASE_ANON_KEY`
4. Preencha o `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## 6. Rodar localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` e teste o fluxo de login com Google.

---

## 7. Criar repositório no GitHub

```bash
git init
git add .
git commit -m "feat: initial commit — vertice financas v5"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/vertice-financas.git
git push -u origin main
```

---

## 8. Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **Add New → Project**
3. Importe o repositório `vertice-financas`
4. O Vercel detecta automaticamente o Vite — mantenha as configurações padrão
5. **Antes de fazer o deploy**, clique em **Environment Variables** e adicione:
   - `VITE_SUPABASE_URL` → mesma URL do `.env.local`
   - `VITE_SUPABASE_ANON_KEY` → mesma key do `.env.local`
6. Clique em **Deploy**
7. Aguarde o deploy (30-60s) e anote a URL gerada (ex: `https://vertice-financas.vercel.app`)

---

## 9. Atualizar URLs de produção

Agora que você tem a URL do Vercel:

### No Supabase (Authentication → URL Configuration):
- **Site URL**: `https://vertice-financas.vercel.app`
- **Redirect URLs**: adicione `https://vertice-financas.vercel.app`

### No Google Cloud Console (Credentials → OAuth client):
- **Authorized JavaScript origins**: adicione `https://vertice-financas.vercel.app`
- Salve

---

## 10. Teste final

1. Acesse a URL do Vercel
2. Clique em "Entrar com Google"
3. Faça login
4. Cadastre uma pessoa
5. Importe um extrato
6. Verifique que os dados aparecem no dashboard
7. Feche o navegador, reabra e reacesse — os dados devem persistir

---

## Troubleshooting

**"Erro ao carregar dados"** após login:
- Verifique se o schema foi criado corretamente no Supabase
- Confirme que as env vars estão corretas no Vercel

**Redirecionamento OAuth não funciona**:
- Confirme que a URL de callback no Google Cloud Console bate com a URL do Supabase
- Confirme que a URL do app está listada em Supabase → Authentication → URL Configuration

**Build falha no Vercel**:
- Verifique se as env vars foram adicionadas no painel do Vercel (não só no `.env.local`)
