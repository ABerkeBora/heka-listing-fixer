# Listing Fixer — track şartları ve kanıt durumu

Seçilen sponsor yalnız **Cardano — Agentic Commerce on Cardano**. API3/BSV bu projeye seçilmedi. Başlangıç kontrolü31 Ekim 2026 **03:39 Europe/Berlin**, final yeniden kontrolü **03:53 Europe/Berlin**: gerçek Cardano sekmesi seçildi; qualification, submission, judging, örnekler ve genel submission ayrı okundu. Sayfa hash'inin varsayılan BSV içeriğini gösterme riski browser seçimiyle giderildi. Önceki hazırlık kontrolü03:02 idi.

## Resmî kaynaklar

- [Cardano track](https://hackathon.tum-blockchain.com/prizes#cardano)
- [Genel submission](https://hackathon.tum-blockchain.com/prizes#how-to-submit)
- [Cardano x402 rehberi](https://developers.cardano.org/x402/)
- [Seçilen Express starter](https://developers.cardano.org/templates/x402-express/)
- [Starter kaynak/README](https://github.com/cardano-foundation/developer-portal/tree/staging/examples/templates/x402-express)
- [Exact Cardano şeması](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md)

Final check özeti: `docs/evidence/rules-cardano-final.txt`, `rules-general-final.txt`. Kural değişikliği saptanmadı. Son tarih **31 Ekim 2026 15:00 Europe/Berlin**. Genel kurallar **takım başına tek başvuru**, en fazla üç partner track diyor; yedi ayrı repo, yedi takım başvurusu izni olarak yorumlanmadı. Başvuru gönderilmedi.

## Zorunlu qualification

| Şart | Uygulama | Kanıt | Durum |
|---|---|---|---|
| Çalışan faydalı agent/hizmet |10 ürün, kaynak/diff/şema; kaynak seçen gerçek model ve deterministik kabul | `server/catalog/`, `catalog-llm-full.json`:10 kabul,0 ret, fiyatlar korunuyor; browser ekranları | PASS |
| Cardano preprod üzerinde en az bir ücretli iş/request tamamlanması | Sabit seller'a2tADA direct x402 request; ilk bounded delegation sonrası agent imzalar | `payment-preflight.json`: gerçek sağlayıcı+facilitator, bakiye0; `payment-live.json`: gerçek deneme BLOCKED; tx/receipt yok | BLOCKED |

**Sonuç: Cardano qualification tamamlanmadı.** Ulaşılabilir provider, cüzdan üretimi, HTTP402 ve başarılı model çağrısı gerçek ödeme yerine geçmez. İnsan faucet doğrulaması ve test ADA gerekir. Blockfrost anahtarı bu sürümde zorunlu engel değil; resmî SDK'nın ücretsiz Koios sağlayıcısı çalışıyor.

## Track'e özel zorunlu submission

| Şart | Uygulama/kanıt | Durum |
|---|---|---|
| Ücretli preprod işlem hash'i | Henüz yok. `npm run cardano:run` gerçek receipt/result kaydı üretir; sahte hash kullanılmaz | BLOCKED |
| Videoda müşteri/problem/iş modeli ve uçtan uca ücretli görev | `PRESENTATION.md`150 saniyelik taslak; gerçek ödeme sonrası kayıt gerekir | PENDING |
| Açıklamada çalışma/Cardano araçları/gerçek kullanım | `README.md`, `docs/PAYMENTS.md`, `SUBMISSION_DRAFT.md`; taslak mevcut, Devfolio'ya gönderilmedi | PENDING |

## Genel zorunlu submission

| Şart | Kanıt | Durum |
|---|---|---|
| En fazla2.5dakika video | Sunum akışı hazır; video kaydedilmedi | PENDING |
| Detaylı Devfolio açıklaması | Taslak hazır, kullanıcı ayrı yetki vermeden gönderilmeyecek | PENDING |
| Public repo + standalone setup/run README | [ABerkeBora/heka-listing-fixer](https://github.com/ABerkeBora/heka-listing-fixer), public `codex/build`, kaynak commit `57a9f4a`; standalone README + lockfile + env örneği; `repository.json` | PASS |

## Kullanıcı ürün şartı: agentic payment

Bunlar resmî sponsor şartına eklenen kullanıcı acceptance ölçütleridir.

| Gereksinim | Uygulama/kanıt | Durum |
|---|---|---|
| Payer→seller, sonuç, ilk mandate ve tamsayı sınırlar | `server/payment/policy.ts`; network/asset/seller/tool/beneficiary, service/network/APIcap0/total, max1, expiry; UI mandate | PASS |
| İlk yetki sonrası gerçek ekonomik adım | Buyer `execute` gerçek SDK ile sign/submit/retrieve yolunu yürütür; mevcut bakiye0 | BLOCKED |
| Yanlış seller/bütçe/asset/endpoint ve duplicate intent retleri | `tests/payment-policy.test.ts`, `payment-service.test.ts`, `jobs.test.ts`; gerçek402 offer değiştirme retleri `payment-challenge.json` | PASS |
| Retry/restart ikinci ödeme yaratmaz | Kalıcı payload/tx/input unique binding; unsigned recovery ve signed-byte reuse testleri. Canlı timeout/receipt testi fon sonrası gerekir | PENDING |
| Gerçek intent/validator/tx/receipt/teslim kanıtı | Intent ve challenge var; işlem/receipt/paid result yok | BLOCKED |

## Teknik doğrulama ve güven sınırları

- Resmî starter2.26.0 temel alındı. Eski Zod bağımlılığındaki açığı gidermek için exact SDK**2.29.0**, Express5.3.0, Zod4.6.7 seçildi; Evolution0.5.14 korundu.33 test/build geçti; final audit0 bilinen açık raporluyor. Sürümler lockfile'da sabit.
- Direct address, lovelace, Cardano preprod; bu yol için ayrı contract deploy edilmez. Escrow/refund/on-chain kalite hakemi yok. Model key/destination/call yetkisi görmez. Bütçe sınırları uygulama ve imzalanan işlem kontrolündedir; on-chain session allowance iddiası yok.
- Seller brüt hizmet miktarı ve gerçek exactnetworkfee ayrıdır; facilitator ayrıca fiyatlandırılmamış ise sıfır diye gösterilmez. Ek API ödemesi yetkilendirilmez. Kaynak doğruluğu kullanıcı/tedarikçiden devralınır; şema uygunluğu hukuki veya ürün güvenliği sertifikası değildir.
- Judging tercihleri (yaratıcılık, müşteri, kaliteli UX, result-linked ödeme) zorunlu escrow şartı olarak yorumlanmadı. Masumi alternatif setup'taki optional ödeme adımı zorunlu prize qualification'ı kaldırmaz.

Eksik zorunlu maddeler `MORNING_HANDOFF.md` içinde etki ve en küçük kalan adımla taşınır.
