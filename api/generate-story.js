export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;

    const models = [
        'mistralai/mistral-7b-instruct',
        'openai/gpt-3.5-turbo',
        'meta-llama/llama-3-8b-instruct',
        'anthropic/claude-3.5-sonnet'
    ];

    for (let model of models) {
        try {
            console.log(`Tentando modelo: ${model}`);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://gerador-de-historias-infantis-ia.vercel.app',
                    'X-Title': 'Gerador de Histórias'
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 800 // 🔥 reduz custo aqui também
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.warn(`Erro no modelo ${model}:`, data);
                continue; // tenta próximo modelo
            }

            return res.status(200).json({
                story: data.choices[0].message.content,
                model_used: model
            });

        } catch (error) {
            console.error(`Falha no modelo ${model}:`, error);
            continue;
        }
    }

    return res.status(500).json({
        error: 'Todos os modelos falharam'
    });
}
