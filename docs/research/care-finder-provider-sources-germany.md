# Care Finder: provider-source strategy for Germany

Checked: 8 October 2026. Scope: Germany, with statutory insurance (GKV) and the DRK deployment in mind.

- **[verified 2026-10-08]** means the named page, document, file or endpoint was opened in this pass.
- **[not published]** means no public price, API, file or measured rate was found; it does not prove that a private offer does not exist.
- A search UI is not permission to scrape it. Without a licence or contract, VYVA should link or negotiate access.

## 1. Verdict

Germany still has no Spain-like, openly licensed national register covering all authorised care. The first draft's broad conclusion was right, but it missed three practical routes:

1. **Use 116117 as the GKV route now, then integrate its regulated third-party appointment interface.** The interface is documented and priced. It can search, book and cancel appointments and request a referral code, but requires certification, a hardware-backed VPN and credentials; practices may object to third-party distribution. **[verified 2026-10-08]**
2. **License the doctor directory rather than scrape one.** Stiftung Gesundheit offers its Strukturverzeichnis to website/app partners through an API, with weekly change files. It includes doctors, dentists, psychotherapists, clinics, rehabilitation, emergency providers and non-medical therapists. Price and reuse scope are contractual. **[verified 2026-10-08]** This is the most realistic nationwide place dataset while DRK asks KBV/KVs for an official extract.
3. **Import the official Bundes-Klinik-Atlas export for hospitals, subject to written reuse confirmation.** The live file contains 1,571 hospital sites, including 57 in Berlin, and every row has coordinates. **[verified 2026-10-08]** The site calls it Open Data and the statute requires machine-readable public access, but no explicit open commercial database licence was found.

For physiotherapy and other remedies, the official GKV list is authoritative but lookup-only. For ambulante Pflege, the national care-fund files are rich but their terms expressly exclude commercial use. DRK can supply its own services, introduce VYVA to funds/KVs and co-sponsor public-interest requests. Its status does **not** automatically give a commercial VYVA product reuse rights.

## 2. Recommended source stack

| Need | Recommended route | Main limitation |
|---|---|---|
| GKV Hausarzt, specialists, psychotherapists | Link to [116117 Arztsuche](https://arztsuche.116117.de/) and [Terminservice](https://www.116117-termine.de/); start § 370a onboarding | No public directory API; interface needs audit and provider participation |
| Doctor places in VYVA | Negotiate Stiftung Gesundheit API; request KBV/KV access with DRK | Commercial terms and exact fields need a quote |
| Hospitals | Bundes-Klinik-Atlas XML export | Commercial database licence needs written confirmation |
| Physiotherapy and other Heilmittel | Link to GKV-SV list; request licensed feed | No public file/API or reuse licence |
| Dentists | Regional KZV directory; request partner feed | Fragmented by region |
| Ambulante Pflege | DRK feed first; negotiate § 7 SGB XI data | Public third-party terms are non-commercial |
| Opticians/Hörakustiker | Request Präqualifizierung data; otherwise label map listings “reported” | No public national supplier feed found |
| Coordinates | Keep source coordinates; otherwise self-host Nominatim or license BKG | Public Nominatim forbids bulk; BKG starts at €6,000 |

Keep four claims separate: `registered/licensed`, `accepts GKV`, `bookable through this channel`, and `reported business listing`. One must never imply another.

## 3. Files and APIs actually tested

### Bundes-Klinik-Atlas

The [official Open Data page](https://bundes-klinik-atlas.de/open-data/) linked `Bundes-Klinik-Atlas_Datenexport_20260929.zip` (29 September 2026). It was downloaded and parsed outside the repository. The ZIP contains `2026-09-29_TVERZ_Export.xml` and its XSD. **[verified 2026-10-08]**

| Test | Result |
|---|---:|
| `<Standort>` rows in XML | **1,571** |
| Rows in live `locations.json` | **1,571** |
| Berlin rows (`city = Berlin`) | **57** |
| Rows with phone | **1,548** |
| Rows with email | **1,548** |
| Rows with latitude/longitude | **1,571** |

Real JSON fields: `name`, `street`, `city`, `zip`, `phone`, `mail`, `beds_number`, `latitude`, `longitude`, `link`. XML groups/fields include `StandortKontaktDaten` (`STOID`, `Land`, `Name`, `Strasse`, `PLZ`, `Ort`, `URL`, `Telefon`, `EMail`, `TraegerArt`, `Laengengrad`, `Breitengrad`), `StandortStrukturDaten`, `StandortNotfallversorgung`, `Barrierefreiheit`, `Zertifizierungen`, `Mindestmengenleistungen`, `Erkrankungen` and `Fachabteilungen`. **[verified 2026-10-08]**

It has clinical structure, contacts and coordinates, but is not a community-specialist directory. The atlas covers hospital sites admitted under § 108 SGB V; private-only hospitals are outside scope and psychiatric/psychosomatic content is limited. **[verified 2026-10-08]**

**Licence:** § 135d(1) SGB V creates public machine-readable access and the page calls the export “Open Data”. The legal notice only says linking is welcome and unchanged quotation with source is allowed; it does not grant a clear commercial database licence. No DL-DE, CC or equivalent grant was found. Treat storage/republication as **not cleared** until G-BA/IQTIG confirms it. The internal JSON is undocumented; production should use the export. **[verified 2026-10-08]**

### InEK register and missing sector files

The InEK register is the statutory source of site identifiers under § 293(6) SGB V. Its 2025 agreement requires machine-readable XML and regular updates, but the portal requires registration and no explicit commercial licence was found. **[verified 2026-10-08]** Use the Klinik-Atlas `STOID` as join key.

No comparable public, commercially reusable national doctor, dentist, therapy or care-service file was found, so no honest row/Berlin count exists for them. The AOK care export requires registration and a non-commercial declaration; this pass did not make a false declaration to obtain it. **[verified 2026-10-08]**

## 4. Doctor registers and licensed vendors

### KBV/KV and 116117

The [KBV Bundesarztregister page](https://www.kbv.de/praxis/abrechnung-und-honorar/bedarfsplanung/bundesarztregister) says regional KVs transmit monthly. It contains every doctor and psychotherapist participating in GKV care and around 60 attributes, including name, address, practice form, specialty, focuses and additional qualifications; it supplies 116117. Individual/regional analysis is restricted for data-protection reasons. **[verified 2026-10-08]**

There is no public bulk download or directory API. Make a joint DRK/VYVA request to KBV and the pilot Land's KV, specifying fields, territory, refresh, purpose, processor roles and paid-licence willingness. DRK strengthens the public-interest case; it creates no entitlement. Do not scrape.

The live [116117 search](https://arztsuche.116117.de/) opened and says accessibility data comes from the Bundesarztregister via regional KVs and cannot be guaranteed complete/current by KBV. It links KZBV dentist search. **[verified 2026-10-08]**

### Stiftung Gesundheit / Arzt-Auskunft

This is the strongest licensable alternative. Stiftung Gesundheit's [partner page](https://www.stiftung-gesundheit.de/arzt-auskunft/kooperationen/) and privacy information say it runs searches for licence/cooperation partners and integrates its Strukturverzeichnis by API. It covers doctors, dentists, psychotherapists, clinics, rehabilitation, MVZ, emergency facilities and non-medical therapists; API customers can receive weekly incremental updates. **[verified 2026-10-08]**

- It is a curated commercial directory, not the statutory register. Require provenance/warranty for specialty and `Kassenzulassung`.
- No public tariff: quote/contract via `kooperation@stiftung-gesundheit.de`.
- Require sample schema, category/Germany/Berlin counts, update SLA, correction/deletion feed and rights to store, distance-rank and display in a commercial app.

### Weisse Liste

Weisse Liste is an authoritative consumer-health initiative, but no current public bulk provider API, downloadable doctor directory or commercial reuse offer was found. Ask for a DRK-backed partnership; otherwise do not scrape. **[not published]**

## 5. 116117 public route and third-party booking

### Patient hand-off

- `arztsuche.116117.de` works as the official doctor/psychotherapist search. **[verified 2026-10-08]**
- `116117-termine.de` opened in a real browser with title “116117 Terminservice: Arzttermine für gesetzlich Versicherte online buchen”. Direct linking works. Automated retrieval returned 403, so its HTML is not an API. **[verified 2026-10-08]**
- Call **116117** for a condition that cannot wait until normal hours; call **112** for life-threatening emergencies.

Current guidance says no referral code is needed for general practice, paediatrics, ophthalmology or gynaecology (and specified paediatric checks). Other specialist bookings normally require the 12-character Vermittlungscode; initial psychotherapeutic consultation has its own path. **[verified 2026-10-08]** Use “normally” because urgency/pathway exceptions exist.

### § 370a interface

The current [implementation guide](https://simplifier.net/guide/implementierungsleitfaden-terminschnittstelle-fuer-dritte/) (v2.12.0 when opened) and [kv.digital partner page](https://www.kv.digital/partner/116117-terminservice/schnittstelle-fuer-dritte) confirm: **[verified 2026-10-08]**

- OAuth2 client credentials, five-minute token, scope `terminefuerdritte`.
- Hardware-backed VPN, issued credentials and key material.
- Search, book, cancel and request referral code. A third party may request a code only for code-free specialties with urgency `urgent`; referral-required specialties need an existing code.
- Onboarding via kv.digital Serviceportal, keyword “Schnittstelle für Dritte”; certification/testing mandatory.
- Practices can object to their appointments being passed to third parties. **No opt-out/coverage rate is published**; demand it in diligence.

Opened fee schedule: result-check certification **€1,222.10**; visual check per appointment **€681.04**; setup **€811.59**; key creation **€67.63**; key delivery **€67.63**; connection/testing **€67.63 per started hour**; **€0.0385 per search, booking, cancellation or code request**. VAT/other work may apply; obtain a quote. **[verified 2026-10-08]**

## 6. Booking platforms considered

| Platform | Finding | Access/cost | Decision |
|---|---|---|---|
| Doctolib DE | Selected practice-system partner integrations; no public nationwide patient-search API/data licence | Bespoke, price unpublished | Ask, not core register |
| Jameda | Booking integrations with medatixx/solutio; no public directory/booking API terms | Bespoke, price unpublished | Secondary negotiation |
| Doctena | Partner programme for PVS, call centres, agencies and associations; API login gated | Partner quote/contract | Plausible DRK partner; participating practices only |
| samedi | Public `/api/booking/v3` docs expose categories, types, insurers, availability, restricted user data and booking | Commercial contract | Technically clearest private API; not national authority |

**[verified 2026-10-08]** for public partner/API materials. None proves statutory authorisation just by listing a profile. Require provider identifiers and warranted source for specialty/GKV status. Prioritise regulated 116117.

## 7. Therapy, dentists and aids

The [GKV Heilmittelerbringerliste](https://www.gkv-spitzenverband.de/service/heilmittelerbringer/heilmittelerbringer.jsp) covers § 124(2)-authorised physiotherapy, OT, podiatry, nutritional therapy and speech/voice/swallowing therapy. Results include name/address and optional phone, email, site and accessibility; maximum 50 results. Hospitals/rehab are excluded. **[verified 2026-10-08]** No export/API/licence was published. Request a licensed file and deltas; until then link, do not scrape.

The [KZBV page](https://www.kzbv.de/patienten/arztsuche/) routes to regional KZV/chamber dentist directories and says they update regularly. **[verified 2026-10-08]** No national feed/licence found. Negotiate with the pilot KZV; link elsewhere.

Optician/hearing supplier eligibility uses Präqualifizierung under § 126 SGB V. Certification bodies report to GKV-Spitzenverband and insurers receive overviews, but no public national search/feed was found. Ask GKV-SV and DRK's insurer partners. Otherwise label listings unverified, not GKV-authorised.

## 8. Ambulante Pflege

AOK-Pflegenavigator, vdek-Pflegelotse and BKK PflegeFinder use statutory § 7 SGB XI service/price data. The [AOK export page](https://navigatoren.aok.de/export/) offers one-off or quarterly files by Land for research/journalism after registration. **[verified 2026-10-08]**

Exact licence text: **“Ich versichere, die angefragten Daten nicht für kommerzielle Zwecke zu nutzen.”** Common terms add: **“Eine gewerbliche Nutzung der Daten ist ausgeschlossen, dieses beinhaltet auch die Veröffentlichung oder Verwendung der Daten auf gegen Entgelt betriebene Onlineangebote.”** **[verified 2026-10-08]** This bars VYVA's commercial storage/display.

Routes: (1) DRK licenses its own care/day-care/Hausnotruf/meals/advice feed; (2) DRK+VYVA negotiate a commercial/public-interest licence or query service with AOK/vdek/regional funds; (3) if access is DRK-only/non-commercial, keep control with DRK and do not assume sublicensing.

## 9. Better sources considered

| Source | Authority/coverage | Reuse/cost/access | Decision |
|---|---|---|---|
| Stiftung Gesundheit | Nationwide curated multi-profession | Commercial API, quote | **Pursue now** |
| KBV/KV Arztregister | Official GKV doctors/psychotherapists | No public licence/file; DRK request | **Pursue in parallel** |
| Weisse Liste | Authoritative consumer initiative | No bulk offer found | Explore only |
| 116117 § 370a | Official GKV appointments | Published charges; audit/VPN | **Top integration** |
| Private booking platforms | Participant bookings | Contractual, mostly unpublished prices | Optional enrichment |
| Bundes-Klinik-Atlas | Official § 108 hospitals | Public ZIP; licence unclear | Import after clearance |
| InEK | Statutory hospital IDs | Registration; reuse unclear | Validation/join |
| GKV Heilmittel | Official § 124 practices | No public API/licence | Link + negotiate |
| KZBV/KZVs | Official dentist routing | Regional | Link/region deal |
| § 7 SGB XI lists | Contracted care/providers/prices | Published terms prohibit commercial use | No import without contract |
| GovData/Länder | Patchy health POIs | Dataset-specific open licences | Supplement only |
| OpenStreetMap | Community POIs | ODbL; attribution/share-alike | Location fallback, never licence proof |
| BKG geocoder | Official house coordinates | From €6,000; licence agreement | Price against self-hosted Nominatim |

The opened BKG page says **“Preis: ab 6.000,00 €”**, requires a licence, updates annually and allows persistent storage of results. **[verified 2026-10-08]** The first draft's €18,000 figure was not current. No official notice was found that this service becomes open in 2027. Do not plan on it; ask BKG about the specific service.

GovData/Länder sources are local supplements, not a coherent authorisation register. Audit the pilot Land once known. OSM is useful for coordinates/discovery but cannot establish Kassenzulassung, licence or contract status.

## 10. What DRK can unlock

- A licensed feed of DRK's own services/service areas—the quickest ambulante-Pflege win.
- Introductions/co-applicant status with the pilot KV/KZV, care funds, Stiftung Gesundheit and kv.digital.
- A public-interest/accessibility case and controlled pilot population for the 116117 audit.
- Regional call centres as fallback when digital booking is unavailable.
- Insurer/fund relationships enabling an authorised query service without database transfer.

DRK cannot waive third-party rights. Every feed needs explicit storage, display, commercial-use, refresh, correction/deletion and subcontractor terms.

## 11. Open questions answered

1. **Klinik-Atlas/InEK licence?** Access verified; explicit commercial database licence absent. Obtain written G-BA/IQTIG permission.
2. **Can VYVA use § 7 lists?** Not under published terms. Bespoke licence/service required; DRK helps negotiate but does not change the licence.
3. **116117 requirements?** Audit, hardware VPN, OAuth2, setup/check/per-call fees and provider opt-out confirmed. Rate limits/opt-out share unpublished—request them.
4. **Will KBV provide access?** No public route/entitlement. Make a scoped DRK request; use Stiftung Gesundheit meanwhile.
5. **Coordinates/files?** Klinik-Atlas: all 1,571 have coordinates. InEK standalone not needed for MVP. No public Heilmittel file found.
6. **BKG open in 2027?** No official evidence. Current price starts at €6,000. Treat the claim as unconfirmed until BKG writes back.
7. **Pilot Land?** Unknown and important; it determines KV, KZV, funds and Länder sources.
8. **Future reform?** Do not make launch depend on pending reform; implement the current 116117 route.

## 12. Next actions

1. Start kv.digital onboarding; request full quote, audit checklist, rate limits, region/specialty coverage and measured opt-out rate.
2. Ask Stiftung Gesundheit for sample schema, Germany/Berlin/category counts, SLA and commercial storage/display quote.
3. Joint DRK/VYVA request to KBV and pilot KV.
4. Ask G-BA/IQTIG whether VYVA may store, transform and commercially display the Klinik-Atlas XML and under what attribution.
5. Contract and ingest DRK's own service feed.
6. Request Heilmittel/Präqualifizierung data from GKV-SV and commercial § 7 terms from AOK/vdek.
7. When the pilot Land is known, audit its portal and negotiate its KV/KZV sources.

## Primary sources opened

- [KBV Bundesarztregister](https://www.kbv.de/praxis/abrechnung-und-honorar/bedarfsplanung/bundesarztregister)
- [116117 search](https://arztsuche.116117.de/) and [appointment portal](https://www.116117-termine.de/)
- [kv.digital interface](https://www.kv.digital/partner/116117-terminservice/schnittstelle-fuer-dritte) and [implementation guide](https://simplifier.net/guide/implementierungsleitfaden-terminschnittstelle-fuer-dritte/)
- [Bundes-Klinik-Atlas Open Data](https://bundes-klinik-atlas.de/open-data/) and [legal notice](https://bundes-klinik-atlas.de/impressum/)
- [GKV Heilmittelerbringerliste](https://www.gkv-spitzenverband.de/service/heilmittelerbringer/heilmittelerbringer.jsp)
- [KZBV dentist searches](https://www.kzbv.de/patienten/arztsuche/)
- [AOK export](https://navigatoren.aok.de/export/) and [§ 7 terms](https://www.vdek.com/vertragspartner/Pflegeversicherung/Pflegelotse/_jcr_content/par/download_415898711/file.res/Leistungs_und%20_Preisdaten_Allgemeine_Nutzungsbedingungen.pdf)
- [Stiftung Gesundheit partner/API](https://www.stiftung-gesundheit.de/arzt-auskunft/kooperationen/)
- [BKG geocoder](https://gdz.bkg.bund.de/index.php/default/geokodierungsdienst-opensearch-der-adv-fur-adressen-und-geonamen-gdz-geokodierung.html)
- [Doctena partners](https://www.doctena.com/partners/), [samedi API](https://booking-api.samedi.de/), [Doctolib partners](https://info.doctolib.de/), [Jameda example](https://presse.jameda.de/395188-dmea-2025-jameda-und-medatixx-prasentieren-partnerschaft-fur-nahtloses-terminmanagement)
