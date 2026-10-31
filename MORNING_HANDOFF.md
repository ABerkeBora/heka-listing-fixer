# Listing Fixer — sabah teslimi

**Gerçek Cardano preprod ödemesi ve kaynaklı katalog teslimi tamamlandı.** İlk fonlama engeli kullanıcı faucet adımıyla çözüldü. Satıcıya 2 tADA gitti; ağ ücreti 0,168581 tADA; toplam 2,168581 tADA, yetki sınırı 2,3 tADA. Kontrollü pending-settlement restart ve duplicate istekte aynı hash/tek imza korundu.

- Paid sonucu doğrudan aç: http://127.0.0.1:3107/?job=batch_3335c09a068c20633a3c8e1c
- Yeni kaynak incelemesi: http://127.0.0.1:3107
- Public repo: https://github.com/ABerkeBora/heka-listing-fixer — `codex/build`
- Dizin: `/Users/wargly/Documents/ChatGPT/Heka/projects/listing-fixer`
- [Gerçek işlem / Cardanoscan](https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0)
- Intent: `batch_3335c09a068c20633a3c8e1c`
- Sonuç hash'i: `05f15c335e49591d6e1d2d97dc295e817fb1d66ccc88f5dcec86a13871224095`

## Ne çalışıyor

10 ürün için JSON/CSV import, kaynak/diff/check görünümü, filtre/search ve ready-only dosyalar var. Gerçek ücretli Ollama qwen3:4b çağrısı10 kaynak kompozisyonu üretti. Teslimde **5 ready, 5 needs source, 33 değişiklik** var; fiyat/para birimi/üretici/güvenlik/sertifika alanları kaynakla korunuyor. Eksik alanlar tamamlanmış gibi sunulmuyor.

Alıcı agent tek initial mandate sonrası gerçek402 teklifi seçti, fiyat/seller/ağ/asset/endpoint/fee/expiry kontrolü yaptı, işlemi imzaladı ve isteği yürüttü. Model key veya arbitrary transaction yetkisi görmedi. Servis fiyatı2000000, fee cap300000, API cap0, total cap2300000 lovelace; max 1 ekonomik aksiyon. UI varsayılan fee cap0,5 tADA, CLI bu senaryoda0,3 tADA kullanıyor.

Receipt gelmeden uygulama kontrollü kapatıldı; CLI bağlantı kaybı gördü. Kalıcı signed bytes/intent/result ile yeniden başlatma ve agent reconciliation aynı işlemi tamamladı. Sonraki duplicate POST aynı completed intent/receipt/result döndürdü; imza sayısı 1 kaldı. CLI artık geçici polling hatalarını tolere eder ve mevcut signed intent için en fazla 4 uzlaştırma dener. Yeni iş/ödeme recovery döngüsünde oluşturulmaz.

## Açma ve yeniden doğrulama

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

Mevcut kurulumda server açıksa tekrar başlatmak gerekmez. Node 24+, yerel Ollama `qwen3:4b` gerekir. Paylaşılan Ollama süreci değiştirilmedi. App yalnız loopback 3107'yi dinler; ayrı cüzdan/env/DB kullanır. Repo global Git kimliğini değiştirmez; commit author/committer `ABerkeBora` hesabına bağlandı.

```sh
npm run cardano:preflight
npm run cardano:run
npm run cardano:verify
npm run cardano:policy-proof
npm run verify:delivery
```

Aynı sample tekrar çalıştırıldığında mevcut paid intent kullanılır. **Veritabanlarını ödeme retry için silme.** Yeni clone kendi cüzdanını `npm run cardano:wallets` ile oluşturur ve kendi test fonuna ihtiyaç duyar. Public repo private key/recovery phrase içermez.

## Kanıt ve kontroller

| Kanıt | Gerçek sonuç |
|---|---|
| `payment-live.json`, işlem-hash adlı arşiv ve `payment-live-result.json` | Confirmed receipt + aynı input/intent'e bağlı yararlı10 ürün sonucu |
| `payment-chain.json` | Bağımsız Koios/CBOR kontrolü **13/13 PASS**: seller2000000, fee168581, buyer change9997831419; hash/signature/input/output/value conservation ve canonical depth |
| `delivery-verification.json` | **53/53 PASS**: kaynak/sonuç hash, korunan alanlar, provenance, sayaçlar, gerçek JSON/CSV/report export'ları |
| `payment-restart.json` | Gerçek pending restart + bağlantı kaybı, recovery PASS, aynı tx, tek imza, duplicate ikinci ödeme yok |
| `payment-policy-live.json` | Gerçek teklif üzerinde düşük bütçe ve yanlış seller reddi; korunan durum değişmedi; ek ücret yok |
| `tests.txt`, `build.txt` | **37 test PASS**, TypeScript + production build PASS |
| `browser-qa.json`, `browser-paid-qa.json`, `ui-*.jpg` | Desktop/tablet/phone gerçek browser kontrolü; paid receipt ve kaynak sonucu |
| `dependency-audit.json`, `publish-scan.json` |0 bilinen dependency açığı; publishable tree'de seçilen wallet secret eşleşmesi yok |

## Güven sınırları

Bu direct-address x402 yolunda ayrı contract deploy edilmez. Bütçe sınırları local executor ve imzalanan işlem kontrolündedir; on-chain session allowance yok. Escrow, otomatik refund veya on-chain kalite hakemi uygulanmadı. Confirmed hizmet bedeli ve network fee sonraki kalite değerlendirmesiyle geri alınamaz. Ayrı fiyatlanmamış facilitator ücreti sıfır diye gösterilmez; ek API harcaması yetkilendirilmez.

İki cüzdan yerel test rolleri; gerçek müşteri satışı veya production geliri iddiası yok. Kaynaklar kullanıcı/tedarikçiden devralınır; schema-ready hukuki/ürün güvenliği sertifikası değildir. Sample katalog açıkça sentetiktir; **ödeme, model çalışması ve receipt ise gerçektir**. Cardano finality olasılıksaldır; bağımsız verifier güncel canonical depth'i tekrar okur.

## Sabah kalanlar

Onaylı yerel uygulama, entegrasyon, kanıt ve sunum taslağı teslimi tamamlandı. Competition submission ayrı izlenir:

1. **10–15dk:** `PRESENTATION.md` 150 saniyelik akışla videoyu kaydet; gerçek receipt/işlem ve kaynak eksiğini göster. Taslak hazır, kayıt henüz yok.
2. **5–10dk:** `SUBMISSION_DRAFT.md` ve repo/işlem/video bağlantılarını Devfolio'ya kullanıcı/takım eklesin. Başvuru gönderilmedi.

Resmî kurallar 04:15 Europe/Berlin'de yeniden kontrol edildi: son tarih **31 Ekim 2026 15:00 Europe/Berlin**, takım başına tek başvuru, en fazla üç partner track. Cardano working paid-request qualification ve tx kanıtı **PASS**; video ve Devfolio teslimi **PENDING**. Bütün submission şartları tamamlandı iddiası yok.

Goal durumu: **complete**, araçla doğrulandı (31 October 2026 at 04:25:12 CET). Bu durum onaylı uygulama/entegrasyon/kanıt ve taslak teslimi içindir; yukarıdaki video/Devfolio submission adımları kullanıcıya aittir.
