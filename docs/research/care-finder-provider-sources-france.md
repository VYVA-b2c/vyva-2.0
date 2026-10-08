# Care Finder: provider source strategy for France

Checked: 8 October 2026. Scope: France only (metropolitan France and the overseas departments). This is a companion to `care-finder-provider-sources-spain.md` and `care-finder-provider-sources-germany.md`, with the same structure and evidence marks.

## How the evidence was gathered

The network proxy in this environment refused **every French public host tried** (section 10). That includes data.gouv.fr, annuaire.sante.fr, esante.gouv.fr, the Annuaire Santé FHIR gateway, ameli.fr, sante.fr, adresse.data.gouv.fr, data.geopf.fr and legifrance.gouv.fr. Both `curl` and the page fetcher were blocked.

GitHub was reachable, and the agency that runs both national registers, the **Agence du Numérique en Santé (ANS)**, publishes its specifications there under its own organisation, `ansforge`. Four of its repositories were cloned and read:

- the FINESS flows, schemas and data model (`ansforge/finess`);
- the Annuaire Santé FHIR API documentation and terms of use (`ansforge/annuaire-sante-fhir-documentation`);
- the FHIR implementation guide source (`ansforge/IG-fhir-annuaire`);
- the terminology source (`ansforge/IG-terminologie-de-sante`) and the Service d'Accès aux Soins guide (`ansforge/IG-fhir-service-acces-aux-soins`).

ANS's `finess` repository also ships an official FINESS+ example extract (9 March 2026, 540 MB of JSON), which was analysed in full. A third-party conversion of the real September 2026 monthly FINESS+ snapshot was also downloaded from a GitHub release and analysed. Nothing was saved in the repository. Downloads are in the session scratchpad.

Evidence marks:

- **[verified 8 Oct 2026]**: the page, file or service was opened and the stated facts were read from it. Where the source is ANS's GitHub rather than its website, the item says so.
- **[secondary]**: read in a third-party file or repository derived from the official source (here, a community conversion of the FINESS+ snapshot). The numbers are real data, but the conversion was not done by ANS.
- **[search]**: found only through web search (result snippets and search-engine summaries). Not yet confirmed.
- **[law]**: the obligation comes from a statute or decree. The cited text appeared in search results or in ANS's own terms; the statute itself was not opened (Légifrance is blocked).
- **[ours]**: a fact about our own code, checked directly.
- **[not found]**: looked for, within a time limit, and not found. This does not prove it doesn't exist.

---

## 1. Executive recommendation

France is the easiest of the four countries so far. Spain has one register of places. Germany has nothing open. **France has two official national registers, both open, free and under a licence that allows commercial reuse, with an official API on top of them:**

1. **FINESS+ is the spine for places.** FINESS is the national register of health, medico-social and social establishments: hospitals, health centres (*centres de santé*), multi-professional practices (*maisons de santé*), home-nursing services (SSIAD and the new *services autonomie*), care homes (EHPAD), pharmacies and others. The legacy data.gouv.fr extracts **stopped on 20 July 2026** when FINESS+ went live. Their last data is from 4 May 2026. **[search]** ANS now publishes two JSON flows on data.gouv.fr (structures and activities), **refreshed daily, with monthly and annual history files**. **[verified 8 Oct 2026, ANS GitHub FAQ]** Each address carries **WGS84 latitude and longitude, a Base Adresse Nationale (BAN) key and a geocoding score**. **[verified 8 Oct 2026, ANS schema and example file]** In the September 2026 snapshot, 75% of the 104,805 active establishments have coordinates and 84% have a public phone number. **[secondary]** Licence: Licence Ouverte 2.0. **[search, plus secondary]**
2. **RPPS is the spine for people.** It is the single register of every health professional authorised to practise. **ADELI was folded into it in 2024**, so it now covers nurses, physiotherapists, psychologists, opticians and hearing-aid audiologists as well as doctors, dentists and pharmacists. **[search]** It is published as a free bulk extract (a pipe-separated flat file, updated daily, Licence Ouverte 2.0 on data.gouv.fr) **[search]** and through the **API FHIR Annuaire Santé**. The API is free, needs a key, is limited to 17 calls per second, and returns only public data. **[verified 8 Oct 2026, ANS GitHub]** RPPS gives profession, specialty, practice mode and the practice's address. **It has no coordinates**, so we geocode the practice addresses ourselves with the BAN. **[verified for the API; not found for the extract]**
3. **Conventionnement comes from the Assurance Maladie, not RPPS.** Fee sector (*secteur 1/2*), OPTAM membership and whether a practitioner takes the *carte Vitale* are defined in the FHIR profile but **blocked from the public API**. **[verified 8 Oct 2026, ANS GitHub profile]** The CNAM publishes them in its own open dataset, **"Annuaire santé Ameli"** on data.gouv.fr (two CSV files, Licence Ouverte 2.0, last updated 5 Oct 2026). It no longer includes prices or opening hours. **[search]** This is the dataset that tells a 75-year-old whether a specialist will charge more than the standard fee.
4. **For people on Assurance Maladie, which is almost everyone, the usual route is the *médecin traitant*.** Every insured person aged 16 or over declares one, and seeing other doctors without a referral costs more (Code de la sécurité sociale, art. L162-5-3). **[law]** Care Finder should ask first "do you have a médecin traitant?" and help the person contact them. For same-day needs when the practice is closed, the official channel is **116 117** (medical on-call service, organised by each regional health agency, ARS) or **15** (SAMU). Care Finder links and dials; it never triages.
5. **There is no official public booking channel.** Doctolib, Maiia and Keldoc are private. The national **SAS platform** (Service d'Accès aux Soins) aggregates their free slots, but **only call-centre regulators can book through it**, on the patient's behalf after a 116 117 or 15 call. **[verified 8 Oct 2026, ANS SAS guide]** *Mon espace santé* has a catalogue of approved apps but does not book. **[search]** For booking, the options are a partnership with a booking platform or the phone with our call script.
6. **Geocoding: the BAN, now served by IGN's Géoplateforme** (`data.geopf.fr/geocodage`). It is free, has no key, is limited to 50 requests per second and supports batch CSV geocoding. The old `api-adresse.data.gouv.fr` was announced as shut down at the end of January 2026. **[search]** The BAN data is under Licence Ouverte. **[search]** FINESS+ is already geocoded against the BAN, so we only geocode RPPS practices and the FINESS+ gaps.

What no French source provides reliably: **availability** (only through a booking platform or the SAS for regulators), **prices** (gone from the Ameli dataset; sector and OPTAM are the proxy), **opening hours**, **languages**, **step-free access**, and **duty pharmacies** (the rota is not open data). For these, "Not known, ask when you call" stays.

---

## 2. France source landscape

| # | Source | What it is | Authority | Covers | Access (as found) | Reuse | Fit |
|---|---|---|---|---|---|---|---|
| 1 | **FINESS+ structures flow** (data.gouv.fr dataset `finess-structures-1` **[secondary]**; schema and examples in [ansforge/finess](https://github.com/ansforge/finess)) | National register of health, medico-social and social establishments. Entered by the registration authorities (ARS and others), plus daily feeds for pharmacies, laboratories and hospital authorisations | **Regulated / official** (ANS) | Legal entities (EJ), sites (*entités géographiques*, EGE / FINESS ET), groups (GHT, GCS) | **[verified 8 Oct 2026, ANS GitHub]** JSON, daily file plus monthly and annual history, gzip **[secondary]**. Per site: FINESS number, SIRET, names, category, opening and closure dates, status, address with **lat/lng (WGS84), BAN key, BAN score**, public phone, fax, email. Full field list in section 7. | **[search]** Licence Ouverte 2.0 on data.gouv.fr; the community converter states the same **[secondary]**. Commercial reuse allowed with attribution. | **High.** The register of places, with coordinates. |
| 2 | **FINESS+ activities flow** (`finess-activites-1` **[secondary]**) | Authorised and actually-provided activities per site, with population served and capacity | **Regulated / official** | Hospital care authorisations, medico-social activities (e.g. "Soins infirmiers à domicile", "Aide à domicile"), heavy equipment | **[verified 8 Oct 2026, ANS GitHub schema]** JSON, daily. **[secondary]** 295,309 activity rows in Sept 2026; columns include activity code and label, operating mode, **population served** (e.g. "Personnes âgées"), status ("active et mise en œuvre"), authorised and installed capacity. | As above | **High.** The French equivalent of Spain's care-offered codes. |
| 3 | **Legacy FINESS extracts** (data.gouv.fr "FINESS Extraction du Fichier des établissements", including the geolocated `etalab-cs1100507` file) | The pre-FINESS+ files | Official | As above | **[search]** Frozen. Last data 4 May 2026. Coordinates in Lambert 93 for metropolitan France and UTM for the overseas departments, flagged in `sourcecoordet`. | Licence Ouverte | **Do not use.** Historical only. |
| 4 | **RPPS open extract** ("Annuaire Santé – Extractions des données en libre accès", [data.gouv.fr](https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps); [annuaire.sante.fr](https://annuaire.sante.fr/web/site-pro/extractions-publiques)) | Bulk file of every professional's public data | **Regulated / official** (ANS; data entered by the professional orders and ARS) | 28 professions per ANS (6 originally RPPS, 22 ex-ADELI) **[search]** | **[search]** Zip at `https://service.annuaire.sante.fr/annuaire-sante-webservices/V300/services/extraction/PS_LibreAcces`; pipe-separated, no quoting. Files: `PS_LibreAcces_Personne_activite` (identity, profession, practice and **practice address**), `PS_LibreAcces_Dipl_AutExerc` (diplomas), `PS_LibreAcces_SavoirFaire` (specialties). **[verified 8 Oct 2026, ANS SAS guide]** The activity file has columns "Numéro FINESS site", "Numéro SIRET site" and "Ancien identifiant de la structure". Updated daily per ANS **[search; sources disagree, see section 7]**. **No coordinates [not found].** | **[search]** Licence Ouverte 2.0 on data.gouv.fr. **[verified 8 Oct 2026, ANS terms]** Reuse conditions: don't alter the data, cite "RPPS" and the update date, comply with GDPR; the reuser becomes data controller. | **High** for who practises what, where. |
| 5 | **API FHIR Annuaire Santé** (`https://gateway.api.esante.gouv.fr/fhir/v2`; [docs](https://ansforge.github.io/annuaire-sante-fhir-documentation/)) | The same public RPPS and FINESS data as FHIR R4 | **Official** (ANS) | Practitioner, PractitionerRole, Organization, HealthcareService, Device | **[verified 8 Oct 2026, ANS GitHub]** Free key from ANS's Gravitee portal, header `ESANTE-API-KEY`. **17 calls/s per application**, HTTP 429 above. 50 results per page by default; 30 s timeout. **No sandbox**: production data only. Search by name, RPPS, qualification code, organisation, postcode and city. **No geographic search and no coordinates.** | Same terms as the extract (the CGU cover both). | **High** for live checks on a named person. **Low** as a discovery index (no geo search, rate limit). |
| 6 | **Annuaire santé Ameli** ([data.gouv.fr](https://www.data.gouv.fr/datasets/annuaire-sante-ameli)) | CNAM's directory of contracted practitioners in private practice (*libéraux*) and health centres | **Official** (Assurance Maladie) | Liberal professionals and centres de santé | **[search]** Two CSV files (professionals about 149 MB, centres about 3 MB), last updated 5 Oct 2026. Has **sector, fee option (OPTAM) and carte Vitale acceptance**. **No longer has prices or opening hours.** Coordinates not confirmed. The old "Annuaire santé de la Cnam" dataset is deprecated and stopped updating in January 2026. | **[search]** Licence Ouverte 2.0. Published under CSP art. L1461-2 **[law]**; contains personal data, so reuse must comply with privacy law. | **High** for "is this doctor secteur 1 / OPTAM / Vitale", joined to RPPS. |
| 7 | **SAS platform** (Service d'Accès aux Soins, sas.sante.fr) | Aggregates free same-day slots from booking platforms, CPTS (local GP networks) and SOS Médecins | **Official** (Ministry / ANS) | Unscheduled GP care | **[verified 8 Oct 2026, ANS SAS guide]** Built for **regulators** in the 15 and 116 117 call centres; booking happens in the editor's software after SSO. No patient-facing or third-party API. | n/a | **None as a data source.** Its value to us is that calling 116 117 can lead to a booked slot. |
| 8 | **Booking platforms** (Doctolib, Maiia, Keldoc and others) | Profiles and real availability | Commercial | Liberal practitioners and clinics that subscribe (coverage not checked) | Partnership only. | Site terms and database right. | **High** for availability, through a partnership. |
| 9 | **Santé.fr** | Public health information service (SPIS) with a directory of professionals and establishments | Official (Ministry) | Professionals and establishments, with filters for conventionnement and disability access **[search]** | Host blocked. **[not found]** No API or open-data export found. | Link only | **Medium as a link.** It is built on the same registers. |
| 10 | **Mon espace santé** catalogue | Approved third-party apps in the national patient record | Official (CNAM / ANS) | Apps, not providers | **[search]** Referencing requires 150+ criteria and is valid for 2 years. Approved apps include home-care booking services (Libheros, Medicalib). | n/a | **Strategic, not data.** Being listed is a later-stage credibility move. |
| 11 | **Duty pharmacies**: 3237 / Résogardes | Phone and web service for the nearest duty pharmacy | Run by the pharmacists' union FSPF (Servigardes is the USPO equivalent), **not the Ordre** **[search]** | Duty pharmacies | **[search]** Phone 0.35 €/min; 3237.fr web free. Regional alternatives exist (monpharmacien-idf.fr, from ARS Île-de-France and the regional pharmacists' union). **No open rota data [not found].** | Link only | **High as a hand-off.** |
| 12 | **Professional orders** (doctors CNOM, nurses ONI, physiotherapists CNOMK, dentists ONCD, pharmacists CNOP, podiatrists, midwives) | Registration authorities that feed RPPS | **Regulated** | Their members | **[verified 8 Oct 2026, FHIR example]** Registration in RPPS carries the registering order (e.g. `CNOM`). Order websites blocked here. | n/a | **Not needed.** RPPS already carries their data. |
| 13 | **Base Adresse Nationale / Géoplateforme geocoder** | National address register and geocoder | **Official** (IGN, DINUM) | Every French address | **[search]** `https://data.geopf.fr/geocodage/search`, `/reverse`, CSV batch; 50 req/s; updated from the BAN twice a week. | **[search]** Licence Ouverte 2.0, commercial use allowed. | **High.** |
| 14 | **OpenStreetMap** | Community map | Community | Mixed | Blocked here. | ODbL | Low. Only for opening hours or travel time if needed. |
| 15 | **Google Places** (current) | Business listings | Commercial | Everything, unverified | Paid API | Only `place_id` storable (see Spain report) | Contact details and hours only, within terms. |

### Care types and where they're registered

Profession codes **[verified 8 Oct 2026, ANS terminology TRE_G15 / TRE_R95]**, specialty codes **[verified, TRE_R38]**, FINESS categories **[verified, TRE_R397]**. Counts are active sites in the September 2026 FINESS+ monthly snapshot **[secondary]**.

| Care Finder type **[ours]** | France source | Code(s) | Notes |
|---|---|---|---|
| `primary_care` | RPPS: Médecin (10) with specialty "Médecine générale" | SM53 / SM54 / SM26 (qualified, specialist or plain general practice) | Plus FINESS **124 Centre de santé** (3,601 active) and **603 Maison de santé** (3,224). |
| `same_day` | Hand-off: médecin traitant → 116 117 → 15 | n/a | No register answers this. SOS Médecins appears as an offer type inside the SAS **[verified]**. Its public number was not checked. |
| `physiotherapy` | RPPS: Masseur-Kinésithérapeute (70) | n/a | Ex-RPPS profession. |
| `orthopaedics` | RPPS: Médecin, specialty Chirurgie orthopédique et traumatologie (SM08). For orthopaedic supplies: Orthopédiste-Orthésiste (83), Podo-Orthésiste (82), Orthoprothésiste (81) | SM08; 81–83 | Supply professions moved from ADELI in June 2024 **[search]**. |
| `optician` | RPPS: Opticien-Lunetier (28) | n/a | In RPPS since 3 June 2024 **[search]**. Shops themselves are not in FINESS. |
| `ophthalmology` | RPPS: Médecin, SM38 Ophtalmologie | SM38, SM85 | Orthoptiste (92) also relevant. |
| `hearing_centre` | RPPS: Audioprothésiste (26) | n/a | In RPPS since June 2024 **[search]**. |
| `ent` | RPPS: Médecin, SM39 Oto-rhino-laryngologie | SM39 | Read the full TRE_R38 list on import; there are related surgical codes. |
| `neurology` | RPPS: Médecin, SM32 Neurologie | SM32, SM84 | |
| `psychology` | RPPS: **Psychologue is a "usager de titre", code 93 in TRE_R95**, not in the health-profession list (TRE_G15 code 93 is marked obsolete). Also psychiatrists (SM42, SM93 "psychiatrie de la personne âgée") and FINESS **156 CMP** (public mental-health centres, 2,044) | R95/93, SM42, SM93 | **MonSoutienPsy** (12 reimbursed sessions) has its own partner list on ameli; no open data found **[not found]**. |
| `dentist` / `urgent_dentist` | RPPS: Chirurgien-Dentiste (40). Urgent: Sunday and holiday on-call via **15** (and 116 117 where available) **[law: décret 2025-152, search]** | 40 | FINESS has dental centres within 124; code 125 "Centre de santé dentaire" had no active rows. |
| Home nursing (not yet a Care Finder type) | RPPS: Infirmier (60), liberal mode. FINESS: **354 SSIAD** (1,513), **209 Service autonomie aide et soins** (659), activity **358 "Soins infirmiers à domicile"** (2,073 distinct sites providing it), **127 HAD** (141) | 60; 354, 209; activity 358 | See the SSIAD note below. |
| Pharmacies (context) | FINESS **620 Pharmacie d'officine** (19,921) | 620 | Duty rota: 3237, not open data. |

**SSIAD note.** Home-care services are being restructured into *services autonomie à domicile*. Between ANS's March 2026 example file and the September 2026 snapshot, active category 354 (SSIAD) fell from 1,896 to 1,513, and 209 (now labelled "Service autonomie aide et soins") rose from 219 to 659. **[verified / secondary]** That is consistent with the reform, but it is our inference; the March file is an ANS example, not necessarily a production extract. **Filter on the activity (358, population "Personnes âgées", status "active et mise en œuvre"), not on the category alone.**

---

## 3. Recommended architecture

Same shape as Spain: places, people, enrichment. France adds a second spine (people) and a cover layer (sector/OPTAM).

```
User request (plain words)
   │
   ▼
Requirements: care type(s) · has médecin traitant? · urgency · area · fee worries · access needs
   │
   ├─ Today, practice closed ─► 116 117 (on-call GP, via ARS regulation) · 15 if serious · 3237 for a duty pharmacy
   │
   ├─ GP need, has médecin traitant ─► contact them (phone from RPPS/Ameli, or the person's own record)
   │
   └─ Find someone
          │
          ▼
   PEOPLE SPINE: RPPS extract (monthly import of the daily file)
     filter: profession + specialty code, liberal or salaried mode, active
     position: BAN geocode of the practice address (cache by structure id + address)
          │
   PLACE SPINE: FINESS+ structures + activities (monthly history file, or daily)
     filter: category + activity code + population served
     position: lat/lng from the file; BAN geocode for the 25% without
          │
          ▼
   JOIN RPPS ↔ FINESS on "Numéro FINESS site" where present
   JOIN RPPS ↔ Ameli on RPPS number (to confirm: section 12)
          │
          ▼
   ENRICH (each fact attributed and dated)
     · sector 1 / 2 / OPTAM / carte Vitale: Ameli dataset (verified, CNAM)
     · phone: FINESS+ public contact, RPPS structure, Ameli (verified)
     · opening hours, travel time: Google (place_id only) or OSM
     · availability: booking-platform partnership, else "Ask when you call"
     · step-free, languages: provider website (reported) or "Not known"
          │
          ▼
   NAMED PROFESSIONAL shown? ─► live FHIR check by RPPS number (active, profession, specialty)
```

### Which source decides what

| Question | Source of truth | Fallback |
|---|---|---|
| Is this person authorised to practise this profession? | RPPS (extract, or FHIR for a live check) | None. Not in RPPS, not shown as a professional. |
| What specialty? | RPPS savoir-faire (TRE_R38 codes) | None |
| Is this place an authorised establishment, and of what kind? | FINESS+ category | None |
| Does it provide this activity (e.g. home nursing for older people)? | FINESS+ activities (code, population, status "mise en œuvre") | "Ask when you call" |
| Where is it? | FINESS+ lat/lng; BAN geocode of the RPPS/FINESS address | Town only |
| Phone | FINESS+ public contact; RPPS structure phone; Ameli | Google (not stored) |
| Fees: secteur 1, secteur 2, OPTAM; carte Vitale | Ameli dataset | "Ask when you call about extra fees" |
| Same-day, out of hours | 116 117 / 15 hand-off | n/a |
| Booking | Partnership; else phone with call script | n/a |
| Duty pharmacy | 3237 / 3237.fr hand-off | n/a |

### Identity and matching

- **Professionals:** the **RPPS number** (11 digits) is permanent for the whole career. The API also accepts IDNPS (the RPPS with a `8` prefix, as in the example `810003461033` / `10003461033`). **[verified 8 Oct 2026, FHIR example]**
- **Practice locations without a FINESS number** (most liberal practices): RPPS gives a structure identifier and an "Ancien identifiant de la structure" (RPPS-rang or ADELI-rang, with prefix). **[verified, SAS guide]** Key on those plus normalised address.
- **Establishments:** **FINESS ET** (9 characters, e.g. `010780195`) for the site; FINESS EJ for the legal entity; SIRET as a cross-check. **[verified]**
- **Addresses:** the **BAN interoperability key** (`cleInInteropBAN`, e.g. `01053_1950_00062`), already present on geocoded FINESS+ rows. Use it as the address key everywhere.
- **Google:** store `place_id` only.

### Our code **[ours]**

The register layer (`server/services/careRegister.ts`, `shared/careFinder/register.ts`) is still REGCESS-shaped: a `ccn` key, `REGISTER_LISTINGS = ["C1","C2","C3","E"]`, `care_codes` as `U.nn`, Spanish province and INE codes, and a single `REGISTER_SOURCE_LABEL`. The Germany report already asked for a generalised record (`country`, `source`, `source_id`, care types in our own vocabulary, per-source evidence text). France adds two requirements:

1. A **person** record (RPPS) separate from a **place** record (FINESS+), joined by a practice link.
2. **Cover attributes** (sector, OPTAM, Vitale), dated, from a third source.

Do that refactor before importing anything French.

---

## 4. Compliance and operating risks

1. **RPPS data is public by regulation, but GDPR still applies to us.**
   - **[law]** The *arrêté du 23 septembre 2022* (amended) defines which RPPS data is public and states that professionals **cannot object** to their public data being recorded and published (art. 10, which sets aside the GDPR art. 21 right to object). **[verified 8 Oct 2026, quoted in ANS's CGU]**
   - ANS's terms say that **anyone who reuses RPPS data becomes a data controller** and must respect data-subject rights, including the right to prior information. **[verified 8 Oct 2026, ANS CGU §4]** That means a line in our privacy notice and a route for a professional to ask us to correct their data.
   - Only public fields reach us anyway: the public FHIR profiles remove birth date, gender, personal address and personal phone, and on PractitionerRole they block every telecom except the secure-messaging (MSSanté) address. **[verified, profiles-dp]**
   - The terminology has diffusion-restriction reasons **"Opposition à diffusion publique"** and **"Professionnel en danger"** (TRE_R391). **[verified]** So some professionals may be held back from public data on purpose. **Never re-publish someone who disappears from the extract.** Delete them on the next import.
2. **Attribution and freshness are licence conditions.** RPPS: cite "RPPS" (and ANS) and the date of last update, and don't alter the meaning. **[verified, CGU]** Licence Ouverte: attribution with the date. Show "Source: RPPS / FINESS (ANS), updated <date>" on each result.
3. **No framing of the Annuaire Santé site.** The CGU allow links without permission but forbid embedding its pages inside another site; they must open in their own window. **[verified, CGU §8.2]** Links are fine; iframes are not.
4. **Database right.** ANS's CGU state the databases are protected under CPI art. L.341-1 and following, except the reusable data. **[verified, CGU §8.3]** Booking platforms and 3237 data: partnership only, no scraping.
5. **The ANS API rate limit means "don't use it as the index".** 17 calls/s, no geographic search. The CGU tell users to keep earlier results, within the art. 4 rules. **[verified]** So the extract is the index, and the API is for single live checks.
6. **ANS data hygiene notes:**
   - The FINESS+ JSON coordinate labels are **swapped**: `coordonneeX` holds the 6.5-million northing and `coordonneeY` the easting, on every geocoded row of ANS's example file (114,101 of 114,101). **[verified]** Use `directionLatitude` and `directionLongitude`, which were in range on every row.
   - The community converter (section 7) mislabels these columns in its CSV. **[secondary]** Don't use its output as-is.
   - The API docs ask users who copy data into their own test environment to delete it after 30 days. **[verified]** Apply that to dev databases.
7. **Medical-device line.** Same as Spain: directory and hand-off only. Never decide between 15, 116 117 and "wait for your GP". Present all three with the plain rule ("life-threatening: 15 or 112").
8. **Fee information is sensitive for this audience.** Sector 2 without OPTAM means extra charges the Assurance Maladie won't cover. Show it factually ("may charge more than the standard fee; ask when you call"). Never rank by it unless the person asks.

---

## 5. MVP and production sources

**MVP (next 30–60 days):**
- FINESS+ monthly structures and activities import: centres de santé, maisons de santé, SSIAD / services autonomie (activity 358), HAD, hospitals, pharmacies.
- RPPS extract import (monthly first; the file is daily): doctors by specialty, physiotherapists, dentists, nurses (liberal), psychologists, opticians, audiologists.
- BAN batch geocoding for RPPS practice addresses and FINESS+ rows without coordinates, cached by BAN key.
- Ameli dataset join for sector, OPTAM and carte Vitale.
- Hand-offs: médecin traitant first; 116 117; 15/112; 3237. No booking.
- FHIR live check when a named professional is shown.

**Production:**
- Switch to daily FINESS+ and RPPS deltas (FHIR `_lastUpdated` for incremental checks).
- A booking partnership (Doctolib, Maiia or Keldoc; market shares not checked), kept out of ranking.
- Regional duty-pharmacy feeds where an ARS publishes one.
- Consider Mon espace santé referencing once the product is stable.

**Store:** register rows (RPPS, FINESS+, Ameli) with source and date; our geocodes; Google `place_id`.
**Don't store:** Google content beyond `place_id`; booking-platform data outside a contract; anything scraped from Santé.fr, annuairesante.ameli.fr or 3237; RPPS people who left the latest extract.

## 6. Sources not to trust

- **The legacy data.gouv.fr FINESS extracts** for anything current: frozen since May 2026 data. **[search]**
- **The data.gouv.fr "Réexposition des données FINESS"** (CSV/Parquet re-publication): last update 13 May 2026, before FINESS+. **[search]**
- **Community conversions of FINESS+ or RPPS** as a production feed. They are useful for analysis; one mislabels the coordinates.
- **Third-party "annuaire" sites and scrapers** of Doctolib, ameli or Santé.fr.
- **Google or OSM as evidence of qualification.**
- **Review stars.**

---

## 7. API and data access

### FINESS+ (structures and activities) **[verified 8 Oct 2026, ANS GitHub]**, links **[secondary]**

- **Where:** data.gouv.fr datasets `finess-structures-1` and `finess-activites-1`, published by ANS. Stable "latest daily" URLs cited by the community converter: `https://www.data.gouv.fr/api/1/datasets/r/cd493959-fb03-41e5-9347-0edd14dfbc22` (structures) and `…/ed12913c-6bb2-4e47-8434-2f6e4f961c8e` (activities). **[secondary; not opened]**
- **Format:** JSON, gzip; daily file replaced every day, plus monthly and annual history files (ANS FAQ: "rafraîchi quotidiennement", "historique mensuel", "historique annuel"). Schema `schema-structures-v1.json` / `schema-activites-v1.json`, version `v1.0.0`. The daily structures file is about 50 MB compressed **[secondary]**.
- **Structures fields:** per legal entity (`pmej`): id, FINESS EJ, SIREN, legal status, APE code, address, contact. Per site (`ege`): `numFinessEge`, `siret`, `nomEgeCourt`, `nomEgeLong`, `categorieentiteGeographiqueExercice` (TRE_R397), `dateOuverture`, `dateFermeture`, `datePremiereAutorisation`, `modefixationtarifaire`, `etatObjet` (`A` active / `I` inactive), `dateDerniereMaj`, and:
  - `adresse[]`: `numeroVoie`, `typeVoie`, `libelleVoie`, `lieuDit`, `codePostal`, `cogCommune` (INSEE code), `ligneAcheminement`, and `coordonneesGeographique` {`coordonneeX`, `coordonneeY`, `directionLatitude`, `directionLongitude`, `cleInInteropBAN`, `scoreBAN`};
  - `contact[]`: `telecom.telephone`, `telecopie`, `courriel`. Only role `01` (public contact) is published.
  - Also `engagement[]` (agreements), `evenement[]` (change history), groups (`gcc`, `gco`).
- **Activities fields [secondary, from the converted CSV]:** FINESS ET and EJ, level (`autorisee` / `exercee`), nature (e.g. AMSR, regulated medico-social activity), activity code and label, operating mode, **population served**, status, authorisation id and dates, authorised and installed capacity.
- **Coverage (September 2026 monthly snapshot, generated 1 Oct 2026) [secondary]:** 174,840 sites, of which 104,805 active; 78,610 active with coordinates (75%); 88,436 with a phone (84%). ANS's own March 2026 example: 103,436 active, 75,157 with coordinates (73%), 89,250 with phone. **[verified]**
- **Category labels:** TRE_R397 "Catégorie entité géographique exercice" (429 codes; it replaces TRE_R66). Read it from the ANS terminology server (SMT) or the `ansforge/IG-terminologie-de-sante` repository on each import.
- **Legacy flows:** the XML "flux standard" over sFTP for partners continues but "is bound to disappear". **[verified, FAQ]**
- **Licence:** Licence Ouverte 2.0. **[search; the converter states the same]** Confirm on the dataset page.

### RPPS open extract **[search]** unless marked

- **Download:** `https://service.annuaire.sante.fr/annuaire-sante-webservices/V300/services/extraction/PS_LibreAcces` (zip), also on data.gouv.fr. ANS recommends the URL for automated download.
- **Files:** `PS_LibreAcces_Personne_activite`, `PS_LibreAcces_Dipl_AutExerc`, `PS_LibreAcces_SavoirFaire`. Pipe-separated (`|`), no quote protection.
- **Columns confirmed [verified 8 Oct 2026, ANS SAS guide FAQ]:** "Numéro FINESS site", "Numéro SIRET site", "Ancien identifiant de la structure". The DSFT also documents "secteur d'activité", "section tableau pharmaciens", "genre d'activité" and "rôle". The rest of the header (name, profession code, practice mode, structure address, phone) must be read from the DSFT v3.1 PDF or the file itself. **Not confirmed here.**
- **Refresh:** ANS pages say "updated daily" and recommend a weekly refresh for reusers; the DSFT's own figure was not readable. Plan for weekly; check the file date.
- **Coordinates:** none found. **[not found]**
- **Spec:** "DSFT Extractions données libre accès" v3.1 on industriels.esante.gouv.fr (blocked here).
- **Licence:** Licence Ouverte 2.0 on data.gouv.fr; ANS CGU conditions apply. **[verified for the CGU]**

### API FHIR Annuaire Santé **[verified 8 Oct 2026, ANS GitHub]**

- **Base:** `https://gateway.api.esante.gouv.fr/fhir/v2`. Endpoints: `/metadata`, `/Practitioner`, `/PractitionerRole`, `/Organization`, `/HealthcareService`, `/Device`. GET and POST `_search` only.
- **Auth:** create an account on `https://portal.api.esante.gouv.fr` (Gravitee), create an application, subscribe to "API Annuaire Santé en libre accès"; send `ESANTE-API-KEY: <key>`.
- **Limits:** 17 calls/s per application (429 above); 50 results per page; 30 s timeout. No sandbox. A status page exists at `status.esante.gouv.fr`.
- **Search parameters:**
  - Practitioner: `identifier` (RPPS / IDNPS), `family`, `given`, `name`, `qualification-code` (diploma, profession, specialty), `active`, `mailbox-mss`.
  - PractitionerRole: `practitioner`, `organization`, `role` (function, activity type, practice mode), `active`, `_include`.
  - Organization: `identifier`, `name`, `address`, `address-city`, `address-postalcode`, `type` (category, sector), `partof`.
  - All: `_lastUpdated` for change tracking.
- **What the public profiles expose:**
  - Practitioner: names, profession, diplomas, specialties. **No address, no phone.**
  - PractitionerRole: activity, practice mode, link to Organization; telecom limited to MSSanté. **Sector, OPTAM and Vitale are `0..0`, removed from the public profile.**
  - Organization: name, identifiers, types, **address and telecom (phone)**.
- **Coordinates:** none. The address profile has no geolocation extension.
- **Terms:** ANS CGU (in the docs repo). Same reuse conditions as the extract.

### Annuaire santé Ameli (CNAM) **[search]**

- data.gouv.fr dataset `annuaire-sante-ameli`, producer CNAM, Licence Ouverte 2.0, last updated 5 Oct 2026. Two CSV files: professionals (about 149 MB) and centres de santé (about 3 MB).
- Content: contact details of liberal professionals and health centres, **conventional sector, fee option, carte Vitale acceptance**. **Removed:** prices of common acts, opening hours, establishments other than centres de santé.
- Legal basis: CSP art. L1461-2. **[law]** Contains personal data; reuse must respect privacy law.
- **To check on download:** the join key (RPPS number?) and whether coordinates are present.
- The public search site (annuairesante.ameli.fr) is for people, not machines: link to it, don't scrape it.

### Base Adresse Nationale geocoder **[search]**

- **Endpoint:** `https://data.geopf.fr/geocodage/search?q=<address>` (also `/reverse`, `/getCapabilities`, and CSV batch). This replaces `https://api-adresse.data.gouv.fr/search/`, whose shutdown was announced for 31 January 2026; a third party reported it still answering on 27 Sept 2026. Migrate anyway.
- **Limits:** 50 requests/s. No key. Index refreshed from the BAN twice a week.
- **Licence:** Licence Ouverte 2.0, commercial use allowed.
- **Use:** batch-geocode RPPS practice addresses once per import, cached by BAN key; FINESS+ already carries BAN keys and scores. Reject results below a score threshold (the Spain importer's `geocodeFitsPlace` pattern **[ours]**).

### SAS (Service d'Accès aux Soins) **[verified 8 Oct 2026, ANS SAS guide]**

- What it is: an aggregator of free slots (individual GPs, CPTS, SOS Médecins, plus "place de marché" services) for **regulators** in the 15 / 116 117 call centres. Booking is done in the editor's software after SSO; appointment data flows back to the SAS and the regulation software.
- The FHIR flows are for **booking-software editors** (slot search, regulator accounts, SSO, appointments). There is nothing for a patient-facing third party.
- Relevance to VYVA: the honest instruction is "call 116 117 (or 15); they can book a same-day slot for you".

### 116 117 and on-call care **[law]** / **[search]**

- 116 117 is the national number for out-of-hours GP care (*permanence des soins ambulatoires*). It was created by décret 2016-1012, with each ARS choosing 116 117 or 15 for its region. **[law]**
- Décret 2025-152 extends on-call care to liberal nurses and midwives (reached via 116 117 or 15) and to dentists (via 15, and 116 117 where available). **[law, search]**
- Hours are set per region, typically weeknights, weekends and holidays. Some regions also use it in the daytime for the SAS. **[search]** Coverage is not uniform: a regional source said Hauts-de-France was not yet on 116 117 (date unclear). **[search]** Check per region before showing it as the only option.

### Duty pharmacies **[search]**

- 3237 (Résogardes, FSPF): voice service, 0.35 €/min, 24/7; 3237.fr free. Regional services such as monpharmacien-idf.fr in Île-de-France. No open, national rota dataset. **[not found]**

---

## 8. Regions (ARS)

France doesn't need a region-by-region data table the way Spain did: both registers are national, and the registration authorities (ARS, orders) feed them directly. Regions matter for three things only:

| What | Why it varies | What to do |
|---|---|---|
| 116 117 hours and coverage | Each ARS organises on-call care | Keep a small per-region table (number, hours, source URL, check date); fall back to 15. |
| Duty pharmacies | Some ARS / regional pharmacists' unions run their own service (Île-de-France: monpharmacien-idf.fr) | Link the regional service where it exists, else 3237. |
| Regional open data (e.g. Île-de-France "annuaire et localisation des professionnels de santé") | Re-publications of the national data | Ignore; use the national sources. |

No regional table was built in this pass: ARS sites were unreachable. **[not found]**

---

## 9. Professional registers

Not needed as separate sources. Since the ADELI switch-over (last batch, including psychologists, opticians, audiologists and orthotists, on 3 June 2024 **[search]**), **RPPS is the single register for all of them**. Each RPPS registration names the registering authority (`CNOM`, etc.) and its status. **[verified, FHIR example]** For a qualification check on a named person, query the FHIR API by RPPS number.

| Profession | RPPS code | Registering body |
|---|---|---|
| Médecin | 10 | Ordre des médecins |
| Chirurgien-dentiste | 40 | Ordre des chirurgiens-dentistes |
| Pharmacien | 21 | Ordre des pharmaciens |
| Sage-femme | 50 | Ordre des sages-femmes |
| Masseur-kinésithérapeute | 70 | Ordre des masseurs-kinésithérapeutes |
| Pédicure-podologue | 80 | Ordre des pédicures-podologues |
| Infirmier | 60 | Ordre des infirmiers |
| Audioprothésiste, Opticien-lunetier, Orthophoniste, Orthoptiste, Ergothérapeute, Psychomotricien, Diététicien | 26, 28, 91, 92, 94, 96, 95 | ARS (ex-ADELI) **[search for the body]** |
| Psychologue (usager de titre) | 93 (TRE_R95) | ARS (ex-ADELI) **[search for the body]** |

Codes **[verified 8 Oct 2026, ANS terminology]**.

---

## 10. Reachability from this environment (8 Oct 2026)

**Reachable:**
- `github.com` (git clone of public repositories, release pages and release downloads);
- `pypi.org`, `pkg.go.dev`;
- `sanidad.gob.es` (control test).

**Blocked by the network proxy** (403 on CONNECT; the page fetcher reports "egress blocked" or DNS failure): www.data.gouv.fr, static.data.gouv.fr, object.files.data.gouv.fr, files.data.gouv.fr, annuaire.sante.fr, service.annuaire.sante.fr, annuaire.esante.gouv.fr, esante.gouv.fr, industriels.esante.gouv.fr, mos.esante.gouv.fr, smt.esante.gouv.fr, gateway.api.esante.gouv.fr, portal.api.esante.gouv.fr, portail.api.esante.gouv.fr, portail.openfhir.annuaire.sante.fr, status.esante.gouv.fr, interop.esante.gouv.fr, finess.esante.gouv.fr, **ansforge.github.io** (GitHub Pages), www.ameli.fr, annuairesante.ameli.fr, data.ameli.fr, monsoutienpsy.ameli.fr, www.sante.fr, monespacesante.fr, www.monparcourspsy.sante.gouv.fr, sante.gouv.fr, solidarites.gouv.fr, drees.solidarites-sante.gouv.fr, data.drees.solidarites-sante.gouv.fr, adresse.data.gouv.fr, api-adresse.data.gouv.fr, data.geopf.fr, cartes.gouv.fr, geoservices.ign.fr, www.legifrance.gouv.fr, www.service-public.fr, www.cnil.fr, www.insee.fr, api.gouv.fr, www.has-sante.fr, www.santepubliquefrance.fr, www.atih.sante.fr, scansante.fr, all professional orders tried (conseil-national.medecin.fr, ordre-infirmiers.fr, ordremk.fr, ordre-chirurgiens-dentistes.fr, ordre.pharmacien.fr), www.3237.fr, sos-medecins.fr, www.doctolib.fr, www.pour-les-personnes-agees.gouv.fr, www.etalab.gouv.fr, doc.data.gouv.fr, guides.data.gouv.fr, code.gouv.fr, framagit.org, huggingface.co, openstreetmap.org, fr.wikipedia.org, wikidata.org, web.archive.org, interhop.org, data.smartidf.services, public.opendatasoft.com.

**GitHub API:** this session is limited to its configured repositories; public repositories were read by `git clone` instead.

**Re-check first from an unrestricted machine:**
1. The data.gouv.fr pages for `finess-structures-1`, `finess-activites-1`, the RPPS extract and `annuaire-sante-ameli`: licence, refresh, resource URLs.
2. The RPPS extract header (one download).
3. The Ameli CSV header: join key and coordinates.
4. The Géoplateforme geocoder terms.

---

## 11. 30 / 60 / 90 days

**Days 0–30: generalise and import.**
- Generalise the register schema (country, source, source_id, person vs place, cover attributes).
- Download from an unrestricted machine and lock the formats: FINESS+ monthly, RPPS extract, Ameli CSV.
- FINESS+ importer (use lat/lng, not X/Y), with TRE_R397 and the activity tables read on import.
- Request an ANS API key (free, minutes).

**Days 30–60: people and geocoding.**
- RPPS importer for the Care Finder professions; BAN batch geocoding with a cache by BAN key.
- Ameli join for sector, OPTAM and Vitale; copy for "may charge more".
- Hand-offs: médecin traitant prompt, 116 117 (per-region table), 15/112, 3237.
- Privacy-notice line for RPPS reuse, and a correction route for professionals.

**Days 60–90: live checks and partnership.**
- FHIR live check on display; daily deltas.
- Approach one booking platform (Doctolib, Maiia or Keldoc), kept out of ranking.
- Decide whether to pursue Mon espace santé referencing.

## 12. Open questions

1. **Technical:** exact RPPS extract header, and whether "Téléphone (coord. structure)" is populated for liberal practices. One download answers both.
2. **Technical:** does the Ameli dataset carry the RPPS number (the clean join), and coordinates?
3. **Legal:** what does our GDPR art. 14 notice for professionals need to say? Is the art. 14(5)(b) exemption (disproportionate effort) usable when the data is published by regulation?
4. **Legal:** confirm the FINESS+ and RPPS licences on the live data.gouv.fr pages (Licence Ouverte 2.0 per search and the converter).
5. **Technical:** how are professionals with an "opposition à diffusion publique" restriction handled in the extract: absent, or present with fields blanked?
6. **Product:** is the *majoration* for patients without a médecin traitant still applied in 2026 (L162-5-3 CSS)? That changes how hard we push "declare a médecin traitant".
7. **Partnership:** Doctolib's terms for third-party discovery or booking hand-off.
8. **Product:** which region first (Telefónica partnership)? That decides the 116 117 hours table and the duty-pharmacy link.

## Sources

Verified 8 October 2026 unless marked otherwise.

- ANS, FINESS+ (GitHub): [repository and README](https://github.com/ansforge/finess) · [FAQ (daily flow, monthly and annual history, end of standard flux)](https://github.com/ansforge/finess/blob/main/FAQ.md) · [structures schema](https://github.com/ansforge/finess/blob/main/flux/out/data.gouv/structure/schema/schema-structures-v1.json) · [activities schema](https://github.com/ansforge/finess/blob/main/flux/out/data.gouv/activite/schema/schema-activites-v1.json) · [example files](https://github.com/ansforge/finess/tree/main/flux/out/data.gouv/structure/examples) · [terminology page](https://github.com/ansforge/finess/blob/main/docs/referentiels/terminologies-smt.md)
- ANS, terminologies (GitHub): [IG-terminologie-de-sante](https://github.com/ansforge/IG-terminologie-de-sante): TRE_R397 categories, TRE_G15 professions, TRE_R95 title holders, TRE_R38 specialties, TRE_R391 restriction reasons
- ANS, API FHIR Annuaire Santé (GitHub): [documentation repository](https://github.com/ansforge/annuaire-sante-fhir-documentation) (API key, basics, resources, [CGU](https://github.com/ansforge/annuaire-sante-fhir-documentation/blob/main/docs/pages/cgu.md)) · [FHIR IG source](https://github.com/ansforge/IG-fhir-annuaire) (public profiles `profiles-dp`, extensions for sector, OPTAM, Vitale)
- ANS, SAS (GitHub): [IG-fhir-service-acces-aux-soins](https://github.com/ansforge/IG-fhir-service-acces-aux-soins) (functional spec, FAQ on the RPPS extract columns)
- [secondary] FINESS+ conversion: [QuentinCazier/referentiels-sante](https://github.com/QuentinCazier/referentiels-sante) · [release finess-202610 (Sept 2026 monthly snapshot)](https://github.com/QuentinCazier/referentiels-sante/releases/tag/finess-202610)
- [search] data.gouv.fr: [FINESS legacy extract (frozen)](https://www.data.gouv.fr/datasets/finess-extraction-du-fichier-des-etablissements) · [FINESS re-exposition](https://www.data.gouv.fr/datasets/reexposition-des-donnees-finess) · [RPPS extract](https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps) · [API FHIR Annuaire Santé](https://www.data.gouv.fr/dataservices/api-fhir-annuaire-sante) · [Annuaire santé Ameli](https://www.data.gouv.fr/datasets/annuaire-sante-ameli) · [Annuaire santé de la Cnam (deprecated)](https://www.data.gouv.fr/datasets/annuaire-sante-de-la-cnam-deprecie)
- [search] ANS: [Annuaire Santé extractions page](https://annuaire.sante.fr/web/site-pro/extractions-publiques) · [DSFT v3.1](https://industriels.esante.gouv.fr/sites/default/files/media/document/Annuaire_DSFT_Extractions_donnees_libre-acces_v3.1.pdf) · [new extractions description v1.2](https://esante.gouv.fr/sites/default/files/media/document/ANS_Description-des-nouvelles-extractions-en-libre-acces_V1.2.pdf) · [ADELI to RPPS switch-over](https://esante.gouv.fr/offres-services/annuaire-sante/bascule-des-professionnels-adeli-dans-le-rpps) · [SAS platform](https://esante.gouv.fr/ens/offre/plateforme-numerique-service-acces-soins-sas) · [Mon espace santé referencing](https://esante.gouv.fr/ens/offre/referencement-mon-espace-sante)
- [search] Geocoding: [API Adresse documentation](https://adresse.data.gouv.fr/outils/api-doc/adresse) · [API Adresse moved to IGN](https://www.data.gouv.fr/posts/lapi-adresse-de-la-base-adresse-nationale-est-transferee-a-lign-10) · [migration notes (third party)](https://www.latrace.com/guides/api-adresse-geoplateforme-migration) · [BAN under open licence](https://acteurspublics.fr/articles/les-donnees-de-la-base-dadresses-nationale-enfin-sous-licence-libre-et-gratuite/)
- [law] / [search] Legal texts: [Arrêté du 23 septembre 2022 (RPPS)](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046349842) · [Décret 2016-1012 (116 117)](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000032928958) · [Décret 2025-152 (on-call care)](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051206924) · [CSS art. L162-5-3 (médecin traitant)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048691431)
- [search] 116 117 regional status: [Grand Est (CRSA, April 2026)](https://www.crsa-grand-est.fr/actualites/2026/04/le-116-117-acces-aux-soins-et-urgences-en-grand-est/) · [Franche-Comté](https://www.ici.fr/infos/sante-sciences/le-116-117-devient-le-nouveau-numero-pour-joindre-la-permanence-des-soins-en-franche-comte-7354324)
- [search] Duty pharmacies: [Le Quotidien du Pharmacien on Résogardes/Servigardes](https://www.lequotidiendupharmacien.fr/exercice-pro/des-appels-surtaxes-pour-joindre-la-pharmacie-de-garde) · [Nantes Métropole](https://metropole.nantes.fr/pharmacies-de-garde) · [data.gouv.fr forum thread](https://forum.data.gouv.fr/t/pharmacies-de-garde/442)
- [search] MonSoutienPsy: [info.gouv.fr](https://www.info.gouv.fr/actualite/mon-soutien-psy-12-seances-remboursees-par-an)
- [search] Santé.fr: [directory article](https://www.sante.fr/node/20060919)
