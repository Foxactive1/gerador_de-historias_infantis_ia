export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://gerador-de-historias-infantis-ia.vercel.app',
                'X-Title': 'Gerador de Histórias'
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2000
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({
                error: data.error?.message || 'Erro na OpenRouter'
            });
        }

        return res.status(200).json({
            story: data.choices[0].message.content
        });

    } catch (error) {
        return res.status(500).json({
            error: 'Erro interno do servidor'
        });
    }
}
