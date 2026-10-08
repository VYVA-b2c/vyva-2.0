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

## 13. Free sources (zero-cost route)

### Clear verdict

**Yes, VYVA can launch a legally reusable, zero-licence-cost German MVP, but it cannot call every result officially licensed.** The strongest combination is:

1. **Berlin's official open care WFS** for ambulante Pflege, Tagespflege, short-term and residential care: authoritative administrative planning data, commercially reusable under DL-DE-Zero-2.0.
2. **OpenStreetMap** for doctors, dentists, physiotherapy, psychotherapy, opticians and hearing-aid shops: commercially reusable under ODbL and reasonably populated, but crowd-maintained, incomplete and not proof of Kassenzulassung or professional licence.
3. **Official open hospital export**, only after its ambiguous reuse notice is clarified; until then use OSM/Wikidata as a semi-verified hospital discovery layer.
4. **Official open house coordinates** in Länder that publish them, including Berlin/Brandenburg and Sachsen, or self-hosted Nominatim/Photon.
5. Official 116117/KZV/GKV search links as the verification hand-off; do not copy those directories.

This gives a useful free product in Berlin today. Uckermark demonstrates that the same OSM approach works in a rural district, but sparse specialties and missing contact fields require a “reported provider” label and a phone/search fallback.

### 13.1 OpenStreetMap: measured coverage

On 8 October 2026 the Overpass API was queried for every node, way and relation inside Berlin relation `62422` and Landkreis Uckermark relation `62537` with `healthcare=*`, relevant `amenity=*`, or `shop=optician|hearing_aids`. The response included tags, geometry centres and element timestamps. Temporary JSON was analysed outside the repository and was not committed. **[verified 2026-10-08]**

Classification used `healthcare`, `amenity`, `shop`, `social_facility`, `healthcare:speciality` and, for ambulatory care, provider names containing `Pflegedienst`, `Sozialstation` or `ambulant`. Phone means `phone` or `contact:phone`; website means `website` or `contact:website`; “fresh ≤2y” means the OSM element was edited on or after 8 October 2024. Counts are OSM elements, not deduplicated legal organisations; a node and building may occasionally describe the same provider.

| Type | Berlin count | Phone | Specialty tag | Fresh ≤2y | Uckermark count | Phone | Specialty tag | Fresh ≤2y |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hausarzt | 441 | 65.3% | 100% | 51.2% | 14 | 78.6% | 100% | 50.0% |
| Target specialists (combined) | 264 | 61.4% | 100% | 53.4% | 5 | 80.0% | 100% | 60.0% |
| Other/unspecified doctors | 725 | 54.9% | 83.7% | 51.0% | 25 | 64.0% | 44.0% | 48.0% |
| Zahnarzt | 830 | 58.0% | 14.3% | 49.0% | 18 | 77.8% | 16.7% | 55.6% |
| Physiotherapie | 606 | 51.2% | 13.2% | 46.4% | 8 | 62.5% | 12.5% | 50.0% |
| Psychotherapie/psychology | 532 | 40.6% | 39.5% | 39.7% | 3 | 100% | 33.3% | 33.3% |
| Optiker | 353 | 49.6% | n/a | 66.9% | 13 | 38.5% | n/a | 53.8% |
| Hörakustiker | 134 | 38.8% | n/a | 64.9% | 5 | 40.0% | n/a | 60.0% |
| Ambulante Pflege (conservative rule) | 256 | 48.8% | n/a | 47.3% | 9 | 66.7% | n/a | 77.8% |
| Tagespflege | 28 | 50.0% | n/a | 50.0% | 1 | 100% | n/a | 0% |

Across the full extracts there were **6,485 Berlin elements** (97.2% named, 49.8% phone, 54.4% website, 50.9% edited within two years) and **168 Uckermark elements** (96.4% named, 63.1% phone, 47.6% website, 50.0% edited within two years). **[verified 2026-10-08]** No object with `Hausnotruf` in its name was found in either extract; OSM is not adequate for that category.

Specialist tag matches (categories can overlap for multi-specialty practices): Berlin had ophthalmology **96** (63.5% phone), HNO/otolaryngology **77** (62.3%), neurology **56** (53.6%) and orthopaedics **112** (57.1%); Uckermark had 2, 1, 0 and 2 respectively. **[verified 2026-10-08]**

#### Official-count comparison

The KBV 2025 Bundesarztregister table reports Berlin planning weights of **2,347** for primary care, **302** ophthalmology, **241** HNO and **514** combined surgery/orthopaedics. **[verified 2026-10-08]** Against those denominators, OSM's tagged elements are about 18.8%, 31.8%, 32.0% and 21.8%. These are warning indicators, **not formal completeness rates**: KBV counts clinician planning weights, while OSM counts mapped places; group practices can contain several clinicians and OSM duplicates can occur. The direction is nevertheless clear—OSM is materially incomplete as an official-doctor register.

#### ODbL implementation obligations

The OSM copyright page states: “You are free to copy, distribute, transmit and adapt our data, as long as you credit OpenStreetMap and its contributors. If you alter or build upon our data, you may distribute the result only under the same license.” It also requires an attribution notice and a clear statement/link that data is under ODbL. **[verified 2026-10-08]**

For VYVA:

- Show `© OpenStreetMap contributors` with a link to `openstreetmap.org/copyright` wherever OSM results/maps are displayed.
- Keep provenance per record and make clear that OSM records are community-reported, not official authorisation.
- If VYVA publicly offers a database derived from OSM or a substantial extracted/modified database, offer that derived OSM database under ODbL. A rendered result/map can be a Produced Work, but attribution and access to the underlying OSM/derived database required by ODbL still apply.
- Keep proprietary booking and user data in separate tables/layers. The OSMF guidance permits distinct layers in a collective database, but do not merge incompatible licensed data into one inseparable derived database without legal review.
- Do not rely on public Overpass, tiles or Nominatim as a production SLA. Download a Germany/region extract and run the import/geocoder, or pay infrastructure costs; “zero-cost source licence” does not mean zero hosting cost.

### 13.2 Official Berlin care data: the strongest free source

Berlin's [“Ausgewählte Pflege- und pflegeflankierende Angebote” WFS](https://gdi.berlin.de/services/wfs/pflegeeinrichtungen?request=GetCapabilities&service=WFS) was opened and all four feature types were downloaded as GeoJSON. **[verified 2026-10-08]**

| WFS feature type | Rows | Use in Care Finder |
|---|---:|---|
| `a_pflegeeinrichtungen_voll` | 263 | Residential care |
| `b_pflegeeinrichtungen_tages` | **112** | Tagespflege |
| `c_pflegeeinrichtungen_kurz` | 17 | Short-term care |
| `d_pflegeeinrichtungen_ambulant` | **723** | Ambulante Pflege/Pflegedienste |

Actual fields: `ik_nummer`, `einrichtung_name`, `gc_strasse`, `gc_plz`, `gc_ort`, `platzzahl` (not ambulatory), `traegername`, `traegerverband`, `x_25833`, `y_25833`, `geo_id`, `bez`, `einrichtung_typ`, `einrichtung_typ_kurz`, plus point geometry. It has official type, provider association, address and coordinates, but **no phone, website or service-area field**. The metadata says the snapshot covers facilities present in TOPqw on 15 January 2024 and is updated “as needed”; freshness is its main weakness. **[verified 2026-10-08]**

The dataset licence is DL-DE-Zero-2.0. Exact text: **“Jede Nutzung ist ohne Einschränkungen oder Bedingungen zulässig.”** It expressly permits commercial and non-commercial copying, presentation, alteration, transmission, combination with other data and integration into products/apps. **Commercial storage and display: yes, zero licence cost. [verified 2026-10-08]**

This corrects the earlier report: the AOK/vdek national files remain non-commercial, but Berlin independently publishes a useful official open subset. Use Berlin WFS as the authoritative care spine, then enrich phone/site from OSM only with separate provenance.

### 13.3 Wikidata hospitals and clinics

The live Wikidata Query Service was queried for hospital/clinic subclasses located in Berlin and Uckermark. Berlin returned **102 unique entities**: 91 with coordinates, 48 with a website and only 3 with a phone. Uckermark returned **5**, of which 4 had coordinates and none had phone/site. Fields queried were item URI, label, `P625` coordinate, `P1329` phone and `P856` website. **[verified 2026-10-08]**

Wikidata is CC0 and permits free commercial storage/reuse, but it is crowd-maintained and very poor for contact data. Use it only to cross-link hospital identities (QIDs/Wikipedia), not as the primary provider feed. The Klinik-Atlas export remains much fuller; its commercial licence ambiguity should be resolved separately.

### 13.4 Open-data portal audit

GovData and the larger Land/city portals were searched for `Ärzte`, `Pflegedienste`, `Pflegeeinrichtungen`, `Pflegestützpunkte`, `Gesundheitsamt` and `Beratungsstellen`. **[verified 2026-10-08]** Results were fragmented; the reusable provider-level wins were care/social facilities, not doctor registers.

- **Berlin:** the official care WFS above, DL-DE-Zero-2.0, is production-usable. This is the best finding.
- **Hamburg:** official full-stationary care locations are downloadable as CSV/GeoJSON/WFS/OAF under DL-DE-BY-2.0; district datasets such as “Wohnen und Pflege Eimsbüttel” include residential, partial-stationary and Tagespflege under DL-DE-Zero-2.0. **[verified 2026-10-08]** The former requires the provider/source, licence link, dataset URI and a note when modified; commercial use is explicitly allowed.
- **NRW:** searches mostly returned aggregate statistics or municipal hospital locations, not a Land-wide provider register.
- **Bayern, Baden-Württemberg, Sachsen, Niedersachsen and other portals:** no open, provider-level doctor/KV dataset was found in this pass. Local social/care/advice datasets occur, so each pilot city still deserves a targeted audit.
- **Pflegestützpunkte/Beratungsstellen:** some municipal lists are open, but no consistently licensed national file was found. Treat portal records dataset-by-dataset.

Destatis/Land statistical-office care tables are primarily aggregates, not named establishments. Heimaufsicht/WTG authorities may publish facility lists locally; only import when the specific distribution has DL-DE/CC terms. Publication on a webpage alone is not an open licence.

### 13.5 KVs, chambers, associations and the DNG

No regional KV, Landesärztekammer or KZV open provider dataset/free documented API with commercial reuse was found. Their directories remain link-only unless they grant written permission. Likewise, professional association searches are not open data:

- The biha Hörakustiker search says participation is voluntary and entries are self-maintained. Its terms expressly forbid partial/full database extraction for commercial address use, competing directories or other commercial use, and prohibit agents/robots/scripts/spiders. **[verified 2026-10-08]** Do not scrape.
- No open commercial data grant was found for ZVA/optician, physiotherapy-association or BPtK/member directories. A free public search is not a free data source.

The Datennutzungsgesetz is useful leverage but **not a magic access right**. § 2 applies when data is already supplied under an access right/duty or otherwise publicly supplied; it excludes restricted/personal/third-party-IP data. § 4 then permits commercial/non-commercial use, § 7 requires available formats and says agencies need not create/adapt data beyond simple processing, and § 10 says use is generally free subject to marginal-cost and listed exceptions. **[verified 2026-10-08]** Therefore VYVA can ask a KV/public chamber to provide an existing export under the relevant access law and invoke DNG reuse/free-use principles, but DNG alone does not compel disclosure of the Arztregister or override privacy.

### 13.6 DRK's own public data

Multiple DRK Kreisverband “Angebotsfinder” pages were opened. They expose category and postcode/place searches and cover services such as ambulante Pflege, Tagespflege and Hausnotruf, but no documented public export/API or open-data licence was found. **[verified 2026-10-08]** The pages are distributed across association sites. Public visibility is not permission to copy.

The zero-cost legal route is **explicit written permission**, which the brief accepts: DRK supplies an internal CMS export/feed and grants VYVA commercial storage/display rights at no licence fee. Ask for stable organisation/service IDs, category, name, address, phone, email, URL, coordinates, service area and last-updated timestamp. This is the only credible free source for Hausnotruf found in this pass.

### 13.7 Free geocoding

- **Self-host Nominatim or Photon** on OSM extracts: no per-query licence charge; obey ODbL/attribution/share-alike for derived databases. Public Nominatim is limited to 1 request/second, requires caching/identification and forbids bulk geocoding, so it is not the importer.
- **Berlin/Brandenburg official addresses:** the Brandenburg/Berlin Gazetteer OGC API includes house coordinates. Brandenburg says its digital geodata are free Open Data under DL-DE-BY-2.0; the January 2026 update reports 866,316 Brandenburg and 394,303 Berlin house coordinates. Formats include ASCII, Shape, GeoJSON, GeoPackage and FileGDB; updates are half-yearly. **[verified 2026-10-08]** Uckermark is therefore covered.
- **Sachsen:** GeoSN states downloads are free and licensed DL-DE-BY-2.0, with attribution `Quelle: GeoSN, dl-de/by-2-0`. **[verified 2026-10-08]**
- Other Länder, including NRW, publish substantial geobasis Open Data, but confirm the exact address product and distribution licence before import; do not infer it from the portal-wide brand.

### 13.8 Ranked free source by provider type

| Provider type | Best zero-cost source | Coverage tested | Authority | Licence / commercial use | Import effort |
|---|---|---|---|---|---|
| Hausarzt | OSM + 116117 verification link | Berlin 441; Uckermark 14 | Community; not GKV proof | ODbL, yes | Medium |
| Augen/HNO/Neurologie/Orthopädie | OSM specialty tags + 116117 link | Berlin 96/77/56/112; rural 2/1/0/2 | Community | ODbL, yes | Medium; sparse rural |
| Zahnarzt | OSM + regional KZV link | Berlin 830; rural 18 | Community + official hand-off | ODbL, yes | Low |
| Physiotherapie | OSM + GKV list link | Berlin 606; rural 8 | Community + official hand-off | ODbL, yes | Low |
| Psychotherapie | OSM + 116117 link | Berlin 532; rural 3 | Community + official hand-off | ODbL, yes | Medium |
| Optiker | OSM | Berlin 353; rural 13 | Community/business mapping | ODbL, yes | Low |
| Hörakustiker | OSM; never scrape biha | Berlin 134; rural 5 | Community; not Präqualifizierung | ODbL, yes | Low |
| Ambulante Pflege | **Berlin care WFS**; OSM elsewhere | Berlin official 723 | **Official Land planning data** | **DL-DE-Zero-2.0, yes** | Low |
| Tagespflege | **Berlin care WFS**; Hamburg/local portals | Berlin official 112 | **Official Land planning data** | **DL-DE-Zero-2.0, yes** | Low |
| Hausnotruf | DRK feed with written permission; OSM inadequate | 0 OSM name matches | Partner-owned if DRK feed | Explicit grant, yes if signed | Medium |
| Hospitals/clinics | OSM/Wikidata pending Klinik-Atlas clearance | Wikidata Berlin 102, rural 5 | Community/semi-verified | ODbL / CC0, yes | Medium |

### 13.9 Free MVP stack

1. Import Berlin's four care WFS layers nightly/weekly; display dataset date and “official Berlin planning data”.
2. Import a Berlin+Brandenburg OSM extract; normalise and deduplicate healthcare POIs, preserve OSM IDs/timestamps/tags and display “community-reported”.
3. Enrich Berlin care rows from OSM only in a separate provenance layer; never overwrite official type/IK number.
4. Obtain DRK's no-fee written feed permission for its own ambulante Pflege, Tagespflege and Hausnotruf.
5. Use Berlin/Brandenburg official open house coordinates for unmatched addresses; self-host Nominatim/Photon for search.
6. Add official link-outs to 116117, KZV and GKV therapy lookup for authorisation checking/booking.
7. Run monthly quality reports: duplicates, missing phone/site, OSM age, failed official links and category disagreement. Do not label an OSM-only result “licensed” or “accepts GKV”.

The free MVP is therefore **strong for Berlin care, workable but semi-verified for urban doctors/dentists/therapists/retail providers, weak for rural specialists, and dependent on DRK permission for Hausnotruf.**

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
- [OpenStreetMap copyright/licence](https://www.openstreetmap.org/copyright) and [OSMF Produced Work guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)
- [Berlin care dataset](https://www.govdata.de/suche/daten/ausgewahlte-pflege-und-pflegeflankierende-angebote-in-berlin) and [WFS](https://gdi.berlin.de/services/wfs/pflegeeinrichtungen?request=GetCapabilities&service=WFS)
- [DL-DE-Zero-2.0](https://www.govdata.de/dl-de/zero-2-0) and [DL-DE-BY-2.0](https://www.govdata.de/dl-de/by-2-0)
- [Hamburg full-stationary care](https://suche.transparenz.hamburg.de/dataset/vollstationaere-pflegeeinrichtungen-hamburg7)
- [Datennutzungsgesetz §§ 2, 4, 7 and 10](https://www.gesetze-im-internet.de/dng/)
- [biha Hörakustiker-search terms](https://www.hoerakustiker-suche.de/nutzung.php)
- [Brandenburg georeferenced addresses](https://geobasis-bb.de/lgb/de/geodaten/liegenschaftskataster/georeferenzierte-adresse/) and [Sachsen reuse terms](https://www.geodaten.sachsen.de/rechtsgrundlagen-und-nutzungsbedingungen-4509.html)
