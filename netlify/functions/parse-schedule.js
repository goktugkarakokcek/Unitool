// netlify/functions/parse-schedule.js

exports.handler = async (event) => {
    // Sadece POST isteklerini kabul et
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Sadece POST desteklenir.' })
        };
    }

    try {
        // Netlify Environment Variables'dan virgülle ayrılmış anahtarları al
        // Örn: GEMINI_API_KEYS = "AIzaSyBirinci...,AIzaSyIkinci...,AIzaSyUcuncu..."
        const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
        const keyPool = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

        if (keyPool.length === 0) {
            return {
                statusCode: 503,
                body: JSON.stringify({ error: 'NO_SERVER_KEYS', message: 'Sunucu anahtarı tanımlanmamış.' })
            };
        }

        const body = JSON.parse(event.body || '{}');
        const { imageBase64, mimeType } = body;

        if (!imageBase64) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Görsel verisi eksik.' })
            };
        }

        // Aynı anda gelen kullanıcıları farklı anahtarlara dağıtmak için havuzu karıştır (Shuffle)
        const shuffledKeys = [...keyPool].sort(() => Math.random() - 0.5);

        const promptText = `Bu üniversite haftalık ders programı görselini dikkatlice incele ve tüm ders bloklarını JSON dizisi olarak çıkar.
Her ders bloğu için şu alanları döndür:
- "name": Dersin tam adı (Ders kodu, derslik veya hoca unvanı varsa temizle, sadece dersin adını yaz)
- "day": Gün numarası (Pazartesi=1, Salı=2, Çarşamba=3, Perşembe=4, Cuma=5, Cumartesi=6, Pazar=0)
- "startTime": Başlangıç saati "SS:DD" formatında (örn: "09:00")
- "endTime": Bitiş saati "SS:DD" formatında (örn: "11:50")
- "hours": O günkü dersin kaç ders saati sürdüğü (tam sayı, örn: 2 veya 3).
Sadece geçerli bir JSON dizisi döndür.`;

        let lastError = null;

        // ANAHTAR ROTASYONU (KEY ROTATION & FAILOVER)
        for (let i = 0; i < shuffledKeys.length; i++) {
            const currentKey = shuffledKeys[i];
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${currentKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: promptText },
                                    { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
                                ]
                            }],
                            generationConfig: {
                                response_mime_type: "application/json",
                                temperature: 0.1
                            }
                        })
                    }
                );

                // Eğer bu anahtar kotaya takıldıysa (429) veya geçici hata verdiyse hemen sıradaki anahtara geç
                if (!response.ok) {
                    lastError = `HTTP ${response.status}`;
                    continue;
                }

                const result = await response.json();
                const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
                const parsed = JSON.parse(rawJson);

                if (Array.isArray(parsed) && parsed.length > 0) {
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: parsed, usedKeyIndex: i })
                    };
                }
            } catch (innerErr) {
                lastError = innerErr.message;
                continue;
            }
        }

        // Tüm anahtarlar denendi ve başarısız olduysa (İstemci otomatik OCR'a düşecek)
        return {
            statusCode: 429,
            body: JSON.stringify({ error: 'ALL_KEYS_EXHAUSTED', details: lastError })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'SERVER_ERROR', message: err.message })
        };
    }
};