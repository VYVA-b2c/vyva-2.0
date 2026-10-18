# Care Finder: provider source strategy for France

Checked: 8 October 2026. Scope: metropolitan France and the overseas departments. Facts marked **[verified 2026-10-08]** were opened on the live official page, downloaded from the live official resource, or called directly on that date. Temporary verification downloads were not added to the repository.

## Executive recommendation

France has a strong, commercially reusable official-data route, but it needs several sources:

1. **Use RPPS / Annuaire Santé as the practitioner spine.** It is the authoritative national register of professionals and qualifications. Import the new three-file text publication weekly, not the legacy ZIP that ANS says will stop at the end of 2026. **[verified 2026-10-08]**
2. **Use FINESS+ Structures plus Activities as the authorised-place spine.** Structures supplies registered sites, addresses, contacts and coordinates; Activities supplies authorised and exercised care. **[verified 2026-10-08]**
3. **Use Annuaire santé Ameli only as reimbursement enrichment.** It gives sector, tariff option and Carte Vitale flags for liberal professionals and health centres, but its current file has no RPPS identifier or coordinates. It cannot be cleanly joined to RPPS without probabilistic matching. **[verified 2026-10-08]**
4. **Geocode RPPS practices with the official BAN/Géoplateforme geocoder.** RPPS has structured addresses but no coordinates. FINESS+ already carries longitude, latitude, BAN key and BAN score for most active sites. **[verified 2026-10-08]**
5. **Public-cover route:** ask for and prioritise the person's *médecin traitant*. If that doctor is unavailable and the need is urgent or same-day, the Ministry's national SAS advice is to call **15**; 116 117 may coexist locally. The SAS regulator can advise, arrange teleconsultation or find a consultation, but its booking platform is not patient- or third-party-facing. **[verified 2026-10-08]**
6. **Booking links require a commercial relationship or simple hand-off.** No public Doctolib, Maiia or KelDoc discovery/booking API was found. Do not scrape them. Start with outbound links and contact business development for contracted access.

The launch stack should be **RPPS + FINESS+ + BAN**, with **Ameli displayed only after a reliable match**, **15/SAS for same-day care**, and a later booking-platform partnership. This meets authority, reuse and nationwide coverage; weak points are practitioner coordinates, booking availability, websites/emails and the Ameli join.

---

## 1. Verified live files

Test city: **Paris**. For RPPS and Ameli, “Paris” means a Paris commune label or `75xxx` postcode; for FINESS+, commune code `75056` or a `75xxx` postcode. Counts are records, not necessarily unique consumer-visible providers, unless stated otherwise.

| Source and live resource | Real format and fields | National count | Paris count | Care type | Phone | Coordinates |
|---|---|---:|---:|---|---|---|
| **FINESS+ Structures**, September 2026 monthly snapshot, generated `2026-10-01T02:07:19Z` | gzip JSON. Site fields include `numFinessEge`, `siret`, names, `categorieentiteGeographiqueExercice`, `etatObjet`, `dateDerniereMaj`, structured address, `coordonneesGeographique` (`coordonneeX`, `coordonneeY`, `cleInInteropBAN`, `scoreBAN`) and contact telecom | 174,840 sites; **104,805 active** | **3,540 active sites** | Category; join Activities for authorisation detail | 88,436 active (84.4%); Paris 2,722/3,540 | 78,613 active (75.0%); Paris 3,106/3,540. `coordonneeX` is longitude and `coordonneeY` latitude in inspected records. **[verified 2026-10-08]** |
| **FINESS+ Activities**, September 2026 monthly snapshot | gzip JSON. `pmej[].activitesAutorisees[]` and `pmej[].ege[].activitesExercees[]`; includes activity id/state/EGE/type, authorisation dates, nature-specific activity/mode/public codes, capacity and engagement | 295,287 authorised records (161,311 active); **295,309 exercised** (161,333 active) | Join by EGE id / FINESS | **Yes** | No | No |
| **RPPS / Annuaire Santé**, `PS_LibreAcces_Personne_activite.txt`, updated 8 October 2026 | pipe text, 56 columns: professional id, profession, specialty/savoir-faire, practice mode, site SIRET/FINESS, structured practice address, two phones, email, authority, sector, role and activity type | **2,308,081 activity rows; 1,931,974 unique professional ids** | **113,353 rows; 97,927 unique ids** | **Yes** | 1,036,643 rows (44.9%) | **No field** |
| **Annuaire santé Ameli**, professionals CSV dated 5 October 2026 | semicolon CSV, 24 fields: name, practice, Carte Vitale/APCV, specialty, provider type, phone/address, tariff option, contractual sector and practice nature | **557,958 rows** | **26,322 rows** | Specialty | 385,546 rows (69.1%) | **No** |

**Corrections to the previous draft.** The new RPPS publication is not a ZIP: the current resources are uncompressed text files (`PS_LibreAcces_Personne_activite`, `PS_LibreAcces_Dipl_AutExerc`, `PS_LibreAcces_SavoirFaire`). The older ZIP publication is marked for shutdown at the end of 2026. The Ameli professionals file does **not** contain RPPS, FINESS or SIRET, so the proposed clean join was wrong. **[verified 2026-10-08]**

### Licence and commercial reuse

The live data.gouv.fr pages for FINESS Structures, FINESS Activities, RPPS, Ameli and ROR/“Offres de santé” each state **“Licence Ouverte / Open Licence version 2.0.”** **[verified 2026-10-08]** The [official licence text](https://www.etalab.gouv.fr/wp-content/uploads/2017/04/ETALAB-Licence-Ouverte-v2.0.pdf) says reuse may be **“à des fins commerciales ou non”** and expressly permits including the information in one's own product or application, subject to naming the source and last update date. **[verified 2026-10-08]** VYVA may therefore store and use these files commercially with attribution.

The Ameli page adds: **“La réutilisation de ces données est soumise au respect de la réglementation relative à la protection de la vie privée.”** **[verified 2026-10-08]** This does not prohibit commercial reuse, but makes the GDPR assessment and correction route launch requirements.

Links: [FINESS Structures](https://www.data.gouv.fr/datasets/finess-structures-1) · [FINESS Activities](https://www.data.gouv.fr/datasets/finess-activites-1) · [RPPS extract](https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps) · [Ameli data](https://www.data.gouv.fr/datasets/annuaire-sante-ameli)

---

## 2. Source assessment

| Source | Authority and coverage | Access, cost and reuse | Care Finder fit |
|---|---|---|---|
| **RPPS extract** | ANS says data are certified by professional orders, ARS and military health service, nationwide and daily. Covers identity, profession, specialty, qualifications and practice sites. **[verified 2026-10-08]** | Free direct text downloads; Open Licence 2.0. ANS recommends weekly automatic refresh. | **Primary people source.** Geocode; deduplicate activities/sites; honour diffusion restrictions. |
| **FHIR Annuaire Santé API** | Official API over RPPS/FINESS: Practitioner, PractitionerRole, Organization, Device and HealthcareService; daily. **[verified 2026-10-08]** | Free account/key; 17 requests/s/application; FHIR R4. | Live validation/named lookup. Bulk remains better for nationwide radius search. |
| **FINESS+ Structures + Activities** | Official national register of health, social and medico-social structures and authorised/exercised activities. Closed structures remain, so filter `etatObjet`. **[verified 2026-10-08]** | Free daily/monthly gzip JSON; Open Licence 2.0. | **Primary places/home-care source.** Closest French equivalent to REGCESS. |
| **Annuaire santé Ameli** | Official Assurance Maladie directory for liberal professionals and health centres; sector, tariff option, Carte Vitale/APCV. **[verified 2026-10-08]** | Free CSV, Open Licence 2.0, personal-data warning. | Reimbursement enrichment only: no stable join id, coordinates, email, website, hours or prices. |
| **BAN / Géoplateforme** | Official national address geocoder. | Free API/batch service at `https://data.geopf.fr/geocodage`; BAN data under Open Licence. | Geocode RPPS once per import; cache result, score and source date. |
| **ROR / Offres de santé** | Official ANS health-offer exports for all 18 metropolitan/DROM regions. XML contains organisations, services/facilities, offer codes, contacts and some opening hours. **[verified 2026-10-08]** | 18 regional ZIPs, IHE CSD XML, free/Open Licence 2.0. One regional file was still dated June: freshness is uneven. | Valuable service/hour enrichment; too complex and uneven to replace RPPS/FINESS at launch. |
| **Santya** | Commercial convenience API built from official RPPS and BAN, with geo-search; not a new authority. **[verified 2026-10-08]** | 100 requests/day free; Starter €29/month annual or €39 monthly; Pro €59/€79; Business €179/€239; enterprise from €800. Signup for key. | Strong buy-vs-build shortcut for RPPS/geocoding. Validate contract, uptime and correction handling. |

---

## 3. Care-type mapping

| Care Finder type | Authoritative source/filter |
|---|---|
| Family doctor | RPPS doctor (`Code profession = 10`) plus general-medicine savoir-faire; FINESS 124 health centre and 603 multi-professional health centre. |
| Ophthalmology / ENT / neurology / orthopaedics | RPPS doctor plus current TRE_R38 specialty/savoir-faire. |
| Physiotherapy | RPPS `Code profession = 70`. |
| Dentist | RPPS `Code profession = 40`; dentists are outside the médecin-traitant referral rule. **[verified 2026-10-08, Ameli]** |
| Optician | RPPS `Code profession = 28`; test retail-site completeness separately. |
| Hearing centre | RPPS `Code profession = 26`; test retail-site completeness separately. |
| Psychologist | RPPS title-holder code 93 plus psychiatrists in doctor savoir-faire. |
| Home nursing/care | FINESS active exercised home-nursing/home-help activity and older-adult public, resolved to EGE in Structures. Include SSIAD 354 and transition to *service autonomie aide et soins* 209. |
| Same-day/out-of-hours | No register equals live availability. Try médecin traitant, then 15/SAS; show 116 117 only where a local official route confirms it. |

Import current ANS terminology tables rather than hard-coding labels: TRE_R397 (FINESS category), TRE_G15 (professions), TRE_R95 (title holders) and TRE_R38 (specialties).

---

## 4. Better sources considered

### ROR / “Offres de santé” — useful enrichment

This official source was missing from the first recommendation. The live dataset contains 18 regional ZIPs. The Île-de-France ZIP downloaded on 8 October contained three XML files dated 1 October 2026:

- file 1: 17,543 organisations, 19,839 services and 16,742 facilities;
- file 2: 17,954 organisations, 43,940 services and 14,082 facilities;
- file 3: 4,049 organisations, 19,692 services and 2,949 facilities;
- 5,480 organisation/facility records across the three had a Paris address by `cityName` prefix;
- observed fields include `entityID`, `otherID`, `codedType`, `primaryName`, contact `equipment`, address attributes, `cityNumber`, service links, `facilityType`, `careMode`, patient age, `operatingHours`, capacity and record timestamps;
- no latitude/longitude elements were found. **[verified 2026-10-08]**

Use ROR after launch for institutional/home-care service detail and hours. It duplicates FINESS/RPPS concepts, is XML-heavy and regionally published, so measure overlap and freshness before ranking with it.

Dataset: [Offres de santé, sanitaire, médico-social et de ville](https://www.data.gouv.fr/datasets/offres-de-sante-sanitaire-medico-social-et-de-ville-en-france-metropolitaine-et-drom-1)

### Regional open data

Regional FINESS/RPPS republications are not better authorities than ANS. Add a regional source only when it contributes a genuinely local field—verified on-call route, accessibility or service hours—not merely another national-data copy.

### Booking platforms

| Option | Verified evidence | Cost/licence/access conclusion |
|---|---|---|
| **Doctolib** | Public partner categories/connectors exist, but no open practitioner-discovery or patient-booking API/price list was found. | Partnership/contract only. Ask for RPPS/FINESS matching, deep links, availability, delegated booking, territories, database-use rights, SLA and price. Do not scrape. |
| **Maiia** | Patient search/booking works; its SAS help confirms a regulator can SSO from SAS to Maiia to place an appointment. **[verified 2026-10-08]** | No public third-party API/tariff found. Contact Cegedim Santé partnerships. |
| **KelDoc** | Documents HL7 SIU, JSON web-service and SOAP connectors for slots and appointment create/cancel. **[verified 2026-10-08]** | An establishment/agenda connector, not a public national discovery API. Quote and contract required. |

These platforms add availability, not authorisation. Match every partnered provider to RPPS/FINESS and keep platform participation out of clinical ranking.

### Licensed vendor and national e-health options

- **Santya** packages RPPS/BAN into a versioned geo-search API with published prices. It can reduce engineering work but does not add Ameli reimbursement data or booking. **[verified 2026-10-08]**
- **FHIR Annuaire Santé** is free and official: use for live validation, not bulk radius search. **[verified 2026-10-08]**
- **SAS** is official same-day infrastructure, but its digital platform is for regulators and connected scheduling vendors: patient route, not VYVA API. **[verified 2026-10-08]**
- **Mon espace santé** is a record, messaging, catalogue and preventive agenda. Its page says users add appointments already made; it is not a national booking channel. **[verified 2026-10-08]**

---

## 5. Public-cover route verified

France does not assign everyone to a public centre. The route is personal and mixed public/private:

1. **Start with the declared médecin traitant.** Ameli says this is the doctor consulted first and the coordinator of referrals. Its 2026 example reimburses €19 for a €30 sector-1 GP consultation with the declared doctor versus €8.40 without one. The penalty still applies. **[verified 2026-10-08]**
2. **Respect direct-access exceptions.** Dental care is outside the referral route. Ameli also lists direct ophthalmology access for specified eye care and certain other specialists under conditions. **[verified 2026-10-08]**
3. **If the doctor is unavailable and care cannot wait, call 15/SAS.** The Ministry says 15 is the access number; regulation may advise, arrange teleconsultation or find an unscheduled consultation. **[verified 2026-10-08]**
4. **Treat 116 117 as regional/local.** It may coexist for out-of-hours general practice; do not promise universal routing through it. Show it only from a maintained official regional table.
5. **No official patient booking portal was found.** Mon espace santé is not one. Ameli's directory is discovery/contact; online booking remains provider/platform-specific. **[verified 2026-10-08]**

Pages opened successfully: [Ameli coordinated-care route](https://www.ameli.fr/assure/remboursements/etre-bien-rembourse/medecin-traitant-parcours-soins-coordonnes) · [Ministry SAS](https://sante.gouv.fr/systeme-de-sante/segur-de-la-sante/le-service-d-acces-aux-soins-sas/article/tout-savoir-sur-le-sas-service-d-acces-aux-soins) · [Mon espace santé](https://www.ameli.fr/assure/sante/mon-espace-sante/mon-espace-sante-carnet-sante-numerique) · [Ameli directory](https://annuairesante.ameli.fr/)

---

## 6. Recommended implementation

### Launch

- Weekly import of all three new RPPS text resources, retaining source update date and public-diffusion status.
- Monthly FINESS+ Structures/Activities snapshot; optionally daily for next-day changes.
- One provider-place index joining RPPS activities, FINESS EGE sites and current code tables.
- BAN geocoding for RPPS addresses, storing coordinates, score, BAN id and date.
- Rank by active status, authority match, exact care-code match, distance and usable contact—not booking-platform participation.
- Public-cover flow: médecin traitant first, then verified exceptions and 15/SAS.

### Pilot enrichments

- Test Santya against a representative RPPS sample; buy if cheaper than ingestion/geocoding operations.
- Add Ameli sector/OPTAM/Carte Vitale only after a match-confidence method. Never silently attach tariff status from fuzzy name/address matching.
- Pilot ROR in Île-de-France to measure extra hours/service/home-care detail.
- Ask one booking partner for contracted deep-link/availability access.

### Known gaps

No official source reliably provides national live availability, provider websites/booking URLs, accessibility, languages or complete hours. RPPS phone coverage is 44.9% by activity row; FINESS email is extremely sparse (701 active sites in the inspected snapshot). Product copy must say when a detail is unknown.

---

## 7. Open questions — answered

1. **Exact RPPS header and phone population?** The main file has 56 pipe fields, including structured site address, two phones, fax and email. 1,036,643/2,308,081 activity rows (44.9%) had the first phone. **[verified 2026-10-08]**
2. **Does Ameli carry RPPS and coordinates?** No. The October professionals file has neither stable registry identifiers nor coordinates. **[verified 2026-10-08]**
3. **GDPR Article 14 notice?** Counsel/DPO must decide lawful basis, content/timing and whether Article 14(5)(b) applies. Provide source, purposes, fields, retention, rights/contact, recipients, correction route and ranking explanation. Do not assume the disproportionate-effort exemption.
4. **FINESS+/RPPS licences confirmed?** Yes: Open Licence 2.0 on both live official pages; commercial reuse allowed with attribution. **[verified 2026-10-08]**
5. **Opposition to public diffusion?** The extract contains only public data, but precise blanking/omission was not proven from the main file alone. Treat absence as intentional, never backfill non-public personal contacts, and confirm the current DSFT rule before production.
6. **Does the médecin-traitant penalty still apply in 2026?** Yes; Ameli's 23 April 2026 page gives the €19 versus €8.40 example. **[verified 2026-10-08]**
7. **Doctolib terms?** No public discovery/booking API terms found. Business-development request: identifiers, deep links, availability, delegated booking, storage/database rights, territories, SLA and price.
8. **First region?** Product decision remains open. Île-de-France is easiest for an ROR data pilot because its 1 October export was downloaded and measured. For a Telefónica launch, choose the partner region and verify its local 116 117/on-call page before shipping copy.

---

## Sources

Official sources opened or downloaded on 8 October 2026:

- ANS: [Annuaire Santé overview](https://esante.gouv.fr/ens/offre/annuaire-sante) · [RPPS extract](https://www.data.gouv.fr/datasets/annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps) · [FHIR API](https://www.data.gouv.fr/dataservices/api-fhir-annuaire-sante)
- ANS: [FINESS Structures](https://www.data.gouv.fr/datasets/finess-structures-1) · [FINESS Activities](https://www.data.gouv.fr/datasets/finess-activites-1) · [schemas](https://github.com/ansforge/finess) · [ROR regional exports](https://www.data.gouv.fr/datasets/offres-de-sante-sanitaire-medico-social-et-de-ville-en-france-metropolitaine-et-drom-1)
- Assurance Maladie: [Ameli dataset](https://www.data.gouv.fr/datasets/annuaire-sante-ameli) · [live directory](https://annuairesante.ameli.fr/) · [médecin traitant](https://www.ameli.fr/assure/remboursements/etre-bien-rembourse/medecin-traitant-parcours-soins-coordonnes) · [Mon espace santé](https://www.ameli.fr/assure/sante/mon-espace-sante/mon-espace-sante-carnet-sante-numerique)
- Ministry: [SAS](https://sante.gouv.fr/systeme-de-sante/segur-de-la-sante/le-service-d-acces-aux-soins-sas/article/tout-savoir-sur-le-sas-service-d-acces-aux-soins) · [patient-flow infographic](https://sante.gouv.fr/IMG/pdf/_sas_infographie_fonctionnement_sas_version_juillet_2025.pdf)
- Commercial: [Santya](https://www.santya.fr/) · [KelDoc connectors](https://www.keldoc.com/offres-business-prise-de-rdv-en-ligne) · [Maiia SAS workflow](https://maiia.zendesk.com/hc/fr/articles/17128813549970-R%C3%A9gulateur-SAS-Adresser-un-patient-%C3%A0-un-professionnel-de-sant%C3%A9) · [Doctolib partners](https://doctolib.zendesk.com/hc/fr/articles/37699972693012-Quels-sont-les-partenaires-de-Doctolib-et-comment-peuvent-ils-am%C3%A9liorer-votre-quotidien)
