# Listing Fixer proje handoff'u

Durum: **Tarihsel onaylı brief. Uygulama 31 Ekim 2026 tarihinde ayrı chat ve aktif Goal ile başladı.** Güncel sonuç ve kanıtlar `MORNING_HANDOFF.md` / `TRACK_REQUIREMENTS.md` içindedir; aşağıdaki hazırlık durumları başlangıç tarihçesidir.

## Kimlik ve hedef

- Dizin: `/Users/wargly/Documents/ChatGPT/Heka/projects/listing-fixer`
- Track: yalnızca **Cardano — Agentic Commerce on Cardano**.
- Önerilen public repo: `ABerkeBora/heka-listing-fixer`; henüz oluşturulmadı.
- Yerel port: `3107`; kullanılabilirliği uygulama başlangıcında kontrol edilecek.
- Builder: GPT-6.1 Sol / ultra; inceleme hedefi 31 Ekim 2026 08.00–09.00 Europe/Berlin.
- Teslim: yerel uygulama + ayrı public repo. Hosted deploy, gerçek para ve mainnet işlemi yok.
- Ortak talimat: `/Users/wargly/Documents/ChatGPT/Heka/AGENTS.md`; diğer proje ve ortak dosyalar değiştirilmez.

## Müşteri ve satın alınan sonuç

Müşteri, tedarikçiden gelen ürün bilgilerini mağazasına aktaran küçük e-ticaret ekibidir. Satın aldığı sonuç, **10 ürünlük bir partinin tek hedef şemaya dönüştürülmesi, kaynak bağlantıları ve kontrol raporudur**. Agent karışık başlıkları/özellikleri anlamlandırır, sadece verilen güvenilir kaynaktan yeniden yazar veya tek hedef dile çevirir; kod şemayı, fiyat/kaynak tutarlılığını ve tekrarları kontrol eder.

Bu bir hukuki uygunluk veya GPSR sertifikası değildir. Bir alanın doldurulması bilginin doğru olduğunu göstermez; üretici/sorumlu kişi/güvenlik uyarısı/sertifika gibi kaynakta bulunmayan bilgiler kesinlikle üretilmez. Eksik bilgi ürün satırı üzerinde gerekçesiyle `Needs source` olur ve kullanıma hazır kayıt sayılmaz.

Cardano, bu dar hizmetin alıcı agent tarafından istek başına ödenmesini sağlar. Alıcı agent gerçek katalog ihtiyacı ve başlangıç bütçesiyle uygun hizmeti seçer, teklif/402 challenge'ını kontrol eder, gerçek preprod ödemesini yapar ve sonucu alır. Bir ücretli API eklemenin ürünün özgünlüğünü tek başına sağlamadığı bilinerek kaynak/diff/doğrulama işi iyi yapılır.

## Agentic payment sözleşmesi

| Konu | Bu ürünün sınırı |
| --- | --- |
| Ödeyen → alan | E-ticaret ekibinin sınırlı test bütçeli alıcı agent'ı → Listing Fixer seller hizmetinin sabit preprod adresi. |
| Satın alınan sonuç | En çok 10 ürün için kaynaklı hedef dosya, alan diff'i ve deterministik kontrol raporu. Yalnız token transferi veya kendimize ödeme gösterisi yeterli değildir. |
| Agent kararı | Girdi ihtiyacına göre izinli Listing Fixer hizmetinin şema/dil/parti boyutuna uyduğunu kontrol eder, quote bütçedeyse 402 isteğini öder ve receipt ile teslimi eşler. Yeni bir hizmet pazaryeri kurmak gerekmez. |
| İlk yetki | Kullanıcı kaynak partisini, hedef şema/dili, sabit seller/endpoint'i ve toplam bütçeli süreli mandate'i bir kez verir; sonraki quote doğrulama, ödeme ve sonuç alma agent tarafından yürür. |
| Kesin sınırlar | Cardano preprod, SDK'da doğrulanan tek asset; quote'taki tamsayı hizmet tutarı + ağ/facilitator ücreti için ayrı üst sınırlar, tek mantıksal batch ödemesi, expiry ve seller allowlist'i ödeme öncesi sabittir. Bütçe dışı quote'ta dur; yeni ücret veya top-up yok. |
| Kanıt | Batch/intent ve mandate, gerçek 402 challenge, alıcı ödeme transaction hash'i, seller receipt'i, ücret kırılımı ve o ödemeye bağlı faydalı sonuç. Brüt tutar, gerçek ağ/facilitator ücreti ve seller net alacağı ölçülebildiği şekilde ayrı görünür; bilinmeyen ücret sıfır diye gösterilmez. |

Agentic ödeme kullanıcının ürün şartıdır; Cardano'nun resmî paid-request şartı ve submission kanıtları ayrı checklist'te kalır. Her projede LLM çalıştırmanın yeni bir resmî qualification maddesi olduğu iddia edilmez. Bu üründe model kaynaklı taslak üretir, ödeme yetkisi ile katalog kabulü deterministik kontrollerde kalır.

## Kesin MVP

- En fazla 10 ürün, tek tedarikçi giriş örneği, tek hedef şema ve tek hedef dil.
- Kaynak CSV veya JSON, ayrıca kullanıcı tarafından sağlanan kısa kaynak metinleri/URL referansları. İlk sürüm arbitrary web browsing veya PDF/OCR gerektirmez.
- Agent kolonları eşleştirir; kaynaklı alanları normalleştirir/yeniden yazar. Değişen her alanın kaynak satırı/alanı kaydedilir.
- Deterministik kontroller: SKU benzersizliği, kayıt sayısı, fiyat ve para birimi tutarlılığı, zorunlu alanlar, boş/uygunsuz değerler ve kaynakta bulunmayan iddiaların işaretlenmesi.
- Alıcı agent tek sabit ücretli paid request'i gerçek katalog ihtiyacı/mandate'inden başlatır; ilk sürüm satır başına dinamik kısmi ödeme veya karmaşık refund sözleşmesi kurmaz.
- Sonuçta temizlenmiş dosya, alan bazında önce/sonra diff, geçerli/inceleme gerektiren kayıtlar ve gerçek ödeme receipt/explorer linki sunulur.

Gerçek Amazon/eBay hesabına yazma, listing yayınlama, çoklu dil, sınırsız katalog, yeni güvenlik/üretici bilgisi üretme, tam GPSR kararı, ayrı agent pazaryeri ve BSV/API3 entegrasyonu kapsam dışıdır. Kaynak verinin doğruluğu ve dış beyanların gerçekliği ayrıca varsayılır.

## Ödeme yolu ve ilk 45 dakika

İlk tercih **Cardano x402 Express paid-request** starter'ı:

- https://developers.cardano.org/templates/x402-express/
- https://developers.cardano.org/x402/

Resmî template Node.js 20+, ücretsiz Blockfrost project id, kendi ürettiği server-side preprod wallet ve faucet fonu tanımlıyor. Browser wallet veya Sokosumi hesabı bu dar yol için zorunlu gösterilmiyor. **Bunların hiçbiri bu proje için kurulmuş/fonlanmış/doğrulanmış değildir.** Exact sürümler, hangi asset'in ücretlendirileceği, seller adresi ve facilitator davranışı README/SDK'dan kontrol edilecek.

İlk 45 dakikada:

1. Prize page'in doğru Cardano tabını ve genel submission'ı yeniden oku; checklist zamanını yaz.
2. Resmî starter'ı incele; preprod Blockfrost erişimi, ayrı test wallet, seller adresi ve test fonu yolunu doğrula. Mnemonic/private key yalnızca izinli özel yerel dosyada saklanır; chat/log/screenshot'ta görünmez.
3. Starter'ın tek ücretli request'ini gerçek preprod'da alıcı agent üzerinden uçtan uca tamamla; başlangıç yetkisinden sonra ek manuel ödeme tıklaması olmasın. On-chain receipt, seller'a ödeme, ücret kırılımı ve iş kimliği kanıtını kaydet. Sadece terminalde “paid” yazması yeterli değildir.
4. Yerel Ollama `qwen3:4b` genel structured-output preflight'ı fixture girdileriyle **6,71 saniyede PASS** verdi (`../../docs/evidence/llm-preflight.json`). Bu ürünün kaynak bağlı katalog JSON üretimi PENDING; uygulama başlangıcında gerçek küçük katalog girdisiyle test et. Model yoksa kaynak koruyan deterministik kontrolleri bağımsız tamamla; model varmış gibi cevap üretme.
5. Katalog endpoint'ini küçük giriş/çıkışla paid request'e bağla. Alıcı agent'ın hizmet/quote seçimi, teslim ve receipt eşleştirmesini göster; bütçe aşan/yanlış seller veya duplicate intent'i engelle. Giriş hataları mümkünse ödeme talebinden önce tespit edilsin. Ödeme yapılmış bir uygulama hatasının iadesi için mevcut ödeme mekanizmasının desteklemediği garanti verme.

Cardano confirmed payment bazen bekleme gerektirir; kullanıcıya `Payment pending` ve gerçek transaction göster. Timeout sonrası yeni payment göndermeden önce önceki işlem uzlaştırılır. Ağ veya credential engeli bağımsız UI/veri kurallarını durdurmasın; qualification ise gerçek paid request gerçekleşene kadar `BLOCKED` kalır.

Mantıksal batch/intent kimliği, input hash'i, quote, ödeme receipt'i ve sonuç bağı kalıcı tutulur. SDK'nın idempotency/reconciliation desteği doğrulanmadan idempotency garantisi verilmez; gerekirse uygulama tek ödeme kilidi ve chain uzlaştırmasıyla ikinci gönderimi engeller. Retry/restart aynı batch'i tekrar ücretlendiremez. Yalnız uygulama kodunda olan sınırlar açıkça öyle etiketlenir; model key, rastgele seller veya serbest transaction üretmez.

## Agent'ın güvenli veri kuralları

- Kaynakta bulunmayan üretici, ürün güvenliği, uygunluk, sertifika, fiyat ve teknik özellik hiçbir şekilde tamamlanmaz.
- Metin çevirisi/iyileştirmesi kaynak anlamını genişletmez. Kaynak satır/alan referansı ve dönüşüm nedeni saklanır.
- LLM yalnızca yapılandırılmış taslak üretir; şema parse/validation, kaynak değerlerinin korunması ve kabul statüsü kodla kontrol edilir.
- Prompt injection içerebilecek ürün metinleri veri olarak ele alınır; modelin araçlara, cüzdan anahtarına veya shell'e erişimi olmaz.
- Şüpheli/eksik satırlar çıktı raporunda ayrı tutulur. On kayıt alındığında kaçının hazır/inceleme gerektirdiği aynı veri kaynağından hesaplanır.

## Tasarım ve ekranlar

İngilizce UI; açık utility arayüz, düz teal vurgu, iyi hizalanmış ürün tablosu. İlk ekranın sorusu: **“Bu parti içinden hangi ürünler aktarılmaya hazır, hangileri hangi kaynağı bekliyor?”**

Tek çalışma alanında giriş partisi, ürün listesi ve seçili satırın kaynak/diff/doğrulama detayı. Küçük satın alma paneli alıcı agent'ın seçtiği hizmeti, mandate/kalan bütçeyi, gerçek ücret kırılımını, seller receipt'ini ve sonucu gösterir. Ana eylemler `Review catalog`, `Start catalog agent`, `View changes`, `Download checked file`. Başlangıç yetkisi sonrasında 402 ödeme ve teslim adımları kendiliğinden ilerler; her ödemeye ayrı insan düğmesi koyma. Eksik kaynak görünür; bütün satırları yeşil yapan sahte başarı akışı yok.

Creator stüdyosu, esport skor tahtası veya genel crypto KPI dashboard'u düzenini kullanma. TasteSkill uygulama ekranı akışı; desktop/tablet/phone gerçek görüntü kontrolü. “Demo” yazısı her yerde yok; örnek dataset ve ağ bilgisi kısa tek bir yerde doğru belirtilir.

## Durumlar ve doğrulama

- Input empty/invalid, mandate ready, service selected/quoted, quote rejected/budget exhausted, payment required, payment pending, paid/processing, result ready, needs source, processing failed, receipt unresolved.
- Hatalı şema, 10'dan fazla satır, yinelenen SKU, fiyat/para birimi değişikliği, kaynaksız güvenlik iddiası, modelin geçersiz JSON'u ve ödeme hatası görünür biçimde ele alınır.
- Payment retry tek mantıksal işi tekrar ücretlendirmesin; SDK'nın idempotency/reconciliation desteği doğrulansın. Destek varsayılmasın.
- Gerçek yetkili alıcı-agent ödemesinin yanında bütçe aşan/yanlış seller veya duplicate intent için bir bloklama kanıtı göster; ödeme, receipt ve teslimi ayrı durumlar olarak doğrula.
- Fixture sonuçları gerçek ödeme veya model çıktısı olarak gösterilmez. Başarılı UI tek başına seller receipt kanıtı değildir.
- Masumi alternatifi sonradan seçilirse gerçek refund authorization/dispute lifecycle'ı kullanılır. Mevcut kalite kontrolünün otomatik zorunlu on-chain refund yarattığı iddia edilmez.

## 2,5 dakikalık gösterim

- 0.00–0.25: e-ticaret ekibinin karışık 10 ürünlük girdisi, bütçeli mandate ve satın aldığı somut çıktı.
- 0.25–0.55: alıcı agent'ın uygun hizmet/quote kararı, gerçek preprod 402 ödemesi ve seller receipt'i.
- 0.55–1.35: kaynak bağlı normalleştirme, yakalanan fiyat/SKU hatası ve kaynaksız bilginin `Needs source` olması.
- 1.35–2.05: temiz dosya/diff/rapor ve aynı intent'in ikinci kez ücretlenmemesi; bütçe/izin dışı bir denemenin bloklanması.
- 2.05–2.30: gerçek preprod explorer, seller net ücret/receipt kanıtı, kapsam ve tekrar çalıştırma.

## Teslim ve sabah handoff'u

README'de exact setup/start, private env konumları (değerler olmadan), `.env.example`, lockfile, test verisi hazırlama ve paid scenario komutları olsun. Production build ve veri/ödeme için anlamlı kontroller çalıştırılsın. Görsel walkthrough ve ekran görüntüleri kaydedilsin. GitHub CLI ABerkeBora doğrulandı; bu proje reposu henüz açılmadı ve source push yapılmadı. Public repo secrets tarandıktan sonra hazırlanır.

`MORNING_HANDOFF.md` localhost URL'si, repo linki, paid request ve seller receipt kanıtı, model kontrolü, kalan işler ve tahmini eforu içerir. Muhtemel engeller: Blockfrost hesabı/anahtarı, test fonu, facilitator beklemesi, model endpoint'i, alan sözleşmesinin kesinleşmesi ve GitHub erişimi. Eksik fon/ödeme qualification'ı etkiler; eksik ürün kaynağı ise ilgili satırın hazır sayılmasını engeller. Bütün katalog hukuken onaylanmış gibi raporlama.

**Ortak hazırlık sınırı:** GitHub/LLM setup'ı doğrulandı; Cardano Blockfrost erişimi, preprod cüzdanı ve test fonu henüz hazır değil. Altı API3 adayına verilen Base Sepolia ETH/aUSD bu Cardano projesinin ödeme veya fon kanıtı değildir. Uygulama/qualification PENDING; BSV standart-wallet gerçek transaction yolu da henüz gösterilmedi.

Güncel ve kendi başına çalışan proje kaynakları: [README](README.md), [katalog doğrulama](docs/CATALOG.md), [ödeme sınırları](docs/PAYMENTS.md), [gerçek uygulama kanıtları](docs/evidence/VERIFICATION.md). Önceki ortak setup kanıtı uygulama qualification kanıtı olarak kullanılmadı.
