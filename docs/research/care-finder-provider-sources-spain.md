# Care Finder: provider source strategy for Spain

Checked: 7 October 2026. Scope: Spain only. Germany is next because of the DRK deployment; other countries come later.

## How the evidence was gathered

This environment's network policy blocks direct access to Spanish government sites (`sanidad.gob.es`, `regcess.mscbs.es`, `datos.gob.es`, `saludcastillayleon.es`, `datosabiertos.castillalamancha.es`). Every source below was **found through web search on 7 Oct 2026; its page was not opened**. Each one is marked:

- **[search]**: existence and description come from search results. Not yet confirmed by opening the source.
- **[law]**: the obligation comes from a statute. The cited text appeared in search results.
- **[ours]**: a fact about our own code, checked directly.

Treat every **[search]** item as a lead to confirm. The first task in the 30-day plan is to open each one from an unrestricted machine.

---

## 1. Executive recommendation

Google Places is the wrong backbone. It holds business listings that anyone can edit. It cannot show that a clinic is authorised, what services it is licensed to offer, or that a practitioner is qualified. Its terms also forbid what we currently do with its data (section 9).

Spain has something better, and it is official:

1. **The register of authorised health centres (REGCESS) is the spine.** Every health centre, service and establishment in Spain, public or private, must be authorised by its region. The national register collects all of these. It can be searched by **"care offered"** (*oferta asistencial*), using official service codes (for example U.59 physiotherapy and U.60 occupational therapy), and by location. Bulk downloads appear to exist. If confirmed, this answers the question Google can't: is this place authorised to provide this kind of care?
2. **For people on public cover, don't search at all.** Work out their assigned health centre and link straight into their region's online appointment system (Sacyl Conecta in Castilla y León, which covers Zamora). This is the most useful thing we can do for most of our users, and it relies only on authoritative sources.
3. **Professional college registers verify people, they don't help find them.** Every health professions college (*colegio*) must publish a public register of its members. Each record gives name, membership number, qualifications, professional address and whether the person can practise. These registers are searched by name, so they can confirm a person but can't find one.
4. **Private insurers' provider lists through partnership.** Adeslas and Asisa (the MUFACE insurers), Sanitas and DKV publish their provider lists online and as PDFs. Reusing them at scale needs agreements.
5. **Map data is secondary.** Use OpenStreetMap (reusable with attribution under its ODbL licence) or Google, within its terms, for geocoding, travel time and opening hours only. Never use it as the authority on what a place offers.

What no source provides reliably: **availability, prices, step-free access, home visits, languages spoken**, or "experience with older adults after hospital discharge". Booking platforms such as Doctoralia have availability, but only through a partnership. For everything else, Care Finder's current "Not known, ask when you call" is the honest answer and should stay.

---

## 2. Spain source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Confidence it fits our need |
|---|---|---|---|---|---|---|---|
| 1 | **REGCESS**, national register of health centres, services and establishments. [Ministry page](https://www.sanidad.gob.es/areas/saludDigital/regCess/home.htm), [search tool](https://regcess.mscbs.es/regcessWeb/inicioBuscarCentrosAction.do), [download manual](https://regcess.mscbs.es/regcessWeb/descargaManualDefinicionesInformacion.do) | Every authorised health centre, public and private, fed continuously by the regions. Legal basis: RD 1277/2003 and Order SCO/3866/2007 | **Regulated / official** | All care types in scope that need authorisation: clinics, physiotherapy, podiatry, opticians, hearing-aid centres, dental, psychology (health), dietetics and more | **[search]** Web search by region, province, town, street, centre type, name, **care offered** and classification, plus a map search. **Periodic download files** with a definitions manual. Search results suggest Excel exports and say files may be supplied encrypted. Some fields (telephone) may be marked "protected". | Public-sector information, reusable by default under Spanish public-sector reuse law (Ley 37/2007) unless conditions say otherwise. **Confirm the download terms.** | **High** for whether a place exists and is authorised, and for which services it is licensed to offer. Medium for contact details. None for availability or price. |
| 2 | **Regional health-centre registers** (Castilla y León [registry](https://www.saludcastillayleon.es/institucion/en/centros-servicios-establecimientos-sanitarios/registro-centros-sanitarios); Castilla-La Mancha [open data](https://datosabiertos.castillalamancha.es/dataset/registro-de-centros-servicios-y-establecimientos-sanitarios-rcses-de-castilla-la-mancha); [Andalucía](https://www.juntadeandalucia.es/temas/sectores/sanitario/autorizacion-acreditacion.html); [Valencia](https://www.san.gva.es/es/web/centros-servicios-y-establecimientos-sanitarios/registro-autonomico-de-centros-servicios-y-establecimientos-sanitarios-de-la-comunidad-valenciana); [Canarias](https://www3.gobiernodecanarias.org/sanidad/scs/RegistroCentros/); [Extremadura](https://saludextremadura.ses.es/web/detalle-contenido-estructurado/11338?refMenu=466); [Euskadi](https://www.euskadi.eus/informacion/autorizacion-de-centros-presentacion/web01-a2inzer/es/)) | The original records that REGCESS copies | **Regulated / official** | As above, per region | **[search]** Castilla-La Mancha publishes an open-data set. Other regions: web search tools. | Open-data licence where published | High. Use these where they are fresher or richer than REGCESS. |
| 3 | **National hospital catalogue (CNH)** [intro](https://www.sanidad.gob.es/en/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/introduccion.htm) | Yearly catalogue built from REGCESS | Official | Hospitals only | **[search]** Annual publication; the 2025 edition is referenced. Older editions are PDFs. | Public | High for hospitals. Only refreshed yearly. |
| 4 | **Public primary-care centres** (centros de salud and local clinics), by region; [Castilla y León map](https://www.saludcastillayleon.es/es/mapa-centros-salud-castilla-leon/120686), [Castilla-La Mancha local clinics CSV](https://datos.gob.es/en/catalogo/a08002880-consultorios-locales-de-castilla-la-mancha.csv) | Public-system centres organised by **basic health zone** | Official | Family doctors, nursing, public physiotherapy | **[search]** Castilla y León has a map and a centres directory, and an open-data portal ([datosabiertos.jcyl.es](https://datosabiertos.jcyl.es/web/es/datos-abiertos-castilla-leon.html)). No dataset with coordinates was found. | Open data where published | High for "which public centre serves this address", once the address-to-zone mapping is confirmed. |
| 5 | **Regional online appointment systems**: Castilla y León [cita previa centres](https://saludcastillayleon.es/es/citaprevia/centros-adscritos-sistema-cita-previa), the Sacyl Conecta app | Where public patients book with their own family doctor or nurse | Official | Primary care only | **[search]** Web and app booking; centres can be filtered by type, address, health zone and name. No API was found. | **Deep links only**, no data reuse | High as a hand-off. We link out; we never book. |
| 6 | **State register of health professionals (REPS)** [page](https://www.sanidad.gob.es/areas/profesionesSanitarias/registroEstatal/profesionalesREPS.htm) | National register of every professional authorised to practise. RD 640/2014, RD 610/2024 | **Regulated / official** | All health professions | **[search]** Public lookup for citizens "to verify that the professionals attending them have adequate qualifications". Records holding only the minimum data are **not visible** publicly, so coverage is incomplete. No API or bulk data found. | Personal data. Lookup for verification only. | Medium. Good for spot checks, unsuitable as a dataset. |
| 7 | **Professional college registers** (*ventanilla única*), each college obliged by law to publish one. Doctors: CGCOM "Buscador de colegiados" ([integration contract](https://pai.gva.es/documents/162018290/176279246/PAI_CONTRATO_INTEGRACION_CGCOM_CONSULTA_HABILITADOS_v3_v001.pdf/a1e14795-5c43-4cc1-9038-c36b63f6c4e7)). Physiotherapists: [Consejo General](https://www.consejo-fisioterapia.org/vu_colegiados/pag_1308.html). Psychologists: [COP](https://www3.cop.es/pdf/FUNCIONES-DEL-CONSEJO-GENERAL.pdf). Also dentists, podiatrists, optician-optometrists, dietitians and occupational therapists. | Membership and fitness to practise | **Regulated** (public-law corporations) | Named professionals | **[law]** Ley 2/1974 art. 10.2 a), as amended by Ley 25/2009: the register must give name, membership number, qualifications, professional address and qualification status. **[search]** Searches are by name or membership number, often per province. CGCOM appears to offer a "consult registered doctors" integration to public administrations (the Valencian contract above). No public APIs found. | Personal data published for consumer verification. Bulk reuse is not covered; the Spanish data-protection authority has issued rulings on colegio registers ([2014-0148](https://www.aepd.es/documento/2014-0148.pdf), [2013-0398](https://www.aepd.es/documento/2013-0398.pdf)). | High for a qualification check on a **named** person. Useless for discovery. |
| 8 | **Insurer provider lists**: Adeslas, Asisa, Sanitas, DKV, and MUFACE through Adeslas and Asisa ([2026 lists](https://www.redaccionmedica.com/politica/muface/20260109/los-cuadros-medicos-de-muface-en-asisa-adeslas-quedan-asi/255815_0.amp.html)) | Which providers accept which insurer | Commercial, owned by the insurer | Private specialists, clinics, physiotherapy, podiatry and more (insurer-dependent) | **[search]** Web search by specialty, centre and name. PDFs by province. No public API. | Database right and site terms. **Partnership needed** for automated reuse. | High for "accepts this insurer", if current. PDFs go out of date between editions. |
| 9 | **Doctoralia** and similar booking platforms (Top Doctors) | Profiles, reviews, real availability | Commercial | Private practitioners and clinics | **[search]** Its official API serves practices that manage their own schedules. Third-party scrapers exist (Apify and others); using them is **not acceptable** for us. | Site terms plus database right. Partnership only. | High for availability, where a partnership exists. Reviews are self-selected. |
| 10 | **OpenStreetMap** | Map features tagged healthcare, doctors, dentist, clinic; a wheelchair tag | Community-maintained | Mixed; physiotherapy and podiatry tagging is sparse | Free download, Overpass API | ODbL: commercial use allowed with attribution; share-alike applies to derived databases | Low for what a place offers; medium for location. The wheelchair tag is incomplete in most cities ([study](https://publish.mersin.edu.tr/index.php/igd/article/view/444)). |
| 11 | **Google Places** (current) | Business listings | Commercial, user-editable | Everything, unverified | API, paid | **Strict:** only `place_id` may be stored indefinitely; coordinates up to 30 days; no caching exception for names, addresses or ratings ([service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms?hl=es-419); [summary](https://openplacesapi.com/blog/can-you-store-places-api-results)) | Medium for contact details and opening hours. Low for what a place offers. Zero for qualification. |
| 12 | **Provider-owned websites** (already read by `refreshProviderEvidence`) | The clinic's own claims | Provider-owned | Varies | Read the page | Fine to read and quote with attribution | Medium for prices, step-free access and home visits. Self-declared, so labelled "says on its own website". |

**One correction to my earlier claim.** Search results put podiatry at **U.4**, not U.59. U.59 is physiotherapy and U.60 is occupational therapy (RD 1277/2003 Annex II). The care-offered codes are also **being revised**: a draft royal decree on care units was open for comment in December 2024 and again in May 2025 ([dietitians' council comments](https://www.consejodietistasnutricionistas.com/wp-content/uploads/2025/06/2025-05-26-Alegaciones-proyecto-modificacion-Final_260525.pdf)). The mapping must be read from the current manual, not from memory.

---

## 3. Recommended architecture

The architecture separates places, people and enrichment.

```
User request (plain words)
   │
   ▼
Requirements: care type(s) · cover route · area · access needs · what can't be verified
   │
   ├─ Public cover ─► assigned centre (regional zone lookup) ─► link to regional booking
   │
   └─ Private / insurer / self-pay
          │
          ▼
   PLACE SPINE: REGCESS + regional registers
     filter: care-offered codes for the care type, status = authorised, distance
          │
          ▼
   ENRICH (per place, each fact attributed and timestamped)
     · location / travel time: OSM or Google, place_id only stored
     · opening hours, phone: Google (not stored) or provider website
     · accepts insurer X: insurer provider list (partnership)
     · price, step-free, home visits, languages: provider website, else "Not known"
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
| Where is it, and how long to get there? | Register address, geocoded through OSM or Google | n/a |
| Does it take my insurance? | Insurer provider list | "Ask when you call" |
| Is it my assigned public centre? | Regional health-zone data | "Check your health card" (current behaviour) |
| Can I book, and when? | Regional booking link (public); booking partnership (private) | Phone, with the call script |
| Price, step-free access, home visits, languages | Provider website (labelled self-declared) | "Not known" |

### Matching the same provider across sources

1. The **register code** is the identity of a place.
2. Match to other sources on: normalised name, plus address (street, number, postcode), plus phone where available. Store a Google `place_id` alongside, which is permitted.
3. Never merge two register codes automatically. A clinic with two authorised units at one address stays as one place offering two services.
4. Professionals link to places only when a source states it (a college's professional address, or the provider's own staff page), and that link is shown as reported, not verified.

### Evidence and confidence

This builds on the evidence model Care Finder already has (verified / reported / unknown / conflicting, with source, URL and check date):

- **Verified:** from an official register (REGCESS, a regional register, a college register) or an insurer partnership feed.
- **Reported:** from the provider's own site or a map source.
- **Unknown:** shown as "Ask when you call". Never inferred.
- **Conflicting:** official beats provider-owned, which beats map or community data. Show both when they disagree on something that matters, such as being authorised.
- **Staleness:** each fact type gets a maximum age, extending the existing `PROVIDER_CRITERION_FRESHNESS_MS` (for example authorisation 30 days, insurer list 90 days, opening hours 7 days). Older facts are downgraded to "reported, may be out of date".

### Ranking

Order of priority, adapted from the brief:

1. **Hard filters, not scores:** authorised for the care type; eligible under the person's cover; meets hard access needs (home visit, if required).
2. **Fit with the full request.** Each requirement is met (verified), met (reported), unknown or not met. Rank by count of verified-met, then reported-met.
3. **Travel time.**
4. **Availability**, only when real data exists.
5. **Price transparency**, as a small boost for showing a price, never a penalty for not showing one.
6. **Reputation: not used for ranking.** No Spanish source is both authoritative and unbiased. Show it labelled if at all.

**Paid placement can never affect the order.** Provider payments, partnerships or sponsored placement must never enter the scoring function. The ranking code should not have access to commercial fields. Enforce this with a test.

### Turning a request into requirements

Example: *"A physiotherapist who offers home visits and has experience supporting older adults after hospital discharge."*

| Requirement | Kind | Verifiable from | Result |
|---|---|---|---|
| Physiotherapy | Care type | Register code U.59 | **Hard filter** |
| Home visits | Access | Provider website; possibly a home-care authorisation code (to confirm) | Rank; "ask" if unknown |
| Experience after hospital discharge | Specialisation claim | **No source** | Shown as "Ask when you call". Never claimed. |

The parser pulls out care type, cover, access needs and specialisation claims using the existing Care Finder keyword model, extended if needed. It never infers a diagnosis. Anything that can't be verified becomes a question for the call script, not a filter.

---

## 4. Compliance and operating risks

1. **We are probably breaching Google's terms now. [ours]**
   - Care Finder saves search results (names, addresses, phone numbers, travel text) in task drafts with no expiry (`providerResult` in `careFinderProgressPayload`).
   - The legacy offers and evidence code caches Google data too.
   - Google's terms allow storing only `place_id` indefinitely, and coordinates for up to 30 days.
   - **Fix:** store only `place_id` plus our own data, and re-fetch display fields when showing results. Or move place identity to the register.
2. **Personal data in professional registers.** These registers publish personal data for one purpose: letting the public verify a professional. Copying them in bulk into our own directory would be a new purpose under GDPR and needs a legal basis. Look up named people on demand only; don't build a copy of the registers.
3. **Database rights.** Insurer lists and booking platforms are protected under the EU database right, and copying a substantial part of one infringes it. Use partnerships only. No scraping, which also rules out the third-party scrapers that exist for Doctoralia.
4. **Medical-device classification.** Stay a directory: no diagnosis, no triage beyond sending warning signs to 112. Keep the "where to start" routes labelled as product reasoning, as now, under the CLAUDE.md wellness positioning.
5. **Register data quality.** Registers lag behind reality: closures may still be listed, and contact details may be blank or marked "protected". Use the register for authorisation and enrich contact details from other sources, with labels.

---

## 5. MVP and production sources

**MVP (next 30–60 days):**
- REGCESS bulk download, or regional open data where better, as the place spine for Castilla y León first (Zamora), then national.
- A care-type to register-code map, read from the current manual.
- Public-cover path: assigned centre plus a deep link to Sacyl Conecta / regional booking (Castilla y León first).
- Geocoding and travel through OSM or Google with `place_id`-only storage.
- Provider-website evidence (existing), labelled self-declared.
- The Google caching fix.

**Production:**
- Insurer partnerships: Adeslas and Asisa first (they cover MUFACE).
- A booking partnership (Doctoralia or Top Doctors) for availability, kept out of ranking influence.
- An integration with doctors' registered-member lookup, modelled on the regional-government contract with CGCOM.
- The other regional booking systems.

## 6. Sources not to trust

- **Google or OSM as evidence of qualification or what a place offers.** These are user-edited listings.
- **Review stars as a quality signal.** They are self-selected and gameable, and there is no authoritative alternative.
- **Third-party scrapers of Doctoralia, insurers or colleges.** Legal and reliability risk.
- **The PDFs of past national hospital catalogues** for anything except history.
- **Any "verified" badge from a marketplace**, which reflects the marketplace's own process, not a regulator's.

## 7. 30 / 60 / 90 days

**Days 0–30: confirm, then fix what's broken.**
- Open every [search] source from an unrestricted machine and record fields, formats, terms and refresh frequency. (The cloud environment blocks these sites; either allow them in its network settings or check from Replit.)
- Get the REGCESS download and manual. Confirm the care-offered codes and the access terms.
- Fix Google storage: keep only `place_id`.
- Build the care-type to register-code map.

**Days 30–60: register spine for Castilla y León.**
- Import REGCESS for Castilla y León and link Google `place_id`s to register entries.
- Switch Care Finder results to "authorised places for this care type", with map data used only for travel time.
- Public-cover path: assigned centre plus the Sacyl booking deep link.
- Measure, in Zamora and one city, the share of Google results that are not authorised for the care type. This number justifies the change.

**Days 60–90: national rollout and partnerships.**
- Extend to all regions.
- Approach Adeslas and Asisa about provider-list feeds, and one booking platform.
- Add the "paid placement cannot affect ranking" test.
- Germany: repeat the exercise (statutory health-insurance doctors' associations, state chambers of physicians, 116117).

## 8. Open questions

1. **Legal:** what are the REGCESS download terms? Is reuse for a commercial directory allowed under Ley 37/2007 and its conditions?
2. **Legal:** can we look up named professionals in college registers on demand, as part of a commercial service, without a separate legal basis?
3. **Technical:** do REGCESS downloads include phone numbers and coordinates, or is phone marked protected? How often are they refreshed?
4. **Technical:** can we map an address to its basic health zone in Castilla y León from public data?
5. **Technical:** are "home care" and home-visit services authorised as separate codes?
6. **Technical:** when does the new care-units decree take effect, and do its codes change?
7. **Partnership:** what are Doctoralia's API terms for third-party discovery, as opposed to practice management?
8. **Partnership:** will Adeslas and Asisa provide provider-list feeds, and on what terms?

## Sources

All checked by web search on 7 October 2026; pages not opened unless noted.

- REGCESS: [Ministry page](https://www.sanidad.gob.es/areas/saludDigital/regCess/home.htm) · [search tool](https://regcess.mscbs.es/regcessWeb/inicioBuscarCentrosAction.do) · [definitions manual](https://regcess.mscbs.es/regcessWeb/descargaManualDefinicionesInformacion.do) · [CASDA summary](https://www.casda.es/wp-content/uploads/2022/09/REGCESS.-CMC.pdf)
- Regional registers: [Castilla y León](https://www.saludcastillayleon.es/institucion/en/centros-servicios-establecimientos-sanitarios/registro-centros-sanitarios) · [Castilla-La Mancha](https://datosabiertos.castillalamancha.es/dataset/registro-de-centros-servicios-y-establecimientos-sanitarios-rcses-de-castilla-la-mancha) · [Andalucía](https://www.juntadeandalucia.es/temas/sectores/sanitario/autorizacion-acreditacion.html) · [Valencia](https://www.san.gva.es/es/web/centros-servicios-y-establecimientos-sanitarios/registro-autonomico-de-centros-servicios-y-establecimientos-sanitarios-de-la-comunidad-valenciana) · [Canarias](https://www3.gobiernodecanarias.org/sanidad/scs/RegistroCentros/) · [Extremadura](https://saludextremadura.ses.es/web/detalle-contenido-estructurado/11338?refMenu=466) · [Euskadi](https://www.euskadi.eus/informacion/autorizacion-de-centros-presentacion/web01-a2inzer/es/)
- Hospital catalogue: [introduction](https://www.sanidad.gob.es/en/estadEstudios/estadisticas/sisInfSanSNS/ofertaRecursos/hospitales/introduccion.htm)
- Castilla y León primary care and booking: [centres map](https://www.saludcastillayleon.es/es/mapa-centros-salud-castilla-leon/120686) · [booking centres](https://saludcastillayleon.es/es/citaprevia/centros-adscritos-sistema-cita-previa) · [open-data portal](https://datosabiertos.jcyl.es/web/es/datos-abiertos-castilla-leon.html)
- REPS: [public data](https://www.sanidad.gob.es/areas/profesionesSanitarias/registroEstatal/profesionalesREPS.htm)
- College registers and law: [Ley 2/1974 reform, Ley 25/2009 analysis](https://ga-p.com/wp-content/uploads/2018/03/la-reforma-de-la-ley-de-colegios-profesionales-de-1974.pdf) · [CGCOM integration contract](https://pai.gva.es/documents/162018290/176279246/PAI_CONTRATO_INTEGRACION_CGCOM_CONSULTA_HABILITADOS_v3_v001.pdf/a1e14795-5c43-4cc1-9038-c36b63f6c4e7) · [physiotherapists' register](https://www.consejo-fisioterapia.org/vu_colegiados/pag_1308.html) · [COP functions](https://www3.cop.es/pdf/FUNCIONES-DEL-CONSEJO-GENERAL.pdf) · data-protection rulings [2014-0148](https://www.aepd.es/documento/2014-0148.pdf), [2013-0398](https://www.aepd.es/documento/2013-0398.pdf)
- Care-offered codes: [RD 1277/2003](https://www.boe.es/eli/es/rd/2003/10/10) · [draft care-units decree, comments May 2025](https://www.consejodietistasnutricionistas.com/wp-content/uploads/2025/06/2025-05-26-Alegaciones-proyecto-modificacion-Final_260525.pdf)
- Insurers / MUFACE: [2026 provider lists](https://www.redaccionmedica.com/politica/muface/20260109/los-cuadros-medicos-de-muface-en-asisa-adeslas-quedan-asi/255815_0.amp.html)
- Doctoralia: [third-party scraper listing (evidence it is scraped, not endorsed)](https://apify.com/scrapesage/doctoralia-scraper)
- Google terms: [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms?hl=es-419) · [caching summary](https://openplacesapi.com/blog/can-you-store-places-api-results)
- OpenStreetMap wheelchair coverage: [study](https://publish.mersin.edu.tr/index.php/igd/article/view/444)
