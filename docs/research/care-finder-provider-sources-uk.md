# Care Finder: provider source strategy for the United Kingdom

Checked: 8 October 2026. Scope: England first. Scotland, Wales and Northern Ireland are covered briefly in section 8. Companion to `care-finder-provider-sources-spain.md`, which this report follows in structure.

## How the evidence was gathered

**Every UK host we needed was blocked by this environment's network proxy** (section 10). That includes cqc.org.uk, api.service.cqc.org.uk, digital.nhs.uk, nhs.uk, api.service.nhs.uk, opendata.nhs.scot, opendatani.gov.uk, ons.gov.uk, ordnancesurvey.co.uk, postcodes.io, hcpc-uk.org, gov.uk and legislation.gov.uk, through both `curl` and the web-fetch tool. Unofficial mirrors of the NHS England developer site (the National Archives web archive, `nhsd-proxy.openprescribing.net`) were blocked too. GitHub was reachable, so two open-source repositories were read directly.

As a result, this report is mostly **[search]**. Unlike Spain, no official file was downloaded and no API was called. The first job of the next pass (section 11) is to run the checks listed in section 12 from an unrestricted machine, ideally the Replit Shell.

- **[verified 8 Oct 2026]**: the page, file or repository was opened and the fact was read from it. Here, that means GitHub only.
- **[search]**: seen only in search results or search-tool summaries of official pages. Not yet confirmed.
- **[law]**: the obligation comes from a statute or statutory instrument. The cited text appeared in search results.
- **[ours]**: a fact about our own code, checked directly.
- **[background]**: general knowledge of the UK system, not checked in this pass. Treat as a lead, not a fact.
- **[not found]**: looked for, within a time limit, and not found. This does not prove it doesn't exist.

---

## 1. Executive recommendation

Google Places is still the wrong backbone. The reasons are the same as in Spain: listings anyone can edit, nothing about authorisation, and terms that forbid storing anything except `place_id` (Spain report, section 4). The UK has better official sources than Spain, but they are split across several regulators.

1. **In England, the CQC register is the spine for "regulated places".** The Care Quality Commission registers every provider of regulated health and adult social care activity in England, NHS and private: GP practices, dentists, hospitals, independent clinics, community services, care homes and **home care (domiciliary care) agencies**. **[search]** The register is published two ways:
   - **Downloadable spreadsheets.** The "Care directory with filters" file is updated about monthly, and "Locations regulated by CQC" about weekly. A mirror of the active-locations table shows **`Location Latitude` and `Location Longitude` columns**, so coordinates appear to be included.
   - **A daily-updated REST API.** It returns providers and locations with registered **regulated activities**, **service types**, specialisms and current ratings. It has moved to `api.service.cqc.org.uk` and **now needs a free subscription key** from the CQC developer portal.

   Both are released under the **Open Government Licence (OGL v3)**, which allows commercial reuse with attribution. CQC also asks reusers to say on their service that they use CQC information. **[search]** This is the UK equivalent of REGCESS, with coordinates as a bonus.
2. **Pharmacies, opticians and hearing-aid shops are not CQC-registered as such.** [background] They need their own sources:
   - Pharmacies: ODS (the NHS's organisation register), or the NHSBSA consolidated pharmaceutical list (quarterly, OGL).
   - NHS sight-test providers: ODS and the nhs.uk directory.
   - Hearing-aid dispensers: no premises register found. The HCPC registers individual dispensers only.
3. **For people on NHS cover, don't search. Start from their registered GP practice.** Every NHS patient is registered with one practice. Name, address, phone and website come from **ODS** (OGL; daily-refreshed "Data Search and Export" reports, or a FHIR R4 API). **[search]** Booking goes through the **NHS App**, with the GP's phone number as the fallback. We link to the NHS App; we never book on the user's behalf. No documented deep link into a specific GP's booking screen was found **[not found]**. Urgent same-day care goes to **NHS 111 online (111.nhs.uk) or 111 by phone**, and emergencies to 999. Many NHS services can be self-referred without the GP (Talking Therapies, audiology in some areas). They are local, so the path is "find the local service, show its self-referral route".
4. **nhs.uk's own directory (Directory of Healthcare Services API, formerly "Service Search") is the richest NHS source, but it is gated.** It holds opening times, services, facilities and, for dentists, **"accepting new NHS patients"**, which NHS dental contractors must review at least every 90 days **[law]**. Version 3 is in production; versions 1 and 2 were due for retirement on 2 February 2026. Access goes through NHS England's API Platform, with an API key and onboarding. A forum thread says production access is approved only for "legal use cases" **[search]**. Its licence is the NHS syndication terms, not plain OGL. **Apply early. It is the only realistic source for NHS dentist availability.**
5. **Professional registers verify people; they are not directories.** The GMC, GDC, GOC, HCPC (physiotherapists, hearing-aid dispensers, podiatrists and others), GPhC and NMC all publish public search tools. **The GDC says copies of its register "are not available for sale or for commercial purposes"** **[search]**. Look up named people on demand only.
6. **Geocoding is free and official.** The ONS Postcode Directory gives a centroid for every postcode. postcodes.io serves it as a free JSON API, and can be self-hosted from Docker images **[verified 8 Oct 2026]**. Great Britain postcodes are OGL. **Northern Ireland (BT) postcodes need a commercial licence from Land & Property Services** **[search]**. Postcode-level accuracy is enough for "near me".

What no official source provides: **live availability, private prices, step-free access as a verified fact, or languages spoken**. Exceptions: the nhs.uk directory may carry some facilities data, and the dentist "accepting new NHS patients" flag (point 4) is a real, contractually maintained signal. As in Spain, "Not known, ask when you call" stays the honest answer.

---

## 2. UK source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Fit for our need |
|---|---|---|---|---|---|---|---|
| 1 | **CQC register: API** (developer portal `api-portal.service.cqc.org.uk`, base `https://api.service.cqc.org.uk`) | Every provider and location registered with CQC, active and inactive | **Regulator / official** (Health and Social Care Act 2008) | England: GP practices, dentists, hospitals, independent clinics, community health, home care, care homes, some private physiotherapy and audiology | **[search]** REST/JSON, updated daily. Provider, location and "changes" resources (changes take a start and end date window). Now needs a subscription key (`Ocp-Apim-Subscription-Key` header, per a third-party guide). The older public `api.cqc.org.uk/public/v1/...` route asked for a `partnerCode` query parameter. TLS 1.2+ only. Rate limits **[not found]**. Contact: syndicationAPI@cqc.org.uk | **[search]** OGL v3, plus "acknowledge you are using CQC information" | **High.** Existence, registration, regulated activities, service types, ratings, coordinates |
| 2 | **CQC register: spreadsheets** ("Using CQC data", `cqc.org.uk/about-us/transparency/using-cqc-data`) | The same register as Excel | Official | As above | **[search]** "Care directory with filters" (about monthly; ratings by location), "Care directory with ratings" (per-service ratings; frequency not stated), "Locations regulated by CQC" (about weekly). The file has historically been named `HSCA_Active_Locations…`, and one pandas example skips 7 header rows. **CQC warns that its move to a new system is delaying these files** | **[search]** OGL v3 | **High** as a bulk spine for the MVP. Use the API for freshness later |
| 3 | **ODS, Organisation Data Service** (NHS England) | The NHS's master list of organisations and codes: GP practices, branch surgeries, pharmacies, trusts, sites, and more | **Official** (mandatory NHS reference data) | England and Wales (ORD); NHS-contracted organisations, not purely private ones | **[search]** (a) **Data Search and Export (DSE)** predefined reports. These replace the legacy CSVs (`epraccur` and similar); the source data updates nightly; CSV. (b) **Organisation Data Terminology API**, FHIR R4: the recommended API for new users. It covers everything ORD has, plus geographic boundaries and some practitioner data. (c) **ORD API**: retirement planned for September 2027, depending on feedback. (d) Monthly XML and quarterly postcode files via **TRUD** (free account and API key). Coordinates: **not confirmed**; plan to geocode from postcode | **[search]** ODS states its data is published under the OGL. TRUD items carry per-item licences | **High** for GP practice and pharmacy identity, address and phone. Not for "what care is offered" |
| 4 | **Directory of Healthcare Services (DoHS) API v3**, formerly Service Search (`digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services`) | The data behind nhs.uk service finders | Official (NHS England), provider-maintained profiles | England: GPs, pharmacies (type `PHA` confirmed), dentists, hospitals, opticians and more | **[search]** v3 in production; v1 and v2 deprecated 2 Feb 2026. Base `https://api.service.nhs.uk/service-search-api` (plus `int.` and `sandbox.`). Search by OData-style `$filter`/`$select`, with postcode and service codes (e.g. `EPS0001`). Header `apikey`. Onboarding through the NHS API Platform: developer account, then digital onboarding. A forum thread says production access is approved only for "legal use cases". v1/v2 support was business hours only ("bronze") | **[search]** NHS syndication terms: free but a binding licence agreement; "can only be used where there is a legal basis". nhs.uk website content in general is OGL, commercial use allowed | **High** for opening times, services and **dentists accepting new NHS patients**. Gated |
| 5 | **nhs.uk organisation datasets "on request"** (`nhs.uk/about-us/nhs-website-datasets`) | Snapshots of dentists, GPs, hospitals and pharmacies (ODS code, name, address, phone, website) | Official | England | **[search]** Email `nhswebsite.servicedesk@nhs.net`; no download; opticians not listed. Page last reviewed Dec 2023 | **[search]** Not stated | Medium. A stop-gap while DoHS onboarding runs |
| 6 | **NHSBSA consolidated pharmaceutical list** (`opendata.nhsbsa.net/dataset/consolidated-pharmaceutical-list`) | Every NHS community pharmacy, dispensing appliance contractor and LPS contractor | Official | England | **[search]** CKAN dataset, **quarterly** (changes happen monthly; a separate monthly openings/closures count exists) | **[search]** OGL v3 (per council republications; confirm on the portal) | **High** for "is this an NHS pharmacy" |
| 7 | **Professional registers**: GMC, GDC (`olr.gdc-uk.org`), GOC, HCPC, GPhC, NMC (section 9) | Who may practise | **Regulator** | Named individuals; the GOC and GPhC also register businesses or premises | **[search]** Web search tools only; no APIs found. HCPC has a multi-registrant search (up to 100 numbers). GDC is updated daily | **[search]** GDC: "not available for sale or for commercial purposes". HCPC: no reuse terms found | High for verifying a **named** person; useless for discovery |
| 8 | **ONS Postcode Directory** (Open Geography portal) and **postcodes.io** | Every UK postcode with coordinates and admin and health geographies | Official (ONS); postcodes.io is a free service run by Ideal Postcodes | UK | **[verified 8 Oct 2026]** postcodes.io serves ONSPD, OS Open Names and the Scottish Postcode Directory; MIT software; Docker images for app and database. **[search]** ONSPD is updated quarterly and includes lat/long. Hosted API rate limits **[not found]** | **[search]** GB: OGL v3 with OS, Royal Mail and ONS attribution statements. **NI (BT) postcodes: commercial use needs an LPS licence** | **High** for geocoding |
| 9 | **NHS App** and **NHS 111 online** | Patient-facing booking and urgent-care routing | Official | England | **[search]** Web login at `www.nhsapp.service.nhs.uk/login`. GP booking runs through IM1 interfaces to EMIS and TPP; online consultation tools (Accurx, eConsult and others) appear inside the app. No public deep links to features. 111 online at `111.nhs.uk`; it can book UTC and ED slots in some areas | Link only | High as a hand-off |
| 10 | **Scotland, Wales, NI open data** (section 8) | Practice lists from PHS, BSO and the Welsh Government | Official | Per nation | **[search]** CSV via CKAN (PHS, OpenDataNI); a Welsh Government GP-sites layer with coordinates | **[search]** OGL | High for GP, dental and optical lists outside England |
| 11 | **Google Places** (current) | Business listings | Commercial | Everything, unverified | API | **[search]** only `place_id` storable (Spain report) | Contact details and hours only |
| 12 | **OpenStreetMap** | Map features | Community | Mixed | Not tested this pass | ODbL | Low |

### Mapping Care Finder care types to UK sources

| Care type | NHS route | Official "where" source | Qualification / authorisation | Notes |
|---|---|---|---|---|
| GP (family doctor) | Registered practice → NHS App / phone | ODS GP practices; CQC (service type for GP practices) | CQC registration; GMC for named GPs | Private GPs are CQC-registered too. Separate NHS and private using ODS (NHS-contracted) |
| Specialists | GP referral; e-Referral choice is made with the GP, not in our app | CQC (hospitals, independent clinics) | CQC; GMC specialist register | Not a direct-book path for NHS patients |
| Physiotherapy | GP referral, or **local self-referral** in many areas [background] | CQC where registered | HCPC (physiotherapist) | **Whether private physiotherapy clinics must register with CQC is unresolved** (section 12). Don't assume CQC covers all private physios |
| Dentist | Any NHS practice (no catchment); **"accepting new NHS patients"** | DoHS v3 (flag), CQC (dental services), nhs.uk on-request datasets | CQC; GDC | The 90-day profile review makes the flag meaningful **[law]** |
| Optician | NHS sight test (eligible groups, including 60+ [background]) at any NHS-contracted practice | ODS / DoHS; GOC business register | GOC | Mostly not CQC-registered [background] |
| Hearing services | GP referral, or **local self-referral (often 55+)** in some areas **[search]** | CQC (audiology providers where registered); local ICB pages | HCPC (hearing-aid dispenser) | No national register of hearing-aid shops found **[not found]** |
| Talking therapies | **Self-referral** to the local NHS Talking Therapies service, by GP area **[search]** | nhs.uk talking-therapies finder (DoHS); no open dataset found **[not found]** | Service is NHS-commissioned | Show the self-referral route, not a list |
| Home care (domiciliary) | Council adult social care assessment, or self-funded | **CQC: regulated activity "personal care", service type for domiciliary/home care** | CQC registration and rating | Exact column/field names to confirm on download |
| Pharmacy (incl. Pharmacy First) | Walk in; 111 can refer | ODS, NHSBSA list, DoHS (`PHA`) | GPhC premises register [background] | Opening hours from DoHS only |
| Urgent / same-day | **111 online / 111 phone**; 999 for emergencies | DoHS (urgent treatment centres); CQC | n/a | Never rank urgent options ourselves; route to 111 |

---

## 3. Recommended architecture

```
User request (plain words)
   │
   ▼
Requirements: care type · cover route (NHS / private / council-funded) · area (postcode) · access needs
   │
   ├─ Emergency words ─► 999 (unchanged)
   ├─ Urgent, same-day ─► 111 online / call 111 (link + phone; no ranking of UTCs by us)
   │
   ├─ NHS cover, primary care ─► "Which GP practice are you registered with?"
   │        → ODS lookup by name/postcode → practice card (phone, website)
   │        → hand-off: NHS App (login link) or phone with call script
   │
   ├─ NHS self-referral services (talking therapies, audiology, MSK physio where offered)
   │        → local service via DoHS/nhs.uk (when onboarded), else "ask your GP practice"
   │
   └─ Private / self-funded / home care
          │
          ▼
   PLACE SPINE (England): CQC locations (monthly file → daily API)
     filter: regulated activity + service type for the care type, distance
     coordinates: CQC lat/long, else ONSPD postcode centroid
   + ODS / NHSBSA for pharmacies; ODS / DoHS / GOC for opticians
          │
          ▼
   ENRICH (each fact attributed and timestamped)
     · opening hours, NHS dentist accepting patients: DoHS v3 (after onboarding)
     · CQC rating: shown as a CQC fact with its date, never as our score
     · price, step-free, languages: provider website, labelled self-declared
     · travel time: OSM / Google, place_id only stored
          │
          ▼
   NAMED PROFESSIONAL shown? ─► on-demand register check (HCPC / GDC / GMC / GOC)
```

### Which source decides what

| Question | Source of truth | Fallback |
|---|---|---|
| Is this place registered to provide this care? (England) | CQC regulated activities and service types | None. If not CQC-registered and not in ODS/NHSBSA/GOC, don't show it as a health provider |
| Is it an NHS pharmacy / NHS GP practice? | ODS; NHSBSA list | n/a |
| Which practice is mine? | The user (they know it), confirmed against ODS | "Check a letter from your practice or the NHS App" |
| Is this dentist taking NHS patients? | DoHS v3 profile flag, with its last-updated date | "Ask when you call" |
| Can I book online? | NHS App (NHS cover); provider website (private) | Phone with call script |
| Is this named person allowed to practise? | Their regulator's register, looked up on demand | Show the place, not the person |
| Where is it? | CQC lat/long; else ONSPD postcode centroid | n/a |
| Quality signal | CQC rating with date, labelled as CQC's | Nothing. No review stars |

### Identity and matching

1. **CQC location ID** (format like `1-123456789` [search]) is the identity of a regulated place. CQC also has provider IDs; one provider runs many locations.
2. **ODS code** is the identity of NHS organisations (e.g. GP practice `B82005`, pharmacy `FVR79` [search]). CQC location records carry an ODS code for NHS bodies [background; confirm field].
3. Join CQC ↔ ODS on ODS code where present, else normalised name + postcode + phone. Store a Google `place_id` alongside, as in Spain.
4. Never merge two CQC location IDs automatically.

### Evidence and staleness

Reuse the Spain model (verified / reported / unknown / conflicting) **[ours, per Spain report]**:
- CQC registration facts: max age 35 days on the monthly file, 2 days once on the daily API.
- DoHS dentist "accepting new NHS patients": show the profile's own last-updated date. Older than 90 days means the practice is in breach of its contract review duty; downgrade to "may be out of date".
- ODS: 35 days (monthly import) or nightly.

### Ranking

As in Spain: hard filters (registered for the care type, eligible under cover, hard access needs) → requirement fit → travel time. **CQC ratings are displayed, not used to rank.** This is a design choice, not a legal requirement; ranking by rating would turn a regulator's judgement into our recommendation. **Paid placement never affects order.**

---

## 4. Compliance and operating risks

1. **Google caching**. Same issue as Spain. Fix once for all countries **[ours, per Spain report]**.
2. **Personal data in registers.** Many CQC "providers" are individuals (sole-trader dentists, home-care owners), and professional registers are personal data by design. UK GDPR and the Data Protection Act 2018 apply **[law]**. Store what is needed to show a place; look up named people on demand; don't build a people index. The GDC explicitly bars commercial copies of its register **[search]**.
3. **Database right.** Copyright and Rights in Databases Regulations 1997 (SI 1997/3032) **[law]**. OGL releases cover it for CQC, ODS, PHS and BSO data. **nhs.uk/DoHS content is under the NHS syndication terms instead.** Read them before storing DoHS fields; they set refresh rates **[search]**.
4. **NHS identity.** The NHS logo is a registered trade mark. Third parties may not use the NHS identity for their own marketing, and the NHS cannot be seen to endorse third-party services **[search]**. Use plain text ("NHS App", "NHS 111"), no NHS logo, no "NHS-approved" wording.
5. **Medical-device boundary (MHRA).** Software is a medical device only if its intended purpose is medical (diagnosis, prevention, monitoring, treatment). General information and administrative tools such as booking are unlikely to be devices. Per MHRA's symptom-checker guidance, **filtering or ranking results by red flag, severity or probability** may make software a device **[search]**. Care Finder must not triage: urgency goes to 111/999, and we rank only by fit and distance.
6. **Attribution.** OGL v3 needs the standard attribution statement **[background: standard OGL wording, page not opened]**. CQC asks for acknowledgement. ONSPD carries its own OS, Royal Mail and ONS statements **[search]**. Show a "Data sources" line in Care Finder.
7. **CQC data quality.** CQC itself warns that file generation is delayed during its system migration, and that deregistrations may appear late **[search]**. Diff consecutive imports and suppress locations that vanish rather than guessing.

---

## 5. MVP and production sources

**MVP (England, 30–60 days):**
- CQC "Care directory with filters" spreadsheet as the place spine, imported monthly. Coordinates from the file.
- ODS DSE reports for GP practices, branch surgeries and pharmacies, imported monthly or nightly.
- Care-type → CQC regulated activity / service type map, built from the real column headers (section 12, item 1).
- NHS cover path: "your GP practice" (ODS lookup), with links to the NHS App and 111 online. No search for GP or urgent care.
- Geocoding user postcodes through self-hosted postcodes.io (Docker; avoids dependence on a free hosted service) or a direct ONSPD import.
- **Start NHS API Platform onboarding for DoHS v3 on day 1.** Lead time is the risk.
- CQC developer-portal key, so the daily API can replace the monthly file.

**Production:**
- CQC API (daily, changes endpoint) replaces the spreadsheet.
- DoHS v3: opening hours, dentists accepting NHS patients, talking-therapies and other self-referral services, urgent treatment centres.
- Scotland, Wales and NI datasets (section 8).
- On-demand professional-register checks (HCPC first: physios and hearing-aid dispensers).

**What not to store:** Google content other than `place_id`; register entries for named individuals beyond the moment of the check; DoHS fields beyond what its syndication terms allow (to confirm).

## 6. Sources not to trust

- **Third-party CQC/NHS resellers and scrapers** (Apify actors, paid "CQC exports", MCP wrappers). Use the regulator's own files.
- **data.gov.uk copies of NHS datasets from 2015–2017** (NHS Choices era). Stale; licence often "Not set".
- **Council republications** of CQC and NHSBSA data. Filtered extracts, not primary.
- **Review stars and "verified" marketplace badges.**
- **Google/OSM as evidence of what a place is registered to do.**

---

## 7. API and data access

### CQC **[search]**
- **Portal:** `api-portal.service.cqc.org.uk`. Sign up with name, email and password; a primary key is issued and sent with each request (header `Ocp-Apim-Subscription-Key`, per third-party guides).
- **Base URL:** `https://api.service.cqc.org.uk` (migrated from `api.cqc.org.uk/public/v1`).
- **Resources:** providers, locations (paginated; one guide says up to 500 per page), changes (by start and end time; chain calls end → start).
- **Contents:** active and inactive providers and locations; linked organisations; regulated activities; service types and specialisms (locations only); latest ratings with report dates (`currentRatings` per a third-party guide).
- **Refresh:** daily. **Licence:** OGL v3, plus acknowledgement. **Rate limits:** [not found].
- **Files:** "Care directory with filters" (≈monthly), "Care directory with ratings", "Locations regulated by CQC" (≈weekly). Columns seen in a mirror: `Location Latitude`, `Location Longitude`; a gist shows one column per service type (`Service type - Acute services with overnight beds`).

### ODS **[search]**
- **DSE predefined reports** replace `epraccur.csv` and other legacy CSVs. The source updates nightly, and each report downloads as one CSV. Column specs live in the ODS Reference Data Catalogue. Amendment-only files have stopped.
- **Organisation Data Terminology API**, FHIR R4 (4.0.1). Recommended for new users. Includes boundaries and some practitioner data. Access model (key or open): [not found].
- **ORD API**: covers England and Wales; retirement September 2027 (depending on feedback). STU3 FHIR API retired January 2026.
- **TRUD**: monthly XML, quarterly postcode files; free account with an API key. **[verified 8 Oct 2026]** The open-source `clods` project (Wardle, GitHub) documents this TRUD API-key flow and a GP search pattern ("roles=RO177 within range of postcode"). That's a third-party tool, not NHS documentation.
- **Licence:** ODS data under the OGL **[search]**.

### Directory of Healthcare Services API v3 **[search]**
- **Base:** `https://api.service.nhs.uk/service-search-api` (prod), `int.`, `sandbox.`. GET or POST "search for organisations"; OData `$filter`, `$select`, `search.ismatch(...,'Postcode')`. Organisation type `PHA` for pharmacies. Service codes such as `EPS0001`.
- **Auth:** API key header `apikey` (examples); a third-party summary of the v3 spec mentions bearer tokens. **Confirm on the spec.**
- **Onboarding:** NHS England developer account → Digital Onboarding Service (register organisation and product; assurance). Platform prerequisites cited for API-key products include an ODS code for our organisation, the Data Security and Protection Toolkit, and the connection agreement. **Which of these apply to DoHS specifically is unconfirmed.**
- **Fields:** opening times, services, facilities, contacts. Latitude and longitude were selectable in the v2 examples; v3 not confirmed. A "DoHS API guide to FHIR mappings" lists the fields.
- **Terms:** NHS syndication terms (free, binding, legal-basis condition, set refresh rates).

### postcodes.io and ONSPD
- **[verified 8 Oct 2026]** postcodes.io: "Postcodes.io serves the ONS Postcode Directory, Ordnance Survey Open Names and Scottish Postcode Directory datasets". Prebuilt PostgreSQL/PostGIS database published as `pg_dump`; Docker images `idealpostcodes/postcodes.io` and `idealpostcodes/postcodes.io.db`; MIT licence. Features: postcode lookup, autocomplete, reverse geocode, nearest postcode, terminated postcodes, bulk lookup.
- **[search]** ONSPD: quarterly; easting/northing, lat/long, positional quality. GB data OGL; NI (BT) data under LPS terms, commercial use needs a licence. Attribution statements on the ONS licences page.

---

## 8. Scotland, Wales, Northern Ireland (brief)

| Nation | Regulator of places | Practice lists (open data) | Patient-facing directory / urgent care | Licence |
|---|---|---|---|---|
| **Scotland** | **Healthcare Improvement Scotland** (independent healthcare) and the **Care Inspectorate** (care services, incl. care at home) [background]. Not CQC | **PHS open data** (`opendata.nhs.scot`, CKAN API): GP practices and list sizes (code, name, address, postcode, phone, dispensing flag, health board, HSCP, data zone), quarterly snapshots; NHS dental practices and registrations. Pharmacy dataset [not found] **[search]** | **NHS inform** and Scotland's Service Directory (no API found; updated about every six months); **NHS 24 on 111** [background] | OGL v3, with PHS attribution wording **[search]** |
| **Wales** | **Healthcare Inspectorate Wales** and **Care Inspectorate Wales** [background]. Not CQC | **ODS covers Wales** (ORD). Welsh Government GP main-sites layer with coordinates (Jan 2025, geocoded from DHCW addresses) on DataMapWales **[search]** | **NHS 111 Wales** local-services directory (GP, dentists, audiology; no API found) **[search]** | OGL **[search]** |
| **Northern Ireland** | **RQIA** [background] | **BSO** GP practice lists for professional use (Excel/PDF); OpenDataNI: GP list sizes (quarterly), dentist and surgery list (quarterly, updated Jan 2026), ophthalmic surgery list **[search]** | **nidirect** GP Practice Finder; HSC online **[search]** | OGL, acknowledge BSO **[search]**. **BT postcodes need an LPS licence for commercial geocoding** |

Practical consequence: CQC is an England-only spine. Outside England, start with the practice lists (GP, dental, optical) and add the national care regulators' registers later. The DRK and Zamora deployments make the UK a later market anyway.

---

## 9. Professional registers

| Profession | Regulator | Public search | API / bulk | Status |
|---|---|---|---|---|
| Doctors | GMC | Online register [background] | [not found] | Not opened |
| Dentists and dental care professionals | GDC, `olr.gdc-uk.org` | Name, town, or registration number; updated daily; shows status, number, type, dates, qualifications | None. **"not available for sale or for commercial purposes"** | **[search]** |
| Optometrists, dispensing opticians, **optical businesses** | GOC | Individuals and registered businesses | [not found] | **[search]** |
| Physiotherapists, hearing-aid dispensers, podiatrists, OTs, dietitians, speech therapists, practitioner psychologists | HCPC | Surname or number + profession; multi-registrant search up to 100 numbers | None found; no reuse terms found | **[search]** |
| Pharmacists and pharmacy premises | GPhC | [background] | [not found] | Not opened |
| Nurses | NMC | [background] | [not found] | Not opened |

---

## 10. Reachability from this environment (8 Oct 2026)

**Reachable:** raw.githubusercontent.com, api.github.com (repository-scoped endpoints only; search is blocked), sanidad.gob.es (control check), registry.npmjs.org, pypi.org.

**Blocked by the egress proxy (403 on CONNECT, or EGRESS_BLOCKED in web fetch):** cqc.org.uk, www.cqc.org.uk, api.cqc.org.uk, anypoint.mulesoft.com (CQC syndication docs), digital.nhs.uk, files.digital.nhs.uk, www.nhs.uk, api.nhs.uk, developer.api.nhs.uk, api.service.nhs.uk, directory.spineservices.nhs.uk, 111.nhs.uk, www.england.nhs.uk, www.nhsbsa.nhs.uk, opendata.nhsbsa.net, www.opendata.nhs.scot, www.publichealthscotland.scot, www.nhsinform.scot, 111.wales.nhs.uk, www.hscbusiness.hscni.net, www.ons.gov.uk, geoportal.statistics.gov.uk, www.ordnancesurvey.co.uk, osdatahub.os.uk, api.postcodes.io, www.hcpc-uk.org, www.gdc-uk.org, www.optical.org, www.gov.uk, www.data.gov.uk, api.gov.uk, www.legislation.gov.uk, ico.org.uk, www.nationalarchives.gov.uk, webarchive.nationalarchives.gov.uk, tnaqa.mirrorweb.com, nhsd-proxy.openprescribing.net, openprescribing.net, cljdoc.org, simplifier.net, get-ig.org, en.wikipedia.org, web.archive.org.

Everything on those hosts stays **[search]** until opened from Replit or a laptop.

---

## 11. 30 / 60 / 90 days

**Days 0–30: confirm and apply.**
- From the Replit Shell, run the checks in section 12 (download the CQC file, read headers, call ODS FHIR, call postcodes.io).
- Register on the CQC developer portal; get a key.
- **Open NHS England developer account and start DoHS v3 digital onboarding.** Ask in the developer community whether a consumer companion app is an accepted "legal use case".
- Fix Google storage (shared with Spain).

**Days 30–60: England spine.**
- CQC importer (monthly file), ODS importer (GP practices, pharmacies), postcodes.io self-hosted.
- Care-type → CQC mapping from real headers.
- NHS path: GP practice card + NHS App + 111 links, with call script.

**Days 60–90:**
- CQC API with changes feed; DoHS v3 if approved (dentists accepting NHS patients first).
- HCPC on-demand check for named physios and hearing-aid dispensers.
- Scotland/Wales/NI practice lists if a UK partner materialises.

## 12. Open questions

1. **Technical:** exact CQC file headers. Is there one column per regulated activity and per service type? Is "Domiciliary care service" the exact service-type label? Are `Location Latitude/Longitude` populated for all rows, and is the ODS code included?
2. **Technical / partnership:** will NHS England approve DoHS v3 production access for a private consumer app, and under which terms (storage, refresh, attribution)? This decides whether we can show "accepting new NHS patients" and opening hours.
3. **Regulatory:** which private physiotherapy, podiatry and audiology services must register with CQC? This determines whether CQC can be the spine for private physio and hearing in England, or whether we need HCPC plus provider websites. Read Schedules 1–2 of SI 2014/2936 and CQC's scope guidance.
4. **Technical:** does the ODS FHIR R4 API need a key, and does it return coordinates?
5. **Legal:** NHS App linking. Is there an approved way for a third-party app to send users to specific NHS App features, or only the login page?
6. **Legal:** postcodes.io hosted-service terms and rate limits (self-hosting avoids the question for GB; NI postcodes still need an LPS licence).
7. **Legal:** CQC's preferred acknowledgement wording, and whether ratings may be shown alongside our own labels.

## Sources

All [search] unless marked. Opened in this pass: GitHub only.

- **[verified 8 Oct 2026]** [postcodes.io README](https://github.com/ideal-postcodes/postcodes.io) and [MIT licence](https://github.com/ideal-postcodes/postcodes.io/blob/master/LICENSE) · [clods (ODS/TRUD tooling, third party)](https://github.com/wardle/clods)
- **[ours]** `server/routes/advisorSearchTools.ts` already trusts `nhs.uk`, `gov.uk` and `cqc.org.uk` as authoritative domains for GB; no UK-specific Care Finder code exists yet.
- CQC: [Using CQC data](https://www.cqc.org.uk/about-us/transparency/using-cqc-data) · [download page](https://www.cqc.org.uk/node/1466) · [CQC Syndication API docs](https://anypoint.mulesoft.com/exchange/portals/care-quality-commission-5/4d36bd23-127d-4acf-8903-ba292ea615d4/cqc-syndication-1/) · [scope of registration: treatment of disease, disorder or injury](https://cqc.org.uk/guidance-providers/scope-registration/regulated-activities/treatment-disease-disorder-or-injury) · [general exceptions and exemptions](https://cqc.org.uk/guidance-providers/scope-registration-general-exceptions-and-exemptions-registration) · [personal care](https://www.cqc.org.uk/guidance-providers/registration/personal-care) · [Airbyte connector notes](https://docs.airbyte.com/integrations/sources/care-quality-commission) · [Nexla connector notes](https://docs.nexla.com/user-guides/connectors/care_quality_commission_api) · [Microsoft connector (changes endpoint)](https://learn.microsoft.com/en-us/connectors/cqcdata/) · [active locations mirror (lat/long columns)](http://hsc.databeat.co.uk/cqc_data-a902a88/active_locations/139) · [gist reading the CQC file](https://gist.github.com/psychemedia/0cfa84e5ad7e9d2d1f13)
- ODS: [ODS service](https://digital.nhs.uk/services/organisation-data-service) · [ODS roadmap](https://digital.nhs.uk/services/organisation-data-service/ods-roadmap) · [Organisation Data Terminology API](https://digital.nhs.uk/developer/api-catalogue/organisation-data-terminology) · [choosing an ODS API](https://digital.nhs.uk/services/organisation-data-service/organisation-data-service-apis/choosing-an-organisation-data-service-api) · [DSE GP CSV downloads](https://digital.nhs.uk/services/organisation-data-service/data-search-and-export/csv-downloads/gp-and-gp-practice-related-data) · [TRUD licences](https://isd.hscic.gov.uk/trud/users/guest/filters/2/licences)
- DoHS / nhs.uk: [DoHS API](https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services) · [version 3](https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services/version-3) · [v1 and v2](https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services/service-search-versions-1-and-2) · [search identifiers and service codes](https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services/guide-to-search-identifiers-and-service-codes) · [FHIR mappings](https://digital.nhs.uk/developer/api-catalogue/directory-of-healthcare-services/version-3/dohs-api-guide-to-fhir-mappings) · [EPS DoS migration (PHA example)](https://digital.nhs.uk/developer/api-catalogue/electronic-prescription-service-directory-of-services/migrating-from-the-eps-dos-api-to-the-service-search-api) · [developer forum: v3 access](https://developer.community.nhs.uk/t/directory-of-healthcare-services-api-version-3-access-onboarding/15213) · [forum: requirements / legal use cases](https://developer.community.nhs.uk/t/requirements-for-directory-of-healthcare-services-api/870) · [nhs.uk datasets on request](https://www.nhs.uk/about-us/nhs-website-datasets) · [nhs.uk terms](https://www.nhs.uk/our-policies/terms-and-conditions/) · [API key authentication pattern](https://digital.nhs.uk/developer/guides-and-documentation/security-and-authorisation/application-restricted-restful-apis-api-key-authentication) · [Digital Onboarding Service](https://digital.nhs.uk/services/digital-onboarding-service)
- NHSBSA: [consolidated pharmaceutical list](https://opendata.nhsbsa.net/dataset/consolidated-pharmaceutical-list)
- NHS App / 111: [how to integrate with the NHS App](https://digital.nhs.uk/services/nhs-app/how-to-integrate-with-the-nhs-app) · [NHS App technical specification](https://digital.nhs.uk/services/nhs-app/nhs-app-documents/nhs-app-technical-specification) · [NHS 111 online](https://digital.nhs.uk/services/nhs-111-online)
- Geocoding: [ONSPD licensing guide (Ideal Postcodes)](https://ideal-postcodes.co.uk/guides/onspd-licensing) · [ONS FOI on ONSPD/NSPL reuse](https://www.ons.gov.uk/aboutus/transparencyandgovernance/freedomofinformationfoi/usingthenationalstatisticspostcodelookupnsplandonspostcodedirectory) · [OS OpenData background (OSM wiki)](https://wiki.openstreetmap.org/wiki/OS_Opendata)
- Scotland: [PHS open data](https://www.opendata.nhs.scot/about) · [GP practices and list sizes](https://www.opendata.nhs.scot/dataset/gp-practice-contact-details-and-list-sizes) · [dental practices](https://www.opendata.nhs.scot/dataset/dental-practices-and-patient-registrations) · [PHS OGL statement](https://publichealthscotland.scot/ogl)
- Wales: [GP main sites (DataMapWales)](https://datamap.gov.wales/layers/geonode:gpmainsites_ogl/metadata_detail) · [111 Wales local services](https://111.wales.nhs.uk/localservices/healthwellbeingsupportfaq/)
- Northern Ireland: [BSO GP practice lists](https://bso.hscni.net/directorates/operations/family-practitioner-services/medical-services/contractor-information/northern-ireland-gp-practice-lists-for-professional-use/) · [OpenDataNI BSO datasets](https://admin.opendatani.gov.uk/organization/business-services-organisation) · [nidirect GP finder](https://www.nidirect.gov.uk/services/gp-practices/bellaghy-medical-centre-dr-hinds-and-partners)
- Registers: [GDC registers](https://www.gdc-uk.org/about-us/what-we-do/the-registers) · [GDC online register](https://olr.gdc-uk.org/) · [GOC](https://optical.org/en/Registration) · [HCPC check the register](https://www.hcpc-uk.org/check-the-register/) · [HCPC multiple registrant search](https://prod.hcpts-uk.org/multiple-registrant-search)
- Law and regulation: [SI 2022/1132 (dental 90-day profile review)](https://www.legislation.gov.uk/uksi/2022/1132/body/made) · [GDS Contracts Regs 2005 Sch 3 para 34A](https://legislation.gov.uk/uksi/2005/3361/schedule/3/paragraph/34A/2023-11-06?view=plain) · [MHRA software and apps guidance](https://www.gov.uk/government/publications/medical-devices-software-applications-apps) · [NHS identity: who can use it](https://www.england.nhs.uk/nhsidentity/identity-guidelines/who-can-use-the-nhs-identity/) and [who cannot](https://www.england.nhs.uk/nhsidentity/identity-guidelines/who-cannot-use-the-nhs-identity/) · Health and Social Care Act 2008 (Regulated Activities) Regulations 2014 (SI 2014/2936) · Copyright and Rights in Databases Regulations 1997 (SI 1997/3032) · UK GDPR / Data Protection Act 2018
- Self-referral examples: [Birmingham and Solihull hearing self-referral](https://birminghamsolihull.icb.nhs.uk/health-information/self-referral-hearing-checks) · [Oxford Health talking therapies](https://oxfordhealth.nhs.uk/talkingtherapies/)
