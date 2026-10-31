# Listing Fixer — V2 sabah teslimi

V2'nin gerçek Cardano preprod paid request'i ve ücret alınmayan kabul reddi doğrulandı. Goal'ın son yayın/tarayıcı kontrolü tamamlanınca gerçek araç durumu NEXT_GOAL_STATUS.md'ye kaydedilir.

- **V2:** http://localhost:3107/next
- **V2 ücretli sonuç:** http://localhost:3107/next?job=next_79721f59050ed46dc6cccef5de7394df
- **V2 ücret alınmayan ret:** http://localhost:3107/next?job=next_686079ceccc9fc622b09a8970793e65a
- **V1:** http://localhost:3107/ — mevcut ücretli sonuç: http://localhost:3107/?job=batch_3335c09a068c20633a3c8e1c
- **Repo:** https://github.com/ABerkeBora/heka-listing-fixer/tree/codex/next
- **V1 baseline:** `v1-baseline` → `4bb9d5b`; çalışan V1 commit'i `a36d5d6`. Etiket hareket ettirilmedi.

## V1 / V2 kısa karşılaştırma

V1 kaynak koruyan katalog hizmetini gerçek x402 ödemesiyle teslim eder; restart/duplicate kanıtı hazırdır. V2 aynı akışa alıcının ödeme yetkisinden önce seçtiği minimum hazır ürün sayısı ve izinli title/description alanlarını ekler. Koşul sağlanmazsa settlement istenmez; sağlanırsa koşul, input, result ve receipt tek manifestte birleşir.

**Sunum için V2 önerilir:** Alıcının hangi sonuca para vereceğini açıkça göstermesi ve gerçek ücret alınmayan ret ile yeni başarılı ödeme kanıtı, jüriye müşteri değerini daha net anlatır. V1 hazır bir yedektir. Canlı yeni model/chain çağrısı dış servis süresine bağlı olduğundan gösterim riski **medium**; kayıtlı doğrulanmış iş bağlantıları incelemeyi hemen açar. Gerçek müşteri pilotu yapılmadı; sentetik katalog üzerinde model ve test ağı işlemleri gerçektir.

## Gerçek kanıt

- **Yeni V2 işlem:** https://preprod.cardanoscan.io/transaction/7869104649f7723510e722ce0621078e81daf7fc6b4d9cb535d3fbebb19a21b2
- Satıcı **2 tADA**, ağ ücreti **0,168405 tADA**, toplam **2,168405 tADA**; yetki sınırı 2,3 tADA. Tek imza ve tek yerel settlement çağrısı. V2 alıcı bakiye kontrolü: **7,831595 tADA**.
- Input hash: `3335c09a068c20633a3c8e1ccd926c1269450653995cb2a762cbbac5603c25a2`.
- Acceptance hash: `1742cd9c1001c8297fa399f1eb22a2cf9b44168933ca51c163eabad0e0a4d73f`.
- Result hash: `432aaf5df15075ee53c0bcf0ed649c288c49463bc00ba29f277a8aff28b66e94`.
- Gerçek model sonucu **5 ready / 5 needs source / 33 değişiklik**. En az 5 koşulu geçti; aynı input'un en az 6 koşulu ayrı intent'te reddedildi.
- Rette gerçek model çalıştı, **0 settlement**, receipt ve paid export yok. İmzalı yetki süresi dolduktan sonra zincirde işlem yoktu ve girdiler harcanmamıştı. Bu tarihli snapshot sonraki başarılı ödeme öncesinde alındı; sonradan aynı girdilerin meşru yeni işte harcanması eski ret kanıtını bozmaz.

`docs/evidence/v2/` içindeki `payment-live.json`, `payment-chain.json` (**13 kontrol**), `delivery-verification.json` (**15**), `policy-verification.json` (**9**), `no-settlement-verification.json` (**10**) ve `v1-regression.json` (**6**) PASS. V1'in orijinal receipt/result/hash/tek imza kaydı korunuyor. Testler **57/57 PASS**, TypeScript + production build PASS, dependency audit 0 açık. Tarayıcı QA **12/12 PASS**: desktop 1440×900, tablet 768×1024 ve phone 390×844; ücretli teslim/ret, kaynak eksiği, hash doğrulaması ve V1 dönüşü. `browser-qa.json` ile 11 ekran görüntüsü mevcut. Kaynak yayını commit kaydı ayrıca eklenir.

## Açma ve yeniden kontrol

Sunucu port 3107'de açık bırakılır. Yeniden başlatmak gerekirse proje dizininde:

```sh
npm ci
npm run build
npm start
```

Mevcut `.env`, `.local/` ve SQLite dosyalarını koru. Fresh clone için `.env.example` kopyalanır ve ayrı küçük preprod cüzdanı gerekir; source checkout `codex/next`. Paylaşılan Ollama `qwen3:4b` servisini değiştirme.

```sh
npm run v2:verify-chain
npm run v2:verify-delivery
npm run v2:policy-proof
npm run v2:v1-regression
```

Aynı koşul ve input tekrarında `npm run v2:run` mevcut completed intent'i döndürür. İmzalı işlem veya veritabanı silerek retry yapma. `v2:verify-rejection` unspent snapshot'ını başarılı işten önce alır; eski PASS'i sonraki farklı gözlemle ezmez.

V2 `/api/next`, ayrı job/payment SQLite, `.local/v2/cardano-wallets.json` ve ayrı browser storage kullanır. V1 varsayılanları paylaşılmış validator kodunda korunur. Cüzdan hazırlığı için 10 tADA aktarımı ve 0,168581 tADA ücreti ayrıca `docs/evidence/v2-funding.json` içinde kayıtlıdır; bu hazırlık aktarımı müşteri ödemesi kanıtı değildir.

## Sınırlar ve kalanlar

Kabul kontrolü yerel uygulama politikasıdır; on-chain kalite hakemi, escrow, otomatik refund veya on-chain bütçe allowance yoktur. İmzalı yetki broadcast değildir. Yerel settlement çağrıları ölçülür; hosted facilitator'ın iç broadcast sayısı ölçülmez. Supplier kaynaklarının doğruluğu devralınır, schema-ready hukuki/güvenlik sertifikası değildir. Kaynak eksiği uydurularak doldurulmaz. Confirmed direct payment geri alınamaz.

Cardano/genel kurallar **31 Ekim 2026 04:42 CET**'te yeniden okundu, değişiklik yok. Teknik paid-request qualification PASS; bütün yarışma başvurusunun tamamlandığı iddiası yok. Kullanıcı/takım için kalanlar:

1. **10–15 dk:** PRESENTATION.md'deki en fazla 150 saniyelik videoyu kaydet.
2. **5–10 dk:** SUBMISSION_DRAFT.md, repo, V2 işlem ve video bağlantılarıyla Devfolio başvurusunu kullanıcı/takım tamamlasın. Son tarih **31 Ekim 2026 15:00 Europe/Berlin**; takım başına tek başvuru.

Hosting, mainnet işlem veya yarışma başvurusu yapılmadı. Gerçek müşteri pilotu bu teknik teslimin kanıtı olarak gösterilmedi.
