export default async function handler(req, res) {
    const { prompt, user_id } = req.body;

    if (!user_id) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // 🔹 Conectar Supabase (server-side)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 🔹 Buscar plano do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user_id)
        .single();

    const today = new Date().toISOString().slice(0, 10);

    // 🔹 Verificar uso diário
    const { data: usageData } = await supabase
        .from('usage')
        .select('*')
        .eq('user_id', user_id)
        .eq('date', today)
        .single();

    const limit = profile?.plan === 'pro' ? 100 : 3;

    if (usageData && usageData.count >= limit) {
        return res.status(403).json({
            error: 'Limite diário atingido'
        });
    }

    // 🔹 Chamada OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
        })
    });

    const data = await response.json();

    if (!response.ok) {
        return res.status(500).json({ error: data.error.message });
    }

    const story = data.choices[0].message.content;

    // 🔹 Salvar história
    await supabase.from('stories').insert({
        user_id,
        prompt,
        story
    });

    // 🔹 Atualizar uso
    if (usageData) {
        await supabase.from('usage')
            .update({ count: usageData.count + 1 })
            .eq('id', usageData.id);
    } else {
        await supabase.from('usage').insert({
            user_id,
            count: 1
        });
    }

    return res.status(200).json({ story });
}