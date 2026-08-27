# Location SEO & Agent Pages — Eternalgy

> **One-page system · 390 town pages · built to be found by Google & AI search**
> URL pattern: `/agent/{state}/{town}`

---

## What this is

A network of **one landing page per town** across every Malaysian state, e.g.:

- `/agent/johor/batu-pahat` — "Solar PV in Batu Pahat, Johor"
- `/agent/selangor/petaling-jaya` — "Solar PV in Petaling Jaya, Selangor"
- `/agent/pahang/tanah-rata` — "Solar PV in Tanah Rata, Cameron Highlands, Pahang"
- `/agent/federal-territories/presint-20` — "Solar PV in Presint 20, Putrajaya"

Each page:
1. **Recommends the reader call our local agent** for solar PV (name + mobile + WhatsApp).
2. **States that our service region covers that town** and its district.
3. Is **fully indexable** by Google and AI crawlers, with structured data.

### Coverage summary (auto-generated)
- **390 town/sub-area pages** (towns, sub-areas like Medini/Puteri Harbour, all 20 Putrajaya precincts, plus district-level pages like Batu Pahat, Muar, Langkawi, Cameron Highlands, Kemaman)
- **12 state hub pages** `/agent/{state}`
- **1 national hub page** `/agent`
- **402 URLs** added to `sitemap.xml`, all listed in `llms.txt`

---

## Why this exists (the main purpose)

**SEO / AI discoverability.** When someone searches Google or asks an AI chat:

> *"solar pv in Batu Pahat"*

...this page is what gets found. The page is indexed, contains the town name in the title, headings, body text, meta description, and structured data — so both **search engines** and **LLM / AI agents** can answer the query with *our* page, driving local leads to Eternalgy.

The whole point is: **be the local answer for "solar PV in [town]"** in every town in Malaysia.

---

## How it works (the architecture)

There are **no 400 static files**. Everything is generated from **one template + one data file**, rendered on request.

```
data/service-areas.js   ← the list of all 390 towns & states (source of truth)
data/agents.js          ← the list of agents (names + mobile)
        │
        ▼  looked up by the route
routes/service-areas.js ← builds title / meta / JSON-LD / markdown, finds the agent
        │
        ▼  filled into ONE page design
views/desktop/agent-town.ejs   (and views/mobile/agent-town.ejs)
        │
        ▼  rendered on request
/agent/johor/batu-pahat  →  "Solar PV in Batu Pahat, Johor"
/agent/selangor/...      →  "Solar PV in …, Selangor"
```

Because the town name is a **variable** (`<%= record.town %>`) swapped in at render time, changing the template changes **all 390 pages at once**.

### What each file does

| File | Role |
|---|---|
| `data/service-areas.js` | **Source of truth** — states, districts, towns, sub-areas. Adding a town here creates its page, sitemap entry and llms.txt entry automatically. |
| `data/agents.js` | The **agent list** (name + mobile). Assigned round-robin across all towns. |
| `routes/service-areas.js` | The routes + the SEO text: page title, meta description, JSON-LD schema, `?format=md` / `?format=json` output. |
| `views/desktop/agent-town.ejs` | The **desktop** page design (call-your-agent CTA, coverage, services, nearby towns). |
| `views/mobile/agent-town.ejs` | The **mobile** page design (same content, mobile layout). |
| `views/desktop/mobile/agent-state.ejs` + `agent-index.ejs` | The state hub and national hub listing pages. |

### SEO + GEO features baked in
- **JSON-LD** `Service` + `Person` (named area representative) + `FAQPage` + `WebPage` + `BreadcrumbList` + `Organization`
- **Canonical URL** + **`?format=md` / `?format=json`** alternatives for AI crawlers (marked noindex; markdown `Content-Type: text/markdown`)
- Unique coverage sentence per town (town + district + state + parent + note)
- Fact block: town, district, state, representative name + mobile
- Internal links to **nearby towns in the same district**
- `geo.placename` / `geo.region` meta, `og:locale=en_MY`
- Added to **`sitemap.xml`**, **`llms.txt`** (with representative name + phone) and **`llms-full.txt`**
- `robots.txt` explicitly allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Grok, xAI, Gemini-Deep-Research

---

## How to maintain it

> **Golden rule: never edit the 400 pages. Edit the data file and the one template.**

### 1. Add / remove a town
Edit `data/service-areas.js` — the `STATES` array.

```js
{
  state: 'Johor',
  districts: [
    { district: 'Batu Pahat', towns: ['Yong Peng', 'Ayer Hitam', 'Parit Raja'] }
  ]
}
```

- A plain string `'Kulai'` = one town page.
- An object with `subAreas` creates separate pages for each sub-area:
  ```js
  { town: 'Iskandar Puteri', subAreas: ['Kota Iskandar', 'Medini', 'Puteri Harbour'] }
  ```
- A `note` shows extra context on the page (e.g. `note: 'partially'`) without creating a page.

The page, its sitemap entry, and its llms.txt entry all appear automatically.

### 2. Change the page wording / design
Edit the **templates**:
- `views/desktop/agent-town.ejs`
- `views/mobile/agent-town.ejs`

The town name is referenced as `<%= record.town %>` and the state as `<%= record.stateName %>`. Edit once → applies to all towns.

### 3. Change the SEO title / description / JSON-LD
Edit `routes/service-areas.js` (the `res.render(...)` block and `buildTownSchema()`). This controls:
- the `<title>` and `meta_description`
- the JSON-LD schema
- the `?format=md` / `?format=json` output

### 4. Change / add agents
Edit `data/agents.js`, one entry per agent:

```js
module.exports = [
  { name: 'Ahmad Faizal', phone: '+60 12-345 6789' },
  { name: 'Siti Nurhaliza', phone: '013-555 1234' }
];
```

Agents are assigned **evenly (round-robin)** across all towns, so each page shows its own agent's name and number. Phone numbers are normalized to a WhatsApp link automatically (leading `0` → `60`, e.g. `013-555 1234` → `wa.me/60135551234`).

> If the agent list is empty, every page falls back to the main line **+60 11-2100 0099**.

### 5. Deploy
The pages are dynamic — just redeploy the app. No static regeneration step is needed.

---

## Quick reference

| Question | Answer |
|---|---|
| How many pages? | 390 towns + 12 state hubs + 1 national hub = **403 URLs** (402 in sitemap) |
| Do I edit each page? | **No** — one template + one data file |
| Where do town names live? | `data/service-areas.js` |
| Where do agent names live? | `data/agents.js` |
| Where does the page design live? | `views/desktop/agent-town.ejs` + `views/mobile/agent-town.ejs` |
| Where is the SEO title/description/schema? | `routes/service-areas.js` |
| Where is it listed for search engines? | `sitemap.xml` |
| Where is it listed for AI crawlers? | `llms.txt` |
| Does it need the database? | The `/agent/*` pages themselves do **not**; `sitemap.xml` / `llms.txt` query the DB for news/products first |
