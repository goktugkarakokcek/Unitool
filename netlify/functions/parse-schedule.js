const MODELS_TO_TRY = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash'
];

function extractArrayFromText(rawText) {
    if (!rawText) return null;
    try {
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
                if (Array.isArray(parsed[k])) return parsed[k];
            }
        }
    } catch (_) {
        return null;
    }
    return null;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        const keyPool = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

        if (keyPool.length === 0) {
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'NO_SERVER_KEYS', message: 'Netlify Environment Variables içinde GEMINI_API_KEYS tanımlı değil.' })
            };
        }

        const { imageBase64, mimeType } = JSON.parse(event.body || '{}');
        if (!imageBase64) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Görsel verisi boş.' }) };
        }

        // Eğer base64 başında "data:image/jpeg;base64," varsa temizle
        const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

        // Timeout'a takılmamak için en fazla 2 farklı anahtar dene
        const shuffledKeys = [...keyPool].sort(() => Math.random() - 0.5).slice(0, 2);

        const promptText = `Sen Türkiye'deki üniversitelerin (OBS, ÜBYS, Proliz vb.) haftalık ders programı tablolarını okuyan uzman bir asistansın.
Görseldeki haftalık ders programını incele ve sadece gerçek dersleri JSON dizisi olarak çıkar.

KESİN KURALLAR:
1. "name" alanına SADECE dersin temiz Türkçe adını yaz. Ders kodlarını, şube numaralarını, derslik/amfi/lab kodlarını ve öğretim elemanı isimlerini/unvanlarını KESİNLİKLE YAZMA.
2. Tabloda aynı gün içinde aynı ders alt alta birden fazla saat satırında tekrar ediyorsa tek bir ders olarak birleştir, "hours" alanına toplam saati yaz (örn: 3).
3. Gün numaraları: Pazartesi=1, Salı=2, Çarşamba=3, Perşembe=4, Cuma=5, Cumartesi=6, Pazar=0.
4. Öğle arası veya boş saatleri dahil etme.`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: mimeType || 'image/jpeg', data: cleanBase64 } }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                response_mime_type: "application/json",
                response_schema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            day: { type: "INTEGER" },
                            startTime: { type: "STRING" },
                            endTime: { type: "STRING" },
                            hours: { type: "INTEGER" }
                        },
                        required: ["name", "day", "startTime", "endTime", "hours"]
                    }
                }
            }
        };

        let lastErrorMsg = '';

        for (const apiKey of shuffledKeys) {
            for (const modelName of MODELS_TO_TRY) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
                    
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        const errData = await response.json().catch(() => ({}));
                        lastErrorMsg = errData?.error?.message || `HTTP ${response.status} (${modelName})`;
                        continue;
                    }

                    const result = await response.json();
                    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    const parsed = extractArrayFromText(rawText);

                    if (Array.isArray(parsed)) {
                        return {
                            statusCode: 200,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: parsed, model: modelName })
                        };
                    }
                } catch (err) {
                    lastErrorMsg = err.message;
                }
            }
        }

        return {
            statusCode: 429,
            body: JSON.stringify({ error: 'ALL_ATTEMPTS_FAILED', message: lastErrorMsg || 'Anahtarlar yanıt vermedi.' })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'SERVER_ERROR', message: err.message })
        };
    }
};