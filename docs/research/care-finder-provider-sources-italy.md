# Care Finder: provider source strategy for Italy

Checked: 8 October 2026. Scope: Italy only. This is a companion to the Spain, Germany, France and UK reports in this folder, with the same structure and evidence marks.

## How the evidence was gathered

The network proxy in this environment refused **every Italian public host tried** (section 10). That includes dati.salute.gov.it, salute.gov.it, dati.gov.it, all eight regional open-data portals in scope, every regional booking portal, FNOMCeO, FNOPI, FNOFI, TSRM-PSTRP, the psychologists' council, ANNCSU, Agenzia delle Entrate, Normattiva and the Gazzetta Ufficiale. Both `curl` and the page fetcher were blocked.

Two things were reachable:

- **raw.githubusercontent.com**. HL7 Italia's terminology repository (`hl7-it/terminology`) carries FHIR CodeSystems built from four Ministry of Health open datasets: pharmacies, parapharmacies, hospitals and ASLs. They were downloaded and analysed. They are a snapshot, not the live files (section 7). Two community repositories about the national address register (ANNCSU) were also read.
- **nominatim.openstreetmap.org**. It was queried live with Italian addresses (section 7).

Nothing was saved in the repository. Downloads are in the session scratchpad.

Evidence marks:

- **[verified 8 Oct 2026]**: the page, file or service was opened and the stated facts were read from it.
- **[secondary]**: read in a third-party file derived from the official source (here, HL7 Italia's CodeSystems built from Ministry datasets, and community ANNCSU repositories). The data is real, but the conversion was not done by the publisher.
- **[search]**: found only through web search (result snippets and search-engine summaries). Not yet confirmed. **Most of this report is [search]**, because the official hosts were blocked.
- **[law]**: the obligation comes from a statute or decree. The cited text appeared in search results; the statute itself was not opened.
- **[ours]**: a fact about our own code, checked directly.
- **[not found]**: looked for, within a time limit, and not found. This does not prove it doesn't exist.

---

## 1. Executive recommendation

Italy is the hardest of the five countries so far. **Spain and France each have one national register of authorised places with care-offered codes. Italy has no open equivalent.** Health facilities are authorised and accredited by the regions. The Ministry collects facility data through its NSIS reporting forms (HSP for hospitals, STS11 for territorial facilities with SSN contracts), but the open data it publishes covers pharmacies, hospitals and ASLs, not the private clinics, dentists, physiotherapists and psychologists that make up most of what Care Finder looks for. **[search]**

What works:

1. **Pharmacies are the one clean national dataset.** The Ministry of Health's *Farmacie* dataset lists every pharmacy open to the public, including branches and seasonal dispensaries, with the ministerial pharmacy code, ASL code, VAT number, full address, validity dates and **latitude/longitude**. CSV, XML and JSON, **updated daily**, **Italian Open Data License v2.0 (IODL 2.0)**. A current file is named `FRM_FARMA_5_20260116.csv`. **[search]** HL7 Italia's copy of it holds 20,617 pharmacy codes **[secondary]**. Two caveats: about 10% of rows have no coordinates and some coordinates are wrong, and the Ministry says some coordinates came from OpenStreetMap, which brings ODbL into play (section 4). **[search]**
2. **For people on SSN cover (almost everyone), the spine is a route, not a search.** Every resident is registered with a *medico di medicina generale* (MMG, the family doctor). Specialist visits, physiotherapy on the SSN, home care (ADI) and most diagnostics start with a **prescription from that doctor**, carrying a 15-character electronic prescription number (**NRE**). The person then books through their **regional CUP** (*Centro Unico di Prenotazione*) online, by phone or at a pharmacy, using their *codice fiscale*, health-card digits and the NRE. **[search]** Care Finder's job here is to **ask "do you have the prescription? What does it say?"**, then hand off to the right regional CUP with the right phone number and a checklist. It never books and never stores the NRE.
3. **Regional registers fill some gaps, unevenly.** Lombardia publishes a current pharmacy list with coordinates (updated 14 Sept 2026) and a geocoded facilities table **[search]**. Piemonte publishes CSVs of public facilities and private non-hospital facilities, including private outpatient units **[search]**. Toscana has a coordinates file per facility type, but it was last modified in 2015 **[search]**. Emilia-Romagna publishes hospitals only (CC BY 2.5 IT) **[search]**. Lazio's accredited-private list stopped in 2014 **[search]**. Sicilia and Campania publish lists of varying age **[search]**. None was opened.
4. **Same-day, out-of-hours care: 116117.** The European non-urgent medical number replaces the old *guardia medica* (*continuità assistenziale*) number. According to a Ministry update of 3 Sept 2026 reported in the press, it is active region-wide in Abruzzo, Basilicata, Calabria, Friuli Venezia Giulia, Lazio, Lombardia, Molise, Piemonte, Toscana, Veneto and the Province of Trento, and authorised but not confirmed live in Campania, Emilia-Romagna, Puglia, Sicilia, Valle d'Aosta and Bolzano. **[search]** Elsewhere the local *continuità assistenziale* number applies. 112/118 for emergencies.
5. **Professional registers verify people; they don't find them.** Doctors and dentists (FNOMCeO, two national registers), nurses (FNOPI and local OPI), physiotherapists (**FNOFI**, a separate order since Dec 2022; register live since 1 Feb 2023), psychologists (CNOP's *Albo Unico Nazionale*), and audiologists (*audioprotesisti*) and other technical professions (TSRM-PSTRP) all run public name searches. No bulk download or API was found. **[search]**
6. **Geocoding: ANNCSU first, Nominatim second.** ANNCSU, the national register of street numbers run by Istat and Agenzia delle Entrate, is published as open data (national and regional bulk files, monthly; a point API, daily), reportedly under **CC BY 4.0** **[search]**. Coordinates are optional for municipalities, so coverage is incomplete. Nominatim answered from here and geocoded Rome correctly, but put "Via Roma 1, Torino" in Chieri, the wrong town, because the city field matched the province **[verified 8 Oct 2026]**. Constrain by postcode or ISTAT municipality code.

What no Italian source provides reliably: **a list of private (non-SSN) providers by care type**, **availability**, **prices**, **opening hours**, **step-free access**, **languages**, and **duty-pharmacy rotas** as open data. For private dentists, private physiotherapists and private psychologists, discovery has to come from map data or provider websites, labelled "reported", with the professional register used to check a named person. A booking-platform partnership is the only route to availability.

---

## 2. Italy source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Fit |
|---|---|---|---|---|---|---|---|
| 1 | **Ministry *Farmacie* dataset** ([page](https://www.dati.salute.gov.it/it/dataset/farmacie/); [file seen](https://www.dati.salute.gov.it/sites/default/files/opendata/FRM_FARMA_5_20260116.csv)) | Every pharmacy open to the public, including branches and dispensaries | **Official** (Ministero della Salute) | Pharmacies | **[search]** CSV/XML/JSON, **daily**. Semicolon-separated; decimal comma in coordinates. Header includes `cod_farmacia`, `cod_farmacia_asl`, `data_inizio_validita`, `data_fine_validita` ("-" when open), `latitudine`, `longitudine`; plus name, VAT number, street, postcode, *frazione*, municipality, province, region. **Phone [not found].** **[secondary]** 20,617 codes in HL7 Italia's copy: type 1 = 19,849, type 3 = 610, type 2 = 84, type 4 = 74; 229 with an end date; latest start date in the copy 2023-08-01 (the copy is stale). | **[search]** IODL 2.0. Some coordinates "© OpenStreetMap contributors" per the dataset page. | **High.** National pharmacy spine. |
| 2 | **Ministry *Parafarmacie*** (shops other than pharmacies selling OTC medicines) | Licensed outlets for non-prescription medicines | **Official** | Parapharmacies | **[search]** Dictionary PDF exists (`Dizionario-DatasetParafarmacieTipologieMedicinaliVenduti.pdf`). Codes start with zero. **[secondary]** 10,750 codes, 3,645 with an end date. | **[search]** IODL 2.0 (as the pharmacy file) | Low. Not care. |
| 3 | **Ministry hospital datasets**: "Strutture di ricovero pubbliche e equiparate presenti nel territorio della ASL" ([page](https://www.dati.salute.gov.it/it/dataset/strutture-di-ricovero-pubbliche-e-equiparate-presenti-nel-territorio-della-asl/)); "Posti letto per struttura ospedaliera" (yearly to 2023); "Elenco Aziende sanitarie locali e Strutture di ricovero" on salute.gov.it | Hospitals and beds, from forms HSP11–13 | **Official** | Public and accredited hospitals | **[search]** Annual. The ASL-territory dataset: 23 fields, 628 rows, last updated 21 May 2024. The salute.gov.it page has a file of public and private hospitals active on 1 Mar 2023 with address. **[secondary]** HL7 copy: 1,135 hospital codes with region, municipality, ASL, company code, hospital type, public/private. | **[search]** IODL 2.0 | **Medium.** Hospitals rarely matter for Care Finder, except outpatient clinics inside them. |
| 4 | **Ministry facilities CSV with SSN relationship** (`C_17_dataset_70_0_upFile.csv`) | Facility list with columns *Anno; Codice Regione; Codice ASL territoriale; Codice Azienda; Denominazione Azienda; Codice struttura; Denominazione struttura; Tipo rapporto con il S.S.N.* plus address, municipality, phone | Official | Facilities reporting to the SSN | **[search]** 2019 data per the snippet. Which dataset it belongs to is not confirmed. | **[search]** IODL 2.0 | **Unknown.** Open it from an unrestricted machine; if it is the STS11 territorial list, it is the closest thing to a national register of SSN-contracted outpatient facilities. |
| 5 | **Ministry "Strutture e attività ASL"** ([page](https://www.dati.salute.gov.it/it/dataset/strutture-e-attivita-asl/)) | ASL organisation, activity, counts of contracted GPs and paediatricians | Official | ASLs | **[search]** Annual. Aggregates, **not a list of doctors**. | IODL 2.0 | Low. |
| 6 | **STS11** (NSIS form "Dati anagrafici strutture sanitarie") | The national annual record of territorial facilities with SSN contracts: clinics, labs, residential and semi-residential care, with care-type codes S01 (clinical), S02 (imaging), S03 (laboratory), S05–S13 (residential and others) | **Official** | SSN-contracted territorial facilities; **excludes GPs and paediatricians** | **[search]** Collected yearly; **no national open release found [not found]**. Trentino publishes its own STS11-derived list with coordinates. | n/a | **High if released.** Ask the Ministry (section 12). |
| 7 | **Regional registers** (section 8) | Regional open data on authorised/accredited facilities | **Official** | Varies by region | **[search]** Uneven: current with coordinates (Lombardia pharmacies), old with coordinates (Toscana 2015, Lombardia facilities 2021), CSV without confirmed coordinates (Piemonte), stale (Lazio 2014). | Mostly CC BY or IODL **[search]**; Milan's GP list is **CC BY-SA 3.0 IT** (share-alike) | **Medium to high** where current. |
| 8 | **GP lists** (MMG) | Name and practice address of SSN family doctors | Official (ASL/ATS, region, city) | GPs | **[search]** No national list. **Milan** (ATS Milano via Comune di Milano): CSV/JSON/GeoJSON with practice address and **coordinates**, updated 1 Oct 2026. **Campania**: regional CSV (ASL, name, practice address), 2019, semi-annual. **ASP Siracusa**: CSV, Oct 2024. | Personal data. Milan: CC BY-SA 3.0 IT. | **Medium.** Useful to help someone **choose** a GP; useless for "my GP" (we ask the person). |
| 9 | **Regional CUP booking portals** (section 8) | Where SSN patients book specialist visits and diagnostics with a prescription | **Official** | Public and accredited private providers | **[search]** Web and app; identification by *codice fiscale* + health-card digits + NRE, or SPID/CIE/CNS. **No public API or deep link found [not found].** | **Link only** | **High** as a hand-off. |
| 10 | **Fascicolo Sanitario Elettronico (FSE 2.0)** | National-framework, regionally run patient record; booking, GP choice and payment are among its planned core services | Official | Patient's own data | **[search]** Availability of booking and GP change varies by region in 2026. | n/a | **Link only.** |
| 11 | **Professional registers**: FNOMCeO, FNOPI/OPI, FNOFI, CNOP, TSRM-PSTRP, FOFI (section 9) | Who may practise | **Regulated** | Named professionals | **[search]** Web name searches; no API or bulk found. | Personal data, published for verification | **High** for checking a **named** person. Useless for discovery. |
| 12 | **ANNCSU** national address register (section 7) | Every street and street number, with coordinates where the municipality supplied them | **Official** (Istat, Agenzia delle Entrate) | All Italian addresses | **[search]** Bulk national/regional files, monthly; point API, daily. **[secondary]** Download URLs `getds.php?INDIR_ITA`, `STRAD_ITA`, `INDIR_<REGIONE>`. | **[search]** CC BY 4.0 | **High** for geocoding, with gaps. |
| 13 | **Nominatim / OpenStreetMap** | Geocoder and map features (`amenity=pharmacy`, `healthcare=*`, `ref:msal` = Ministry pharmacy code) | Community | Everything, unverified | **[verified 8 Oct 2026]** Public Nominatim reachable. | ODbL; public Nominatim usage policy (about 1 request/s, no bulk) **[search]** | Medium for location; low for what a place offers. |
| 14 | **Booking platforms** (e.g. MioDottore) and **Google Places** | Private profiles, availability; business listings | Commercial | Private practice | Not researched for Italy. | Partnership only; Google terms as in the Spain report | High for availability via partnership; zero for authorisation. |
| 15 | **Duty pharmacies** | Which pharmacy is open tonight | Rotas set by **regional law**; information run by Federfarma provincial bodies and third parties | Pharmacies | **[search]** Services: Federfarma Lombardia's "Pronto Farm@cia" freephone (Milan, Monza, Lodi), Federfarma Verona SMS, third-party farmaciediturno.org and paid apps. **No open rota data [not found].** | Link only | **High as a hand-off**, per province. |

### Care types and where each can come from

| Care type | Official place source | Status |
|---|---|---|
| Family doctor (MMG) | The person's own assignment; GP lists (Milan, Campania) to help choose | Ask, don't search |
| Specialist (SSN) | Prescription → regional CUP | Hand-off |
| Specialist (private) | Regional registers of authorised private outpatient units (Piemonte, Lombardia, Toscana) | Partial, region by region |
| Physiotherapy (SSN) | Prescription → CUP or ASL rehabilitation service | Hand-off |
| Physiotherapy (private) | **No open register of practices found.** FNOFI to verify a named physiotherapist | Map data / provider site, labelled "reported" |
| Dentist | SSN dental care is limited (mainly vulnerable groups) **[search, not checked]**; private dental studios **no open register found** | Map data / provider site; FNOMCeO dentists' register to verify a person |
| Optician | Not a regulated health facility; a commercial licence **[search, not checked]** | Map data only |
| Hearing-aid audiologist | *Audioprotesista* is a health profession in the TSRM-PSTRP order **[search]**; shops not registered as facilities **[not found]** | Map data; TSRM-PSTRP to verify a person |
| Psychologist | Private: CNOP register to verify; SSN: via ASL / *Casa della Comunità* | Map data + register check |
| Home care (ADI) | Not searchable: **MMG or hospital discharge team requests it**, the district's *Punto Unico di Accesso* (PUA) processes it, often in a *Casa della Comunità* **[search]** | Explain the route; give the PUA contact |
| Out-of-hours GP | 116117 where active, else local *continuità assistenziale* | Dial |
| Pharmacy | Ministry *Farmacie* dataset | **Spine** |
| Duty pharmacy | Federfarma provincial services / third parties | Link |

---

## 3. Recommended architecture

```
User request (plain words)
   │
   ▼
Requirements: care type · cover route (SSN / private) · has prescription? · area · access needs
   │
   ├─ SSN, needs a GP ───────► "Do you have a family doctor?" → help contact them
   │                            (choosing/changing: ASL desk or regional FSE portal)
   │
   ├─ SSN, has prescription ─► ask region + priority letter (U/B/D/P) on the slip
   │                            → regional CUP: web/app link, phone, pharmacy option
   │                            → checklist: codice fiscale, health card, NRE (user types it there)
   │
   ├─ SSN, home care ────────► explain ADI route: GP or discharge team → PUA / Casa della Comunità
   │
   ├─ Tonight / weekend ─────► 116117 (where active) or local continuità assistenziale; 112/118
   │
   ├─ Pharmacy ──────────────► Ministry Farmacie (daily) → distance → duty-pharmacy link
   │
   └─ Private
          │
          ▼
   PLACES: regional register where one exists (authorised/accredited, care type if given)
           else map data / provider website, labelled "reported, not checked against a register"
          │
          ▼
   NAMED PROFESSIONAL shown? ─► check their order's register (FNOMCeO, FNOFI, CNOP, FNOPI, TSRM-PSTRP)
          │
          ▼
   ENRICH: travel time (OSM/Google, place_id only) · hours (provider site) · price, access → "Not known"
```

### Which source decides what

| Question | Source of truth | Fallback |
|---|---|---|
| Is this a licensed pharmacy? | Ministry *Farmacie*, `data_fine_validita` empty | Regional pharmacy list |
| Is this place authorised for this care? | Regional register (where published) | **Nothing national.** Show as "reported". |
| Is this person allowed to practise? | Their order's register | Show the place, not the person |
| Where is it? | Dataset coordinates, else ANNCSU, else Nominatim with postcode | n/a |
| How do I book on the SSN? | Regional CUP entry page + phone | ASL CUP desk, participating pharmacy |
| Out-of-hours? | 116117 where active | Local *continuità assistenziale* |
| Home care? | ADI route via GP / PUA | "Ask your family doctor" |
| Price, step-free, languages, availability | Provider website (self-declared) | "Not known, ask when you call" |

### Identity and matching

1. **Pharmacy:** the ministerial `cod_farmacia` is the key (OSM stores it as `ref:msal`).
2. **Hospitals and SSN facilities:** region code + company code + facility code (the HSP/STS codes).
3. **Private places from regional registers:** the regional register id, prefixed by region.
4. **Places from map data:** Google `place_id` or OSM id, flagged as unregistered.
5. **Professionals:** link to places only when a source says so; shown as reported.

### Evidence and staleness

Same model as the Spain report **[ours]**: verified / reported / unknown / conflicting, each with source, URL and check date. Pharmacy data can be at most a few days old (daily source). Regional registers: their own stated refresh, and any register last updated before 2024 is shown as "reported" only. Ranking rules (hard filters, fit, travel time; paid placement never affects order) carry over unchanged.

---

## 4. Compliance and operating risks

1. **Health data in the booking path.** A prescription (NRE, the prescribed service, exemption codes) is health data under GDPR art. 9; the NRE resolves to the patient's *codice fiscale* and prescribed services **[search]**. **Do not collect or store the NRE.** Tell the person what they'll need and let them enter it on the regional portal. Asking only for the region and the priority letter is enough to route them.
2. **Personal data in lists.** GP lists name doctors; pharmacy rows can name owners; professional registers are personal data published for verification. Look up named people on demand; don't build a people index. Same reasoning as Spain and France.
3. **Licences.**
   - IODL 2.0 is an attribution licence, described as compatible with CC BY and ODC-BY **[search]**. Commercial reuse was **not confirmed** from the licence text (dati.gov.it was blocked). Read it before production.
   - Milan's GP list is **CC BY-SA 3.0 IT**: share-alike may reach a derived database. Use for lookup, not merged into our own register, until reviewed.
   - The Ministry pharmacy file says some coordinates came from **OpenStreetMap** **[search]**. Those rows carry ODbL obligations. Prefer re-geocoding via ANNCSU and keep OSM-derived coordinates separate.
   - HL7 Italia's CodeSystems are under HL7's FHIR licence **[verified 8 Oct 2026]**. Use them only as a schema reference, never as the data source.
4. **Health advertising law.** Italian law limits health-care communications by private facilities and registered professionals to informative content, excluding promotional or "suggestive" elements (Legge 145/2018, art. 1 c. 525) **[law]**. Our "paid placement never affects ranking" rule is a good fit with this. Any sponsored listing would need legal review first.
5. **Medical-device classification.** Same as elsewhere: directory and hand-off only, no triage beyond pointing at 112/118 and 116117.
6. **Data quality.** OSM contributors report wrong coordinates, closed VAT numbers and non-existent pharmacies in the Ministry file **[search]**. Validate on import: drop rows with an end date, coordinates outside the stated municipality, or decimal-comma parse failures.

---

## 5. MVP and production sources

**MVP (next 30–60 days), Lombardia and Piemonte:**
- **Pharmacies:** Ministry *Farmacie* daily file as the national spine; Lombardia's ARIA "Elenco Completo Farmacie" for comparison.
- **SSN route:** region → CUP hand-off (Lombardia: PrenotaSalute, phone 800 638 638 / 02 99 95 99; Piemonte: CUP Piemonte, 800 000 500) **[search]**; "do you have the prescription? which priority letter?"; never ask for the NRE.
- **Out-of-hours:** 116117 (active in both) **[search]**.
- **Home care:** ADI explanation and PUA route.
- **Private care:** regional register where available (Piemonte private outpatient CSV; Lombardia geocoded facilities); everything else map data or provider website, labelled "reported", plus a professional-register check for named people.
- **Geocoding:** ANNCSU regional files for Lombardia and Piemonte; Nominatim (postcode-constrained) as fallback.

**Why Lombardia and Piemonte:** both have region-wide 116117, a single regional CUP (Lombardia's regional CUP reportedly covers public and accredited private facilities from 13 April 2026, from a news source only; Piemonte's "CUP Unico" is long established), and open facility and pharmacy data **[search]**. Milan adds a geocoded GP list. Toscana is the next candidate (116117 region-wide; CUP 2.0 online with NRE), held back only by its 2015 facility file.

**Production:**
- Ask the Ministry whether the STS11 territorial-facilities register can be released as open data (or whether `C_17_dataset_70` already is it).
- Region by region: Toscana, Veneto (CUP per ULSS, no single portal), Emilia-Romagna (CUPWEB / ER Salute), Lazio (ReCUP), Campania (Sinfonia CUP Unico), Sicilia.
- A booking-platform partnership for private availability, kept out of ranking.

## 6. Sources not to trust

- **Google or OSM as evidence of authorisation** or of what a place offers.
- **Any regional register older than 2024** as current (Lazio 2014, Toscana 2015, Campania RSA 2018), unless refreshed.
- **HL7 Italia CodeSystems** as data: they are a stale snapshot under a different licence.
- **Third-party "farmacie di turno" apps** as authoritative rotas. Link to the provincial Federfarma service instead.
- **Commercial "address list" sites** (e.g. indirizzi.it): marketing data.

---

## 7. API and data access

### Ministry *Farmacie* **[search]**, plus HL7 copy **[secondary]**

- **Access:** dataset page `https://www.dati.salute.gov.it/it/dataset/farmacie/`; files under `/sites/default/files/opendata/FRM_FARMA_5_<YYYYMMDD>.csv` (current name seen: `…20260116.csv`). Older path `…/imgs/C_17_dataset_5_download_itemDownload0_upFile.CSV` (2015). Also XML and JSON.
- **Format:** CSV, `;`-separated, decimal comma in `latitudine`/`longitudine`, "-" for empty end date.
- **Fields (seen in search snippets):** `cod_farmacia`, `cod_farmacia_asl`, `data_inizio_validita`, `data_fine_validita`, `latitudine`, `longitudine`, plus name, VAT number, address, postcode, *frazione*, municipality, province, region, pharmacy type. The exact full header is **not confirmed**; read it on first import.
- **Refresh:** daily. **Licence:** IODL 2.0.
- **HL7 copy:** `https://raw.githubusercontent.com/hl7-it/terminology/master/input/vocabulary/CS_elenco_farmacie.xml` (14 MB FHIR CodeSystem; properties: region, municipality, province, start date, end date, type). Siblings: `CS_elenco_parafarmacie.xml`, `CS_strutture_ricovero.xml` (properties: region, municipality, territorial ASL, company code, facility type, legal status), `CS_ASL.xml` (110 ASL codes with region, municipality, province). **No addresses or coordinates in the copies.** **[verified 8 Oct 2026]**

### Regional data **[search]**

See section 8 for each region. Lombardia uses Socrata (`dati.lombardia.it/resource/<id>.json` is the usual Socrata pattern; not tested). Toscana, Lazio, Emilia-Romagna and Sicilia use CKAN.

### ANNCSU (national address register)

- **Access [secondary]:** `https://anncsu.open.agenziaentrate.gov.it/age-inspire/opendata/anncsu/getds.php?INDIR_ITA` (addresses, national), `?STRAD_ITA` (streets), `?INDIR_<REGIONE>` / `?STRAD_<REGIONE>` per region. Host blocked here.
- **Service [search]:** point API updated daily; bulk regional/national files monthly; metadata in RNDT and dati.gov.it. An address-normalisation API on PDND is for public administrations.
- **Licence [search]:** CC BY 4.0 (trade press and an unofficial gateway; official metadata not opened).
- **Coverage, conflicting figures:** an independent check of the March 2026 file reported **52.4% of records with coordinates** and about 170,000 with coordinates outside their municipality **[search]**. A community dump of the 28 Jan 2025 file reports 25,952,906 georeferenced and 760,573 non-georeferenced access points **[secondary]**. The two probably count different things. Measure it ourselves on the Lombardia and Piemonte files.

### Nominatim **[verified 8 Oct 2026]**

- `https://nominatim.openstreetmap.org/search?street=12+Via+del+Corso&city=Roma&countrycodes=it&format=jsonv2` → Via del Corso 12, Roma 00187, correct.
- `…?street=1+Via+Roma&city=Torino&country=Italia` → **Via Roma 1, Chieri (TO)**, the wrong municipality: "Torino" matched the province. Always pass `postalcode` and check the returned municipality against the source's ISTAT code.
- **Terms [search]:** ODbL attribution; public server limited to about 1 request per second and not for bulk geocoding. Bulk jobs need a self-hosted instance or ANNCSU.

### Regional CUP and FSE

Web and app only; **no public API or deep link found [not found]**. Identification: *codice fiscale* + health-card digits + NRE, or SPID/CIE/CNS login **[search]**. Link to the entry page; give the phone number.

### Professional registers

Web search forms only (section 9). No API or bulk export found **[not found]**.

---

## 8. Region by region

Time-boxed per region; nothing opened (all hosts blocked). Columns: (1) facility register; (2) pharmacies with coordinates; (3) GP list; (4) online CUP; (5) 116117 (Ministry update 3 Sept 2026, as reported).

| Region | (1) Facility register | (2) Pharmacies | (3) GP list | (4) CUP online | (5) 116117 |
|---|---|---|---|---|---|
| **Lombardia** | "Georeferenziazione strutture" (`6n7g-5p5e`): address, ATS, X/Y; created 2018, updated 2021. "Mappa Strutture" (`u7vf-cp5k`): hospitals with ATS, address, code, coordinates. Accredited private socio-health units published under D.Lgs. 33/2013 art. 41 **[search]** | **Yes**: ARIA "Elenco Completo Farmacie" (`f77v-rpny`), about 3,050 rows, lat/lng, updated 14 Sept 2026 **[search]** | **Milan**: ATS Milano list via Comune di Milano, CSV/JSON/GeoJSON, address + coordinates, updated 1 Oct 2026, CC BY-SA 3.0 IT **[search]** | **PrenotaSalute** (prenotasalute.regione.lombardia.it), SALUTILE Prenotazioni app, 800 638 638 (landline) / 02 99 95 99 (mobile); booking without login with *codice fiscale*, last 5 health-card digits and NRE or IUP. Regional CUP for public and accredited private facilities from 13 Apr 2026 (news source only) **[search]** | Active region-wide **[search]** |
| **Piemonte** | dati.gov.it lists Regione Piemonte CSVs: public facilities (active only), private non-hospital facilities, private outpatient units, outpatient units in private clinics **[search]** | Use Ministry file | Not found | **CUP Piemonte** (cup.sistemapiemonte.it, salutepiemonte.it), app, 800 000 500 (8–20 daily); about 1,600 pharmacies book; red paper prescriptions can't be booked online **[search]** | Active region-wide **[search]** |
| **Toscana** | "Strutture sanitarie" (`rt-strut-sanitarie`): hospitals, rehabilitation, territorial, health authorities, each with a coordinates CSV; **modified 2015** **[search]** | Use Ministry file | Not found | **CUP 2.0** (prenota.sanita.toscana.it), Toscana Salute app; *codice fiscale* + NRE; 15 minutes to confirm **[search]** | Active region-wide (rolled out Sept–Nov 2024) **[search]** |
| **Veneto** | No region-wide register found; ULSS 8 publishes its accredited private facilities as CSV **[search]** | Use Ministry file | Not found | **Per ULSS** (CupWeb Lite, iCUP), access via the regional FSE; ULSS 7's app books across the region **[search]** | Active region-wide; two regional centres **[search]** |
| **Emilia-Romagna** | "Ospedali della Regione Emilia-Romagna": public and private hospitals with address, phone, email, website, disciplines; CC BY 2.5 IT; no coordinates seen. Regional facility register exists by law (LR 22/2019) but not found as open data **[search]** | Use Ministry file | Not found | **CUPWEB** (cupweb.it) and ER Salute app; FSE login; patient must have a GP in the region **[search]** | Authorised; AUSL Bologna plans activation in 2026 **[search]** |
| **Lazio** | "Elenco delle strutture sanitarie private accreditate": CSV/XLSX, **data to 26 Nov 2014**. Since July 2026 (RR 11/2026) facilities must display a regional QR code showing authorised branches **[search]** | Use Ministry file | Not found | **ReCUP** (salutelazio.it; "Prenota smart"); phone 06 9939; NRE + *codice fiscale* + health-card characters **[search]** | Active, 24/7 **[search]** |
| **Campania** | Accredited RSA list (2018); accredited private facilities published per ASL as documents, not a dataset **[search]** | Regional "Elenco Farmacie" on dati.regione.campania.it **[search]** | **Regional MMG CSV**: ASL, name, practice address; 2019, semi-annual **[search]** | **CUP Unico Regionale "Sinfonia"** (sinfonia.regione.campania.it), Campania in Salute app; SPID/CIE/CNS; NRE required **[search]** | Authorised, not confirmed live **[search]** |
| **Sicilia** | dati.regione.sicilia.it "Strutture sanitarie" group: facility list (CC BY), hospitals, RSA (to Jan 2018) **[search]** | SITR map service for pharmacies by province **[search]** | ASP Siracusa CSV (Oct 2024) **[search]** | Per ASP; not researched | Authorised, not confirmed live **[search]** |

**Outside scope but notable:** Trentino publishes public and accredited facilities **with coordinates, derived from STS11** **[search]**, a model to ask other regions for. Puglia publishes an "anagrafe strutture sanitarie" updated in 2025 **[search]**.

---

## 9. Professional registers

| Profession | Body | Public search | API / bulk | Status |
|---|---|---|---|---|
| Doctors, dentists | **FNOMCeO**, two national registers (*Albi Unici Nazionali*) | "Anagrafica" on portale.fnomceo.it; search by name, surname, city; shows qualifications | None found | **[search]** |
| Nurses | **FNOPI** / provincial **OPI** | Via local OPI registers; cards carry a QR code to the register | None found | **[search]**; no national search confirmed |
| Physiotherapists | **FNOFI** (separate order since 15 Dec 2022; register since 1 Feb 2023) | `albo.alboweb-fnofi.net/registry/search`, by name and province | None found | **[search]** |
| Psychologists | **CNOP** *Albo Unico Nazionale* | On areariservata.psy.it; record holds name, birth, residence, suspension status (L. 56/1989) | None found | **[search]** |
| Audiologists (*audioprotesisti*), speech therapists, other technical and rehabilitation professions | **TSRM-PSTRP** federation | Not confirmed | None found | **[search]** |
| Pharmacists | **FOFI** | Not researched | n/a | Host blocked |
| Opticians | No health order found | n/a | n/a | **[not found]** |

As in Spain: use these to check a **named** person when we show one. Never as a discovery index or a bulk copy.

---

## 10. Reachability from this environment (8 Oct 2026)

**Reachable:** raw.githubusercontent.com (public files only; GitHub's API, code search, git clone and codeload zip were refused for repositories outside this session), nominatim.openstreetmap.org, and the page fetcher for github.com pages.

**Blocked (proxy 403, both `curl` and the page fetcher):** www.dati.salute.gov.it, www.salute.gov.it, www.dati.gov.it, www.dati.lombardia.it, dati.lazio.it, dati.veneto.it, dati.emilia-romagna.it, www.dati.piemonte.it, dati.toscana.it, dati.regione.sicilia.it, dati.regione.campania.it, dati.puglia.it, dati.trentino.it, dati.regione.sardegna.it, dati.comune.milano.it, www.prenotasalute.regione.lombardia.it, www.regione.lombardia.it, www.salutelazio.it, www.recup.it, www.cupweb.it, cup.sistemapiemonte.it, prenota.sanita.toscana.it, sinfonia.regione.campania.it, www.fascicolosanitario.gov.it, www.fnomceo.it, portale.fnomceo.it, www.fnopi.it, www.fnofi.it, albo.alboweb-fnofi.net, www.tsrm-pstrp.org, www.psy.it, areariservata.psy.it, www.fofi.it, www.federfarma.it, www.agenas.gov.it, www.agid.gov.it, www.anncsu.gov.it, anncsu.istat.it, anncsu.open.agenziaentrate.gov.it, www.istat.it, www.normattiva.it, www.gazzettaufficiale.it, www.garanteprivacy.it, www.quotidianosanita.it, eur-lex.europa.eu, data.europa.eu, build.fhir.org, packages.fhir.org, wiki/lists/community/www/planet/taginfo.openstreetmap.org, operations.osmfoundation.org, overpass-api.de, download.geofabrik.de, photon.komoot.io, wikidata.org, web.archive.org, zenodo.org, kaggle.com, huggingface.co, and github.io pages tried. datiopen.it answered 403.

---

## 11. 30 / 60 / 90 days

**Days 0–30: confirm the [search] facts.**
- From an unrestricted machine: open the *Farmacie* dataset and dictionary, the IODL 2.0 text, `C_17_dataset_70_0_upFile.csv`, the Lombardia and Piemonte datasets in section 8, the ANNCSU metadata and licence, and the Nominatim usage policy. Record headers and licences.
- Build the SSN hand-off content for Lombardia and Piemonte: CUP link, phone, pharmacy option, prescription checklist, 116117, ADI route.

**Days 30–60: Lombardia and Piemonte end to end.**
- Pharmacy importer (daily), keyed on `cod_farmacia`, end-dated rows dropped, re-geocoded via ANNCSU where coordinates are missing or OSM-derived.
- Private-care path with regional registers where they exist; map data labelled "reported" elsewhere; register checks for named professionals.
- Measure ANNCSU coordinate coverage on the two regional files.

**Days 60–90: widen.**
- Toscana, Veneto, Emilia-Romagna, Lazio hand-offs.
- Write to the Ministry (NSIS / open-data office) about releasing STS11.
- Approach one booking platform for private availability.

## 12. Open questions

1. **Data:** is `C_17_dataset_70_0_upFile.csv` the STS11 territorial-facilities list, and how current is it? If not, will the Ministry release STS11 as open data?
2. **Legal:** does IODL 2.0 explicitly allow commercial reuse (expected yes, as an attribution licence), and how do we handle the OSM-derived coordinates in the *Farmacie* file?
3. **Product:** is there any official register of **private** physiotherapy, dental and psychology practices in Lombardia and Piemonte (regional *autorizzazione all'esercizio* lists), or must private discovery stay "reported"?
4. **Technical:** does any regional CUP accept a deep link with pre-filled region or service, or offer a partner API? None found.
5. **Technical:** real ANNCSU coordinate coverage for the MVP regions (52% versus 97%, depending on the source).
6. **Legal:** do the advertising limits in L. 145/2018 c. 525 apply to a third-party directory that shows provider-written descriptions?

## Sources

Verified 8 October 2026 only where marked; everything else **[search]**.

- **[verified]** HL7 Italia CodeSystems derived from Ministry data: [CS_elenco_farmacie.xml](https://raw.githubusercontent.com/hl7-it/terminology/master/input/vocabulary/CS_elenco_farmacie.xml) · [CS_elenco_parafarmacie.xml](https://raw.githubusercontent.com/hl7-it/terminology/master/input/vocabulary/CS_elenco_parafarmacie.xml) · [CS_strutture_ricovero.xml](https://raw.githubusercontent.com/hl7-it/terminology/master/input/vocabulary/CS_strutture_ricovero.xml) · [CS_ASL.xml](https://raw.githubusercontent.com/hl7-it/terminology/master/input/vocabulary/CS_ASL.xml) · [repo licence](https://raw.githubusercontent.com/hl7-it/terminology/master/LICENSE)
- **[verified]** Nominatim: [search endpoint](https://nominatim.openstreetmap.org/search?street=12+Via+del+Corso&city=Roma&countrycodes=it&format=jsonv2)
- **[secondary]** ANNCSU download URLs: [ivandorte/anncsu_dump](https://github.com/ivandorte/anncsu_dump) · [gbvitrano/ANNCSU](https://github.com/gbvitrano/ANNCSU)
- Ministry open data: [Farmacie](https://www.dati.salute.gov.it/it/dataset/farmacie/) · [FRM_FARMA_5_20260116.csv](https://www.dati.salute.gov.it/sites/default/files/opendata/FRM_FARMA_5_20260116.csv) · [Strutture di ricovero nel territorio della ASL](https://www.dati.salute.gov.it/it/dataset/strutture-di-ricovero-pubbliche-e-equiparate-presenti-nel-territorio-della-asl/) · [Strutture e attività ASL](https://www.dati.salute.gov.it/it/dataset/strutture-e-attivita-asl/) · [Posti letto 2023](https://www.dati.salute.gov.it/it/dataset/posti-letto-struttura-ospedaliera-2023/) · [parafarmacie dictionary](https://www.dati.salute.gov.it/dati/documenti/Dizionario-DatasetParafarmacieTipologieMedicinaliVenduti.pdf) · [facilities CSV with SSN relationship](https://www.dati.salute.gov.it/sites/default/files/imported/C_17_dataset_70_0_upFile.csv) · [ASL and hospitals list](https://www.salute.gov.it/portale/documentazione/p6_2_8_1_1.jsp?id=13)
- STS11: [Lazio STS11 forms 2022](https://rms.regione.lazio.it/sipc/doc/Modelli_STS11_Anno2022.pdf) · [Trentino STS11-derived facilities](https://dati.trentino.it/dataset/strutture-sanitarie-dell-azienda-sanitaria-e-convenzionate)
- Pharmacy data quality: [OSM Key:ref:msal](https://wiki.openstreetmap.org/wiki/Key:ref:msal) · [OSM talk-it 2014](https://lists.openstreetmap.org/pipermail/talk-it/2014-November/045726.html) · [OSM community 2026](https://community.openstreetmap.org/t/proposte-per-l-iniziativa-di-mapping-comunitaria-di-febbraio/140712?page=2)
- Lombardia: [Elenco Completo Farmacie](https://www.dati.lombardia.it/Sanit-/Elenco-Completo-Farmacie/f77v-rpny) · [Georeferenziazione strutture](https://www.dati.lombardia.it/Sanit-/Georeferenziazione-strutture/6n7g-5p5e) · [Mappa Strutture](https://www.dati.lombardia.it/Sanit-/Mappa-Strutture/u7vf-cp5k) · [accredited private units](https://www.regione.lombardia.it/amministrazione-trasparente/strutture-sanitarie-private-accreditate) · [PrenotaSalute info](https://www.regione.lombardia.it/sanita/prenotazioni-e-tempi-d-attesa/prenotazione-online-visite-esami) · [regional CUP news](https://www.milanofree.it/milano/cronaca/prenotare-esami-e-visite-in-lombardia-numero-unico-online-e-app.html) · [116117](https://www.regione.lombardia.it/sanita/prenotazioni-e-tempi-d-attesa/numero-europeo-armonizzato-116-117) · [Milan GP list](https://dati.comune.milano.it/dataset/ds234-sociale-medici-medicina-generale)
- Piemonte: [dati.gov.it Piemonte health datasets](https://www.dati.gov.it/node/192?tags=medicina&organization=regione-piemonte) · [CUP Piemonte](https://cup.sistemapiemonte.it/) · [regional booking page](https://www.regione.piemonte.it/web/temi/sanita/accesso-ai-servizi-sanitari/prenotazione-esami-visite-specialistiche)
- Toscana: [Strutture sanitarie](https://dati.toscana.it/dataset/rt-strut-sanitarie) · [CUP online](https://www.regione.toscana.it/-/cup-online)
- Veneto: [regional CUP link page](https://salute.regione.veneto.it/organizzazione-sssr/attivit%C3%A0--del-servizio-socio-sanitario-veneto/assistenza-distrettuale/visite-ed-esami-ambulatoriali/tempi-di-attesa/collegamento-al-sistema-cup-regionale) · [ULSS 8 open data](https://www.aulss8.veneto.it/amm-trasparente/open-data/)
- Emilia-Romagna: [Ospedali dataset](https://dati.emilia-romagna.it/dataset/ospedali-della-regione-emilia-romagna) · [CUPWEB](https://www.cupweb.it/)
- Lazio: [accredited private facilities (2014)](https://dati.lazio.it/dataset/elenco-delle-strutture-sanitarie-private-accreditate) · [RR 11/2026](https://regione.lazio.it/sites/default/files/regolamenti-regionali-testo-originale/RR_11_2026.pdf)
- Campania: [MMG list](https://dati.regione.campania.it/catalogo/datasetdetail/medici-medicina-generale) · [Elenco Farmacie](https://dati.regione.campania.it/catalogo/datasetdetail/elenco-farmacie) · [Sinfonia CUP](https://sinfonia.regione.campania.it/preview/cup)
- Sicilia: [Strutture sanitarie group](https://dati.regione.sicilia.it/dataset/groups/strutture-sanitarie) · [ASP Siracusa MMG](https://www.asp.sr.it/Organizzazione/Documenti/Dataset/Medici-di-Medicina-Generale)
- Booking and law: [DL 73/2024 (Camera)](https://temi.camera.it/leg19/provvedimento/misure-urgenti-per-la-riduzione-dei-tempi-delle-liste-di-attesa-delle-prestazioni-sanitarie.html) · [L. 107/2024](https://www.certifico.com/news/legge-29-luglio-2024-n-107-liste-di-attesa) · [priority classes (FVG)](https://www.regione.fvg.it/rafvg/cms/RAFVG/salute-sociale/sistema-sociale-sanitario/FOGLIA51/) · [ATS Brescia booking vademecum](https://www.ats-brescia.it/documents/3432658/78178881/VADEMECUM+PRENOTAZIONE+PRESTAZIONI+v1.9.pdf/d9a8769f-777a-5c03-1131-2576ab4534f7) · [GP choice (Altroconsumo)](https://www.altroconsumo.it/salute/diritti-in-salute/speciali/medico-di-base) · [FSE 2.0 services](https://lentepubblica.it/pa-digitale/nuove-funzionalita-fascicolo-sanitario-elettronico/)
- 116117: [status Sept 2026 (Mondosanità)](https://www.mondosanita.it/news/sanita/110194/116117-il-numero-da-conoscere-prima-del-pronto-soccorso-quando-chiamarlo-e-cosa-puo-fare.html) · [Toscana rollout](https://www.lanazione.it/arezzo/cronaca/dal-21-ottobre-attivo-il-nuovo-numero-per-le-cure-non-urgenti-116117-kshfulng)
- ADI / PUA: [ASP Palermo ADI leaflet](https://asppalermo.org/wp-content/uploads/2024/12/Distretto-n.-41-di-Partinico-Opuscolo-Informativo-ADI.pdf) · [Lombardia DM77 monitoring June 2026](https://www.regione.lombardia.it/content/dam/rl/Analisi%20monitoraggio%20CdC%20DM77%20-%20giugno%202026.pdf)
- Duty pharmacies: [Federfarma Lombardia freephone](https://www.quotidianosanita.it/lavoro-e-professioni/farmacie-un-numero-verde-per-trovarla-sempre-aperta-successo-per-il-progetto-federfarma-lombardia/)
- Registers: [FNOMCeO anagrafe circular 2026](https://portale.fnomceo.it/wp-content/uploads/2026/01/COM-N-15.pdf) · [TSRM-PSTRP circular on the physiotherapists' order](https://www.tsrm-pstrp.org/wp-content/uploads/2022/12/Circolare-59-2022-adempimenti-a-seguito-della-pubblicazione-del-DM-Ordini-Fisioterapisti-e-relativa-Federazione-nazionale.pdf) · [FNOFI](https://www.fnofi.it/) · [L. 56/1989](https://www.unito.it/sites/default/files/legge_56_1989_psicologo.pdf)
- Geocoding and licences: [ANNCSU open data](https://www.anncsu.gov.it/it/consultazione-dellarchivio/open-data/) · [ANNCSU CC BY 4.0 (lavoripubblici.it)](https://www.lavoripubblici.it/news/stampa/35094) · [ANNCSU technical specs 2024](https://www.istat.it/wp-content/uploads/2022/05/Specifiche-tecniche-anccsu-2024.pdf) · [IODL 2.0 compatibility (OSM wiki)](https://wiki.openstreetmap.org/wiki/IT:Import/ODbL_Compatibility)
- Health advertising: [FNOMCeO letter citing L. 145/2018 c. 525](https://portale.fnomceo.it/wp-content/uploads/2022/10/LETTERA-SU-PUBBLICITA-SANITARIA.pdf)
