# Eternalgy Corporate Profile 2026 — content plan

Status: **DRAFT for approval.** No design work starts until this plan is approved.

Format: A4 portrait (210 × 297 mm), 16 pages (a multiple of 4, so it also prints as a booklet). English.
Design: the new eternalgy.me language (General Sans, white / ink / near-black fields, documentary photography, alternating-tone tables, no eyebrow labels, no numbering, no rules).

## Source key

| Key | File |
|---|---|
| **SSM** | `G:\SinChew Awards\08_SSM_and_Corporate_Records\current-ssm-extracted-facts.json` (SSM company profile, 12 Oct 2026) |
| **CIDB** | `G:\SinChew Awards\04_Certifications_and_Awards\CIDB_PPK_Source_Record.json` + `Eternalgy_CIDB_PPK_2026-07-22.pdf` |
| **MYH** | `G:\SinChew Awards\04_Certifications_and_Awards\MyHIJAU_2026_Source_Record.json` + `Eternalgy_MyHIJAU_Service_Certificate_2026-2027.pdf` |
| **CO** | `G:\SinChew Awards\06_Application_Working_Files\Company_Details_User_Confirmed.json` (user-confirmed, 20–23 Oct 2026) |
| **ORG** | `G:\SinChew Awards\09_Organisation_Chart\reporting-structure.json` |
| **OSH** | `G:\SinChew Awards\04_Certifications_and_Awards\Safwan_OSH-C_Certificate_2026-09-24.jpg` |
| **GB** | `G:\SinChew Awards\04_Certifications_and_Awards\Eternalgy_Award_GoldenBull.png` |
| **V4** | `Eternalgy_Corporate_Profile_v4_Full.pdf` (Oct 2026), page given as V4 p.N |
| **P25** | `G:\Eternalgy-Media-Kit\Eternalgy Profile 2025.pdf`, page given as P25 p.N (used only where not superseded) |
| **LIVE** | `https://ee-pr.up.railway.app/api/dashboard-state` → `metrics`, read 27 Oct 2026 (`last_verified` 21 Oct 2026) |
| **WEB** | `views/shared/home-b2b.ejs` (live homepage, already verified) |

---

## Page 1 — Cover

**Purpose:** first impression; who we are in one line.
**Image:** `public/images/b2b/studio-macro.webp` (module corner, full bleed, near-black).

- Eternalgy logo (white)
- Headline: **Solar infrastructure for industry.** — WEB hero
- Sub-line: **Corporate Profile 2026**
- Tagline: **Own Your Power. Own Your Future.** — V4 p.1
- Foot: Eternalgy Sdn Bhd · 202301029164 (1523087-A) — SSM

## Page 2 — Who we are

**Purpose:** company introduction and the core facts a procurement team checks first.
**Headline:** **One contractor, from design to decades of output.**

Copy (from V4 p.2, tightened):
> Eternalgy Sdn Bhd is a Johor Bahru-headquartered solar PV EPCC company. We design, supply, build, commission and maintain solar systems for commercial, industrial, public-sector, developer and residential clients across Peninsular Malaysia, with one team and one point of accountability.

Vision (P25 p.8, shortened, wording kept): *To be Malaysia's leading renewable energy company, empowering communities and industries through innovative, reliable and affordable solar and energy storage solutions.*

Fact table (alternating tone rows):

| | | Source |
|---|---|---|
| Company | Eternalgy Sdn Bhd | SSM |
| Registration | 202301029164 (1523087-A) | SSM |
| Incorporated | 31 July 2023 | SSM |
| Paid-up capital | RM1,000,000 | SSM (page 2) / CO |
| Founder & CEO | Mr. Gan Lai Soon | SSM (director), CO |
| People | 62 staff (24 executive, 38 non-executive) | CO |
| Offices | 5, across Johor, Melaka, Negeri Sembilan and Selangor | V4 p.10, WEB footer |
| Headquarters | 01-23, Jalan Mutiara Emas 10/19, Taman Mount Austin, 81100 Johor Bahru, Johor | SSM (business address) |
| CIDB | Grade G7 | CIDB |

## Page 3 — In numbers

**Purpose:** scale, on one near-black page.
**Headline:** **Three years. Twelve megawatts.** — WEB

| Figure | Caption | Source |
|---|---|---|
| **12 MWp+** | solar PV installed and commissioned | LIVE `installed_mwp` = 12.31 |
| **1,100+** | sites commissioned across Peninsular Malaysia | LIVE `installed_projects_count` = 1,138 |
| **60+** | commercial and industrial projects completed | V4 p.9, p.15 |
| **RM 35M+** | customer revenue since 2023 | LIVE `total_revenue_millions` = 35.75 |
| **G7** | CIDB grade, the highest | CIDB |

Foot note: *Installed capacity, sites and customer revenue from Eternalgy's project records as at 21 October 2026.*
(Internal finance fields — invoice value, collections, clients, SEDA registrations — are **not** used.)

## Page 4 — What we do

**Purpose:** capability scope, grouped as on the homepage.
**Headline:** **Capabilities**
**Image:** one real photo, half page: `public/images/b2b/real/industrial-kota-tinggi.webp`

- **Engineering and construction** — Solar EPCC (design, procurement, construction, commissioning) · Duo Mix systems (string + micro inverters in one system) · Battery storage and off-grid · Electrical works (Suruhanjaya Tenaga certified) · SEDA and TNB approvals — V4 p.2, p.26; WEB
- **Financing and schemes** — Zero-capex solar as a SEDA Registered PV Investor (we finance, build and operate; you buy the power) · Maybank solar financing (preferred partner) · GITA allowances · ATAP and SELCO · CRESS and CREAM — WEB; P25 p.11, p.17
- **Operations** — eSAJ monitoring · six-monthly inspection · thermal drone scanning · 48-hour fault response · EV charging — V4 p.25, p.27–29; WEB

## Page 5 — Schemes and incentives

**Purpose:** show we advise on the right scheme; useful reference for clients.
**Headline:** **The right scheme for your load profile.**

Table 1, ATAP vs SELCO (V4 p.5): what it is · excess energy · credits · capacity (non-domestic) · duration · best for.
Table 2, CRESS vs CREAM (V4 p.6): purpose · target user · structure · entry requirement · risk.
Incentive line (V4 p.4): Solar qualifies for a 60% Green Investment Tax Allowance and battery storage for 100%, set off against 70% of statutory income, for qualifying capital expenditure until 31 December 2026. Malaysia targets a 70% renewable share of capacity by 2050.
Foot: *Scheme rules are set by the relevant authorities and may change.* — V4 p.5

## Page 6 — How we deliver

**Purpose:** process and engineering approach.
**Headline:** **From consultation to long-term output.** — WEB

Six steps (V4 p.8), each one line:
Consultation · Site survey and design · Proposal and contract (milestone payments, financing, GITA) · Approvals (SEDA and utility; regulator timelines apply) · Installation and commissioning (most C&I rooftops 4–8 weeks from survey to commissioning) · Monitoring and maintenance.

Side block — **Duo Mix** (V4 p.26): string inverters on large uniform roof areas, micro inverters on shaded or complex sections, in one system: higher yield, less single-point dependence, panel-level data.

Side block — **Supply chain we control** (P25 p.21, WEB): sole distributor for SAJ in Malaysia; digitalised logistics (cloud invoicing, cloud inventory, automated stock-keeping); warehouses in Johor and Selangor for fast replacement.

**Images:** step photos `public/images/b2b/step-*.webp` (generated; illustrative only, no captions naming a project) + `real/thermal-drone-scan.webp` for the last step.

## Page 7 — Credentials

**Purpose:** proof, in one table with numbers and validity.
**Headline:** **Top grade, on record.** — WEB

| Credential | Issuer | Detail | Source |
|---|---|---|---|
| Grade G7 contractor: B04, CE21, M15; Grade G2: E04 | CIDB Malaysia | Reg. 0120250324-WP152634 · effective 22 Jul 2026, valid to 25 Mar 2027 | CIDB |
| MyHIJAU: Engineering, Procurement, Construction and Commissioning of Solar PV services | MGTC | MyHS00025/25 · issued 19 Jun 2026, valid to 18 Jun 2027 | MYH |
| Registered PV Service Provider (RPVSP) | SEDA Malaysia | Registered | P25 p.2, WEB (no number — see open items) |
| Registered PV Investor (RPVI) | SEDA Malaysia | RPVI directory | P25 p.17, WEB |
| Electrical wiring works | Suruhanjaya Tenaga | Certified | V4 p.11 |
| Corporate member | Malaysian Photovoltaic Industry Association (MPiA, now MPSEA) | Member | P25 p.2, WEB |

**Competent personnel** (second table, V4 p.12): SEDA GCPV certified designer; SEDA GCPV wireman and chargeman; SEDA GCPV installation and maintenance · ST Competent PW4; ST Competent Energy Manager · CIDB Green Card · NIOSH OGSP and NTSP · MBOT certified technician · CAAM RCOC-B drone operator · certified first aider · Occupational Safety & Health Coordinator (OSH-C) course, Sep 2026 (OSH).

Marks shown: CIDB, MyHIJAU, SEDA logos from `G:\SinChew Awards\03_Brand_Assets\Partner_and_Accreditation_Marks\`.

## Page 8 — Recognition and partners

**Purpose:** third-party endorsement.
**Headline:** **Chosen by people who check.**
**Image:** Golden Bull award photograph, top crop of GB (real event photo).

| | | Source |
|---|---|---|
| Golden Bull Award 2025, Outstanding Bull — for 2024 performance | Golden Bull Award | GB, P25 p.27 |
| Centre of Excellence partner — contributed to the Battery Energy Storage System training facility | SHRDC, Shah Alam | V4 p.22, P25 p.10 |
| Preferred solar PV partner for Maybank solar financing products | Maybank | P25 p.11 |
| Sole distributor for SAJ in Malaysia — 50 MW + 10 MWh PV and storage agreement, announced in Shanghai | SAJ Electric | P25 p.12 |
| Technology partner — Tiger Neo 3.0 modules, AAA bankability tier | JinkoSolar | V4 p.23 |

Logos: SAJ, Jinko, Golden Bull from the brand-assets folder; Maybank and SHRDC as text (no logo files on hand).

## Page 9 — Founder & CEO

**Purpose:** leadership.
**Headline:** **Mr. Gan Lai Soon** — Founder and Chief Executive Officer
**Image:** `.taste-skill/ceo/gan-lai-soon-cutout.png` (transparent cut-out) on surface tone.

Copy (V4 p.13, condensed; nothing added):
- B.Sc. Electronics, Universiti Teknologi Malaysia (UTM).
- Built a career in the Malaysian insurance industry, with multiple industry awards; brings client-facing rigour and a risk-conscious mindset.
- Investor with a network across Malaysia and China, which informs sourcing of bankable equipment (Jinko modules, SAJ inverters).
- Leads engineering-first: technical decisions by certified engineers, equipment chosen for bankability, every project built to hold up to banks, authorities and the client's facilities team.
- Quote: *"Every roof is a power plant waiting to be engineered properly — our job is to make that transition simple, bankable and built to last."*

## Page 10 — Our people

**Purpose:** the team that delivers; first-party engineering.
**Headline:** **The people behind it.** — WEB

- **Mr. Lim Kim Chang** — General Manager (CO, ORG). No photo on file → name and title only.
- **Ahmad Safwan bin Ahmad Nazri** — Solar Design Engineer. 7+ years; Kerian, Tanah Merah and Gebeng solar farms; 50+ C&I sites. Masters in Mechanical Engineering · SEDA GCPV certified designer · ST Competent Energy Manager · CAAM RCOC-B drone operator · OSH-C course (Sep 2026). Photo `real/ahmad-safwan.webp`. — V4 p.14, OSH
- **Ahmad Faruoqi bin Ibrahim** — Solar O&M Engineer. 10+ years; 3,400+ residential systems handled; electrical engineer on a 10 MW large-scale solar project. Diploma in Electrical Engineering · ST Competent PW4 · SEDA GCPV wireman and chargeman. Photo `real/ahmad-faruoqi.webp`. — V4 p.14
- Line: *62 people across five offices: engineering, project delivery and site supervision, sales, and administration.* — CO, ORG (functions as drawn on the chart)
- Line: *Our own first-party engineering team, from design to resolution. No finger-pointing between vendors.* — P25 p.23, WEB

## Page 11 — Track record

**Purpose:** project overview, full-bleed photograph.
**Headline:** **Built, commissioned, and running.** — WEB
**Image:** `real/bhp-seri-alam-top.webp` (top-down aerial, real project), full bleed.

Index table of the six projects that follow:

| Project | Sector | Scheme | Key figure |
|---|---|---|---|
| Industrial project, Kota Tinggi | Industrial | ATAP | Major industrial installation |
| PETRONAS Pengerang | Off-grid site | Off-grid + BESS | 11.16 kWp + 48 kWh |
| BHP Seri Alam | Petrol station | SELCO | 126.26 kWp, 214 panels |
| Beach resort, Pengerang | Hospitality | NEM | First hospitality project |
| Taman Rinting | Residential developer | SELCO | 104 homes |
| SHRDC, Shah Alam | Institutional | BESS | Centre of Excellence partner |

Source: V4 p.16–22.

## Page 12 — Commercial and industrial projects

**Headline:** **Commercial and industrial.**

- **Industrial project, Kota Tinggi, Johor** — ATAP. A major industrial installation built to the demands of a working plant. Photo `real/industrial-kota-tinggi.webp`. — V4 p.20
- **BHP Seri Alam petrol station** — SELCO. 126.26 kWp across 214 panels; all generation used on site, no grid export. Photo `real/bhp-seri-alam.webp`. — V4 p.18
- **Beach resort, Pengerang, Johor** — NEM. Our first hospitality project, engineered for a coastal environment. Photo `real/beach-resort-pengerang.webp`. — V4 p.19

## Page 13 — Storage, off-grid and developer projects

**Headline:** **Storage, off-grid and at scale.**

- **PETRONAS Pengerang off-grid site** — 11.16 kWp of solar with 48 kWh of battery storage, no grid connection. Photo `real/petronas-pengerang-bess.webp`. — V4 p.21
- **SHRDC Centre of Excellence, Shah Alam** — contributed to the Battery Energy Storage System training facility; appointed Centre of Excellence partner. Photo `real/shrdc-coe.webp`. — V4 p.22
- **Taman Rinting developer programme, Johor** — SELCO. 104 homes delivered with one developer, each to the same system standard. Photo `real/taman-rinting.webp`. — V4 p.17

## Page 14 — Technology

**Purpose:** equipment we stand behind, condensed from four v4 pages to one.
**Headline:** **Equipment chosen for bankability.**

- **JinkoSolar Tiger Neo 3.0** (V4 p.23–24): N-type TOPCon, bifacial glass-glass, quarter-cell. 650–670 W · 27.79% cell efficiency · −0.26 %/°C · ≤ 0.35% annual degradation · 88.85% guaranteed output at year 30 · AAA bankability tier. Partial shading: ~84% of nominal power vs ~63% for half-cell (manufacturer data).
- **SAJ inverters and storage** (V4 p.25): established 2005 · 9 GW inverter and 3.6 GWh storage capacity per year · 85+ export countries · 289 patents.
- **eSAJ monitoring** (V4 p.25): real-time data 24 hours a day, remote settings, alarms and error detection, exportable reports, single or multi-plant.
- **Thermal drone scanning** (V4 p.27): DJI Enterprise thermal + visual; finds defective cells and sub-strings, connection faults, storm damage, non-functioning panels, delamination, cell rupture. Image `real/thermal-drone-scan.webp`.
- Foot: *Manufacturer data; actual performance varies by site and system design.*

## Page 15 — Warranty and aftersales

**Purpose:** what the client can hold us to.
**Headline:** **Warranty you can hold us to.** — WEB

| Cover | Period | Source |
|---|---|---|
| Module power warranty · JinkoSolar Tiger Neo 3.0 | 30 years | V4 p.29 |
| Module product warranty | 12 years | V4 p.29 |
| Inverter product warranty · SAJ | 10 years | V4 p.29 |
| Installation workmanship | 3 years | V4 p.29 |
| System monitoring | 3 years | V4 p.29 |
| Technical support | 3 years | V4 p.29 |
| Roof leaking | 1 year | V4 p.29 |

Service: eSAJ monitoring · inspection every 6 months (connection checks, cleaning inspection, performance audit) · thermal drone scanning · urgent cases (system down) attended within 48 hours; standard claims resolved in 3 to 5 working days. Claim process: submit (hotline, email, WhatsApp) → assessment → repair or replace → retest with you. — V4 p.29
Foot: *Warranty terms are subject to manufacturer and contract conditions.*

## Page 16 — Offices and contact (back cover)

**Purpose:** call to action and addresses. Near-black page.
**Headline:** **Own your power. Own your future.**
Line: *Share your site address and electricity bills. Our engineers recommend the scheme that fits your load profile and return a system design, yield and payback.* — WEB

Contact: +60 11-2100 0099 · admin@eternalgy.com · eternalgy.me · eternalgy.com · solarpanels.my
WhatsApp QR → `https://wa.me/601121000099` (generated from the number; same link as the website).

Offices:
- **Johor Bahru (HQ)** — 01-23, Jalan Mutiara Emas 10/19, Taman Mount Austin, 81100 Johor Bahru, Johor — SSM
- **Seremban** — 252 First Floor, Uptown Avenue, Jalan S2 B12, Seremban 2, 70300 Negeri Sembilan — V4 p.31
- **Kluang** — No. 26, Jalan Tasik Indah 1/1, Taman Tasik Indah, 86000 Kluang, Johor — V4 p.31
- **Klang** — 8, Jalan Permata 8A/KS09, Jln Kg Air Hitam, Taman Perindustrian, 41200 Klang, Selangor — WEB
- **Melaka** — *address needed (see open items)*

Foot: Eternalgy Sdn Bhd · 202301029164 (1523087-A) · Corporate Profile 2026.

---

## Open items — need your answer before design is final

1. **Melaka office address.** Not in any source. Supply it, or the page lists "Melaka" with no street address.
2. **HQ unit number.** SSM (12 Oct 2026) says **01-23**; v4, v3, the 2025 profile and the SinChew application use **21-01** (you confirmed 21-01 on 23 Oct for the award form). The plan follows SSM (01-23), as the website now does. Confirm.
3. **SEDA RPVSP number.** The only saved certificate (SEDA/RPVSP/2024/321) expired 31 Dec 2024. Plan shows "Registered" with no number. Supply the renewal to show it.
4. **GM on the people page.** Lim Kim Chang, General Manager — name and title only (no photo on file). Include? Supply a photo if you have one. Other names on the org chart (branch managers, project manager) are left out unless you want them.
5. **Numbers: rounded or exact.** Plan uses rounded (12 MWp+, 1,100+, RM 35M+) so the profile does not date quickly. Alternative: exact as at 21 Oct 2026 (12.31 MWp, 1,138 sites, RM 35.75M).
6. **GITA end date.** The allowance applies to spending until 31 Dec 2026, two months away. Keep it (dated), or drop it so the profile stays valid in 2027?
7. **Chinese name / logo (恒能).** Brand assets include Chinese logos. Add the Chinese name on the cover, or English only?

## Verified but not backed by an original document on file

These appear in v4 / the 2025 profile and on the website, so the plan keeps them; the SinChew folder has only company-produced pages, not the original letters. Tell me if any should come out.
- Maybank preferred solar PV partner (P25 p.11)
- SAJ Malaysia sole distributor, 50 MW + 10 MWh agreement (P25 p.12)
- SHRDC Centre of Excellence partner (P25 p.10, V4 p.22)
- MPiA / MPSEA membership (P25 p.2) — no current membership proof
- Suruhanjaya Tenaga electrical wiring works certificate — no certificate copy in the folder

## Wording changed to match the evidence

- **OSH-C:** the certificate is a *Certificate of Attendance* for the Occupational Safety & Health Coordinator (OSH-C) course, 22–24 Sep 2026, Ahmad Safwan. The profile says "OSH-C course, Sep 2026" under his name, not "certified safety supervisor". (The homepage still says "certified safety supervisor"; that is a website follow-up, not part of this profile.)
- **MyHIJAU:** scope is Solar PV EPCC services (2026 certificate), not "SAJ inverter equipment" (2025 certificate).

## Left out on purpose

- **Outdated:** CIDB G3; 7.8 / 1.65 / 10.75 MWp; 925+ / 40+ projects; RM900,000 capital; "September 2023"; the 2025 team (Jamaluddin, Xiang Jun, Yuan, Leon); MSIG; "zero sub-contractors"; 1-year leak-proof as the workmanship warranty; NEM 3.0 as a current scheme; Apex Manufacturing case study; Kuala Lumpur office; 3-office count (v3).
- **Unverifiable claims:** "first solar company to adopt thermal drone scanning" (V4 p.27); "fastest-growing new solar EPCC company by revenue" and "fastest RPVSP to RM10M revenue" (P25 p.6, award draft) — no comparative evidence.
- **BHP Seri Alam savings figures** (RM4,900 saving, 11,300 kWh, 112,120 kg CO2e, V4 p.18): the period (monthly? annual?) is not stated and the figures do not reconcile, so only capacity and panel count are used. Supply the period to restore them.
- **Customer-facing filler from v4** that a B2B profile does not need: the "customer challenges" page, FAQ and terms & conditions (V4 p.3, p.30), Jinko module range table (V3 p.9). Content condensed: four technology pages → one; two scheme pages → one.
- **Internal finance fields** from the live dashboard (invoice value, collections, client and SEDA registration counts).
- Generated photos (`aerial-*`, `step-*`) are used only as unnamed illustration, never as an Eternalgy project.
