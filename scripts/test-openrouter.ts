import 'dotenv/config';

async function test() {
    const key = process.env.OPENROUTER_API_KEY;
    console.log('Key present:', !!key, key?.slice(0, 20) + '...');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://betbodhi.io',
            'X-Title': 'Bet Bodhi'
        },
        body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4-5',
            messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
            max_tokens: 100
        })
    });

    console.log('HTTP Status:', res.status);
    const data = await res.json() as any;
    console.log('Full response:', JSON.stringify(data, null, 2));
    if (data.choices?.[0]?.message?.content) {
        console.log('\n✅ Model replied:', data.choices[0].message.content);
    }
}

test().catch(console.error);
