---
name: pwa-architecture-guard
description: UniTool PWA mimarisini, dahili CSS utility sistemini, Service Worker önbellek sürümlemesini ve sunucusuz API güvenliğini koruma kuralları.
---

# Skill: PWA Architecture & Inline CSS Guard

## Amaç
Bu yetenek, AI coding agent'ın UniTool üzerinde yeni özellik geliştirirken veya hata düzeltirken mevcut bağımsız (zero-dependency) PWA mimarisini, özel CSS sınıf yapısını ve Service Worker güncelleme döngüsünü bozmasını engeller.

## Mimari Kurallar ve Kısıtlamalar

1. **Harici CSS / Tailwind CDN Yasağı:**
   - Projede harici bir Tailwind CSS CDN bağlantısı kullanılmamaktadır.
   - Tüm utility sınıfları `index.html` içindeki `<style>` bloğunda özel olarak tanımlanmıştır.
   - Yeni bir HTML bileşeni eklerken yalnızca `<style>` bloğunda mevcut olan sınıfları kullan. Eğer yeni bir sınıf (renk, boşluk, esnek kutu vb.) gerekiyorsa, mutlaka `<style>` etiketi içine karşılık gelen CSS kuralını ekle.

2. **Modül Bütünlüğü:**
   - Uygulama 4 ana modülden oluşur: `view-attendance` (Devamsızlık), `view-schedule` (Haftalık Program & Gemini Vision), `view-gpa` (GPA & Hedef Analizi) ve `view-exam` (Vize/Final & Çan).
   - Bir modülde değişiklik yaparken diğer modüllerin DOM referanslarını, sekme geçiş (`switchTab`) mantığını veya `.ics` takvim çıktısı üreticisini (`exportScheduleToICS`) silme veya devre dışı bırakma.

3. **Service Worker ve Sürüm Senkronizasyonu (`sw.js`):**
   - `index.html` üzerinde yapılan her anlamlı arayüz veya mantık değişikliğinden sonra `sw.js` içindeki `CACHE_NAME` sabitini bir üst sürüme yükselt (örn: `unitool-static-v4.3` -> `unitool-static-v4.4`).
   - Aynı sürüm numarasını `index.html` içindeki `<title>`, yan menü (`#sideDrawer`) ve `exportAllDataJSON` fonksiyonundaki `version` alanına da yansıt.

4. **API Anahtarı Güvenliği:**
   - Gemini API anahtarlarını asla doğrudan istemci koduna (`index.html`) düz metin olarak gömme.
   - Görsel çözümleme isteklerini her zaman önce sunucu fonksiyonuna (`/.netlify/functions/parse-schedule`) yönlendir ve katı `response_schema` yapısını koru.

## Doğrulama Adımları
- Değişiklik sonrası `<style>` bloğunda tanımsız sınıf kullanılmadığını kontrol et.
- `sw.js` önbellek adının güncellendiğini doğrula.
- Mobil güvenli alan (`env(safe-area-inset-*)`) boşluklarının korunduğunu teyit et.