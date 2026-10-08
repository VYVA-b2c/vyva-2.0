# Care Finder: provider source strategy for Germany

Checked: 8 October 2026. Scope: Germany only, for the DRK deployment. Companion to `care-finder-provider-sources-spain.md`; same structure and evidence marks.

## How the evidence was gathered

This pass was meant to open every source directly, as the Spain pass did. It could not. The network proxy in this environment refused almost every German host (section 10): kbv.de, 116117.de, bundes-klinik-atlas.de, g-ba.de, gkv-spitzenverband.de, vdek.com, aok.de, govdata.de, geodatenzentrum.de and the rest all returned 403 to both `curl` and the page fetcher. Three things were reachable: the public Nominatim geocoder, raw files on GitHub, and PyPI. So **most of this report is [search]**. Treat it as a map of where to look, and re-run the checks from an unrestricted machine before building on any single fact.

- **[verified 8 Oct 2026]**: the page, file or service was opened and the stated facts were read from it.
- **[search]**: found only through web search (result snippets and search-engine summaries of the page). Not yet confirmed.
- **[law]**: the obligation comes from a statute. The cited text appeared in search results; the statute itself was not opened.
- **[ours]**: a fact about our own code, checked directly.
- **[not found]**: looked for, within a time limit, and not found. This does not prove it doesn't exist.

---

## 1. Executive recommendation

Germany is harder than Spain. Spain has one open, monthly, commercially reusable register of every authorised place (REGCESS). **Germany has no equivalent.** The official registers exist, and several are created by statute, but each is split by sector, and none was found under an open licence that allows commercial reuse. Access runs through statutory third-party interfaces that are either **non-commercial only** (care) or **audited and opt-out for providers** (doctors' appointments).

What that means for Care Finder:

1. **For people with statutory cover (GKV), the 116117 system is the backbone, not a register download.** 116117 is the national number and portal of the Kassenärztliche Vereinigungen (KVs): doctor and psychotherapist search (arztsuche.116117.de), appointment booking (116117-termine.de, app, phone), and the out-of-hours medical service. **[search]** Since mid-2025 a statutory **third-party appointment interface** (§ 370a SGB V) lets outside apps search, book and cancel 116117 appointments and request referral codes. It needs an audit by kv.digital, and practices can opt out of being shown to third parties. This is the single most valuable German integration for VYVA and should be pursued now.
2. **Doctors as places: no open dataset; ask for one.** The data behind arztsuche.116117.de is the KVs' Arztregister (doctors with a statutory licence, *Vertragsärzte*). The KBV hands bulk extracts only to named recipients and "where a law allows it". **[search]** No public API, download or reuse licence was found **[not found]**. Until there is an agreement, **link to the 116117 search and the phone line; do not scrape.**
3. **Hospitals are the one sector with a usable national open file.** The Bundes-Klinik-Atlas publishes a machine-readable export (a ZIP containing `TVERZ_Export.xml`, dated 21 April 2026), with coordinates from the national hospital-site register run by InEK, refreshed monthly. The public has a statutory right to it (§ 135d SGB V). **[search]** **The licence was not found.** Confirm it before using the file in production.
4. **Home care (ambulante Pflege) has statutory data, but non-commercial only.** The care-insurance funds must publish quarterly service-and-price lists of every contracted care service and hand them to third parties (§ 7 Abs. 3 SGB XI). The terms of use **exclude commercial use**, including paid online services. **[search]** The quality-inspection data under § 115 SGB XI has the same restriction (terms dated 30 June 2026). **[search]** VYVA is commercial, so the only clean route is an agreement: with AOK-Bundesverband, which coordinates the data, or with the regional associations of care funds, or with **DRK itself, which runs care services and can license its own data to us.**
5. **Therapy practices (physio, OT, speech, podiatry, nutrition) have an official list.** The GKV-Spitzenverband publishes the *Heilmittelerbringerliste*: every practice licensed to treat at the expense of any statutory fund, searchable by place, radius and therapy area, refreshed monthly. **[search]** No download or licence was found. Ask the GKV-Spitzenverband.
6. **Pharmacies: buy the official feed or link to aponet.** Official emergency-duty data comes from the Bundesapothekerkammer and is sold by Avoxa (daily XML, national). Some regional chambers offer free XML with registration and attribution (Thuringia, Bavaria). **[search]**
7. **Dentists, opticians, hearing-aid acousticians: no usable national source.** Dentist searches are per region (KZV or dental chamber). Opticians and acousticians are certified (*Präqualifizierung*) to supply under statutory cover, but the register of certified suppliers goes to the insurers, not the public. **[search]**
8. **Geocoding: self-host Nominatim (OSM, ODbL), or use free regional house-coordinate data.** The BKG's official geocoder is **paid for anyone outside the federal administration**. The public Nominatim service answers from here **[verified 8 Oct 2026]**, but its policy rules out bulk geocoding. **[search]**

What no German source provides reliably: **availability** (except through the 116117 interface, for 116117 appointments only), **prices** for anything except care services, **languages spoken** (partly in KV and KZV searches), and **step-free access**. The KVs are required to publish accessibility information (§ 75 Abs. 1a SGB V) **[law]**, but practices aren't required to report it, and coverage is patchy. **[search]**

---

## 2. Germany source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Fit |
|---|---|---|---|---|---|---|---|
| 1 | **116117 doctor and psychotherapist search** ([arztsuche.116117.de](https://arztsuche.116117.de/)) | Public search over the KVs' Arztregister; also on gesund.bund.de | **Official** (KBV / KVs) | GKV-licensed doctors and psychotherapists; specialty, location, opening hours, phone, accessibility filters ("weitere Suchkriterien") | **[search]** Web and app only. No documented public API. A third-party catalogue lists a tool that queries `patientennavi.116117.de` and returns coordinates; it is undocumented and unofficial. | **[not found]** No reuse licence. Bulk Arztregister data goes only to named recipients (GKV-Spitzenverband, Ärzteverlag, Postbeamtenkrankenkasse, Bundeswehr) and "where a law allows it". **[search]** | **High as a hand-off**, none as a dataset until there is an agreement |
| 2 | **116117 Terminservice: interface for third parties** ([implementation guide on Simplifier](https://simplifier.net/guide/implementierungsleitfaden-terminschnittstelle-fuer-dritte/Terminschnittstelle-f%C3%BCr-Dritte?version=2.1.0)) | Statutory API for outside apps to search, book and cancel 116117 appointments and request referral codes | **Regulated** (§ 370a SGB V) | Appointments that practices release into the 116117 pool, video and (since 2025) in person | **[search]** Spec published on gematik's INA on 13 June 2025; procedural rules approved by the BMG on 25 June 2025 and published 30 June 2025. FHIR guide on Simplifier, v2.0.0 and v2.1.0. Testing through kv.digital; **audit required** (audit@kv.digital). | Practices **may object** to their slots being passed to third parties. Terms are set by the procedural rules (*Verfahrensordnung*), not read. | **High.** The only official route to real availability. |
| 3 | **116117 booking for patients** ([116117-termine.de](https://www.116117-termine.de/)) | Where patients book themselves | Official | GP, gynaecology, ophthalmology, paediatrics and a first psychotherapy session **without a code**; other specialties need a 12-digit referral code (*Vermittlungscode*) from the referring practice | **[search]** Web, app, phone 116117 | Link only | **High as a hand-off** |
| 4 | **Bundes-Klinik-Atlas** ([open data](https://bundes-klinik-atlas.de/open-data/)) | National hospital directory with quality, staffing and case data | **Official** (BMG; G-BA from 15 Apr 2026 under the KHAG, per IQTIG; future of the portal under review, per press) | Every hospital site | **[search]** ZIP export (`TVERZ_Export.xml` + `IQTIG_Export_Schema_Alpha_3.xsd`, about 556 KB, dated 21 Apr 2026). Names, addresses, **coordinates**, operator and beds come from the InEK site register, monthly. **[verified 8 Oct 2026]** A community OpenAPI description ([bundesAPI/klinikatlas-api](https://github.com/bundesAPI/klinikatlas-api)) documents `/fileadmin/json/locations.json` with `name, street, city, zip, phone, mail, beds_number, latitude, longitude, link`, plus a search endpoint filtered by ICD, OPS, department and lat/lon. **This is a community description, not an official API.** | **[law]** § 135d Abs. 1 SGB V gives the public a right to the published data in machine-readable form. **Licence not found.** | **High** for hospitals, once the licence is confirmed |
| 5 | **InEK hospital-site register** ([krankenhausstandorte.de](https://krankenhausstandorte.de/login)) | Statutory register of every hospital site and its unit, maintained by the hospitals | **Regulated** (§ 293 Abs. 6 SGB V; agreement of 1 June 2025) | Hospitals (and their outpatient units) | **[search]** Free public search and XML download **after registration**. The agreement requires machine-readable publication, weekly updates and access to past versions. From 2 Oct 2026, XML only in the 2025 schema. Site number: 9 digits, starting `77` + 4 digits; the last digits encode the unit. Whether the XML carries coordinates: **not confirmed**. | **[not found]** No licence statement found | **High** as the hospital id (*Standortnummer*); use it as the join key |
| 6 | **Destatis hospital directory** ([statistikportal.de](https://www.statistikportal.de/de/veroeffentlichungen/krankenhausverzeichnis)) | Annual list of hospitals and rehabilitation centres | Official statistics | Hospitals, rehab | **[search]** Reference date 31 Dec 2024, free. Name, address, phone, email, web, operator type, beds by department. Format not confirmed. | **[search]** "Reproduction and distribution, including excerpts, permitted with source credit." | Medium; yearly, no coordinates found. Use Klinik-Atlas first. |
| 7 | **G-BA hospital quality reports (XML)** ([G-BA page](https://www.g-ba.de/themen/qualitaetssicherung/datenerhebung-zur-qualitaetssicherung/datenerhebung-qualitaetsbericht/)) | Annual structured report per hospital site | **Regulated** | Hospitals: departments, procedures, staff, accessibility | **[search]** XML **on order** (form), individual credentials; free; available until 31 Jan of the following year. PDFs public in the reference database. 2024 reports published March 2026. | **[search]** G-BA general terms (ANB, from 2008): redistribution allowed with duties (source, notice of partial use, rules on combining data). Full text not read. | Medium; enrichment for hospitals (departments, step-free access) |
| 8 | **GKV-Spitzenverband list of therapy providers** (*Heilmittelerbringerliste*) ([page](https://www.gkv-spitzenverband.de/service/heilmittelerbringer/heilmittelerbringer.jsp)) | Every practice licensed under § 124 SGB V | **Regulated** (§ 124 Abs. 2 SGB V) | Physiotherapy, podiatry, occupational therapy, nutrition therapy, speech/voice/swallowing therapy. **Not** hospitals or rehab units. | **[search]** Web search: place + radius + therapy area (+ special service). Results: name, address, phone, email, website, accessibility where given. Fed by the regional licensing bodies (ARGEn); **monthly**. | **[not found]** No download, API or licence found | **High** for "is this practice licensed for statutory patients". Needs an agreement for bulk use. |
| 9 | **Care services: service and price lists (§ 7 Abs. 3 SGB XI)** via [AOK-Pflegenavigator](https://www.aok.de/pk/pflegenavigator/) ([export page](https://navigatoren.aok.de/export/)), [vdek-Pflegelotse](https://www.pflegelotse.de/), BKK PflegeFinder (uses AOK data) | Every contracted home-care service and care home, with services, prices, co-payments | **Regulated** | Ambulante Pflege, care homes, day care | **[search]** Funds must update quarterly and publish online **[law]**. AOK-Bundesverband coordinates delivery to third parties. AOK offers a quarterly XML export to researchers and journalists. Pflegelotse address, structure and price data update about twice a week. | **[search]** Terms of use under § 7 Abs. 3 SGB XI: **non-commercial only**, explicitly including paid online services; source and delivery date must be shown prominently. | **High in content, blocked in licence.** Agreement needed. |
| 10 | **Care quality-inspection data (§ 115 SGB XI)**, vdek-Pflegelotse ([terms of 30 June 2026](https://www.vdek.com/vertragspartner/Pflegeversicherung/Pflegelotse/_jcr_content/par/download_223948164/file.res/Allgemeine-Nutzungsbedingungen-vom-30062026-inkl-Anlagen.pdf)) | Inspection results for care services and homes | Regulated | As above | **[search]** On application to a regional association of care funds; contract; one-off delivery only for science | **[search]** **Non-commercial only**; commercial = any direct or indirect profit aim | Low for us; quality grades are also contested |
| 11 | **Pflegestützpunkte** via the [ZQP database](https://www.zqp.de/) | Neutral care-advice centres | Public (care funds + municipalities) | Care advice for families | **[search]** Searchable database (several addresses cited over the years); address, phone, opening hours. No download found. | **[not found]** | Medium; link-out for "I need help organising care" |
| 12 | **Pharmacies: emergency duty** ([Avoxa / apotheken-notdienstdaten.de](https://apotheken-notdienstdaten.de/), [aponet](https://www.aponet.de/apotheke/notdienstsuche), [LAK Thüringen XML](https://www.lakt.de/xml-schnittstelle), [BLAK](https://www.blak.de/notdienst/notdienst-und-dienstbereitschaft/webintegration)) | Official duty rota of the pharmacy chambers | **Official** (chambers / Bundesapothekerkammer) | All pharmacies, duty times | **[search]** Avoxa: national daily XML, priced on request. aponet: widgets only, "Ein Service von aponet.de" label required. LAKT: free XML with registration and attribution (endpoint changed in May 2026). BLAK: XML/HTML with attribution. LAK BW: members only. | Contract or chamber terms | **High** for "open pharmacy now"; paid nationally |
| 13 | **gematik FHIR directory (VZD)** | TI address book of every practice, pharmacy and hospital with a TI card (Telematik-ID) | Official infrastructure | All TI participants | **[search]** FHIR search API; pharmacies maintain opening hours here since the old pharmacy directory closed. Public third-party access **not confirmed**; appears limited to TI participants. | Not confirmed | Medium in future; ask gematik |
| 14 | **Dentists**: KZBV map → regional KZV / dental-chamber searches | Per-region dentist search | Official (KZVs, chambers) | Dentists; filters for specialty, accessibility, languages | **[search]** Web search per region. KZBV and KBV link to each other; **no data exchange**. No API found. | **[not found]** | Link-out per region |
| 15 | **Hearing-aid and optical suppliers**: GKV-Spitzenverband register of certified suppliers (*Präqualifizierung*) | Who may supply aids under statutory cover | Regulated | Acousticians, opticians, orthopaedic suppliers | **[search]** Certification bodies report certificates to the GKV-Spitzenverband, which passes overviews to the insurers. **No public search found.** Trade registers (*Handwerksrolle*) are per chamber. | **[not found]** | Low; fall back to map data, labelled "reported" |
| 16 | **Medical chambers (Landesärztekammern)** ([BÄK links per state](https://www.bundesaerztekammer.de/arztsuche/rheinland-pfalz)) | Searches that include private-only doctors | Regulated | All licensed doctors in the state | **[search]** Per-state web searches, linked from the Bundesärztekammer | Personal data; lookup only | Medium for private doctors; verification of a named person |
| 17 | **POI-Bund (BKG)** | Federal points of interest, including pharmacies and doctors' practices | Federal geodata, but the health POIs come from commercial suppliers (infas 360, then data analytics institute AG) | Mixed | **[search]** Copyright protected, restricted access; free only to federal bodies | Licence needed | **Low.** Commercial address data, not a register. Don't use. |
| 18 | **OpenStreetMap** | Community map; `amenity=doctors/pharmacy/hospital`, `healthcare=*`, wheelchair tags | Community | Mixed | **[verified 8 Oct 2026]** Nominatim answers from here (see section 7). Overpass and Geofabrik extracts did not (connection reset). | ODbL: commercial use with attribution; share-alike on derived databases | Medium for location; low for authority |
| 19 | **Google Places** (current) | Business listings | Commercial | Everything, unverified | API, paid | Same as Spain: only `place_id` storable indefinitely | Contact details and hours only |
| 20 | **DRK's own services** | DRK district associations run ambulante Pflege, Hausnotruf (home alarm), day care, meals on wheels, care advice | Provider (our partner) | DRK services | **[search]** Each district association runs its own website; no central finder found | **Ours to agree** in the DRK contract | **High** for DRK-run care, if DRK supplies a feed |

### Care types and where they're authorised

| Care Finder type | German authorisation | Best source | Status |
|---|---|---|---|
| Family doctor (*Hausarzt*) | KV licence (Vertragsarzt), Arztregister | 116117 search; 116117 interface for appointments | Hand-off now; API after audit |
| Specialists | KV licence; specialty from the register | Same; most need a referral code to book via 116117 | Hand-off |
| Psychotherapy | KV licence (psychological psychotherapists are in the same register) | 116117 search; TSS (appointment service) for first session within the statutory time limit | Hand-off |
| Physiotherapy, OT, speech, podiatry | § 124 SGB V licence (ARGE) | GKV-Spitzenverband Heilmittelerbringerliste | Agreement needed |
| Dentist | KZV licence | Regional KZV search | Link-out |
| Optician, hearing aids | Certification (§ 126 SGB V) + trade register | None public | Map data, "reported" |
| Home care (ambulante Pflege) | Care-fund contract (§ 72 SGB XI) | § 7(3) SGB XI lists (AOK, vdek) | Agreement needed (non-commercial terms) |
| Care advice | Pflegestützpunkt / care-fund adviser (§ 7a, § 7c SGB XI) | ZQP database | Link-out |
| Hospital | Hospital plan / § 108 SGB V | Bundes-Klinik-Atlas export; InEK site number | Licence to confirm |
| Out-of-hours (non-life-threatening) | KV duty service | 116117 phone and portal | Hand-off |
| Pharmacy, emergency duty | Chamber rota | Avoxa feed or aponet widget | Paid or link |

The § numbers in the last two columns for opticians and home care (§ 126 SGB V, § 72 SGB XI) are from general knowledge of the statutes and were not re-checked in this pass. Treat them as **[search]**.

---

## 3. Recommended architecture

Same separation as Spain (places, people, enrichment), but the German spine is **several sector registers plus live hand-offs**, not one file.

```
User request (plain words)
   │
   ▼
Requirements: care type · cover (GKV / PKV / self-pay) · area · access needs
   │
   ├─ Statutory cover, doctor or psychotherapist
   │      ├─ Not urgent ─► 116117 third-party interface (after audit): search + book
   │      │                fallback: link to 116117-termine.de / arztsuche.116117.de + "call 116117"
   │      │                tell them: GP, gynaecology, eyes, first psychotherapy session need no code;
   │      │                other specialties need the referral code from their GP
   │      └─ Can't wait until tomorrow ─► 116117 (duty service). Life-threatening ─► 112
   │
   ├─ Therapy (physio etc.) ─► Heilmittelerbringerliste (agreement) else map data, "reported"
   ├─ Home care ─► DRK feed + § 7(3) SGB XI lists (agreement) else Pflegestützpunkt hand-off
   ├─ Hospital ─► Bundes-Klinik-Atlas export, keyed on InEK site number
   ├─ Pharmacy now ─► Avoxa feed (paid) or aponet link
   └─ Dentist / optician / acoustician ─► regional search link; map data labelled "reported"
          │
          ▼
   ENRICH (each fact attributed and timestamped)
     · travel time: OSM routing or Google (place_id only)
     · opening hours: 116117 / provider website / Google (not stored)
     · price: care-fund lists for care services only; otherwise provider website or "Not known"
     · step-free access: 116117 accessibility fields, G-BA reports (hospitals), else "ask"
```

### Which source decides what

| Question | Source of truth | Fallback |
|---|---|---|
| Is this doctor licensed to treat statutory patients? | KV Arztregister, via 116117 | Show the 116117 link, not our own list |
| Is this therapy practice licensed? | Heilmittelerbringerliste | "Reported" from map or website |
| Is this care service contracted with the care funds? | § 7(3) SGB XI list | DRK's own data for DRK services; else Pflegestützpunkt |
| Is this hospital real, and where? | Bundes-Klinik-Atlas / InEK site register | Destatis directory |
| Can I book, and when? | 116117 third-party interface | Phone 116117; practice phone |
| Which pharmacy is open now? | Chamber rota (Avoxa / regional XML) | aponet link |
| Price | Care-fund lists (care only) | "Not known" |

### Private cover (PKV)

No industry-wide provider directory was found **[not found]**; the PKV association's site was blocked here. Privately insured people may see any licensed doctor, so the 116117 search still works for finding one (booking via 116117 is for statutory patients). People in the PKV basic tariff (*Basistarif*) can only be treated by GKV-licensed doctors **[search]**. Insurers run their own doctor-finding services for members; any feed is a partnership question. Care Finder should ask "statutory or private?" early and, for private, skip the 116117 booking path.

### Identity and matching

- **Doctors:** the 9-digit practice number (*Betriebsstättennummer*, BSNR) and doctor number (*LANR*) are the register's keys (agreement under § 293 Abs. 4 SGB V **[search]**). We will only see them if the 116117 interface or a KBV agreement exposes them. Don't derive them.
- **Hospitals:** InEK *Standortnummer* (77xxxx + unit digits). The Institutionskennzeichen (IK) identifies the billing entity, not the site.
- **Pharmacies and practices in the TI:** Telematik-ID (gematik), if access is granted.
- **Care services:** IK of the care service, as used in the care-fund lists **[search: field names not confirmed]**.
- **Everything else:** normalised name + address + phone, plus Google `place_id` (storable).

### Our code **[ours]**

The register layer added for Spain (`server/services/careRegister.ts`, `shared/careFinder/register.ts`) is REGCESS-shaped: `ccn`, province and INE codes, `care_codes` as `U.nn`, and Spain-specific evidence text in `server/services/careFinderSearch.ts` ("Authorised for this care in Spain's official register…"). Germany needs a register record with `country`, `source` (`kbv`, `heilmittel`, `pflege_7_3`, `klinikatlas`, …), `source_id`, a care-type list in our own vocabulary, and per-source evidence text. Generalise before importing anything German.

---

## 4. Compliance and operating risks

1. **No open licence on the doctor data.** Copying arztsuche.116117.de would breach the KBV's control of the Arztregister and probably the database maker's right (§ 87a ff. UrhG) **[search: statute not opened]**. Link out or integrate via § 370a SGB V.
2. **Non-commercial clauses on care data.** The § 7(3) and § 115 SGB XI terms exclude commercial use, including paid online services. **[search]** Using AOK or Pflegelotse data in VYVA without an agreement is a breach, even through the DRK deployment, unless the agreement says otherwise.
3. **Neutrality and paid placement.** The Federal Court of Justice held (VI ZR 30/17, 20 Feb 2018) that a doctor-rating portal that showed paying competitors' ads on non-paying doctors' profiles lost its position as a "neutral information intermediary", and the doctor could demand deletion. **[search]** Our rule "paid placement never affects ranking" is also a legal protection in Germany. Keep it, and test it.
4. **Personal data.** Doctor and therapist listings are personal data (name, specialty, practice address). Showing them on demand from an official source is defensible; building our own index of named professionals is a new purpose under the GDPR and needs its own legal basis and an Art. 14 notice. **[law, general GDPR; no German-specific ruling checked]**
5. **116117 practice opt-out.** Practices can object to their appointments being passed to third parties. Results via the interface will be incomplete by design. Say "appointments available through 116117", never "all appointments".
6. **Medical-device line.** Routing a person to 112 or 116117 is fine. Triage ("this sounds like it can wait") is not; the Notfallreform plans a structured first assessment (*Ersteinschätzung*) inside 116117 itself. **[search]**
7. **Pending law that changes the routes.**
   - **Emergency-care reform** (Bundestag print 21/6808): cabinet 22 April 2026, first reading 9 July 2026, in committee. Splits 116117 into an appointment service and an "acute control centre" linked to 112, with integrated emergency centres at hospitals. **Not passed** as far as found. **[search]**
   - **GP-first system** (*Primärarztsystem*): draft promised for late summer or late November 2026; GP or 116117 to set the need and time window for specialist appointments. **No draft found.** **[search]**
   - Both strengthen the case for 116117 as the route. Re-check before building the hand-off copy.
8. **Hospital atlas status.** One source says the G-BA took over the atlas on 15 April 2026; press reports in mid-2026 say the BMG was reviewing whether to discontinue it. **[search]** Build on the InEK site register as the stable layer and treat the atlas file as a convenience.
9. **Attribution.** Every official source we use expects the source and the data date shown next to the data (care-fund lists explicitly; G-BA; chambers). Build this into the evidence model, as for Spain.

---

## 5. MVP and production sources

**MVP (next 30–60 days), for the DRK pilot area:**
- **Statutory-cover hand-off**, no data import: plain-language guidance + deep links to arztsuche.116117.de and 116117-termine.de, the 116117 phone number, the referral-code rule, and 112 for emergencies.
- **Hospitals:** import the Bundes-Klinik-Atlas export monthly (once its licence is confirmed), keyed on InEK site number, with its coordinates.
- **DRK services:** ask DRK for a feed of its own ambulante Pflege, Hausnotruf, day care and care-advice locations in the pilot area. This is the one German care dataset we can get clean rights to quickly.
- **Pharmacies:** aponet widget/link for emergency duty (free, attributed). Price the Avoxa feed.
- **Everything else:** map data (OSM) or Google, labelled "reported", plus a link to the official regional search (KZV for dentists, Heilmittelerbringerliste for therapists).
- **Geocoding:** self-hosted Nominatim on a Germany extract; the public instance only for low-volume user-address lookups.
- **Generalise the register schema** (section 3) before the first German import.

**Production:**
- **116117 third-party interface:** apply to kv.digital, pass the audit, then search and book in-app. Highest value.
- **KBV:** ask for an Arztregister extract or query access for a care-navigation service (with DRK as co-applicant).
- **GKV-Spitzenverband:** ask for the Heilmittelerbringerliste as data.
- **AOK-Bundesverband / vdek:** ask for commercial terms for the § 7(3) SGB XI lists, or confirm that a DRK-operated service qualifies.
- **gematik:** ask about read access to the FHIR directory for opening hours.

## 6. Sources not to trust

- **Scraped arztsuche.116117.de or patientennavi.116117.de data**, including third-party "Arztsuche API" wrappers.
- **POI-Bund health categories:** commercial address data under a federal label.
- **Commercial doctor portals** (Jameda, Doctolib listings, arzt-auskunft.de) as evidence of licence or specialty. arzt-auskunft.de's own terms limit use to single, manual searches. **[search]**
- **Care-quality grades** (*Pflegenoten*) as a ranking signal: legally non-commercial and widely criticised.
- **Unofficial pharmacy-duty APIs** (e.g. a 2020 GitHub project): unclear licence and source.
- **The community Klinik-Atlas OpenAPI** as a contract: it describes the site's internal JSON, which can change without notice. Use the official export.

---

## 7. API and data access

### 116117 interface for third parties **[search]**

- **Legal basis:** § 370a SGB V. KBV commissioned KV.digital; in-person appointments added in 2025, video before that.
- **Spec:** FHIR implementation guide "Terminschnittstelle für Dritte" on Simplifier (versions 2.0.0, 2.1.0 seen); published on gematik INA 13 June 2025.
- **Process:** procedural rules (*Verfahrensordnung*) on the KBV site from 30 June 2025; testing via kv.digital; audit certificate required (request by email to audit@kv.digital, subject "Anmeldung Audit" + interface name, per the referral-code test package of 9 May 2025).
- **Functions:** search, book, cancel appointments; request referral codes.
- **Limits:** practices can opt out; Bitkom criticised the requirements as going beyond the statute (Dec 2024 draft). Whether the final version changed: not confirmed.
- **Not found:** auth method, rate limits, costs, current 2026 version.

### Bundes-Klinik-Atlas **[search]**, with one **[verified 8 Oct 2026]** item

- **Official export:** ZIP from the open-data page, `TVERZ_Export.xml` + XSD, 21 April 2026, about 556 KB. Case counts under 4 are replaced by `-1`.
- **Site JSON (community-documented, verified on GitHub):** `https://bundes-klinik-atlas.de/fileadmin/json/locations.json` → `name, street, city, zip, phone, mail, beds_number, latitude, longitude, link`; also `states.json`, `icd_codes.json`, `ops_codes.json`, `german-places.json`, and `/searchresults/` with `tx_solr[latlon]`, `[icd]`, `[ops]`, `[department]`. Host not reachable from here; responses not seen.
- **Refresh:** site data monthly from InEK.
- **Licence:** not found. § 135d SGB V gives a right of access, not a licence.

### InEK hospital-site register **[search]**

- `krankenhausstandorte.de`; registration required; XML; 2025 schema only from 2 October 2026; weekly updates under the 2025 agreement; history kept. Field list (Anlage 1 of the agreement) not read.

### GKV-Spitzenverband Heilmittelerbringerliste **[search]**

- Web search on gkv-spitzenverband.de. Inputs: place, radius, therapy area, optional special service. Outputs: name, address, phone, email, website, accessibility. Monthly. No export.

### Care-fund lists (§ 7(3) SGB XI) **[search]**

- Coordinated by AOK-Bundesverband through the AOK-Pflegenavigator; XML export quarterly for research and journalism (`navigatoren.aok.de/export/`). Terms: non-commercial, source + delivery date shown prominently.

### Pharmacies **[search]**

- **Avoxa** (commissioned by the Bundesapothekerkammer): national daily XML; price on request.
- **LAK Thüringen:** free XML API, registration with real name and email, attribution; endpoint changed May 2026.
- **BLAK (Bavaria):** XML and HTML; attribution.
- **aponet:** widgets only.

### Geocoding

- **Nominatim (public instance) [verified 8 Oct 2026]:** `https://nominatim.openstreetmap.org/search?q=…&format=jsonv2&addressdetails=1` with an identifying User-Agent. A test with "Carstennstraße 58, Berlin" returned the building (tagged hospital, "Rittberg-Krankenhaus") with lat/lng, postcode, borough and `ISO3166-2-lvl4: DE-BE`; the response carries `"licence": "Data © OpenStreetMap contributors, ODbL 1.0"`. **Policy [search]** (policy page blocked here): at most 1 request per second, identifying User-Agent or Referer, cache results, attribution, **no bulk geocoding**; client-side autocomplete is reported as forbidden. **Use:** user addresses on demand only. Bulk geocoding of registers → **self-host Nominatim** on a Germany extract (Geofabrik; ODbL).
- **BKG geocoder (gdz_geokodierung) [search]:** official house coordinates of the Länder. **Free only for federal bodies** (V GeoBund); others license through the ZSGT under the AdV fee directive. A BKG page lists the geocoding service at **€18,000**; which fee version that belongs to was not confirmed. The terms allow persistent storage of results. Attribution: "© GeoBasis-DE / BKG (year)". One search summary said a new fee directive 4.1 from 1 January 2027 moves the data to open licences (dl-de/by-2-0 or CC BY 4.0) with provision fees only; **a second search found no trace of 4.1. Unconfirmed.** Worth one phone call to the BKG service centre: if true, it changes the geocoding answer from 2027.
- **Regional open house coordinates [search]:** Sachsen (GeoSN, dl-de/by-2-0, ATOM download), Schleswig-Holstein (CC BY 4.0), city sets such as Essen (dl-de/by-2-0, GeoJSON). Coverage depends on the DRK pilot Land.

---

## 8. Länder (states)

Time-boxed. Only things found; most Länder not checked.

| Land | Open data with coordinates found | Licence | Note |
|---|---|---|---|
| Berlin | Public pharmacies (map service + table, yearly) | dl-de/zero-2-0 **[search]** | gdi.berlin.de |
| Brandenburg | Pharmacy locations (INSPIRE, LAVG) | dl-de/by-2-0 **[search]** | |
| Bremen | Hospital sites | CC BY **[search]** | |
| NRW (cities) | Hospital sites: Bonn (GeoJSON/API), Münster (KML) | open.nrw **[search]** | City-level only |
| Sachsen | Official house coordinates (address service, free) | dl-de/by-2-0 **[search]** | Geocoding option |
| Dresden | Pharmacy statistics | dl-de/by-2-0 **[search]** | Statistics, not a register |
| Schleswig-Holstein | House-coordinate service | CC BY 4.0 **[search]** | Geocoding option |
| Thüringen | Pharmacy duty XML (chamber) | Chamber terms, free with registration **[search]** | |
| Bayern | Pharmacy duty XML/HTML (chamber) | Attribution **[search]** | |

**KVs** each run their own doctor search and a terminservicestelle, all feeding 116117. No KV open data found **[not found]**. Which Land the DRK pilot runs in decides which rows matter; fill this table for that Land first.

---

## 9. Professional chambers and registers

| Profession | Body | Public search | Bulk / API |
|---|---|---|---|
| Doctors (GKV-licensed) | KVs / KBV (Arztregister) | arztsuche.116117.de | Named recipients only **[search]** |
| Doctors (all) | 17 Landesärztekammern | Per state, linked from Bundesärztekammer **[search]** | None found |
| Psychotherapists | KVs (GKV-licensed); Landespsychotherapeutenkammern | 116117 search ("Expertensuche" shows phone availability) **[search]** | None found |
| Dentists | KZVs; Landeszahnärztekammern | Per state via KZBV map **[search]** | None found |
| Pharmacists / pharmacies | Landesapothekerkammern | aponet; chamber sites | Avoxa (paid); some chamber XML |
| Therapists (physio etc.) | No chamber; licence via ARGE Heilmittelzulassung | Heilmittelerbringerliste | None found |
| Acousticians, opticians | Handwerkskammern (trade register); biha, ZVA (trade bodies) | Not found | None found |

---

## 10. Reachability from this environment (8 Oct 2026)

**Reachable:** `nominatim.openstreetmap.org` (search API answered), `raw.githubusercontent.com` (public raw files), `pypi.org`.

**Blocked by the network proxy (403 on CONNECT; the page fetcher reports "egress blocked"):** kbv.de, 116117.de, arztsuche.116117.de, 116117-termine.de, patientennavi.116117.de, bundes-klinik-atlas.de, klinikatlas.api.proxy.bund.dev, deutsches-krankenhaus-verzeichnis.de, g-ba.de, qb-referenzdatenbank.g-ba.de, destatis.de, kzbv.de, zahnarztsuche.de, pflegelotse.de, aok.de, bkk-pflegefinder.de, gkv-spitzenverband.de, vdek.com, aponet.de, abda.de, govdata.de, ckan.govdata.de, sg.geodatenzentrum.de, sgx.geodatenzentrum.de, gdz.bkg.bund.de, bkg.bund.de, arzt-auskunft.de, all KV sites tried (kvb, kvwl, kvno, kvberlin, kvsachsen, kvhessen, kvbawue, kvn, kv-rlp, kvsh, kvmv, kv-thueringen, kvsa, kvbb, kvhb, kvhh, kvsaarland), pkv.de, datenlizenz-deutschland.de, bundesgesundheitsministerium.de, gesund.bund.de, drk.de, zqp.de, simplifier.net, update.kbv.de, kv.digital, gematik.de, fhir-directory.gematik.de, biha.de, zva.de, bundesaerztekammer.de, open.nrw, daten.berlin.de, opendata.schleswig-holstein.de, data.europa.eu, de.wikipedia.org, gesetze-im-internet.de, openstreetmap.org, operations.osmfoundation.org, photon.komoot.io, web.archive.org.

**Connection reset:** overpass-api.de, download.geofabrik.de.

**GitHub API:** session limited to configured repositories; public repos readable only as raw files.

Every **[search]** item in this report should be re-checked from an unrestricted machine. Priority: the Klinik-Atlas open-data page and its licence; the 116117 third-party procedural rules; the § 7(3) SGB XI terms; the BKG fee directive.

---

## 11. 30 / 60 / 90 days

**Days 0–30: hand-offs and the asks.**
- Build the statutory-cover hand-off (116117 search, booking, phone, referral-code rule, 112).
- Generalise the register schema for multiple countries and sources.
- Write to kv.digital to start the 116117 interface onboarding.
- Ask DRK for a feed of its own services in the pilot area, with reuse rights written into the contract.
- Re-check every **[search]** item in section 10's priority list from an unrestricted machine.

**Days 30–60: hospitals and pharmacies.**
- Import the Klinik-Atlas export (licence permitting); key on InEK site number.
- Self-host Nominatim on a Germany extract; geocode only what lacks coordinates.
- aponet link for emergency pharmacies; decide on the Avoxa feed.
- Requests to GKV-Spitzenverband (Heilmittelerbringerliste) and AOK-Bundesverband (§ 7(3) lists, commercial terms).

**Days 60–90: booking.**
- 116117 interface integration through audit.
- Ask KBV about Arztregister access for care navigation.
- Re-check the Notfallreform and GP-first bills; adjust the hand-off copy.

## 12. Open questions

1. **Legal:** what licence covers the Bundes-Klinik-Atlas export, and does the InEK site-register XML allow commercial reuse?
2. **Legal / partnership:** can a commercial service get the § 7(3) SGB XI care lists, and on what terms? Does a DRK-operated deployment change that?
3. **Partnership:** what does the 116117 third-party interface require in practice (audit scope, cost, auth, rate limits, share of practices that opted out)?
4. **Partnership:** will KBV give query access to the Arztregister (specialty + location + accessibility) to a care-navigation service?
5. **Technical:** does the InEK XML carry coordinates? Does the Heilmittelerbringerliste exist as a file?
6. **Technical:** does AdV fee directive 4.1 (open licences from 1 January 2027) exist? If yes, the BKG geocoder becomes the obvious choice.
7. **Product:** which Land is the DRK pilot in? That decides the state rows, the KV, the KZV and the pharmacy chamber.
8. **Regulatory:** will the Notfallreform pass in 2026, and what does it do to 116117's role?

## Sources

All **[search]** unless marked. Opened on 8 Oct 2026: Nominatim API; [bundesAPI/klinikatlas-api README and openapi.yaml](https://github.com/bundesAPI/klinikatlas-api) (raw files).

- 116117 / KBV: [arztsuche.116117.de](https://arztsuche.116117.de/) · [Terminschnittstelle für Dritte (Simplifier)](https://simplifier.net/guide/implementierungsleitfaden-terminschnittstelle-fuer-dritte/Terminschnittstelle-f%C3%BCr-Dritte?version=2.1.0) · [Ärzteblatt: third parties may book in-person appointments](https://www.aerzteblatt.de/news/116117-drittanbieter-konnen-auf-behandlungstermine-in-prasenz-zugreifen-4d1a5cc2-78ca-46d0-bd17-70cf7c895c81) · [Bitkom position](https://www.bitkom.org/Bitkom/Publikationen/Stellungnahme-Benehmensherstellung-zur-Schnittstelle-zum-116117-Terminservice) · [KBV referral-code test package](https://update.kbv.de/ita-update/TSS/3_0_0/KBV_ITA_AHEX_Pruefpaket_116117_Vermittlungscode.pdf) · [patient booking guide](https://www.116117-termine.de/fileadmin/user_upload/116117_TS_Anleitung_Patient.pdf) · [Bundesarztregister on the administrative-data platform](https://www.verwaltungsdaten-informationsplattform.de/register/214) · [KBV Bundesarztregister](https://www.kbv.de/html/bundesarztregister.php) · [KBV Kollegensuche](https://www.kbv.de/praxis/tools-und-services/kollegensuche) · [KVBW Terminservice](https://www.kvbawue.de/patienten/patientenservice-116117/terminservicestelle-fuer-patienten) · [KVB psychotherapy information](https://www.kvb.de/fileadmin/kvb/Patienten/Psychotherapie/KVB-Patienteninformation-Psychotherapie.pdf)
- Hospitals: [Bundes-Klinik-Atlas open data](https://bundes-klinik-atlas.de/open-data/) · [data basis overview, 30 June 2026](https://bundes-klinik-atlas.de/fileadmin/user_upload/2026-06-30_%C3%9Cbersicht-Datengrundlage-BKA.pdf) · [IQTIG](https://iqtig.org/qs-instrumente/bundes-klinik-atlas/) · [Berliner Zeitung on the atlas review](https://www.berliner-zeitung.de/article/nina-warken-beendet-karl-lauterbachs-prestige-projekt-das-ist-der-grund-2354956) · [InEK site register](https://krankenhausstandorte.de/login) · [site-register agreement, 1 June 2025](https://www.dkgev.de/fileadmin/Mediapool/2_Themen/2.1_Digitalisierung_Daten/2.1.2._Informationstechnik_im_Krankenhaus/2.1.2.1._Verzeichnisse_und_Register/2025-06-01_Verzeichnisvereinbarung_gemaess____293_Absatz_6_SGB_V_.pdf) · [Standortnummer](https://de.wikipedia.org/wiki/Standortnummer) · [Destatis/Statistikportal hospital directory](https://www.statistikportal.de/de/veroeffentlichungen/krankenhausverzeichnis) · [G-BA quality reports](https://www.g-ba.de/themen/qualitaetssicherung/datenerhebung-zur-qualitaetssicherung/datenerhebung-qualitaetsbericht/) · [G-BA ANB](https://www.g-ba.de/downloads/40-268-9061/2022-11-17_Qb-R_ANB-Auftragsformular-DSE-Qb-XML-Format_Anlage-1.pdf)
- Therapy: [GKV-Spitzenverband Heilmittelerbringer](https://www.gkv-spitzenverband.de/service/heilmittelerbringer/heilmittelerbringer.jsp) · [IWW on the list's launch](https://www.iww.de/pp/perspektiven/praxiskommunikation-gkv-sv-veroeffentlicht-liste-von-heilmittelerbringern-f143330) · [vdek Heilmittel licensing](https://www.vdek.com/vertragspartner/heilmittel/zulassung.html)
- Aids: [GKV-SV Präqualifizierung for providers](https://www.gkv-spitzenverband.de/krankenversicherung/hilfsmittel/praequalifizierung/hinweise_fuer_leistungserbringer/hinweise_fuer_leistungserbringer.jsp)
- Care: [AOK-Pflegenavigator](https://www.aok.de/pk/pflegenavigator/) · [AOK export](https://navigatoren.aok.de/export/) · [§ 7(3) SGB XI terms](https://www.vdek.com/vertragspartner/Pflegeversicherung/Pflegelotse/_jcr_content/par/download_415898711/file.res/Leistungs_und%20_Preisdaten_Allgemeine_Nutzungsbedingungen.pdf) · [§ 115 terms, 30 June 2026](https://www.vdek.com/vertragspartner/Pflegeversicherung/Pflegelotse/_jcr_content/par/download_223948164/file.res/Allgemeine-Nutzungsbedingungen-vom-30062026-inkl-Anlagen.pdf) · [vdek-Pflegelotse](https://www.vdek.com/vertragspartner/Pflegeversicherung/Pflegelotse.html) · [§ 7 SGB XI](https://www.gesetze-im-internet.de/sgb_11/__7.html) · [ZQP advice database (Ärzteblatt)](https://www.aerzteblatt.de/news/neue-datenbank-gibt-informationen-ueber-pflegeberatung-30140622-4841-4323-a267-3555348b3833)
- Pharmacies: [apotheken-notdienstdaten.de](https://apotheken-notdienstdaten.de/) · [aponet widgets](https://apotheken-notdienstdaten.de/aponet-download-service/widgets/apotheken-und-notdienstsuche/) · [LAKT XML](https://www.lakt.de/xml-schnittstelle) · [BLAK web integration](https://www.blak.de/notdienst/notdienst-und-dienstbereitschaft/webintegration) · [LAK BW](https://www.lak-bw.de/notdienstportal)
- Dentists: [KZBV/KBV linking (zm)](https://www.zm-online.de/news/detail/kzbv-und-kbv-kooperieren-bei-bundesweiter-arzt-und-zahnarztsuche) · [KZBV regional searches (zm)](https://www.zm-online.de/news/detail/kzbv-staerkt-digitale-zahnarztsuchen-in-den-laendern)
- gematik: [VZD spec](https://fachportal.gematik.de/fachportal-import/files/gemSpec_VZD_V1.15.0.pdf) · [pharmacy directory change (apotheke adhoc)](https://www.apotheke-adhoc.de/nachrichten/detail/e-rezept/gedisa-liefert-keine-apothekendaten-mehr/)
- Geodata: [BKG geocoder terms](https://sg.geodatenzentrum.de/web_public/gdz/lizenz/deu/nutzungsbedingungen_geokodierungsdienst_adv.pdf) · [AdV fee directive note](https://gdz.bkg.bund.de/index.php/default/neue-adv-gr-4/) · [POI-Bund sources](https://sg.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_poi-bund.pdf) · [Sachsen addresses (INSPIRE)](https://gdk.gdi-de.org/geonetwork/srv/api/records/d3a177ab-a4b2-435a-9f37-7dca287d9e62) · [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (not opened)
- Law and policy: [§ 75 Abs. 1a / accessibility (Bremen Senate, March 2026)](https://www.rathaus.bremen.de/sixcms/media.php/13/20260317_top_3_Barrierefreiheit_von_Arzt_und_Psychotherapiepraxen.pdf) · [Notfallreform, Bundestag first reading](https://www.bundestag.de/dokumente/textarchiv/2026/kw28-de-notfallversorgung-1192586) · [BMG cabinet decision 22 Apr 2026](https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen/bundeskabinett-beschliesst-notfallreform-22-04-2026) · [GP-first system (ZDF)](https://www.zdfheute.de/politik/deutschland/hausarzt-wartezeiten-termine-warken-100.html) · [BGH VI ZR 30/17 commentary](https://www.ra-plutte.de/jameda-nicht-neutral-bgh-erlaubt-loeschung-arztprofil/)
- Open data: [Berlin pharmacies](https://gdi.berlin.de/geonetwork/srv/api/records/831192fe-606d-3059-b497-287a09b18728) · [Bremen hospitals](https://gdk.gdi-de.org/geonetwork/srv/api/records/FB6FE52D-0BB6-43A6-AB9E-7818DF745B7E) · [Bonn hospitals](https://ckan.open.nrw.de/dataset/krankenhausstandorte-bn) · [Dresden pharmacies](https://opendata.dresden.de/dcat-ap/dataset/de-sn-dresden-apotheken_1993ff_dresden)
- PKV: no provider directory found. Basistarif members may only be treated by GKV-licensed doctors ([Allianz](https://www.allianz.de/gesundheit/private-krankenversicherung/basistarif/)), so the 116117 search also serves them. Otherwise privately insured people use any licensed doctor (chamber searches) and their insurer's own service.
