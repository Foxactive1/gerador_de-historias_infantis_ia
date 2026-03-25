export default async function handler(req, res) {
    const { prompt } = req.body;

    const isDev = process.env.NODE_ENV !== 'production';

    // 🟢 MODO DESENVOLVIMENTO (SEM CUSTO)
    if (isDev) {
        console.log("Modo DEV ativo - sem custo");

        const fakeStory = `
Era uma vez uma criança muito especial que adorava aventuras.

Um dia, ela descobriu algo incrível relacionado a ${prompt.slice(0, 50)}...

Com coragem e gentileza, aprendeu uma grande lição:
${prompt.slice(-60)}

E assim, terminou o dia feliz, pronta para novos sonhos.

✨ Fim ✨
        `;

        return res.status(200).json({
            story: fakeStory,
            model_used: "mock-dev"
        });
    }

    // 🔴 MODO PRODUÇÃO (COM API REAL)
    const models = [
        'mistralai/mistral-7b-instruct',
        'openai/gpt-3.5-turbo'
    ];

    for (let model of models) {
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
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 500
                })
            });

            const data = await response.json();

            if (!response.ok) continue;

            return res.status(200).json({
                story: data.choices[0].message.content,
                model_used: model
            });

        } catch (err) {
            continue;
        }
    }

    return res.status(500).json({
        error: "Falha nos modelos"
    });
}