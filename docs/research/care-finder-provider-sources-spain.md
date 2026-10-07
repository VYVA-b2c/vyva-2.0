# Care Finder: provider source strategy for Spain

Checked: 7 October 2026. Scope: Spain only. Germany is next because of the DRK deployment; other countries come later.

## How the evidence was gathered

The first version of this report was written from web search alone. On the same day, a second pass opened the sources directly: national and regional pages were fetched, the REGCESS download files were downloaded and analysed (outside the repository; no data is committed), and the Castilla y León health-zone service was queried live with a real Zamora address. Each item is marked:

- **[verified 7 Oct 2026]**: the page, file or service was opened and the stated facts were read from it.
- **[search]**: still only found through web search. Not yet confirmed.
- **[law]**: the obligation comes from a statute. The cited text appeared in search results.
- **[ours]**: a fact about our own code, checked directly.
- **[not found]**: looked for, within a time limit, and not found. This does not prove it doesn't exist.

Some hosts were still unreachable from this environment (listed in section 10). Anything on those hosts stays **[search]**.

---

## 1. Executive recommendation

Google Places is the wrong backbone. It holds business listings that anyone can edit. It cannot show that a clinic is authorised, what services it is licensed to offer, or that a practitioner is qualified. Its terms also forbid what we currently do with its data (section 4).

Spain has something better, and it is official:

1. **The register of authorised health centres (REGCESS) is the spine.** Every health centre, service and establishment in Spain, public or private, must be authorised by its region, and the national register collects them all. **[verified 7 Oct 2026]** It is published as four Excel files, refreshed monthly, downloadable directly with no request, no login and no encryption. 174,000+ rows. Each row carries the official **care-offered codes** (*oferta asistencial*), for example U.59 physiotherapy and U.4 podiatry, plus address and phone (phone present on 99.5% of rows). It has **no coordinates**, so we geocode it ourselves (CartoCiudad, free, section 7). It answers the question Google can't: is this place authorised to provide this kind of care?
2. **For people on public cover, don't search at all.** Work out their assigned health centre and link to their region's online appointment system. **[verified 7 Oct 2026]** For Zamora this works end to end from public data today: address → CartoCiudad coordinates → Castilla y León health-zone service → "C.S. Puerta Nueva". Four more regions publish health-zone boundaries as live open data (Valencia, Navarra, Baleares, Catalonia), and four others appear to (section 8).
3. **Some regions publish their own register with coordinates.** Castilla y León (monthly, every row geolocated, CC BY 4.0) and Madrid (daily, with coordinates and care offered, CC BY) are richer than REGCESS for those regions. **[verified 7 Oct 2026]** The first version of this report said no Castilla y León dataset with coordinates existed. That was wrong.
4. **Professional college registers verify people, they don't help find them.** Every health professions college (*colegio*) must publish a public register. Searches are by name or membership number. Use them to check a named person, never as a directory.
5. **Private insurers' provider lists through partnership.** Adeslas and Asisa (the MUFACE insurers), Sanitas and DKV publish provider lists online and as PDFs. Reusing them at scale needs agreements.
6. **Map data is secondary.** Use OpenStreetMap (ODbL, attribution) or Google, within its terms, for travel time and opening hours only. Never use it as the authority on what a place offers.

What no source provides reliably: **availability, prices, step-free access, languages spoken**, or "experience with older adults after hospital discharge". Booking platforms such as Doctoralia have availability, but only through a partnership. For everything else, Care Finder's current "Not known, ask when you call" is the honest answer and should stay. One correction: **home health care is an authorised service code (U.66, "Atención sanitaria domiciliaria")**, so "offers home visits" can be partly verified from the register (section 2).

---

## 2. Spain source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Confidence it fits our need |
|---|---|---|---|---|---|---|---|
| 1 | **REGCESS**, national register of health centres, services and establishments. [Ministry page](https://www.sanidad.gob.es/areas/saludDigital/regCess/home.htm), [search tool](https://regcess.mscbs.es/regcessWeb/inicioBuscarCentrosAction.do), [download area](https://regcess.mscbs.es/regcessWeb/inicioDescargarCentrosAction.do), [definitions manual](https://regcess.mscbs.es/regcessWeb/descargaManualDefinicionesInformacion.do) | Every authorised health centre, public and private, fed continuously by the regions. Legal basis: RD 1277/2003 and Order SCO/3866/2007 | **Regulated / official** | Clinics, physiotherapy, podiatry, dental, psychology, dietetics, home care, opticians, hearing-aid centres, pharmacies, orthopaedics | **[verified 7 Oct 2026]** Web search by region, province, town, street, centre class, name and care offered. **Monthly Excel downloads, direct links, no request or encryption.** Fields listed in section 7. **Phone is included, not "protected"**: present on 99.5% of rows (the rest hold "0"). Email on about half; website on under 10%. **No coordinates.** | **[verified 7 Oct 2026]** The Ministry's legal notice allows reuse, **commercial and non-commercial**, unless stated otherwise, on three conditions: don't distort the information, cite the source, and state the date of last update. Pharmacy rows are often named after the pharmacist, so treat names as personal data. | **High** for whether a place exists and is authorised, and for which services it is licensed to offer. Medium for contact details. None for availability or price. |
| 2 | **Regional registers** with machine-readable data: Castilla y León [register CSV](https://datosabiertos.jcyl.es/web/jcyl/set/es/salud/centros_sanitarios/1284289592598), Madrid [centres, services and establishments](https://datos.comunidad.madrid/dataset/d8a0a444-adf5-4c04-8999-0eac3de52cb7), Navarra [centres](https://datosabiertos.navarra.es/dataset/centros-sanitarios), Catalonia [authorised dental clinics](https://analisi.transparenciacatalunya.cat/d/67jd-4x4g). Web-only: [Andalucía](https://www.juntadeandalucia.es/temas/sectores/sanitario/autorizacion-acreditacion.html), [Canarias](https://www3.gobiernodecanarias.org/sanidad/scs/RegistroCentros/), [Valencia](https://www.san.gva.es/es/web/centros-servicios-y-establecimientos-sanitarios/registro-autonomico-de-centros-servicios-y-establecimientos-sanitarios-de-la-comunitat-valenciana), [Extremadura](https://saludextremadura.ses.es/web/detalle-contenido-estructurado/11338?refMenu=466), [Euskadi](https://www.euskadi.eus/informacion/autorizacion-de-centros-presentacion/web01-a2inzer/es/), Castilla-La Mancha [RCSES](https://datosabiertos.castillalamancha.es/dataset/registro-de-centros-servicios-y-establecimientos-sanitarios-rcses-de-castilla-la-mancha) | The original records that REGCESS copies | **Regulated / official** | As above, per region | **[verified 7 Oct 2026]** Castilla y León: 10,484 rows, **every row with coordinates**, care offered in words, monthly. Madrid: one row per centre per service, with UTM coordinates, refreshed daily. Navarra: CSV with centre type but no coordinates. Andalucía and Canarias pages open; no download found on them. Castilla-La Mancha RCSES link not opened. | **[verified 7 Oct 2026]** CC BY 4.0 (Castilla y León, Navarra), CC BY (Madrid) | **High.** Use these where they are fresher or richer than REGCESS. Castilla y León first. |
| 3 | **National hospital catalogue (CNH)** [intro](https://www.sanidad.gob.es/en/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/introduccion.htm) | Yearly catalogue built from REGCESS | Official | Hospitals only | **[verified 7 Oct 2026]** page exists. **[search]** edition details. The REGCESS C1 file (930 hospitals, monthly) makes this redundant for us. | Public | Low. Use REGCESS C1. |
| 4 | **Public primary-care centres and health zones**, by region (section 8) | Public-system centres organised by **basic health zone** | Official | Family doctors, nursing, public physiotherapy | **[verified 7 Oct 2026]** Coordinates published for Castilla y León, Castilla-La Mancha, Valencia, Murcia, Euskadi, Baleares and Catalonia. Health-zone boundaries live as open services in Castilla y León, Valencia, Navarra, Baleares and Catalonia. | Mostly CC BY 4.0; see section 8 for the Castilla y León exception | High for "which public centre serves this address". |
| 5 | **Regional online appointment systems** (section 8) | Where public patients book with their own family doctor or nurse | Official | Primary care only | **[verified 7 Oct 2026]** Entry pages open for most regions. **No API, and no way to deep-link to a specific centre or slot was found.** Booking requires the patient's own health-card identification. | **Link only**, no data reuse | High as a hand-off. We link to the region's entry page; we never book. |
| 6 | **State register of health professionals (REPS)** [page](https://www.sanidad.gob.es/areas/profesionesSanitarias/registroEstatal/profesionalesREPS.htm), [public search](https://reps.sanidad.gob.es/reps-web/inicio.htm) | National register of professionals authorised to practise. RD 640/2014, RD 610/2024 | **Regulated / official** | All health professions | **[verified 7 Oct 2026]** Web form. Search by province, **centre name** (must match the authorised name), first name and surnames. No API or bulk download found. The Ministry's own FAQ confirms some professionals' data is **not** in the public search. | Personal data. Lookup for verification only. | Medium. Good for spot checks, unsuitable as a dataset. |
| 7 | **Professional college registers** (*ventanilla única*) (section 9) | Membership and fitness to practise | **Regulated** (public-law corporations) | Named professionals | **[law]** Ley 2/1974 art. 10.2 a), as amended by Ley 25/2009: the register must give name, membership number, qualifications, professional address and qualification status. **[verified 7 Oct 2026]** Doctors (CGCOM) search by name plus first surname, or membership number. Physiotherapists' council lists members by college and offers a download of search results. No public APIs found. | Personal data published for consumer verification. Bulk reuse is not covered; the Spanish data-protection authority has issued rulings on colegio registers ([2014-0148](https://www.aepd.es/documento/2014-0148.pdf), [2013-0398](https://www.aepd.es/documento/2013-0398.pdf)). **[search]** | High for a qualification check on a **named** person. Useless for discovery. |
| 8 | **Insurer provider lists**: Adeslas, Asisa, Sanitas, DKV, and MUFACE through Adeslas and Asisa ([2026 lists](https://www.redaccionmedica.com/politica/muface/20260109/los-cuadros-medicos-de-muface-en-asisa-adeslas-quedan-asi/255815_0.amp.html)) | Which providers accept which insurer | Commercial, owned by the insurer | Private specialists, clinics, physiotherapy, podiatry and more | **[search]** Web search by specialty, centre and name. PDFs by province. No public API. | Database right and site terms. **Partnership needed** for automated reuse. | High for "accepts this insurer", if current. |
| 9 | **Doctoralia** and similar booking platforms (Top Doctors) | Profiles, reviews, real availability | Commercial | Private practitioners and clinics | **[search]** Its official API serves practices that manage their own schedules. Third-party scrapers exist; using them is **not acceptable** for us. | Site terms plus database right. Partnership only. | High for availability, where a partnership exists. |
| 10 | **OpenStreetMap** | Map features tagged healthcare, doctors, dentist, clinic; a wheelchair tag | Community-maintained | Mixed | Free download, Overpass API. **Not reachable from this environment** (section 10). | ODbL: commercial use allowed with attribution; share-alike applies to derived databases | Low for what a place offers; medium for location. |
| 11 | **Google Places** (current) | Business listings | Commercial, user-editable | Everything, unverified | API, paid | **[search]** Only `place_id` may be stored indefinitely; coordinates up to 30 days ([service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms?hl=es-419)) | Medium for contact details and opening hours. Zero for qualification. |
| 12 | **Provider-owned websites** (already read by `refreshProviderEvidence`) **[ours]** | The clinic's own claims | Provider-owned | Varies | Read the page | Fine to read and quote with attribution | Medium for prices, step-free access and home visits. Labelled "says on its own website". |
| 13 | **CartoCiudad geocoder** (IGN), [portal](https://www.cartociudad.es/web/portal) | National street and address data, with geocoding | Official | Every Spanish address | **[verified 7 Oct 2026]** Free JSON API, no key. A test of "calle Santa Clara 10, Zamora" returned coordinates, postcode, INE municipality code and cadastral reference. | **[search]** CC BY 4.0 compatible (IGN's licence), commercial use allowed; attribution "CartoCiudad cedido por © Instituto Geográfico Nacional". | **High** for geocoding register addresses. Replaces Google for this job. |
| 14 | **datos.gob.es "WFS download service for health resources"** (catalogue id e0dat0002) | A national map service of hospitals, health centres and clinics | Research project (CSIC sigMayores), not the Ministry | Public centres | **[verified 7 Oct 2026]** The catalogue API lists the endpoint as `sigmayores.csic.es/ArcGIS/services/Rec-Sanitarios/MapServer/WFSServer`. That host was unreachable; the catalogue page itself returned an error. | Not confirmed | **Low.** An old research layer, not maintained by a health authority. Don't use it; use REGCESS plus regional data. |

### Care-offered codes that matter for Care Finder

**[verified 7 Oct 2026]**, read from the REGCESS search tool's code list and counted in the downloaded C2 file (providers without beds, 119,334 rows):

| Care type | How it appears in REGCESS | Places (C2 file) |
|---|---|---|
| Physiotherapy | **U.59** Fisioterapia | 20,643 |
| Occupational therapy | **U.60** Terapia ocupacional | 1,481 |
| Podiatry | **U.4** Podología | 8,553 |
| Dentistry | **U.44** Odontología/Estomatología; centre class C251 Clínicas dentales | 26,927 |
| Dietetics | **U.11** Nutrición y Dietética | 2,408 |
| Clinical psychology | **U.70** Psicología clínica | 3,307 |
| General health psychology (*psicólogo general sanitario*) | **No own code.** Filed under **U.900** "Otras unidades asistenciales", a catch-all. Castilla y León's register labels it "(PSICOLOGIA SANITARIA)"; REGCESS does not. | n/a |
| Speech therapy | **U.61** Logopedia | 4,355 |
| Home health care | **U.66** Atención sanitaria domiciliaria | 5,413 |
| Geriatrics | **U.12** Geriatría | 184 |
| Opticians | Establishment class **E3** Ópticas (no care-offered codes) | 9,765 (E file) |
| Hearing aids | Establishment class **E5** Establecimientos de audioprótesis | 4,955 (E file) |
| Orthopaedic supplies | **E4** Ortopedias | 2,513 (E file) |
| Pharmacies | **E1** Oficinas de farmacia | 22,384 (E file) |

Psychology needs care: matching "psychologist" to U.70 alone misses most private general-health psychologists. Use U.70 plus U.900 with the centre class C22 (other health professionals) and, where a region supplies it, the regional label.

The codes are **being revised**: a draft royal decree on care units was open for comment in December 2024 and May 2025 ([dietitians' council comments](https://www.consejodietistasnutricionistas.com/wp-content/uploads/2025/06/2025-05-26-Alegaciones-proyecto-modificacion-Final_260525.pdf)) **[search]**. The code list above is the one in use on 7 October 2026. Read it from the live search tool on each import rather than hard-coding it.

---

## 3. Recommended architecture

The architecture separates places, people and enrichment.

```
User request (plain words)
   │
   ▼
Requirements: care type(s) · cover route · area · access needs · what can't be verified
   │
   ├─ Public cover ─► address → CartoCiudad → regional health-zone service
   │                  → assigned centre ─► link to regional booking entry page
   │
   └─ Private / insurer / self-pay
          │
          ▼
   PLACE SPINE: REGCESS monthly files (+ regional register where richer)
     filter: care-offered codes for the care type, distance
     coordinates: regional register where it has them, else CartoCiudad geocode
          │
          ▼
   ENRICH (per place, each fact attributed and timestamped)
     · travel time: OSM or Google, place_id only stored
     · opening hours: Google (not stored) or provider website
     · accepts insurer X: insurer provider list (partnership)
     · price, step-free, languages: provider website, else "Not known"
     · home visits: U.66 code (verified) or provider website (reported)
     · availability: booking-platform partnership, else "Ask when you call"
          │
          ▼
   NAMED PROFESSIONAL shown? ─► college register check (qualification + status)
```

### Which source decides what

| Question | Source of truth | Fallback |
|---|---|---|
| Does this place exist, and is it authorised? | REGCESS / regional register | None. If a place isn't in the register, it isn't shown as a health provider. |
| Is it licensed for this kind of care? | REGCESS care-offered codes | None |
| Is this named person qualified and allowed to practise? | Their college's register; REPS for spot checks | Show the place, not the person |
| Where is it, and how long to get there? | Regional register coordinates, else register address geocoded by CartoCiudad | n/a |
| Does it take my insurance? | Insurer provider list | "Ask when you call" |
| Is it my assigned public centre? | Regional health-zone boundaries | "Check your health card" (current behaviour) |
| Can I book, and when? | Regional booking entry page (public); booking partnership (private) | Phone, with the call script |
| Home visits | U.66 code (verified), provider website (reported) | "Ask when you call" |
| Price, step-free access, languages | Provider website (labelled self-declared) | "Not known" |

### Matching the same provider across sources

1. The **REGCESS normalised code (CCN)** is the identity of a place. The manual says it never changes and is unique. The regional code (*código autonómico*) is the join key to regional registers.
2. Match to other sources on: normalised name, plus address (street, number, postcode), plus phone. Store a Google `place_id` alongside, which is permitted.
3. Never merge two register codes automatically. A clinic with two authorised units at one address stays as one place offering two services.
4. Professionals link to places only when a source states it (a college's professional address, REPS by centre name, or the provider's own staff page), and that link is shown as reported, not verified.

### Evidence and confidence

This builds on the evidence model Care Finder already has (verified / reported / unknown / conflicting, with source, URL and check date) **[ours]**:

- **Verified:** from an official register (REGCESS, a regional register, a college register) or an insurer partnership feed.
- **Reported:** from the provider's own site or a map source.
- **Unknown:** shown as "Ask when you call". Never inferred.
- **Conflicting:** official beats provider-owned, which beats map or community data.
- **Staleness:** each fact type gets a maximum age, extending the existing `PROVIDER_CRITERION_FRESHNESS_MS` **[ours]**. REGCESS refreshes monthly, so authorisation facts can be at most about 35 days old. Insurer lists 90 days, opening hours 7 days. Older facts are downgraded to "reported, may be out of date".

### Ranking

1. **Hard filters, not scores:** authorised for the care type; eligible under the person's cover; meets hard access needs.
2. **Fit with the full request.** Each requirement is met (verified), met (reported), unknown or not met. Rank by count of verified-met, then reported-met.
3. **Travel time.**
4. **Availability**, only when real data exists.
5. **Price transparency**, as a small boost for showing a price, never a penalty for not showing one.
6. **Reputation: not used for ranking.**

**Paid placement can never affect the order.** The ranking code should not have access to commercial fields. Enforce this with a test.

### Turning a request into requirements

Example: *"A physiotherapist who offers home visits and has experience supporting older adults after hospital discharge."*

| Requirement | Kind | Verifiable from | Result |
|---|---|---|---|
| Physiotherapy | Care type | Register code U.59 | **Hard filter** |
| Home visits | Access | Register code U.66 (home health care) at the same centre; provider website | Rank; verified if U.66, reported if website only, "ask" if neither |
| Experience after hospital discharge | Specialisation claim | **No source** | "Ask when you call". Never claimed. |

---

## 4. Compliance and operating risks

1. **We are probably breaching Google's terms now. [ours]**
   - Care Finder saves search results (names, addresses, phone numbers, travel text) in task drafts with no expiry (`providerResult` in `careFinderProgressPayload`).
   - The legacy offers and evidence code caches Google data too.
   - Google's terms allow storing only `place_id` indefinitely, and coordinates for up to 30 days. **[search]**
   - **Fix:** store only `place_id` plus our own data, and re-fetch display fields when showing results. Or move place identity to the register.
2. **Personal data in registers.** College registers publish personal data for one purpose: letting the public verify a professional. Copying them in bulk would be a new purpose under GDPR. Look up named people on demand only. REGCESS also contains personal data: many pharmacies, consultations and dental clinics are registered under the owner's name, and the Castilla y León file names the owner (*titularidad*). Store what we need to show a place; don't build a people index from it.
3. **Database rights.** Insurer lists and booking platforms are protected under the EU database right. Use partnerships only. No scraping.
4. **Medical-device classification.** Stay a directory: no diagnosis, no triage beyond sending warning signs to 112.
5. **Register data quality.** Registers lag behind reality. REGCESS has a handful of impossible dates (years 2101 and 9010 in the "last authorisation" column) and some phones of "0". Validate on import and drop, not repair, bad values.
6. **Licence conditions.** REGCESS and most regional data need source attribution and the date of last update shown next to the data. Castilla y León's map service declares the non-commercial IGCYL-NC licence (section 8). Resolve that before using its health-zone layer in production.

---

## 5. MVP and production sources

**MVP (next 30–60 days):**
- REGCESS monthly files as the national place spine; Castilla y León's register CSV for Zamora (it adds coordinates).
- A care-type to register-code map, built from the table in section 2 and re-read from the live code list on each import.
- Geocoding through CartoCiudad for rows without coordinates.
- Public-cover path for Castilla y León: address → CartoCiudad → IDECyL health-zone service → assigned centre → Sacyl booking entry page. Proven to work with a Zamora address.
- Provider-website evidence (existing), labelled self-declared.
- The Google caching fix.

**Production:**
- Health-zone lookup for the other regions with open boundaries (Valencia, Navarra, Baleares, Catalonia, Aragón, Murcia, Asturias, Euskadi), then the rest.
- Insurer partnerships: Adeslas and Asisa first (they cover MUFACE).
- A booking partnership (Doctoralia or Top Doctors), kept out of ranking.
- An integration with doctors' registered-member lookup, modelled on the regional-government contract with CGCOM.

## 6. Sources not to trust

- **Google or OSM as evidence of qualification or what a place offers.**
- **Review stars as a quality signal.**
- **Third-party scrapers of Doctoralia, insurers or colleges.**
- **The datos.gob.es "health resources" WFS (e0dat0002).** A research-project layer, not a health authority's.
- **The 2017 Zenodo health-zone maps** for anything current. They are a research snapshot; zones have changed since (Asturias reorganised its map in 2025 **[search]**).
- **Any "verified" badge from a marketplace.**

---

## 7. API and data access

Per source: how to get it, what it holds, licence, refresh.

### REGCESS (national) **[verified 7 Oct 2026]**

- **Access:** direct HTTPS download, one Excel file per centre group. No login, no request, no encryption. The download page builds these links:
  - `https://regcesslm.sanidad.gob.es/recesAdminWeb/lm/GetExcelListadoMensual?tipoListado=C1` (hospitals, 0.2 MB, 930 rows)
  - `…?tipoListado=C2` (providers without beds, 17.6 MB, 119,334 rows)
  - `…?tipoListado=C3` (health services inside non-health organisations, 2.3 MB, 14,442 rows)
  - `…?tipoListado=E` (pharmacies, opticians, hearing-aid centres, orthopaedics, 5.6 MB, 40,536 rows)
- **Format:** `.xlsx`, one sheet, header in row 1.
- **Fields:** centre class; REGCESS normalised code (CCN, permanent and unique); regional authorisation code; centre name; region code and name; province code and name; municipality code and name (INE); street type, name and number; postcode; email; fax; phone; website; functional dependency (code and name); health area or sector (public C1/C2 only); public or private; date first authorised; date of last authorisation; type of last authorisation; structural change; beds (C1 only); care offered (comma-separated `U.nn Name` list; not in the E file).
- **Not included:** coordinates, opening hours, closure date. Closed centres appear to drop out rather than be flagged (to confirm by comparing two months).
- **Refresh:** monthly. The files are dated the first day of the current month. The online search is live; the manual says regions can push changes in real time.
- **Manual:** "Manual de definiciones e información", dated January 2023, 5 pages, PDF.
- **Licence:** Ministry of Health legal notice. Reuse allowed, commercial and non-commercial, unless stated otherwise. Conditions: don't distort the content; cite the source; give the date of last update.
- **Coverage note:** all 17 regions plus Ceuta (140 C2 rows) and Melilla (114) are present.

### Castilla y León register **[verified 7 Oct 2026]**

- **Access:** `https://datosabiertos.jcyl.es/web/jcyl/risp/es/salud/centros_sanitarios/1284289592598.csv` (semicolon-separated, UTF-8 with BOM, 3 MB).
- **Fields:** name, registration number (e.g. `37-C22-0582`), address, postcode, town, province, phone, fax, centre type, care offered (in words, `#`-separated), owner (*titularidad*), dependency, **position (lat, lng)**.
- **Rows:** 10,484, all with coordinates. Zamora: 881.
- **Licence:** CC BY 4.0 (dataset page). **Refresh:** monthly.

### Castilla y León health zones (IDECyL) **[verified 7 Oct 2026]**

- **Access:** WFS `https://idecyl.jcyl.es/geoserver/sanidad/wfs`, layers `sanidad:sacyl_zonas_basicas_salud`, `sanidad:sacyl_centros_salud`, `sanidad:sacyl_areas_salud`. Point-in-zone query with `CQL_FILTER=INTERSECTS(geometry,SRID=4326;POINT(lng lat))` returns the zone in one call.
- **Fields (zones):** centre name (`n_cs`), zone name (`n_zbs`), health area (`n_as`), zone id, hospital, number of municipalities, created/modified dates.
- **Test:** Calle Santa Clara 10, Zamora → zone "Puerta Nueva" → "C.S. Puerta Nueva". The zone record's last-modified date is 2012; check against the current health map.
- **Licence: unresolved.** The service's capabilities document declares `www.jcyl.es/licencia-IGCYL-NC`, the Junta's **non-commercial** licence (a separate commercial version exists, with similar conditions plus a duty to tell users the data is free on the Junta's site). A search-result snippet of the metadata record says "free use with citation", but that record returned 404 when opened. Ask the Junta, or use the commercial IGCYL licence.
- **Alternative with clear licence:** `https://datosabiertos.jcyl.es/web/jcyl/risp/es/salud/centros-salud-municipios/1285017220711.csv` maps every municipality to its zone and centre (CC BY 4.0 per the portal). That's enough everywhere except the cities, where one municipality has several zones; for Zamora city the boundaries are needed.

### Madrid register **[verified 7 Oct 2026]**

- **Access:** CKAN dataset "Centros, servicios y establecimientos sanitarios", CSV and JSON, `datos.comunidad.madrid`.
- **Fields:** registration number, centre type, dependency, care offered (one row per centre per service), municipality, street type/name/number, postcode, **UTM X/Y**, NIF.
- **Rows:** about 46,000 (centre × service). **Licence:** CC BY. **Refresh:** daily (last modified 7 Oct 2026).

### CartoCiudad geocoder (national) **[verified 7 Oct 2026]**

- **Access:** `https://www.cartociudad.es/geocoder/api/geocoder/findJsonp?q=<address>` (also `candidatesJsonp` for suggestions, and reverse geocoding). No key.
- **Returns:** coordinates (lat/lng), street, number, postcode, municipality and province with INE codes, region, cadastral reference.
- **Licence [search]:** IGN's CC BY 4.0-compatible licence, commercial use allowed, attribution "CartoCiudad cedido por © Instituto Geográfico Nacional". The licence page on the portal returned "not found" when opened.
- **Use:** geocode REGCESS rows once per import (about 175,000 addresses; cache by CCN), and user addresses on demand.

### datos.gob.es catalogue API **[verified 7 Oct 2026]**

- **Access:** `https://datos.gob.es/apidata/catalog/dataset/title/<words>`. Blocked to plain scripts by the site's bot protection; reachable through a normal fetch.
- **Searches run:** "centros de salud" (30 datasets), "centros sanitarios" (16+), "zonas basicas de salud" (none by title). Regional results are listed in section 8. The national WFS (e0dat0002) is not usable (source 14).

### REPS **[verified 7 Oct 2026]**

- **Access:** web form only at `reps.sanidad.gob.es/reps-web`. Search by province, centre name, first name, surnames. No API, no download.

### Professional colleges

See section 9. No public APIs found. CGCOM offers a "consult registered doctors" integration to public administrations (Valencian contract) **[search]**.

---

## 8. Region by region

Time-boxed per region. "Not found" means not found in that time.

**Columns:** (1) register of authorised centres, and whether it's machine-readable; (2) public primary-care centres with coordinates; (3) health-zone boundaries for address → assigned centre; (4) online appointment system; (5) licence of the open data.

| Region | (1) Register | (2) Primary-care centres with coordinates | (3) Health-zone boundaries | (4) Appointment system | (5) Licence |
|---|---|---|---|---|---|
| **Andalucía** | Web page opens; no download found. Use REGCESS (23,065 C2 rows). | Not found on the regional portal (catalogue API search returned no centres dataset) | Not found as live data. A 2017 research snapshot exists on Zenodo **[search]** | ClicSalud+: [entry page](https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/clicsalud/pages/portada.jsf) opens **[verified]**; deep link not found | Regional portal: CC BY 4.0 |
| **Aragón** | Not found; use REGCESS | Yes: "Centros de Salud" on opendata.aragon.es with x/y coordinates and zone **[search]** | Yes: "Zonas de Salud" with shape, same portal **[search]** | Salud Informa; the URL tried returned 404. Not confirmed | CC BY 4.0 **[search]** |
| **Asturias** | Not found; use REGCESS | Layers in the regional map service (`sig.asturias.es`, Visor/Salud) **[search]**; host unreachable here | Yes: ArcGIS REST layer of zones under Decree 16/2021; JSON/GeoJSON queries **[search]**. **The map was reorganised in June 2025 (Decree 86/2025, 68 zones)**; check the layer is current | astursalud.es unreachable here. Not confirmed | Not confirmed |
| **Baleares** | Not found; use REGCESS | Yes: IDEIB `GOIB_ZBS_IB` layer "Equipament sanitari" with lat/lon and register id **[verified]** | Yes: same service, layer "Zona sanitària", monthly automatic updates **[verified]** service and fields; refresh **[search]** | ibsalut.es opens **[verified]**; booking page not identified | CC BY on the regional catalogue **[verified]** for related health datasets |
| **Canarias** | Web search tool [RegistroCentros](https://www3.gobiernodecanarias.org/sanidad/scs/RegistroCentros/) opens **[verified]**; no download | Not found (only counts per island) | Not found as live data; 2017 Zenodo snapshot **[search]** | SCS site opens **[verified]**; booking page not identified | ISTAC terms for the statistics |
| **Cantabria** | Not found; use REGCESS | A map service of health centres, pharmacies and zones is registered on datos.gob.es as an application **[search]** | Same service **[search]** | scsalud.es opens **[verified]**; booking page not identified | Not confirmed |
| **Castilla-La Mancha** | RCSES dataset link not opened | **Yes**: [Centros de Salud CSV](https://datosabiertos.castillalamancha.es/sites/datosabiertos.castillalamancha.es/files/Centros_de_Salud_de_Castilla-La_Mancha.csv) with WGS84 coordinates, phone and **health-zone code** **[verified]**; local clinics CSV also listed | Not found as polygons (206 zones, Order 201/2018) | sescam.jccm.es unreachable here. Not confirmed | CC BY 4.0 **[search]** |
| **Castilla y León** | **Yes**: register CSV, all rows geolocated, monthly **[verified]** | **Yes**: IDECyL WFS `sacyl_centros_salud`; also municipality → zone → centre CSV **[verified]** | **Yes**: IDECyL WFS `sacyl_zonas_basicas_salud`, point query proven with a Zamora address **[verified]** | [Cita previa](https://www.saludcastillayleon.es/es/citaprevia) opens **[verified]**; Sacyl Conecta app **[search]**; no deep link found | Register and CSVs CC BY 4.0; **map service IGCYL-NC (non-commercial)** **[verified]** |
| **Cataluña** | Authorised dental clinics published as open data **[verified]**; full register not found | **Yes**: "Equipaments de Catalunya" includes primary-care centres (CAP) with lat/lng, phone and opening hours **[verified]** | **Yes**: "Àrees bàsiques de salut" with geometry on the Generalitat's open-data API (updated May 2026) **[verified]** | La Meva Salut [entry page](https://lamevasalut.gencat.cat/) opens **[verified]**; no deep link | Generalitat open-data terms **[search]** |
| **C. Valenciana** | Web register page **[search]** | **Yes**: centres layer as GeoJSON/ZIP (dated 5 Sept 2026) and WFS `CentrosSanitarios.CentrosSalud`; includes **zone code** **[verified]** download | **Yes**: zones layer (GeoJSON, Sept 2026) and WFS `MapaSanitario.ZonasBasicas` **[verified]** listed in catalogue | cita.san.gva.es returned a gateway error here. Not confirmed | CC BY **[verified]** in catalogue |
| **Extremadura** | Not found; use REGCESS | Yes: "Centros de Salud" XLSX on juntaex.es **[search]** (download timed out here) | Not found as live data; 2017 Zenodo snapshot **[search]** | saludextremadura.ses.es opens **[verified]**; booking page not identified | Not confirmed |
| **Galicia** | Not found; use REGCESS | **Not found.** Vigo city publishes its own centres (CSV/GeoJSON) **[verified]** listed | Not found | sergas.gal opens **[verified]**; booking page not identified | n/a |
| **Madrid** | **Yes**: full register, daily, with coordinates and care offered **[verified]** | Within the register (filter by type) **[verified]** | Not found as live polygons (only COVID-era tables by zone) | [Cita sanitaria](https://www.comunidad.madrid/salud/cita-sanitaria) opens **[verified]**; no deep link | CC BY **[verified]** |
| **Murcia** | Not found; use REGCESS | **Yes**: "Centros de Salud y consultorios" CSV/KML with coordinates **[verified]** download | Yes: Geosalud shapefiles of health zones, plus a street-to-zone directory **[search]** | murciasalud.es opens **[verified]**; booking page not identified | Not confirmed |
| **Navarra** | **Partly**: centres CSV with type and phone, no coordinates **[verified]** | Mental-health centres shapefile only **[verified]** listed | **Yes**: IDENA shapefile "Delimitación de las Zonas Básicas de Salud" (catalogue updated April 2026) **[verified]** listed | navarra.es unreachable here. Not confirmed | CC BY 4.0 **[verified]** |
| **País Vasco** | Web page **[search]** | **Yes**: Osakidetza centres, hospitals and clinics as JSON/GeoJSON with lat/lng **[verified]** | Yes: "Zonas de salud de Euskadi" shapefile on geo.euskadi.eus **[search]** | osakidetza.euskadi.eus opens **[verified]**; booking page not identified | Not confirmed |
| **La Rioja** | Not found; use REGCESS | Not found | Not found (19 zones) | riojasalud.es opens **[verified]**; booking page not identified | IDERioja publishes under CC BY 4.0 **[search]** |
| **Ceuta / Melilla (INGESA)** | Not found; use REGCESS (140 and 114 C2 rows) | Not found | Not found | ingesa.sanidad.gob.es opens **[verified]**; booking page not identified | n/a |

**Reading the table:** for the public-cover path, Castilla y León, Valencia, Navarra, Baleares and Catalonia can do address → zone today from live open data. Castilla-La Mancha can do address → centre only via the zone code on each centre, which needs the zone polygons it doesn't publish. Andalucía, Galicia, Madrid, La Rioja, Canarias, Extremadura and Ceuta/Melilla need a different route (a partnership, or fall back to "Check your health card").

**Appointment systems in general:** no region was found to offer a public API or a link that opens booking for a specific centre. Every system identifies the patient by their health card first. Care Finder should link to the entry page and tell the person what they'll need (health card number or digital certificate).

---

## 9. Professional colleges

| Profession | Council | Public search | API or integration | Status |
|---|---|---|---|---|
| Doctors | CGCOM, [consulta pública de colegiados](https://www.cgcom.es/servicios/consulta-publica-de-colegiados) | Name plus first surname, or membership number. Data supplied by the provincial colleges under art. 10.4 of the colleges law | "Consult registered doctors" integration for public administrations (Valencian contract) **[search]** | **[verified 7 Oct 2026]** |
| Physiotherapists | CGCFE, [registered physiotherapists](https://www.consejo-fisioterapia.org/vu_colegiados/pag_1308.html) | Filter by regional college; returns membership number, name, college. Offers a download of search results | None found | **[verified 7 Oct 2026]** |
| Psychologists | COP, [ventanilla única](https://www.cop.es/index.php?page=Ventanilla-Unica) | Page exists; search fields not confirmed (the page didn't render its content to a script) | None found | Partly verified |
| Nurses | CGE, consejogeneralenfermeria.org | No public member search found on the home page; the ventanilla única described in search results is for colleges and members | None found | **[not found]** |
| Dentists | Consejo General de Dentistas, consejodentistas.es | A professional directory with a published regulation **[search]** | None found | Host blocked here |
| Podiatrists | CGCOP, cgcop.es | **[search]** | None found | Host blocked here |
| Optician-optometrists | CGCOO, cgcoo.es | **[search]** | None found | Host blocked here |
| Pharmacists | CGCOF, [farmaceuticos.com/ventanilla-unica](https://www.farmaceuticos.com/ventanilla-unica/) | Ventanilla única for citizens to get information on pharmacists **[search]** | None found | Host blocked here |
| Dietitian-nutritionists | Consejo General de Colegios Oficiales de Dietistas-Nutricionistas: **consejodietistasnutricionistas.com** | **[search]** | None found | Domain confirmed by search and by the council's own PDFs; host blocked here |
| Occupational therapists | Consejo General de Colegios de Terapeutas Ocupacionales: **consejoterapiaocupacional.org** (from the council's contact email) | **[search]** | None found | Domain inferred, not opened; host blocked here |

---

## 10. Reachability from this environment (7 Oct 2026)

**Reachable:** sanidad.gob.es, regcess.mscbs.es, regcesslm.sanidad.gob.es, reps.sanidad.gob.es, cartociudad.es, ign.es, idecyl.jcyl.es, datosabiertos.jcyl.es, saludcastillayleon.es, datosabiertos.castillalamancha.es, datos.comunidad.madrid, analisi.transparenciacatalunya.cat, opendata.euskadi.eus, datosabiertos.navarra.es, datosabiertos.carm.es, ideib.caib.es, intranet.caib.es, opendata.aragon.es, juntadeandalucia.es, and the regional health portals marked "opens" in section 8.

**Blocked or failing:**
- Network proxy (403): idee.es, openstreetmap.org, sigmayores.csic.es, consejodentistas.es, cgcop.es, cgcoo.es, farmaceuticos.com, consejodietistasnutricionistas.com, consejoterapiaocupacional.org, cgcoto.es, sescam.jccm.es.
- Connection reset: overpass-api.de, download.geofabrik.de, astursalud.es, sig.asturias.es, navarra.es, web.larioja.org, dadesobertes.gva.es (its catalogue API answered once, then reset).
- Site bot protection: datos.gob.es blocks scripts (reachable through a normal page fetch).
- Gateway error: cita.san.gva.es.

---

## 11. 30 / 60 / 90 days

**Days 0–30: build on what is now confirmed.**
- Fix Google storage: keep only `place_id`.
- REGCESS importer: monthly job, four files, validate, store by CCN; geocode through CartoCiudad with a cache.
- Care-type to code map from section 2, including the psychology rule.
- Ask the Junta de Castilla y León about IGCYL-NC for the health-zone service, or apply for the commercial version.
- Open the remaining **[search]** items from an unrestricted machine (section 10 hosts).

**Days 30–60: Castilla y León end to end.**
- Merge the Castilla y León register (coordinates) onto REGCESS by regional code.
- Public-cover path: address → zone → centre → Sacyl booking entry page.
- Switch Care Finder results to "authorised places for this care type".
- Measure, in Zamora and one city, the share of Google results that are not authorised for the care type.

**Days 60–90: national rollout and partnerships.**
- Health-zone lookup for Valencia, Navarra, Baleares, Catalonia, then Aragón, Murcia, Asturias, Euskadi.
- Approach Adeslas and Asisa about provider-list feeds, and one booking platform.
- Add the "paid placement cannot affect ranking" test.
- Germany: repeat the exercise.

## 12. Open questions

1. ~~**Legal:** what are the REGCESS download terms?~~ **Answered:** reuse allowed, including commercial, with attribution, update date and no distortion. Remaining: personal data in owner-named rows (section 4).
2. **Legal:** can we look up named professionals in college registers on demand, as part of a commercial service, without a separate legal basis?
3. ~~**Technical:** do REGCESS downloads include phone numbers and coordinates?~~ **Answered:** phone yes, coordinates no. Refreshed monthly.
4. ~~**Technical:** can we map an address to its basic health zone in Castilla y León from public data?~~ **Answered: yes**, but the map service's licence is non-commercial. Needs a decision.
5. ~~**Technical:** are home-care services authorised as separate codes?~~ **Answered:** yes, U.66. Whether a physiotherapy clinic with U.66 does home *physiotherapy* still needs the provider to say so.
6. **Technical:** when does the new care-units decree take effect, and do its codes change?
7. **Technical:** do closed centres disappear from the REGCESS files, or stay with a flag? Compare two monthly files.
8. **Partnership:** what are Doctoralia's API terms for third-party discovery?
9. **Partnership:** will Adeslas and Asisa provide provider-list feeds, and on what terms?

## Sources

Verified 7 October 2026 unless marked [search].

- REGCESS: [Ministry page](https://www.sanidad.gob.es/areas/saludDigital/regCess/home.htm) · [search tool](https://regcess.mscbs.es/regcessWeb/inicioBuscarCentrosAction.do) · [download area](https://regcess.mscbs.es/regcessWeb/inicioDescargarCentrosAction.do) · [definitions manual](https://regcess.mscbs.es/regcessWeb/descargaManualDefinicionesInformacion.do) · [Ministry legal notice](https://www.sanidad.gob.es/avisoLegal/home.htm)
- Regional registers: [Castilla y León CSV](https://datosabiertos.jcyl.es/web/jcyl/set/es/salud/centros_sanitarios/1284289592598) · [Madrid](https://datos.comunidad.madrid/dataset/d8a0a444-adf5-4c04-8999-0eac3de52cb7) · [Navarra](https://datosabiertos.navarra.es/dataset/centros-sanitarios) · [Catalonia dental clinics](https://analisi.transparenciacatalunya.cat/d/67jd-4x4g) · [Canarias](https://www3.gobiernodecanarias.org/sanidad/scs/RegistroCentros/) · [Andalucía](https://www.juntadeandalucia.es/temas/sectores/sanitario/autorizacion-acreditacion.html) · [search] [Castilla-La Mancha RCSES](https://datosabiertos.castillalamancha.es/dataset/registro-de-centros-servicios-y-establecimientos-sanitarios-rcses-de-castilla-la-mancha), [Valencia](https://www.san.gva.es/es/web/centros-servicios-y-establecimientos-sanitarios/registro-autonomico-de-centros-servicios-y-establecimientos-sanitarios-de-la-comunitat-valenciana), [Extremadura](https://saludextremadura.ses.es/web/detalle-contenido-estructurado/11338?refMenu=466), [Euskadi](https://www.euskadi.eus/informacion/autorizacion-de-centros-presentacion/web01-a2inzer/es/)
- Health zones and centres: [IDECyL WFS](https://idecyl.jcyl.es/geoserver/sanidad/wfs?service=WFS&request=GetCapabilities) · [IGCYL-NC licence](https://datosabiertos.jcyl.es/web/jcyl/RISP/es/Plantilla100/1284235967637/_/_/_) · [Castilla y León municipality → zone CSV](https://datosabiertos.jcyl.es/web/jcyl/risp/es/salud/centros-salud-municipios/1285017220711.csv) · [Castilla-La Mancha centres CSV](https://datosabiertos.castillalamancha.es/sites/datosabiertos.castillalamancha.es/files/Centros_de_Salud_de_Castilla-La_Mancha.csv) · [Valencia centres](https://dadesobertes.gva.es/dataset/sanidad-sip-centros-salud) and [zones](https://dadesobertes.gva.es/dataset/fcb4f6ca-0db8-4752-aed9-0dd35fe7e998) · [Navarra zones](https://idena.navarra.es/descargas/DOTACI_Pol_SNSZonas.zip) · [Baleares IDEIB](https://ideib.caib.es/geoserveis/rest/services/public/GOIB_ZBS_IB/MapServer) · [Catalonia ABS](https://analisi.transparenciacatalunya.cat/d/tqzv-uu8e) and [equipaments](https://analisi.transparenciacatalunya.cat/d/8gmd-gz7i) · [Euskadi centres](https://opendata.euskadi.eus/catalogo/-/centros-de-salud-publicos-en-euskadi/) · [Murcia centres](https://datosabiertos.regiondemurcia.es/carm/catalogo/salud/centros-de-salud-y-de-salud-de-la-region-de-murcia) · [search] [Aragón](https://opendata.aragon.es/ckan/dataset/sanidad), [Asturias zones](https://sig.asturias.es/servicios/rest/services/Sanidad/Areas_Sanitarias/MapServer/0), [Murcia Geosalud](https://www.murciasalud.es/web/planificacion/geosalud-cartografia-sanitaria), [Euskadi zones](https://datos.gob.es/en/catalogo/a16003011-zonas-de-salud-de-euskadi1), [2017 Zenodo zone maps](https://zenodo.org/record/1308898)
- National catalogue: [datos.gob.es API](https://datos.gob.es/apidata/catalog/dataset/title/centros%20de%20salud) · [e0dat0002 health-resources WFS](https://datos.gob.es/es/catalogo/e0dat0002-servicio-de-descargawfs-de-recursos-sanitarios)
- Geocoding: [CartoCiudad](https://www.cartociudad.es/web/portal) · [search] [CartoCiudad licence summary (pycartociudad)](https://pypi.org/project/pycartociudad/)
- Hospital catalogue: [introduction](https://www.sanidad.gob.es/en/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/introduccion.htm)
- REPS: [information page](https://www.sanidad.gob.es/areas/profesionesSanitarias/registroEstatal/profesionalesREPS.htm) · [public search](https://reps.sanidad.gob.es/reps-web/inicio.htm)
- Colleges: [CGCOM search](https://www.cgcom.es/servicios/consulta-publica-de-colegiados) · [physiotherapists](https://www.consejo-fisioterapia.org/vu_colegiados/pag_1308.html) · [COP ventanilla única](https://www.cop.es/index.php?page=Ventanilla-Unica) · [search] [CGCOM integration contract](https://pai.gva.es/documents/162018290/176279246/PAI_CONTRATO_INTEGRACION_CGCOM_CONSULTA_HABILITADOS_v3_v001.pdf/a1e14795-5c43-4cc1-9038-c36b63f6c4e7), [pharmacists' ventanilla única](https://www.farmaceuticos.com/ventanilla-unica/), [dentists' directory regulation](https://transparencia.consejodentistas.es/wp-content/uploads/2023/12/19_reglamento_del_directorio_dentistas.pdf), [Ley 25/2009 analysis](https://ga-p.com/wp-content/uploads/2018/03/la-reforma-de-la-ley-de-colegios-profesionales-de-1974.pdf), data-protection rulings [2014-0148](https://www.aepd.es/documento/2014-0148.pdf), [2013-0398](https://www.aepd.es/documento/2013-0398.pdf)
- Care-offered codes: [RD 1277/2003](https://www.boe.es/eli/es/rd/2003/10/10) · [search] [draft care-units decree, comments May 2025](https://www.consejodietistasnutricionistas.com/wp-content/uploads/2025/06/2025-05-26-Alegaciones-proyecto-modificacion-Final_260525.pdf)
- [search] Insurers / MUFACE: [2026 provider lists](https://www.redaccionmedica.com/politica/muface/20260109/los-cuadros-medicos-de-muface-en-asisa-adeslas-quedan-asi/255815_0.amp.html)
- [search] Doctoralia: [third-party scraper listing (evidence it is scraped, not endorsed)](https://apify.com/scrapesage/doctoralia-scraper)
- [search] Google terms: [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms?hl=es-419) · [caching summary](https://openplacesapi.com/blog/can-you-store-places-api-results)
- [search] OpenStreetMap wheelchair coverage: [study](https://publish.mersin.edu.tr/index.php/igd/article/view/444)
