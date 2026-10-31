# Listing Fixer — sabah teslimi

**Yerel ürün incelemeye hazır; Cardano qualification ve gerçek agent ödemesi tamamlanmadı.** Alıcı cüzdan bakiyesi0. İnsan faucet doğrulaması/test fonu bekleniyor. Goal tamamlandı olarak işaretlenmedi.

- Aç: http://127.0.0.1:3107
- Public repo: https://github.com/ABerkeBora/heka-listing-fixer
- Dizin: `/Users/wargly/Documents/ChatGPT/Heka/projects/listing-fixer`
- Branch: `codex/build`; public source push doğrulandı (`57a9f4a`); GitHub author ve committer login'leri `ABerkeBora`. Son dokümantasyon güncellemeleri aynı branch'tedir.
- Hedef inceleme:31 Ekim 2026 08:00–09:00 Europe/Berlin. Bağımsız build işleri erken tamamlandı; hosted deploy veya yarışma başvurusu yapılmadı.

## Ne çalışıyor

- JSON/CSV ile1–10 ürün, tek İngilizce şema; aynı kaynaktan hesaplanan ready/needs-source sayıları.
- Kaynak→değişiklik→kontrol detayı, filtre/search, ready-only CSV/JSON ve tüm satırları kapsayan rapor.
- Gerçek Ollama qwen3:4b akışı: tam10 ürün, 10 kabul edilen kaynak kompozisyonu, 0 ret, fiyatlar korundu.5 ürün eksik kaynak yüzünden hâlâ ready değil.102.623sn, küçük ardışık çağrılar. Bu **ücretsiz entegrasyon testi**dir; paid receipt değildir.
- Ayrı payer/seller rolleri; sabit preprod/lovelace/seller/endpoint/beneficiary, tamsayı service+network+APIcap0+total, tek mantıksal batch ve expiry.
- Gerçek x402402 challenge. Bütçe/yanlış alıcı/asset/endpoint/fee/timing/receipt müdahaleleri reddediliyor. Model key veya işlem aracı görmüyor.
- Kalıcı input/intent/signedbytes/hash/receipt bağı, unsigned crash recovery, signed-byte reconciliation, eşzamanlı duplicate kilidi; ücretsiz kontrol veya faydasız model sonucu settlement'a gönderilmiyor.
- İş pointer'ı yenilemede aynı girdiyi açıyor; kaynak preview ile paid result ayrı. Gerçek ödeme olmadığı için on-chain başarı ekranı doğrulanmış sayılmıyor.

## Çalıştırma

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

Node 24+ gerekir. Ollama varsa `http://127.0.0.1:11434`, model `qwen3:4b`; paylaşılan süreç değiştirilmedi. App sadece loopback3107'yi dinler. Açık sunucu kapanırsa `npm start` yeterli.

## Dış engel ve en küçük sabah adımı

1. **5–10dk + faucet/ağ bekleme:** [resmî Cardano faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) üzerinde **Preprod** seçip insan reCAPTCHA'sını tamamla; aşağıdaki alıcıya test ADA sağla. İncelemede faucet ücretsiz kota uyarısı da gösteriyordu. Masumi dispenser alternatifinde kayıt e-postası doğrulama kodu gerekiyor; erişim bulunmadı. Ücretli servis veya mainnet kullanılmadı.

   Buyer:
   `addr_test1qr8dn6eysm3fp68f8gsrcxtvhqewztsutc7asvzk43s0fs7edlkjxxvq4qhdegzkn5gy06xqk7ktqdd3ulrmxxu4r55q0zvpkc`

  5 test ADA önerilen minimum **fonlama**; ücret değil. UI service2tADA + fee cap0.5tADA = totalcap2.5tADA; CLI senaryosu2+0.3=2.3tADA. Change UTXO için yeterli fon bırakılır. Seller farklı adrestir; public adresler preflight kanıtında bulunur.

2. **3–5dk:** server açıkken:

   ```sh
   npm run cardano:preflight
   npm run cardano:run
   ```

   Preflight bakiye/facilitator'ı gerçek okur. `cardano:run` bir initial bounded delegation verir; quote/sign/request/result adımlarını agent yürütür. Aynı input aynı intent'i kullanır. Başarılı gerçek işlem `docs/evidence/payment-live.json`, receipt/result ve işlem-hash adlı arşiv dosyalarına yazılır. Şu an komutun exit2 vermesi ve BLOCKED yazması doğru davranış. Yeni ödeme için veritabanını silme. Timeout varsa app'te **Check existing payment** kullan; aynı signed bytes uzlaştırılır.

3. **5–10dk:** gerçek seller output/fee/receipt/result doğrulandıktan sonra TRACK_REQUIREMENTS'daki ilgili BLOCKED/PENDING maddelerini kanıtla güncelle; canlı duplicate/timeout senaryosunu çalıştır. Gerçekchainfailure-path henüz test edilmiş sayılmıyor.
4. **10–15dk:** `PRESENTATION.md` akışıyla en fazla150s video kaydet. `SUBMISSION_DRAFT.md` metnini gerçek tx ile tamamla. Devfolio gönderimini kullanıcı yapar. Resmî son tarih31 Ekim 15:00 Europe/Berlin; takım başına tek başvuru/en fazla üç partnertrack kuralını koordinasyonda dikkate al.

Blockfrost anahtarı artık zorunlu engel değil: resmî SDK'nın ücretsiz Koios sağlayıcısı gerçek UTXO okuyor; CF hosted facilitator erişilebilir. **Eksik olan gerçek test fonu ve tamamlanmış paid request**.

## Kanıt ve kontroller

- `docs/evidence/catalog-llm-full.json`: tam10 ürün gerçek model + validator.
- `payment-preflight.json`: gerçek Koios/facilitator ve bakiye0.
- `payment-challenge.json`: aynı batch'in gerçek402'si, henüz imza/ödeme yok.
- `payment-live.json`: gerçek app denemesi **BLOCKED**, transaction/receipt/result yok.
- `server-checks.json`: gerçek HTTP input/red/duplicate/paid-export kontrolü.
- `tests.txt`: **33/33 PASS**; `build.txt`: TypeScript + production build PASS.
- `dependency-audit.json`:0 bilinen açık. Starter2.26'dan patched2.29'a kontrollü güncelleme yapıldı.
- `ui-*.jpg`, `browser-qa.json`: gerçek browser desktop1440×900, tablet768×1024, phone390×844. TasteSkill rawCDP inspector yerine izinli CUA yolu kullanıldı.
- `publish-scan.json`: kendi buyer/seller recovery phrase'ları publishable tree ile içerik göstermeden karşılaştırıldı; eşleşme yok. `.local`, `.env`, SQLite ve build çıktıları ignored.

## Sınırlar

Caps local executor/transaction validator tarafından uygulanıyor; on-chain session budget yok. Direct x402 adres ödemesinde escrow, otomatik refund veya on-chain kalite hakemi yok; confirmed payment/networkfee sonradan kaynak kontrolü başarısız diye geri alınamaz. Facilitator ayrıca fiyatlandırılmayan ücreti0diye gösterilmez; ek API harcaması yetkilendirilmez. Kaynak gerçekliği devralınır, schema-ready hukuki/ürün güvenliği onayı değildir. Sample tedarikçi verisi ve `.example` kaynaklar açıkça sentetiktir.

Zorunlu eksikler: gerçek preprod ödeme+hash+receipt+teslim **BLOCKED**; canlı retry/timeout kanıtı ve video/Devfolio submission **PENDING**. Tamamlanmış qualification iddiası yok.
