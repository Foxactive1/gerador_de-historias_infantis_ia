export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://seu-dominio.vercel.app',
        'X-Title': 'Gerador de Histórias'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    });

    const data = await response.json();

    return res.status(200).json({
      story: data.choices?.[0]?.message?.content || 'Erro ao gerar história'
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
