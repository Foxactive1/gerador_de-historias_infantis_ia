# Histórias Mágicas com IA

Aplicação web para criar histórias infantis personalizadas. Autenticação, identidade e PostgreSQL usam Neon: Neon Auth (Google OAuth) e Neon PostgreSQL. A aplicação roda na Vercel, gera histórias pela API da OpenAI e oferece assinatura opcional pelo Stripe.

## Stack

- Frontend JavaScript com Vite
- Vercel Functions em Node.js
- Neon Auth para login Google, sessões e JWTs
- Neon PostgreSQL para perfis, histórias, cotas e plano
- OpenAI Chat Completions API
- Stripe Checkout opcional para plano Pro

## Configuração Neon

1. Crie ou escolha um projeto Neon compatível com Neon Auth e habilite Neon Auth para a branch usada pela aplicação.
2. Em Neon Auth, habilite Google OAuth. Cadastre o domínio Vercel como trusted domain e configure as credenciais do provedor Google para produção.
3. Execute neon/schema.sql no SQL Editor do Neon. Neon Auth mantém as próprias tabelas em neon_auth; o script cria somente tabelas da aplicação.
4. Configure as variáveis de ambiente na Vercel:
   - DATABASE_URL: connection string do Neon, somente server-side.
   - NEON_AUTH_BASE_URL e NEON_AUTH_JWKS_URL: copie os valores exatos da branch Neon para validação JWT no backend.
   - VITE_NEON_AUTH_BASE_URL: mesma URL base de Neon Auth, disponível para o bundle de login.
   - OPENAI_API_KEY: chave da API de geração.
5. Cadastre o domínio Vercel como trusted domain no Neon Auth e faça o deploy. O build Vite gera a página estática em dist; as funções em api/ continuam sendo servidas pela Vercel.

O plano gratuito permite 3 histórias por dia; Pro permite 100. A função SQL reserve_story_usage contabiliza cada geração de forma atômica. Se a chamada à IA falhar, a reserva é liberada. As APIs verificam assinatura e emissor do JWT Neon Auth via JWKS antes de associar qualquer registro ao usuário. A connection string do banco nunca vai para o navegador.

## Dados existentes

Neon Auth gera identificadores próprios. O script converte IDs UUID já existentes no banco Neon para texto sem alterar seus valores. As contas, senhas e sessões do Supabase Auth não migram para Neon Auth. Como os IDs novos são diferentes, histórias antigas não são associadas automaticamente às novas contas; será preciso migrar um mapa verificado entre usuário antigo e usuário Neon se a preservação do histórico for necessária. O fluxo de login do app usa Google OAuth.

## Stripe (opcional)

Configure STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET e BASE_URL. Cadastre https://SEU_DOMINIO/api/webhook para receber checkout.session.completed, customer.subscription.updated e customer.subscription.deleted. Os metadados da assinatura associam o plano ao usuário autenticado; o navegador não escolhe o próprio plano.

## Desenvolvimento e validação

Execute npm install, npm run check e npm run build. Para testar o fluxo completo localmente, configure .env.local e execute vercel dev, pois as rotas de API são funções da Vercel.

## Segurança

- O servidor valida JWTs Neon Auth com a chave pública do endpoint JWKS e confere o emissor configurado.
- Toda leitura e escrita de dados de usuário usa o sub validado do token; a API ignora qualquer user_id fornecido pelo navegador.
- DATABASE_URL, chave OpenAI e chaves Stripe ficam apenas em ambiente server-side.
- Histórias são exibidas com textContent, sem interpretar HTML retornado pela IA.
- Os campos do prompt são limitados e as instruções do sistema restringem o conteúdo a histórias infantis adequadas.
