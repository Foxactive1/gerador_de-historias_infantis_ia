# Histórias Mágicas com IA

Aplicação web para criar histórias infantis personalizadas. A interface usa Supabase Auth e mantém as histórias e o histórico no Supabase. A geração acontece em funções serverless da Vercel e usa a API da OpenAI.

## Stack

- HTML, CSS e JavaScript
- Vercel Functions (Node.js / ES Modules)
- Supabase Auth e PostgreSQL com RLS
- OpenAI Chat Completions API
- Stripe Checkout opcional para plano Pro

## Configuração

1. Crie um projeto no Supabase e execute [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor.
2. Em Authentication → Providers, habilite Google e configure as credenciais OAuth e as URLs de retorno do seu domínio Vercel.
3. Na Vercel, importe o repositório e configure as variáveis de ambiente de `.env.example`. `SUPABASE_SERVICE_ROLE` e `OPENAI_API_KEY` devem existir apenas no ambiente server-side.
4. Faça o deploy. A página `/api/config` disponibiliza apenas a URL do Supabase e a chave pública anon.

O plano gratuito permite 3 histórias por dia; o Pro permite 100. A função SQL `reserve_story_usage` contabiliza solicitações atomicamente antes da chamada à IA, evitando consumo fora do limite mesmo com chamadas simultâneas. Se a geração ou o salvamento falhar, o uso reservado é liberado.

## Stripe (opcional)

Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` e `BASE_URL`. Cadastre `https://SEU_DOMINIO/api/webhook` como webhook Stripe para `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`. Os metadados da assinatura associam o evento ao usuário autenticado; o navegador não escolhe o próprio plano.

## Desenvolvimento e validação

```bash
npm install
npm run check
```

Para testar localmente com as funções da Vercel, instale a Vercel CLI e execute `vercel dev` depois de preencher as variáveis do `.env.example` em um arquivo `.env.local` (não versionado).

## Segurança

- Cada endpoint que altera dados valida o JWT com Supabase Auth; `user_id` enviado pelo cliente não é aceito como identidade.
- A chave service role, a chave OpenAI e as chaves Stripe ficam apenas no servidor.
- RLS restringe leituras de perfil, uso e histórias ao próprio usuário. O cliente não pode escrever plano, histórias ou cotas diretamente.
- Histórias são renderizadas com `textContent`, sem interpretar HTML retornado pela IA.
- Campos são limitados e o prompt do sistema orienta a geração de conteúdo apropriado para crianças.
