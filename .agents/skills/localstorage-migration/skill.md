---
name: localstorage-migration
description: Sunucusuz (localStorage tabanlı) UniTool uygulamasında veri şeması değişikliklerini kullanıcı verilerini silmeden geriye dönük uyumlu (backward-compatible) şekilde gerçekleştirme standartları.
---

# Skill: LocalStorage Schema Migration & Data Integrity

## Amaç
UniTool tüm kullanıcı verilerini tarayıcının `localStorage` alanında saklar. Bu yetenek, veri modellerine yeni alanlar eklendiğinde (örneğin devamsızlık sayacına tarih geçmişi eklenmesi) mevcut kullanıcıların kayıtlı derslerinin ve notlarının sıfırlanmamasını sağlar.

## Aktif LocalStorage Anahtarları
- `unitool_courses`: Devamsızlık takibi yapılan derslerin listesi.
- `unitool_schedule`: Haftalık ders programı blokları.
- `unitool_att_logs`: Günlük yoklama bildirim yanıtları (`YYYY-MM-DD_id`).
- `unitool_gpa_courses`: GPA hesaplayıcı dersleri ve harf notları.
- `unitool_gpa_settings`: Not sistemi ölçeği, geçmiş AKTS/GANO ve hedef GANO ayarları.
- `unitool_saved_exams`: Kaydedilmiş vize/final ve çan hesaplamaları.

## Veri Göçü (Migration) Kuralları

1. **Kesintisiz Şema Güncellemesi (Non-Destructive Update):**
   - Mevcut bir nesne yapısına yeni bir özellik eklendiğinde (örn: `course.absenceHistory = []`), eski sürümden kalan nesnelerde bu alan `undefined` gelecektir.
   - Uygulama açılışında (`renderCourses()` çağrılmadan hemen önce) mutlaka idempotent (birden fazla kez çalışsa da veriyi bozmayan) bir `migrateData()` fonksiyonu çalıştır.

2. **Geçmiş Veri Mutabakatı (Reconciliation):**
   - Sayısal bir toplam alanı, detaylı bir kayıt dizisine dönüştürülürken eski toplam ile dizi toplamı karşılaştırılmalıdır.
   - Örnek Kural: Eğer `course.currentAbsence` değeri, `course.absenceHistory` içindeki saatlerin toplamından büyükse, aradaki fark `{ id: 'legacy_' + Date.now(), date: 'Güncelleme Öncesi', hours: fark, type: 'legacy' }` kaydı olarak diziye otomatik eklenmelidir.

3. **Yedekleme ve Geri Yükleme Uyumluluğu (`JSON Export/Import`):**
   - `exportAllDataJSON()` fonksiyonu yeni veri alanlarını eksiksiz dışa aktarmalıdır.
   - `importAllDataJSON()` fonksiyonu eski bir yedek dosyasını içeri aktardığında, veriyi `localStorage`'a kaydetmeden önce mutlaka migration fonksiyonundan geçirmelidir.

## Doğrulama Adımları
- Eski veri formatına sahip bir `localStorage` kaydıyla sayfa yenilendiğinde konsolda `TypeError` (örn: `Cannot read properties of undefined`) oluşmadığını doğrula.
- Güncelleme öncesi girilmiş sayısal değerlerin güncelleme sonrasında korunduğunu kontrol et.