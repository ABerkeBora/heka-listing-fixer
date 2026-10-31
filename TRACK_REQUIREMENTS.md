# Listing Fixer — track şartları ve kanıt durumu

Seçilen sponsor yalnız **Cardano — Agentic Commerce on Cardano**. API3/BSV seçilmedi. Başlangıç kontrolü31 Ekim 2026 **03:39 Europe/Berlin**; ödeme sonrası final kontrolü **04:15 Europe/Berlin**. Gerçek Cardano sekmesi seçildi; qualification, submission, judging, örnekler ve genel submission ayrı okundu. Varsayılan BSV içeriği kullanılmadı; kural değişikliği saptanmadı.

## Resmî kaynaklar

- [Cardano track](https://hackathon.tum-blockchain.com/prizes#cardano)
- [Genel submission](https://hackathon.tum-blockchain.com/prizes#how-to-submit)
- [Cardano x402 rehberi](https://developers.cardano.org/x402/)
- [Seçilen Express starter](https://developers.cardano.org/templates/x402-express/)
- [Starter kaynak/README](https://github.com/cardano-foundation/developer-portal/tree/staging/examples/templates/x402-express)
- [Exact Cardano şeması](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md)

Kontrol özetleri: `docs/evidence/rules-cardano-final.txt`, `rules-general-final.txt`. Son tarih **31 Ekim 2026 15:00 Europe/Berlin**. Takım başına tek Devfolio başvurusu, en fazla üç partner track; TUM track otomatik. Başvuru gönderilmedi.

## Zorunlu qualification

| Şart | Uygulama | Gerçek kanıt | Durum |
|---|---|---|---|
| Çalışan faydalı agent/hizmet |10 ürün, kaynak seçen gerçek model, bağımsız kabul, JSON/CSV/diff/report | `payment-live-result.json`, `delivery-verification.json`:53 kontrol,10 faydalı kompozisyon,5 ready/5 needs source | PASS |
| Cardano preprod üzerinde en az bir ücretli iş/request tamamlanması | İlk bounded delegation sonrası buyer agent direct x402 isteğini ödedi | [1305799c…66dc0](https://preprod.cardanoscan.io/transaction/1305799c411826f9f8463db3b9067913db0286da42320a2297c265aafcd66dc0); `payment-live.json`, `payment-chain.json`13/13 | PASS |

Teknik paid-request qualification kanıtlandı. Bu, aşağıdaki tüm submission teslimlerinin yapıldığı anlamına gelmez. Önceki bakiye0/faucet engeli kullanıcı fonlamasıyla çözüldü; geçmiş audit kayıtları tarihçedir.

## Track'e özel zorunlu submission

| Şart | Kanıt / kalan iş | Durum |
|---|---|---|
| Gerçek ücretli preprod işlem hash'i | İşlem linki + confirmed receipt + aynı input/intent'e bağlı sonuç | PASS |
| Videoda müşteri/problem/iş modeli ve uçtan uca ücretli görev | `PRESENTATION.md` 150s taslak, gerçek paid UI ekranları ve trace var; video kaydı yapılmadı | PENDING |
| Açıklamada çalışma/Cardano araçları/gerçek kullanım | `README.md`, `docs/PAYMENTS.md`, `SUBMISSION_DRAFT.md` içerik hazır; Devfolio'ya kullanıcı ekleyecek | PENDING |

## Genel zorunlu submission

| Şart | Kanıt / kalan iş | Durum |
|---|---|---|
| En fazla2.5dakika video | Sunum taslağı hazır; kayıt bekliyor | PENDING |
| Detaylı Devfolio açıklaması | Kaynaklı taslak hazır; başvuru gönderimi yapılmadı | PENDING |
| Public repo ve standalone setup/run README | [ABerkeBora/heka-listing-fixer](https://github.com/ABerkeBora/heka-listing-fixer), public `codex/build`, doğru kullanıcı commit kimliği; README/env örneği/lockfile | PASS |

## Kullanıcı acceptance: agentic payment

Bunlar sponsor qualification'ına ek ürün şartlarıdır.

| Gereksinim | Uygulama / gerçek kanıt | Durum |
|---|---|---|
| Payer→seller, sonuç, ilk mandate ve tamsayı sınırlar | Network/asset/seller/endpoint/tool/beneficiary, service2000000, fee300000, API0, total2300000, expiry, max1; `payment-live.json` | PASS |
| İlk yetki sonrası gerçek ekonomik adım | Agent quote/transaction kontrolü, imza, request ve settlement; seller2000000, actualfee168581 | PASS |
| Bütçe/yanlış seller/asset/endpoint ve duplicate engeli | `payment-policy-live.json` gerçek offer replays; `payment-restart.json` aynı completed input, tek imza/tx; unit failure cases | PASS |
| Timeout/restart ikinci ödeme yaratmaz | Receipt öncesi gerçek process fault, CLI bağlantı kaybı, kalıcı payload ile recovery; aynı hash, signature count1, sonraki duplicate state unchanged | PASS |
| Intent/validator/tx/receipt/result ve bağımsız doğrulama | `payment-live.json`, `payment-chain.json`, `delivery-verification.json` | PASS |

## Teknik sınırlar ve optional judging

- SDK2.29.0, Evolution0.5.14, Express5.3.0; lockfile sabit.37 test/build PASS; audit0 bilinen açık. Starter2.26'nın eski validation bağımlılığı kontrollü yükseltildi.
- Direct-address lovelace/preprod; ayrı contract deploy edilmez. Caps uygulama ve imzalanan işlem kontrolündedir; on-chain budget allowance yok. Escrow/refund/on-chain kalite hakemi yok.
- Satıcı brüt/net çıktısı2tADA ve ağ ücreti 0,168581tADA ayrı doğrulandı. Ayrı fiyatlanmayan facilitator ücreti uydurulmaz; API cap0. Kaynak doğruluğu devralınır; schema-ready hukuki/ürün güvenliği onayı değildir.
- Müşteri, yararlı sonuç, özgünlük, teknik kalite, UX ve açık gösterim judging tercihleri olarak ele alındı. Escrow/refund örnekleri bu dar x402 yoluna zorunluluk olarak eklenmedi.

Eksik submission maddeleri `MORNING_HANDOFF.md` içinde en küçük kalan adımlarla taşınır. Onaylı build teslimi sunum **taslağı** ve başvuru **taslağı** içerir; actual video/Devfolio submission ayrı kullanıcı işidir.
