import { createAuthClient } from '@neondatabase/auth';

const authUrl = import.meta.env.VITE_NEON_AUTH_BASE_URL;
const authClient = authUrl ? createAuthClient(authUrl) : null;
const $ = (id) => document.getElementById(id);

function showNotice(message, kind = 'danger') {
  const box = $('notice');
  box.className = `alert alert-${kind}`;
  box.textContent = message;
  box.hidden = false;
}

async function getSession() {
  if (!authClient) throw new Error('Neon Auth não está configurado. Defina VITE_NEON_AUTH_BASE_URL e gere um novo deploy.');
  const result = await authClient.getSession();
  if (result.error) throw new Error(result.error.message || 'Não foi possível validar sua sessão.');
  return result.data;
}

async function getAccessToken() {
  if (!authClient?.getJWTToken) throw new Error('A versão do Neon Auth não disponibilizou um token para a API.');
  const token = await authClient.getJWTToken();
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
  return token;
}

async function api(path, body) {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  return data;
}

async function loadHistory(stories) {
  const list = $('history');
  list.replaceChildren();
  if (!stories?.length) {
    list.textContent = 'Sua primeira história está esperando por você.';
    list.className = 'mt-3 muted';
    return;
  }
  list.className = 'mt-3';
  stories.forEach((item) => {
    const row = document.createElement('details');
    row.className = 'history-item';
    const summary = document.createElement('summary');
    summary.className = 'fw-bold';
    summary.textContent = item.story.split('\\n').find((line) => line.trim())?.slice(0, 100) || 'História sem título';
    const story = document.createElement('p');
    story.className = 'story muted mt-3 mb-0';
    story.textContent = item.story;
    row.append(summary, story);
    list.append(row);
  });
}

async function fetchAccount() {
  const token = await getAccessToken();
  const response = await fetch('/api/account', { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar seus dados.');
  return data;
}

async function loadApp() {
  const session = await getSession();
  const user = session?.user;
  $('loginBox').hidden = Boolean(user);
  $('app').hidden = !user;
  if (!user) return;

  $('userEmail').textContent = user.email || user.name || 'Conta conectada';
  const account = await fetchAccount();
  const isPro = account.profile?.plan === 'pro';
  $('plan').textContent = isPro ? 'Plano Pro' : 'Plano gratuito';
  $('usage').textContent = account.usage?.count ?? 0;
  $('upgradeButton').hidden = isPro;
  $('formHelp').textContent = isPro ? 'Plano Pro: até 100 histórias por dia.' : 'Plano gratuito: até 3 histórias por dia.';
  await loadHistory(account.stories);
}

async function start() {
  try {
    if (!authClient) throw new Error('Neon Auth não está configurado. Defina VITE_NEON_AUTH_BASE_URL e gere um novo deploy.');
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'success') showNotice('Pagamento confirmado. Seu plano será atualizado assim que o Stripe enviar a confirmação.', 'success');
    if (params.get('checkout') === 'cancelled') showNotice('Checkout cancelado. Você pode continuar usando o plano atual.', 'info');

    $('loginButton').addEventListener('click', async () => {
      $('loginButton').disabled = true;
      try {
        const result = await authClient.signIn.social({ provider: 'google', callbackURL: location.origin });
        if (result.error) throw new Error(result.error.message || 'Não foi possível iniciar o login Google.');
      } catch (error) {
        showNotice(`Falha no login: ${error.message}`);
        $('loginButton').disabled = false;
      }
    });

    $('logoutButton').addEventListener('click', async () => {
      try {
        const result = await authClient.signOut();
        if (result.error) throw new Error(result.error.message || 'Não foi possível encerrar a sessão.');
        location.reload();
      } catch (error) {
        showNotice(error.message);
      }
    });

    $('upgradeButton').addEventListener('click', async () => {
      try {
        const checkout = await api('/api/create-checkout', {});
        location.assign(checkout.url);
      } catch (error) {
        showNotice(error.message);
      }
    });

    $('storyForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!$('storyForm').reportValidity()) return;
      $('generateButton').disabled = true;
      $('generateButton').textContent = 'Criando sua aventura…';
      try {
        const result = await api('/api/generate-story', {
          age: $('age').value,
          interests: $('interests').value,
          style: $('style').value,
          lesson: $('lesson').value,
        });
        $('storyText').textContent = result.story;
        $('result').hidden = false;
        $('usage').textContent = result.usage;
        await loadApp();
        $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        showNotice(error.message);
      } finally {
        $('generateButton').disabled = false;
        $('generateButton').textContent = 'Criar minha história ✨';
      }
    });

    await loadApp();
  } catch (error) {
    $('loginBox').hidden = true;
    showNotice(error.message);
  }
}

start();
