# Histórias Mágicas com IA

Aplicação web para criar histórias infantis personalizadas. A interface usa Supabase Auth para login Google; perfis, histórias e cotas ficam no Neon PostgreSQL. A geração acontece em funções serverless da Vercel e usa a API da OpenAI.

## Stack

- HTML, CSS e JavaScript
- Vercel Functions (Node.js / ES Modules)
- Supabase Auth para login e validação de JWT
- Neon PostgreSQL para perfis, histórias, cotas e assinatura
- OpenAI Chat Completions API
- Stripe Checkout opcional para plano Pro

## Configuração

1. Crie um banco Neon e execute [`neon/schema.sql`](neon/schema.sql) no SQL Editor do Neon.
2. Configure as variáveis de `.env.example` na Vercel. `DATABASE_URL` deve ser a connection string do Neon e ficar somente no servidor.
3. Configure o projeto Supabase apenas como provedor de autenticação: habilite Google OAuth e informe as URLs de retorno do domínio Vercel.
4. Faça o deploy. A página `/api/config` disponibiliza somente a URL e a chave pública anon do Supabase Auth.

O plano gratuito permite 3 histórias por dia; o Pro permite 100. A função SQL `reserve_story_usage` no Neon contabiliza solicitações atomicamente antes da chamada à IA, evitando consumo fora do limite mesmo com chamadas simultâneas. Se a geração ou o salvamento falhar, o uso reservado é liberado. O navegador nunca conecta diretamente ao Neon: os endpoints validam o JWT do Supabase Auth e filtram os dados pelo ID autenticado.

## Stripe (opcional)

Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` e `BASE_URL`. Cadastre `https://SEU_DOMINIO/api/webhook` como webhook Stripe para `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`. Os metadados da assinatura associam o evento ao usuário autenticado; o navegador não escolhe o próprio plano.

## Desenvolvimento e validação

```bash
npm install
npm run check
```

Para testar localmente com as funções da Vercel, instale a Vercel CLI e execute `vercel dev` depois de preencher as variáveis do `.env.example` em um arquivo `.env.local` (não versionado).

## Segurança

- Cada endpoint que lê ou altera dados valida o JWT com Supabase Auth; `user_id` enviado pelo cliente não é aceito como identidade.
- A connection string do Neon, a chave OpenAI e as chaves Stripe ficam apenas no servidor.
- O banco Neon não usa os papéis/funções `auth.users`, `auth.uid()`, `authenticated` ou `service_role` do Supabase. O isolamento por usuário é aplicado nos endpoints privados e no vínculo dos registros ao UUID autenticado.
- Histórias são renderizadas com `textContent`, sem interpretar HTML retornado pela IA.
- Campos são limitados e o prompt do sistema orienta a geração de conteúdo apropriado para crianças.
