const express = require('express');
const cors = require('cors');
const path = require('path');
const { marked } = require('marked');
const slugify = require('slugify');
require('dotenv').config();

const db = require('./db');
const { trackVisitor } = require('./scripts/visitorTracker');

const app = express();
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'solar-ai-super-secret-key';

// Enable CORS and parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Set template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize DB on startup
db.initDb().catch(err => {
  console.error('Database initialization failed:', err);
});

// Middleware: Device Detection & Dynamic Serving
function detectDevice(req, res, next) {
  const ua = req.get('User-Agent') || '';
  req.isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  
  if (req.query.view === 'mobile') req.isMobile = true;
  if (req.query.view === 'desktop') req.isMobile = false;
  
  res.setHeader('Vary', 'User-Agent');
  
  const originalRender = res.render;
  res.render = function(view, options, fn) {
    const prefix = req.isMobile ? 'mobile' : 'desktop';
    return originalRender.call(res, `${prefix}/${view}`, options, fn);
  };
  
  next();
}
app.use(detectDevice);
app.use(trackVisitor);

// Helper: Resolve canonical base URL forcing HTTPS on external domains
function getBaseUrl(req) {
  const host = req.get('host') || 'eternalgy.me';
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('127.0.0.1:3000')) {
    return `${req.protocol}://${host}`;
  }
  return `https://${host}`;
}

// Middleware: Set Global View Parameters for Canonicalization
app.use((req, res, next) => {
  const baseUrl = getBaseUrl(req);
  res.locals.baseUrl = baseUrl;
  const path = req.path;
  res.locals.canonicalUrl = `${baseUrl}${path === '/' ? '' : path}`;
  
  // Prevent duplicate content indexing for ?format=raw/json/md variants
  if (req.query.format) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// Middleware: API Key Authentication
function authenticateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API Key' });
  }
  next();
}

// Helper: Build JSON-LD Schema
function getSchemaData(item, type, baseUrl) {
  const pageUrl = `${baseUrl}/${item.slug}`;
  let primaryEntity = null;
  let breadcrumbItems = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": baseUrl
    }
  ];

  if (type === 'article') {
    if (item.category === 'news') {
      primaryEntity = {
        "@type": "NewsArticle",
        "@id": `${pageUrl}#newsarticle`,
        "headline": item.title,
        "description": item.summary,
        "image": [
          `${baseUrl}/logo.png`
        ],
        "datePublished": new Date(item.created_at).toISOString(),
        "dateModified": new Date(item.updated_at).toISOString(),
        "author": {
          "@type": "Person",
          "name": item.author
        },
        "publisher": {
          "@type": "Organization",
          "name": "Eternalgy Sdn Bhd",
          "url": baseUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/logo.png`
          },
          "foundingDate": "2023-09-15",
          "sameAs": [
            "https://eternalgy.com",
            "https://solarpanels.my",
            "https://solarpanels.onesync.my",
            "https://solar100.com.my"
          ]
        },
        "mainEntityOfPage": pageUrl,
        "isBasedOn": item.source_url || undefined
      };
      breadcrumbItems.push(
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Energy News",
          "item": `${baseUrl}/news`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": item.title,
          "item": pageUrl
        }
      );
    } else {
      primaryEntity = {
        "@type": "TechArticle",
        "@id": `${pageUrl}#techarticle`,
        "headline": item.title,
        "description": item.summary,
        "image": [
          `${baseUrl}/logo.png`
        ],
        "datePublished": new Date(item.created_at).toISOString(),
        "dateModified": new Date(item.updated_at).toISOString(),
        "author": {
          "@type": "Person",
          "name": item.author
        },
        "publisher": {
          "@type": "Organization",
          "name": "Eternalgy Sdn Bhd",
          "url": baseUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/logo.png`
          },
          "foundingDate": "2023-09-15",
          "sameAs": [
            "https://eternalgy.com",
            "https://solarpanels.my",
            "https://solarpanels.onesync.my",
            "https://solar100.com.my"
          ]
        },
        "dependencies": "Solar PV Engineering",
        "proficiencyLevel": "Intermediate to Expert",
        "mainEntityOfPage": pageUrl
      };
      breadcrumbItems.push(
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Solar Tips",
          "item": `${baseUrl}/tips`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": item.title,
          "item": pageUrl
        }
      );
    }
  } else if (type === 'product') {
    primaryEntity = {
      "@type": "Product",
      "@id": `${pageUrl}#product`,
      "name": item.name,
      "brand": {
        "@type": "Brand",
        "name": item.brand
      },
      "description": item.summary,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "MYR",
        "availability": "https://schema.org/InStock",
        "url": pageUrl
      }
    };
    breadcrumbItems.push(
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Products",
        "item": `${baseUrl}/#hardware`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": item.name,
        "item": pageUrl
      }
    );
  } else if (type === 'project') {
    primaryEntity = {
      "@type": "CreativeWork",
      "@id": `${pageUrl}#project`,
      "name": item.title,
      "description": item.summary,
      "locationCreated": item.location,
      "temporalCoverage": item.commission_date
    };
    breadcrumbItems.push(
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Projects",
        "item": `${baseUrl}/#track-record`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": item.title,
        "item": pageUrl
      }
    );
  }

  if (primaryEntity) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        primaryEntity,
        {
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbItems
        }
      ]
    };
  }
  return null;
}

// Helper: Upsert an article with URL-based dedup for news.
// - If source_url is provided and already exists -> skipped_duplicate (no clobber).
// - If source_url is new -> insert, auto-uniquifying the slug if a different
//   story already owns it (two outlets can produce the same headline).
// - If no source_url (tips / manual posts) -> keep the original slug-based
//   idempotent upsert so re-posting the same slug refreshes the row.
async function upsertArticle(fields) {
  const {
    title, category, summary, content, author, tags,
    meta_description, slug, published, source_url, source_name, published_at, marketing_line, marketing_line_cn
  } = fields;

  const baseSlug = slug || slugify(title, { lower: true, strict: true });
  // Strip duplicate leading H1 heading if present (e.g. "# Title") to prevent duplicated H1 on detail pages
  const cleanContent = content.trim().replace(/^#\s+.*?\n+/, '');
  const htmlContent = marked.parse(cleanContent);
  const finalSummary = summary || cleanContent.replace(/[#*`\n]/g, ' ').substring(0, 160);
  const finalMeta = meta_description || finalSummary.substring(0, 150);
  const finalPublished = published !== undefined ? published : true;
  const pubAt = published_at || null;
  const finalMarketingLine = marketing_line || null;
  const finalMarketingLineCn = marketing_line_cn || null;

  if (source_url) {
    const dup = await db.pool.query(
      'SELECT * FROM main_site_articles WHERE source_url = $1',
      [source_url]
    );
    if (dup.rows.length > 0) {
      return { action: 'skipped_duplicate', data: dup.rows[0] };
    }

    // Resolve slug collisions against genuinely different stories.
    let finalSlug = baseSlug;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await db.pool.query('SELECT 1 FROM main_site_articles WHERE slug = $1', [finalSlug]);
      if (clash.rows.length === 0) break;
      n += 1;
      finalSlug = `${baseSlug}-${n}`;
    }

    const insert = await db.pool.query(
      `INSERT INTO main_site_articles
         (slug, title, category, summary, content, html_content, author, tags, meta_description, published, source_url, source_name, published_at, marketing_line, marketing_line_cn, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($13, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
       RETURNING *;`,
      [finalSlug, title, category, finalSummary, cleanContent, htmlContent, author || 'Solar EPC AI', tags || '', finalMeta, finalPublished, source_url, source_name || null, pubAt, finalMarketingLine, finalMarketingLineCn]
    );
    return { action: 'inserted', data: insert.rows[0] };
  }

  const upsert = await db.pool.query(
    `INSERT INTO main_site_articles
       (slug, title, category, summary, content, html_content, author, tags, meta_description, published, source_name, published_at, marketing_line, marketing_line_cn, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($12, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
     ON CONFLICT (slug)
     DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       summary = EXCLUDED.summary,
       content = EXCLUDED.content,
       html_content = EXCLUDED.html_content,
       author = EXCLUDED.author,
       tags = EXCLUDED.tags,
       meta_description = EXCLUDED.meta_description,
       published = EXCLUDED.published,
       source_name = EXCLUDED.source_name,
       published_at = EXCLUDED.published_at,
       marketing_line = EXCLUDED.marketing_line,
       marketing_line_cn = EXCLUDED.marketing_line_cn,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *;`,
    [baseSlug, title, category, finalSummary, cleanContent, htmlContent, author || 'Solar PV Expert', tags || '', finalMeta, finalPublished, source_name || null, pubAt, finalMarketingLine, finalMarketingLineCn]
  );
  return { action: 'upserted', data: upsert.rows[0] };
}

// Route: Homepage
app.get('/', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const overviewRes = await db.pool.query(
      "SELECT * FROM main_site_company_info WHERE key = 'overview' LIMIT 1"
    );
    const tipsRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE category = 'tip' AND published = true ORDER BY created_at DESC LIMIT 5"
    );
    const newsRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE category = 'news' AND published = true ORDER BY COALESCE(published_at, created_at) DESC LIMIT 5"
    );
    const productsRes = await db.pool.query(
      "SELECT * FROM main_site_products ORDER BY created_at DESC LIMIT 6"
    );
    const projectsRes = await db.pool.query(
      "SELECT * FROM main_site_projects ORDER BY capacity_kwp DESC LIMIT 6"
    );
    const branchesRes = await db.pool.query(
      "SELECT * FROM main_site_branches ORDER BY name ASC"
    );

    const companyAbout = overviewRes.rows[0] || null;
    const tips = tipsRes.rows;
    const news = newsRes.rows;
    const products = productsRes.rows;
    const projects = projectsRes.rows;
    const branches = branchesRes.rows;

    const localBusinesses = branches.map(b => {
      return {
        "@type": "SolarEnergyContractor",
        "@id": `${baseUrl}/#branch-${slugify(b.name, { lower: true, strict: true })}`,
        "name": `Eternalgy - ${b.name}`,
        "image": `${baseUrl}/logo.png`,
        "telephone": b.phone || "+601121000099",
        "email": b.email || "enquiry@eternalgy.me",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": b.address
        },
        "geo": b.latitude && b.longitude ? {
          "@type": "GeoCoordinates",
          "latitude": parseFloat(b.latitude),
          "longitude": parseFloat(b.longitude)
        } : undefined,
        "url": baseUrl
      };
    });

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${baseUrl}/#organization`,
          "name": "Eternalgy Sdn Bhd",
          "url": baseUrl,
          "logo": `${baseUrl}/logo.png`,
          "description": "Premium Engineering, Procurement, and Construction (EPC) firm for commercial and utility-scale solar PV.",
          "foundingDate": "2023-09-15",
          "numberOfEmployees": "60",
          "sameAs": [
            "https://eternalgy.com",
            "https://solarpanels.my",
            "https://solarpanels.onesync.my",
            "https://solar100.com.my"
          ]
        },
        {
          "@type": "WebSite",
          "@id": `${baseUrl}/#website`,
          "url": baseUrl,
          "name": "Eternalgy Solar PV EPC",
          "publisher": { "@id": `${baseUrl}/#organization` },
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@type": "Service",
          "@id": `${baseUrl}/#service-solar-epc`,
          "name": "Solar PV Engineering, Procurement, and Construction (EPC)",
          "serviceType": "Solar PV Installation & EPC",
          "provider": { "@id": `${baseUrl}/#organization` },
          "description": "Full-service engineering, licensing, authority submission, logistics, installation, and commissioning of commercial, industrial, and utility-scale solar PV systems in Malaysia.",
          "areaServed": {
            "@type": "Country",
            "name": "Malaysia"
          },
          "offers": {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Commercial & Industrial Solar PV Installation"
            }
          }
        },
        {
          "@type": "BreadcrumbList",
          "@id": `${baseUrl}/#breadcrumb`,
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": baseUrl
            }
          ]
        },
        ...localBusinesses
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ companyAbout, tips, news, products, projects, schemaData });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Eternalgy Solar PV EPC & News Hub\n\n`;
      markdownText += `## Company Overview\n${companyAbout ? companyAbout.content : 'Not seeded yet'}\n\n`;
      markdownText += `## Premium Solar Hardware Catalogue\n`;
      products.forEach(p => {
        markdownText += `* **[${p.name}](${baseUrl}/${p.slug})** - Brand: ${p.brand} - ${p.summary}\n`;
      });
      markdownText += `\n## Executed Solar PV Projects (Track Record)\n`;
      projects.forEach(pr => {
        markdownText += `* **[${pr.title}](${baseUrl}/${pr.slug})** - Capacity: ${pr.capacity_kwp} kWp | Location: ${pr.location}\n`;
      });
      markdownText += `\n## Latest Solar PV Tips & Calculations\n`;
      tips.forEach(t => {
        markdownText += `* [${t.title}](${baseUrl}/${t.slug}) - ${t.summary}\n`;
      });
      markdownText += `\n## Renewable Energy News\n`;
      news.forEach(n => {
        markdownText += `* [${n.title}](${baseUrl}/${n.slug}) - ${n.summary}\n`;
      });
      return res.send(markdownText);
    }

    res.render('index', {
      title: "Eternalgy | Solar PV EPC Company Malaysia – C&I Rooftop & O&M",
      companyAbout,
      tips,
      news,
      products,
      projects,
      schemaData,
      currentTab: 'home'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database connection error');
  }
});

// Route: News Listing
app.get('/news', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const dbRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE category = 'news' AND published = true ORDER BY COALESCE(published_at, created_at) DESC"
    );
    const news = dbRes.rows;

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${baseUrl}/news#webpage`,
          "name": "Renewable Energy News Portal",
          "description": "Chronological feed of global renewable energy and Solar PV news.",
          "url": `${baseUrl}/news`
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": baseUrl
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "News",
              "item": `${baseUrl}/news`
            }
          ]
        }
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ news });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Renewable Energy News Feed\n\n`;
      news.forEach(n => {
        markdownText += `## ${n.title}\n*Published: ${n.created_at} | Author: ${n.author}*\n\n${n.content}\n\n---\n\n`;
      });
      return res.send(markdownText);
    }

    res.render('news', { 
      news, 
      title: 'Renewable Energy News Portal', 
      meta_description: 'Read the latest updates, market trends, and policy releases in global renewable energy.', 
      schemaData, 
      currentTab: 'news' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Route: Tips Listing
app.get('/tips', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const dbRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE category = 'tip' AND published = true ORDER BY created_at DESC"
    );
    const tips = dbRes.rows;

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `${baseUrl}/tips#webpage`,
          "name": "Solar PV Technical Tips",
          "description": "Engineering tips, calculations, and standards for Solar PV installations.",
          "url": `${baseUrl}/tips`
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": baseUrl
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Solar Tips",
              "item": `${baseUrl}/tips`
            }
          ]
        }
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ tips });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Solar PV Engineering Tips & Guidelines\n\n`;
      tips.forEach(t => {
        markdownText += `## ${t.title}\n*Author: ${t.author}*\n\n${t.content}\n\n---\n\n`;
      });
      return res.send(markdownText);
    }

    res.render('tips', { 
      tips, 
      title: 'Solar PV Tips & Installation Guidelines', 
      meta_description: 'Technical engineering details, mounting parameters, and inverter calculation tips.', 
      schemaData, 
      currentTab: 'tips' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Route: Company Profile & EPC Services page
app.get('/about-solar-pv-epc-company', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const infoRes = await db.pool.query("SELECT * FROM main_site_company_info");
    const branchesRes = await db.pool.query("SELECT * FROM main_site_branches ORDER BY name ASC");
    const certsRes = await db.pool.query("SELECT * FROM main_site_certifications ORDER BY id ASC");

    const infoMap = {};
    infoRes.rows.forEach(r => {
      infoMap[r.key] = r;
    });

    const overview = infoMap['overview'] || null;
    const mission = infoMap['mission'] || null;
    const vision = infoMap['vision'] || null;
    const branches = branchesRes.rows;
    const certifications = certsRes.rows;

    const localBusinesses = branches.map(b => {
      return {
        "@type": "SolarEnergyContractor",
        "@id": `${baseUrl}/#branch-${slugify(b.name, { lower: true, strict: true })}`,
        "name": `Eternalgy - ${b.name}`,
        "image": `${baseUrl}/logo.png`,
        "telephone": b.phone || "+601121000099",
        "email": b.email || "enquiry@eternalgy.me",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": b.address
        },
        "geo": b.latitude && b.longitude ? {
          "@type": "GeoCoordinates",
          "latitude": parseFloat(b.latitude),
          "longitude": parseFloat(b.longitude)
        } : undefined,
        "url": baseUrl
      };
    });

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "AboutPage",
          "@id": `${baseUrl}/about-solar-pv-epc-company#webpage`,
          "name": "Eternalgy Company Profile & EPC Services",
          "description": "Learn about Eternalgy's engineering credentials, SEDA RPVI status, CIDB licensing, and office branch coordinates in Malaysia.",
          "url": `${baseUrl}/about-solar-pv-epc-company`
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": baseUrl
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "EPC Services",
              "item": `${baseUrl}/about-solar-pv-epc-company`
            }
          ]
        },
        ...localBusinesses
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ overview, mission, vision, branches, certifications, schemaData });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Eternalgy Corporate Profile & EPC Services\n\n`;
      markdownText += `## Company Overview\n${overview ? overview.content : 'No overview seeded.'}\n\n`;
      markdownText += `## Our Mission\n${mission ? mission.content : 'No mission seeded.'}\n\n`;
      markdownText += `## Our Vision\n${vision ? vision.content : 'No vision seeded.'}\n\n`;
      
      markdownText += `## Accreditations & Licenses\n`;
      certifications.forEach(c => {
        markdownText += `### ${c.name}\n* **Issued by:** ${c.body}\n* **License No:** ${c.license_number || 'N/A'}\n* **Valid until:** ${c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'N/A'}\n\n${c.summary || ''}\n\n`;
      });

      markdownText += `## Branch Network & Warehouses\n`;
      branches.forEach(b => {
        markdownText += `### ${b.name}\n* **Address:** ${b.address}\n* **Phone:** ${b.phone || 'N/A'}\n* **Email:** ${b.email || 'N/A'}\n* **Coordinates:** Latitude ${b.latitude}, Longitude ${b.longitude}\n\n`;
      });
      return res.send(markdownText);
    }

    res.render('epc', { 
      overview, 
      mission, 
      vision, 
      branches, 
      certifications, 
      title: 'Company Profile & EPC Services - Eternalgy', 
      meta_description: 'Seda Registered PV Investor & CIDB G3 licensed electrical engineer team, headquarted in Mount Austin Johor Bahru.', 
      schemaData, 
      currentTab: 'epc' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Route: FAQ Section (highly optimized for LLM/Search engines)
app.get('/faq', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_faqs ORDER BY category ASC, id ASC");
    const faqs = dbRes.rows;

    // Group FAQs by category
    const grouped = {
      financial: [],
      technical: [],
      structural: [],
      policy: []
    };
    faqs.forEach(f => {
      if (grouped[f.category]) {
        grouped[f.category].push(f);
      } else {
        grouped[f.category] = [f];
      }
    });

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "FAQPage",
          "@id": `${baseUrl}/faq#faq`,
          "mainEntity": faqs.map(f => ({
            "@type": "Question",
            "name": f.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": f.answer.replace(/[#*`\n]/g, ' ')
            }
          }))
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": baseUrl
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "FAQ",
              "item": `${baseUrl}/faq`
            }
          ]
        }
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ faqs, schemaData });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Solar PV Installation in Malaysia - Frequently Asked Questions (FAQ)\n\n`;
      markdownText += `This FAQ is designed to address the primary inquiries, policy shifts, and concerns of Malaysian solar consumers. Highly optimized for LLM retrievers.\n\n`;
      
      Object.entries(grouped).forEach(([cat, list]) => {
        if (list.length === 0) return;
        markdownText += `## Category: ${cat.toUpperCase()}\n\n`;
        list.forEach(f => {
          markdownText += `### Q: ${f.question}\n**A:**\n${f.answer}\n\n`;
        });
        markdownText += `---\n\n`;
      });
      return res.send(markdownText);
    }

    res.render('faq', { 
      grouped,
      title: 'Solar PV Installation FAQ - Malaysian Policies & Concerns', 
      meta_description: 'Frequently asked questions about solar PV installation in Malaysia, including Solar ATAP, SuRIA rebates, 3-phase upgrades, Monier roof warranties, and string inverters.', 
      schemaData, 
      currentTab: 'faq' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// Route: Search
app.get('/search', async (req, res) => {
  const query = req.query.q || '';
  const format = req.query.format;
  const baseUrl = getBaseUrl(req);

  try {
    const articlesSearch = db.pool.query(
      `SELECT * FROM main_site_articles 
       WHERE (title ILIKE $1 OR content ILIKE $1 OR tags ILIKE $1) AND published = true
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );
    const productsSearch = db.pool.query(
      `SELECT * FROM main_site_products 
       WHERE name ILIKE $1 OR summary ILIKE $1 OR description ILIKE $1 OR brand ILIKE $1
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );
    const projectsSearch = db.pool.query(
      `SELECT * FROM main_site_projects 
       WHERE title ILIKE $1 OR summary ILIKE $1 OR details ILIKE $1 OR location ILIKE $1
       ORDER BY created_at DESC`,
      [`%${query}%`]
    );

    const [articlesRes, productsRes, projectsRes] = await Promise.all([articlesSearch, productsSearch, projectsSearch]);
    const articles = articlesRes.rows;
    const products = productsRes.rows;
    const projects = projectsRes.rows;

    if (format === 'json') {
      return res.json({ query, results: { articles, products, projects } });
    } else if (format === 'raw' || format === 'md') {
      res.setHeader('Content-Type', 'text/plain');
      let markdownText = `# Search Results for: "${query}"\n\n`;
      
      markdownText += `## Matching Articles / Technical Guidelines (${articles.length})\n`;
      articles.forEach(r => {
        markdownText += `* [${r.title}](${baseUrl}/${r.slug}) - ${r.summary}\n`;
      });
      
      markdownText += `\n## Matching Products / Catalog (${products.length})\n`;
      products.forEach(p => {
        markdownText += `* [${p.name}](${baseUrl}/${p.slug}) - Brand: ${p.brand} | ${p.summary}\n`;
      });
      
      markdownText += `\n## Matching Executed Projects (${projects.length})\n`;
      projects.forEach(pr => {
        markdownText += `* [${pr.title}](${baseUrl}/${pr.slug}) - Location: ${pr.location} | Capacity: ${pr.capacity_kwp} kWp\n`;
      });
      return res.send(markdownText);
    }

    res.render('tips', { 
      tips: articles.filter(r => r.category === 'tip'),
      news: articles.filter(r => r.category === 'news'),
      products,
      projects,
      title: `Search Results for "${query}" - Solar PV EPC`,
      meta_description: `Search results matching ${query} inside Solar EPC tips, news, products and track record.`,
      schemaData: null,
      currentTab: 'tips',
      noindex: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Search service failure');
  }
});

// Route: Dynamic robots.txt
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  const baseUrl = getBaseUrl(req);
  const robots = `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: *
Allow: /

# AI Crawlers Treasure Map
All-llms: ${baseUrl}/llms.txt

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap-news.xml
`;
  res.send(robots);
});

// Route: Dynamic Sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const articlesPromise = db.pool.query("SELECT category, slug, updated_at FROM main_site_articles WHERE published = true");
    const productsPromise = db.pool.query("SELECT slug, updated_at FROM main_site_products");
    const projectsPromise = db.pool.query("SELECT slug, updated_at FROM main_site_projects");
    const faqsPromise = db.pool.query("SELECT updated_at FROM main_site_faqs");

    const [articlesRes, productsRes, projectsRes, faqsRes] = await Promise.all([
      articlesPromise, productsPromise, projectsPromise, faqsPromise
    ]);

    const articles = articlesRes.rows;
    const products = productsRes.rows;
    const projects = projectsRes.rows;
    const faqs = faqsRes.rows;

    const newsDates = articles.filter(a => a.category === 'news').map(a => new Date(a.updated_at).getTime());
    const tipsDates = articles.filter(a => a.category === 'tip').map(a => new Date(a.updated_at).getTime());
    const productDates = products.map(p => new Date(p.updated_at).getTime());
    const projectDates = projects.map(p => new Date(p.updated_at).getTime());
    const faqDates = faqs.map(f => new Date(f.updated_at).getTime());

    const maxNewsDate = newsDates.length ? new Date(Math.max(...newsDates)) : new Date();
    const maxTipsDate = tipsDates.length ? new Date(Math.max(...tipsDates)) : new Date();
    const maxProductDate = productDates.length ? new Date(Math.max(...productDates)) : new Date();
    const maxProjectDate = projectDates.length ? new Date(Math.max(...projectDates)) : new Date();
    const maxFaqDate = faqDates.length ? new Date(Math.max(...faqDates)) : new Date();

    const maxOverallDate = new Date(Math.max(
      maxNewsDate.getTime(),
      maxTipsDate.getTime(),
      maxProductDate.getTime(),
      maxProjectDate.getTime(),
      maxFaqDate.getTime()
    ));

    const pathDates = {
      '': maxOverallDate,
      '/news': maxNewsDate,
      '/tips': maxTipsDate,
      '/about-solar-pv-epc-company': maxOverallDate,
      '/faq': maxFaqDate
    };

    res.setHeader('Content-Type', 'application/xml');
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // Add static paths
    const staticPaths = ['', '/news', '/tips', '/about-solar-pv-epc-company', '/faq'];
    staticPaths.forEach(p => {
      const dateVal = pathDates[p] || maxOverallDate;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${p}</loc>\n`;
      xml += `    <lastmod>${dateVal.toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${p === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Add articles
    articles.forEach(art => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${art.slug}</loc>\n`;
      xml += `    <lastmod>${new Date(art.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    });

    // Add products
    products.forEach(prod => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${prod.slug}</loc>\n`;
      xml += `    <lastmod>${new Date(prod.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    });

    // Add projects
    projects.forEach(proj => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${proj.slug}</loc>\n`;
      xml += `    <lastmod>${new Date(proj.updated_at).toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Sitemap generation error');
  }
});

// Route: RSS Feed.xml
app.get('/feed.xml', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const dbRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE published = true ORDER BY COALESCE(published_at, created_at) DESC LIMIT 30"
    );
    const feedItems = dbRes.rows;

    res.setHeader('Content-Type', 'application/xml');
    
    let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
    xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
    xml += `<channel>\n`;
    xml += `  <title>Eternalgy Renewable Energy & Solar PV News Portal</title>\n`;
    xml += `  <link>${baseUrl}</link>\n`;
    xml += `  <description>Technical tips, company updates, and news on global solar and renewable energy systems.</description>\n`;
    xml += `  <language>en-us</language>\n`;
    xml += `  <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />\n`;
    
    feedItems.forEach(item => {
      xml += `  <item>\n`;
      xml += `    <title><![CDATA[${item.title}]]></title>\n`;
      xml += `    <link>${baseUrl}/${item.slug}</link>\n`;
      xml += `    <guid>${baseUrl}/${item.slug}</guid>\n`;
      xml += `    <pubDate>${new Date(item.published_at || item.created_at).toUTCString()}</pubDate>\n`;
      xml += `    <description><![CDATA[${item.summary}]]></description>\n`;
      xml += `  </item>\n`;
    });

    xml += `</channel>\n`;
    xml += `</rss>`;
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('RSS generation error');
  }
});

// Route: Feed.json
app.get('/feed.json', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const dbRes = await db.pool.query(
      "SELECT * FROM main_site_articles WHERE published = true ORDER BY COALESCE(published_at, created_at) DESC LIMIT 30"
    );
    const feedItems = dbRes.rows;

    res.setHeader('Content-Type', 'application/json');
    
    const jsonFeed = {
      version: "https://jsonfeed.org/version/1.1",
      title: "Eternalgy Renewable Energy & Solar PV News Portal",
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/feed.json`,
      description: "Technical tips, company updates, and news on global solar and renewable energy systems.",
      items: feedItems.map(item => ({
        id: `${baseUrl}/${item.slug}`,
        url: `${baseUrl}/${item.slug}`,
        title: item.title,
        summary: item.summary,
        content_html: item.html_content,
        content_text: item.content,
        date_published: new Date(item.published_at || item.created_at).toISOString(),
        authors: [{ name: item.author }]
      }))
    };

    res.json(jsonFeed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'JSON Feed generation error' });
  }
});


// ==========================================
// 🛡️ SECURE CRUD API FOR AI MAINTENANCE AGENT
// ==========================================

// 1. Articles API (News & Tips)
app.get('/api/articles', authenticateApiKey, async (req, res) => {
  try {
    const { category } = req.query;
    let query = "SELECT * FROM main_site_articles ORDER BY created_at DESC";
    let values = [];
    if (category) {
      query = "SELECT * FROM main_site_articles WHERE category = $1 ORDER BY created_at DESC";
      values = [category];
    }
    const dbRes = await db.pool.query(query, values);
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/articles/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_articles WHERE slug = $1", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/articles', authenticateApiKey, async (req, res) => {
  const { title, category, summary, content, author, tags, meta_description, slug, published, source_url, source_name, published_at, marketing_line, marketing_line_cn } = req.body;
  if (!title || !category || !content) {
    return res.status(400).json({ error: 'title, category, and content are required' });
  }
  if (!['tip', 'news'].includes(category)) {
    return res.status(400).json({ error: 'category must be news or tip' });
  }

  try {
    const result = await upsertArticle({
      title, category, summary, content, author, tags,
      meta_description, slug, published, source_url, source_name, published_at, marketing_line, marketing_line_cn
    });
    res.status(200).json({
      success: true,
      action: result.action,
      duplicate: result.action === 'skipped_duplicate',
      data: result.data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// News dedup ledger: what the agent has already covered.
// The agent polls this BEFORE searching, builds a Set of source_urls,
// and skips any candidate whose URL is already present.
app.get('/api/news/seen', authenticateApiKey, async (req, res) => {
  try {
    const sinceParam = req.query.since; // optional ISO date, e.g. 2025-06-01
    let query = `
      SELECT slug, title, source_url, source_name, published_at, created_at
      FROM main_site_articles
      WHERE category = 'news' AND source_url IS NOT NULL`;
    const values = [];
    if (sinceParam) {
      values.push(sinceParam);
      query += ` AND COALESCE(published_at, created_at) >= $1`;
    }
    query += ` ORDER BY COALESCE(published_at, created_at) DESC`;
    const dbRes = await db.pool.query(query, values);
    res.json({
      count: dbRes.rows.length,
      source_urls: dbRes.rows.map(r => r.source_url),
      seen: dbRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/articles/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_articles WHERE slug = $1 RETURNING *", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ success: true, message: 'Article deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Company Info API
app.get('/api/company-info', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_company_info ORDER BY key ASC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/company-info/:key', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_company_info WHERE key = $1", [req.params.key]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Key not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/company-info', authenticateApiKey, async (req, res) => {
  const { key, title, content } = req.body;
  if (!key || !title || !content) {
    return res.status(400).json({ error: 'key, title, and content are required' });
  }

  const htmlContent = marked.parse(content);

  try {
    const query = `
      INSERT INTO main_site_company_info (key, title, content, html_content, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (key) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        html_content = EXCLUDED.html_content,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const dbRes = await db.pool.query(query, [key, title, content, htmlContent]);
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/company-info/:key', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_company_info WHERE key = $1 RETURNING *", [req.params.key]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Key not found' });
    res.json({ success: true, message: 'Company info key deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Products API
app.get('/api/products', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_products ORDER BY name ASC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_products WHERE slug = $1", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', authenticateApiKey, async (req, res) => {
  const { name, brand, type, summary, specifications, description, slug } = req.body;
  if (!name || !brand || !type || !summary || !specifications || !description) {
    return res.status(400).json({ error: 'name, brand, type, summary, specifications, and description are required' });
  }
  if (!['panel', 'inverter', 'battery', 'accessory'].includes(type)) {
    return res.status(400).json({ error: 'type must be panel, inverter, battery, or accessory' });
  }

  const finalSlug = slug || slugify(name, { lower: true, strict: true });
  const htmlDescription = marked.parse(description);
  const specsJson = typeof specifications === 'string' ? specifications : JSON.stringify(specifications);

  try {
    const query = `
      INSERT INTO main_site_products (slug, name, brand, type, summary, specifications, description, html_description, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        brand = EXCLUDED.brand,
        type = EXCLUDED.type,
        summary = EXCLUDED.summary,
        specifications = EXCLUDED.specifications,
        description = EXCLUDED.description,
        html_description = EXCLUDED.html_description,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [finalSlug, name, brand, type, summary, specsJson, description, htmlDescription];
    const dbRes = await db.pool.query(query, values);
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_products WHERE slug = $1 RETURNING *", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Projects API (Track Record Case Studies)
app.get('/api/projects', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_projects ORDER BY capacity_kwp DESC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_projects WHERE slug = $1", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateApiKey, async (req, res) => {
  const { title, client_name, capacity_kwp, location, commission_date, summary, details, slug } = req.body;
  if (!title || !capacity_kwp || !location || !summary || !details) {
    return res.status(400).json({ error: 'title, capacity_kwp, location, summary, and details are required' });
  }

  const finalSlug = slug || slugify(title, { lower: true, strict: true });
  const htmlDetails = marked.parse(details);
  const commDate = commission_date || null;

  try {
    const query = `
      INSERT INTO main_site_projects (slug, title, client_name, capacity_kwp, location, commission_date, summary, details, html_details, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (slug) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        client_name = EXCLUDED.client_name,
        capacity_kwp = EXCLUDED.capacity_kwp,
        location = EXCLUDED.location,
        commission_date = EXCLUDED.commission_date,
        summary = EXCLUDED.summary,
        details = EXCLUDED.details,
        html_details = EXCLUDED.html_details,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [finalSlug, title, client_name || '', capacity_kwp, location, commDate, summary, details, htmlDetails];
    const dbRes = await db.pool.query(query, values);
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:slug', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_projects WHERE slug = $1 RETURNING *", [req.params.slug]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, message: 'Project deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Branches API
app.get('/api/branches', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_branches ORDER BY name ASC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/branches/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_branches WHERE id = $1", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/branches', authenticateApiKey, async (req, res) => {
  const { id, name, address, phone, email, latitude, longitude } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'name and address are required' });
  }

  const lat = latitude || null;
  const lon = longitude || null;

  try {
    let dbRes;
    if (id) {
      const query = `
        UPDATE main_site_branches 
        SET name = $1, address = $2, phone = $3, email = $4, latitude = $5, longitude = $6
        WHERE id = $7 RETURNING *;
      `;
      dbRes = await db.pool.query(query, [name, address, phone || '', email || '', lat, lon, id]);
    } else {
      const checkRes = await db.pool.query("SELECT id FROM main_site_branches WHERE name = $1", [name]);
      if (checkRes.rows.length > 0) {
        const query = `
          UPDATE main_site_branches 
          SET address = $1, phone = $2, email = $3, latitude = $4, longitude = $5
          WHERE name = $6 RETURNING *;
        `;
        dbRes = await db.pool.query(query, [address, phone || '', email || '', lat, lon, name]);
      } else {
        const query = `
          INSERT INTO main_site_branches (name, address, phone, email, latitude, longitude)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
        `;
        dbRes = await db.pool.query(query, [name, address, phone || '', email || '', lat, lon]);
      }
    }
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/branches/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_branches WHERE id = $1 RETURNING *", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json({ success: true, message: 'Branch deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Certifications API
app.get('/api/certifications', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_certifications ORDER BY id ASC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/certifications/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_certifications WHERE id = $1", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Certification not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/certifications', authenticateApiKey, async (req, res) => {
  const { id, name, body, license_number, valid_until, summary } = req.body;
  if (!name || !body) {
    return res.status(400).json({ error: 'name and body are required' });
  }

  const vUntil = valid_until || null;

  try {
    let dbRes;
    if (id) {
      const query = `
        UPDATE main_site_certifications 
        SET name = $1, body = $2, license_number = $3, valid_until = $4, summary = $5
        WHERE id = $6 RETURNING *;
      `;
      dbRes = await db.pool.query(query, [name, body, license_number || '', vUntil, summary || '', id]);
    } else {
      const checkRes = await db.pool.query("SELECT id FROM main_site_certifications WHERE name = $1", [name]);
      if (checkRes.rows.length > 0) {
        const query = `
          UPDATE main_site_certifications 
          SET body = $1, license_number = $2, valid_until = $3, summary = $4
          WHERE name = $5 RETURNING *;
        `;
        dbRes = await db.pool.query(query, [body, license_number || '', vUntil, summary || '', name]);
      } else {
        const query = `
          INSERT INTO main_site_certifications (name, body, license_number, valid_until, summary)
          VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        dbRes = await db.pool.query(query, [name, body, license_number || '', vUntil, summary || '']);
      }
    }
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/certifications/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_certifications WHERE id = $1 RETURNING *", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Certification not found' });
    res.json({ success: true, message: 'Certification deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. FAQs API
app.get('/api/faqs', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_faqs ORDER BY id ASC");
    res.json(dbRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/faqs/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("SELECT * FROM main_site_faqs WHERE id = $1", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'FAQ not found' });
    res.json(dbRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/faqs', authenticateApiKey, async (req, res) => {
  const { id, question, answer, category } = req.body;
  if (!question || !answer || !category) {
    return res.status(400).json({ error: 'question, answer, and category are required' });
  }
  if (!['policy', 'technical', 'financial', 'structural'].includes(category)) {
    return res.status(400).json({ error: 'category must be policy, technical, financial, or structural' });
  }

  const htmlAnswer = marked.parse(answer);

  try {
    let dbRes;
    if (id) {
      const query = `
        UPDATE main_site_faqs 
        SET question = $1, answer = $2, html_answer = $3, category = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 RETURNING *;
      `;
      dbRes = await db.pool.query(query, [question, answer, htmlAnswer, category, id]);
    } else {
      const checkRes = await db.pool.query("SELECT id FROM main_site_faqs WHERE question = $1", [question]);
      if (checkRes.rows.length > 0) {
        const query = `
          UPDATE main_site_faqs 
          SET answer = $1, html_answer = $2, category = $3, updated_at = CURRENT_TIMESTAMP
          WHERE question = $4 RETURNING *;
        `;
        dbRes = await db.pool.query(query, [answer, htmlAnswer, category, question]);
      } else {
        const query = `
          INSERT INTO main_site_faqs (question, answer, html_answer, category)
          VALUES ($1, $2, $3, $4) RETURNING *;
        `;
        dbRes = await db.pool.query(query, [question, answer, htmlAnswer, category]);
      }
    }
    res.status(200).json({ success: true, data: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/faqs/:id', authenticateApiKey, async (req, res) => {
  try {
    const dbRes = await db.pool.query("DELETE FROM main_site_faqs WHERE id = $1 RETURNING *", [req.params.id]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'FAQ not found' });
    res.json({ success: true, message: 'FAQ deleted', deleted: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Legacy Mapping API Endpoint
app.post('/api/content', authenticateApiKey, async (req, res) => {
  const { title, category, summary, content, author, tags, meta_description, slug: customSlug, source_url, source_name, published_at, marketing_line, marketing_line_cn } = req.body;

  if (!title || !category || !content) {
    return res.status(400).json({ error: 'title, category, and content are required' });
  }

  if (!['tip', 'news', 'company'].includes(category)) {
    return res.status(400).json({ error: 'category must be tip, news, or company' });
  }

  const finalSlug = customSlug || slugify(title, { lower: true, strict: true });
  const htmlContent = marked.parse(content);
  const finalSummary = summary || content.replace(/[#*`\n]/g, ' ').substring(0, 160);
  const finalMeta = meta_description || finalSummary.substring(0, 150);

  try {
    if (category === 'company') {
      const key = finalSlug === 'about-solar-pv-epc-company' ? 'overview' : finalSlug;
      const query = `
        INSERT INTO main_site_company_info (key, title, content, html_content, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (key) 
        DO UPDATE SET 
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          html_content = EXCLUDED.html_content,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;
      const dbRes = await db.pool.query(query, [key, title, content, htmlContent]);
      return res.status(200).json({
        success: true,
        message: 'Company info upserted successfully via legacy API mapping',
        data: dbRes.rows[0]
      });
    } else {
      const result = await upsertArticle({
        title, category, summary, content, author, tags,
        meta_description, slug: customSlug, source_url, source_name, published_at, marketing_line, marketing_line_cn
      });
      return res.status(200).json({
        success: true,
        action: result.action,
        duplicate: result.action === 'skipped_duplicate',
        message: result.action === 'skipped_duplicate'
          ? 'Duplicate source_url — already covered, skipped'
          : 'Article upserted successfully via legacy API mapping',
        data: result.data
      });
    }
  } catch (err) {
    console.error('Error in legacy API content upsert:', err);
    return res.status(500).json({ error: 'Database error', details: err.message });
  }
});


// Route: Dynamic LLM Index Map (llms.txt spec)
app.get('/llms.txt', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const baseUrl = getBaseUrl(req);

  try {
    const tipsPromise = db.pool.query(
      "SELECT slug, title, summary FROM main_site_articles WHERE category = 'tip' AND published = true ORDER BY created_at DESC"
    );
    const newsPromise = db.pool.query(
      "SELECT slug, title, summary FROM main_site_articles WHERE category = 'news' AND published = true ORDER BY COALESCE(published_at, created_at) DESC LIMIT 20"
    );
    const productsPromise = db.pool.query(
      "SELECT slug, name, summary FROM main_site_products ORDER BY name ASC"
    );
    const projectsPromise = db.pool.query(
      "SELECT slug, title, summary FROM main_site_projects ORDER BY capacity_kwp DESC"
    );

    const [tipsRes, newsRes, productsRes, projectsRes] = await Promise.all([
      tipsPromise, newsPromise, productsPromise, projectsPromise
    ]);

    let md = `# Eternalgy Sdn Bhd - Solar PV EPC & News Hub\n\n`;
    md += `> A premier Engineering, Procurement, and Construction (EPC) firm and SEDA Registered PV Investor (RPVI) specializing in commercial rooftop and utility-scale solar PV installations in Malaysia.\n\n`;
    
    md += `## Main Pages\n`;
    md += `- [Home](${baseUrl}/): Corporate landing page detailing track records, offices, and services.\n`;
    md += `- [EPC Services](${baseUrl}/about-solar-pv-epc-company): Corporate profile, CIDB licensing, office locations, and branches.\n`;
    md += `- [FAQ](${baseUrl}/faq): Frequently Asked Questions concerning net-metering policies (Solar ATAP), Monier roof warranties, 3-phase upgrades, and cost calculations.\n`;
    md += `- [Visitor Analysis](${baseUrl}/visitor-analysis): Real-time analysis dashboard of AI bot crawlers and search index traffic telemetry.\n\n`;

    md += `## Solar PV Engineering Guidelines & Tips\n`;
    if (tipsRes.rows.length > 0) {
      tipsRes.rows.forEach(t => {
        md += `- [${t.title}](${baseUrl}/${t.slug}): ${t.summary}\n`;
      });
    } else {
      md += `*No guidelines posted yet.*\n`;
    }
    md += `\n`;

    md += `## Renewable Energy & Industry News\n`;
    if (newsRes.rows.length > 0) {
      newsRes.rows.forEach(n => {
        md += `- [${n.title}](${baseUrl}/${n.slug}): ${n.summary}\n`;
      });
    } else {
      md += `*No news items posted yet.*\n`;
    }
    md += `\n`;

    md += `## Premium Solar Hardware Catalog\n`;
    if (productsRes.rows.length > 0) {
      productsRes.rows.forEach(p => {
        md += `- [${p.name}](${baseUrl}/${p.slug}): ${p.summary}\n`;
      });
    } else {
      md += `*No hardware items listed.*\n`;
    }
    md += `\n`;

    md += `## Executed Solar PV Case Studies\n`;
    if (projectsRes.rows.length > 0) {
      projectsRes.rows.forEach(pr => {
        md += `- [${pr.title}](${baseUrl}/${pr.slug}): ${pr.summary}\n`;
      });
    } else {
      md += `*No executed projects listed.*\n`;
    }
    md += `\n`;

    res.send(md);
  } catch (err) {
    console.error('Failed to generate llms.txt:', err);
    res.status(500).send('Error generating llms.txt');
  }
});


// Route: Full Knowledge Base Dump (llms-full.txt companion)
app.get('/llms-full.txt', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const baseUrl = getBaseUrl(req);

  try {
    const infoPromise = db.pool.query("SELECT * FROM main_site_company_info");
    const faqsPromise = db.pool.query("SELECT * FROM main_site_faqs ORDER BY category ASC, id ASC");
    const productsPromise = db.pool.query("SELECT * FROM main_site_products ORDER BY name ASC");
    const projectsPromise = db.pool.query("SELECT * FROM main_site_projects ORDER BY capacity_kwp DESC");
    const tipsPromise = db.pool.query("SELECT * FROM main_site_articles WHERE category = 'tip' AND published = true ORDER BY created_at DESC");
    const newsPromise = db.pool.query("SELECT * FROM main_site_articles WHERE category = 'news' AND published = true ORDER BY COALESCE(published_at, created_at) DESC LIMIT 20");

    const [infoRes, faqsRes, productsRes, projectsRes, tipsRes, newsRes] = await Promise.all([
      infoPromise, faqsPromise, productsPromise, projectsPromise, tipsPromise, newsPromise
    ]);

    let md = `# Eternalgy Sdn Bhd - Full Site Knowledge Base\n\n`;
    md += `This document contains the entire structured content of Eternalgy's website. Optimized for offline ingestion and training data for AI agents.\n\n`;

    // 1. Corporate Profile
    md += `# Section 1: Corporate Profile & Services\n\n`;
    infoRes.rows.forEach(info => {
      md += `## ${info.title}\n\n${info.content}\n\n`;
    });
    md += `---\n\n`;

    // 2. FAQs
    md += `# Section 2: FAQ - Policies & Structural Questions\n\n`;
    faqsRes.rows.forEach(faq => {
      md += `### Q: ${faq.question}\n**Category**: ${faq.category}\n\n**A**:\n${faq.answer}\n\n`;
    });
    md += `---\n\n`;

    // 3. Hardware Catalog
    md += `# Section 3: Premium Solar Hardware Catalog\n\n`;
    productsRes.rows.forEach(p => {
      md += `## Product: ${p.name} (${p.brand})\n`;
      md += `*Type*: ${p.type} | *Summary*: ${p.summary}\n\n`;
      
      const specs = typeof p.specifications === 'string' ? JSON.parse(p.specifications) : p.specifications;
      md += `### Specifications:\n`;
      Object.entries(specs).forEach(([k, v]) => {
        md += `- **${k.replace(/_/g, ' ').toUpperCase()}**: ${v}\n`;
      });
      md += `\n### Detailed Description:\n${p.description}\n\n`;
    });
    md += `---\n\n`;

    // 4. Executed Projects
    md += `# Section 4: Executed Solar PV Projects\n\n`;
    projectsRes.rows.forEach(pr => {
      md += `## Project: ${pr.title}\n`;
      md += `*Location*: ${pr.location} | *Capacity*: ${pr.capacity_kwp} kWp | *Client*: ${pr.client_name}\n`;
      md += `*Commission Date*: ${pr.commission_date ? new Date(pr.commission_date).toLocaleDateString() : 'N/A'}\n\n`;
      md += `### Summary:\n${pr.summary}\n\n`;
      md += `### Engineering Details:\n${pr.details}\n\n`;
    });
    md += `---\n\n`;

    // 5. Technical Tips
    md += `# Section 5: Technical Solar Guidelines & Tips\n\n`;
    tipsRes.rows.forEach(t => {
      md += `## Guideline: ${t.title}\n`;
      md += `*Author*: ${t.author} | *Published*: ${new Date(t.created_at).toLocaleDateString()}\n\n`;
      md += `${t.content}\n\n`;
    });
    md += `---\n\n`;

    // 6. News
    md += `# Section 6: Renewable Energy News Portal (Recent Articles)\n\n`;
    newsRes.rows.forEach(n => {
      md += `## News: ${n.title}\n`;
      md += `*Author*: ${n.author} | *Published*: ${new Date(n.created_at).toLocaleDateString()}\n`;
      if (n.source_name) {
        md += `*Source*: ${n.source_name} [Link](${n.source_url})\n`;
      }
      md += `\n${n.content}\n\n`;
    });

    res.send(md);
  } catch (err) {
    console.error('Failed to generate llms-full.txt:', err);
    res.status(500).send('Error generating llms-full.txt');
  }
});


// Helper: XML Escape utility
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// Route: Dynamic Google News Sitemap (sitemap-news.xml)
app.get('/sitemap-news.xml', async (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  const baseUrl = getBaseUrl(req);

  try {
    // Google News sitemaps strictly require articles published within the last 48 hours.
    let newsRes = await db.pool.query(
      `SELECT slug, title, created_at, published_at 
       FROM main_site_articles 
       WHERE category = 'news' AND published = true 
         AND COALESCE(published_at, created_at) >= NOW() - INTERVAL '48 hours'
       ORDER BY COALESCE(published_at, created_at) DESC`
    );

    // Fallback: If no articles are in the 48h window, serve the 3 most recent articles so sitemap is not empty
    if (newsRes.rows.length === 0) {
      newsRes = await db.pool.query(
        `SELECT slug, title, created_at, published_at 
         FROM main_site_articles 
         WHERE category = 'news' AND published = true 
         ORDER BY COALESCE(published_at, created_at) DESC 
         LIMIT 3`
      );
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

    newsRes.rows.forEach(art => {
      const pubDate = new Date(art.published_at || art.created_at).toISOString();
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/${art.slug}</loc>\n`;
      xml += `    <news:news>\n`;
      xml += `      <news:publication>\n`;
      xml += `        <news:name>Eternalgy Renewable Energy News</news:name>\n`;
      xml += `        <news:language>en</news:language>\n`;
      xml += `      </news:publication>\n`;
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title>${escapeXml(art.title)}</news:title>\n`;
      xml += `    </news:news>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;
    res.send(xml);
  } catch (err) {
    console.error('Failed to generate sitemap-news.xml:', err);
    res.status(500).send('Error generating Google News sitemap');
  }
});


// Route: Visitor Analysis Dashboard
app.get('/visitor-analysis', async (req, res) => {
  const timeframe = req.query.timeframe || '24h';
  
  let timeframeCondition = '';
  if (timeframe === '24h') {
    timeframeCondition = "visited_at >= NOW() - INTERVAL '24 hours'";
  } else if (timeframe === '7d') {
    timeframeCondition = "visited_at >= NOW() - INTERVAL '7 days'";
  } else if (timeframe === '30d') {
    timeframeCondition = "visited_at >= NOW() - INTERVAL '30 days'";
  } else {
    timeframeCondition = "1=1"; // All time
  }

  try {
    // 1. Fetch Summary Stats
    const statsQuery = `
      SELECT 
        COUNT(*)::int as total_hits,
        COUNT(DISTINCT ip_address)::int as unique_ips,
        COALESCE(SUM(CASE WHEN visitor_type = 'human' THEN 1 ELSE 0 END), 0)::int as human_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'ai_crawler' THEN 1 ELSE 0 END), 0)::int as ai_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'seo_crawler' THEN 1 ELSE 0 END), 0)::int as seo_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'other_bot' THEN 1 ELSE 0 END), 0)::int as other_hits
      FROM main_site_visitor_logs
      WHERE ${timeframeCondition}
    `;
    const statsRes = await db.pool.query(statsQuery);
    const summary = statsRes.rows[0] || { total_hits: 0, unique_ips: 0, human_hits: 0, ai_hits: 0, seo_hits: 0, other_hits: 0 };

    // 2. Fetch Timeline Data for Chart
    const truncPeriod = timeframe === '24h' ? 'hour' : 'day';
    const timelineQuery = `
      SELECT 
        DATE_TRUNC('${truncPeriod}', visited_at) as period,
        COALESCE(SUM(CASE WHEN visitor_type = 'human' THEN 1 ELSE 0 END), 0)::int as human,
        COALESCE(SUM(CASE WHEN visitor_type = 'ai_crawler' THEN 1 ELSE 0 END), 0)::int as ai,
        COALESCE(SUM(CASE WHEN visitor_type = 'seo_crawler' THEN 1 ELSE 0 END), 0)::int as seo,
        COALESCE(SUM(CASE WHEN visitor_type = 'other_bot' THEN 1 ELSE 0 END), 0)::int as other,
        COUNT(*)::int as total
      FROM main_site_visitor_logs
      WHERE ${timeframeCondition}
      GROUP BY period
      ORDER BY period ASC
    `;
    const timelineRes = await db.pool.query(timelineQuery);
    const timeline = timelineRes.rows;

    // 3. Fetch Top LLM bots
    const aiBotsQuery = `
      SELECT bot_name, COUNT(*)::int as count 
      FROM main_site_visitor_logs 
      WHERE visitor_type = 'ai_crawler' AND bot_name IS NOT NULL AND ${timeframeCondition}
      GROUP BY bot_name 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const aiBotsRes = await db.pool.query(aiBotsQuery);
    const aiBots = aiBotsRes.rows;

    // 4. Fetch Top SEO Crawlers
    const seoBotsQuery = `
      SELECT bot_name, COUNT(*)::int as count 
      FROM main_site_visitor_logs 
      WHERE visitor_type = 'seo_crawler' AND bot_name IS NOT NULL AND ${timeframeCondition}
      GROUP BY bot_name 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const seoBotsRes = await db.pool.query(seoBotsQuery);
    const seoBots = seoBotsRes.rows;

    // 5. Fetch Top Pages
    const pagesQuery = `
      SELECT url, 
        COUNT(*)::int as total_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'human' THEN 1 ELSE 0 END), 0)::int as human_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'ai_crawler' THEN 1 ELSE 0 END), 0)::int as ai_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'seo_crawler' THEN 1 ELSE 0 END), 0)::int as seo_hits,
        COALESCE(SUM(CASE WHEN visitor_type = 'other_bot' THEN 1 ELSE 0 END), 0)::int as other_hits
      FROM main_site_visitor_logs 
      WHERE ${timeframeCondition} 
      GROUP BY url 
      ORDER BY total_hits DESC 
      LIMIT 15
    `;
    const pagesRes = await db.pool.query(pagesQuery);
    const topPages = pagesRes.rows;

    // 6. Recent Logs
    const recentLogsQuery = `
      SELECT visited_at, ip_address, user_agent, url, referer, method, status_code, device_type, visitor_type, bot_name, execution_time_ms 
      FROM main_site_visitor_logs 
      ORDER BY visited_at DESC 
      LIMIT 50
    `;
    const recentLogsRes = await db.pool.query(recentLogsQuery);
    const recentLogs = recentLogsRes.rows;

    // Format timeline labels for Chart.js
    const timelineLabels = timeline.map(r => {
      const d = new Date(r.period);
      if (timeframe === '24h') {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    });

    const format = req.query.format;
    if (format === 'json') {
      return res.json({ timeframe, summary, timeline, aiBots, seoBots, topPages, recentLogs });
    }

    res.render('visitor-analysis', {
      timeframe,
      summary,
      timeline,
      timelineLabels,
      aiBots,
      seoBots,
      topPages,
      recentLogs,
      title: 'Visitor Analysis & Bot Traffic Dashboard - Eternalgy',
      meta_description: 'Real-time monitoring and analytics of human users, search engine spiders, and LLM AI training bot traffic.',
      schemaData: null,
      currentTab: 'analytics'
    });
  } catch (err) {
    console.error('Visitor analysis database query failed:', err);
    res.status(500).send('Failed to fetch visitor analytics data');
  }
});

// Redirect underscore path to correct hyphenated path
app.get('/visitor_analysis', (req, res) => {
  res.redirect(301, '/visitor-analysis');
});


// ==========================================
// 🔗 DYNAMIC ROUTING & CATCH-ALL ROUTE
// ==========================================

// Catch-all for slug-based lookups
app.get('/:slug', async (req, res, next) => {
  const { slug } = req.params;
  const baseUrl = getBaseUrl(req);

  // Protect system routes
  const systemRoutes = ['news', 'tips', 'about-solar-pv-epc-company', 'search', 'robots.txt', 'sitemap.xml', 'feed.xml', 'feed.json', 'api', 'faq', 'visitor-analysis', 'visitor_analysis', 'llms.txt', 'llms-full.txt', 'sitemap-news.xml'];
  if (systemRoutes.includes(slug.split('/')[0])) {
    return next();
  }

  try {
    const articlePromise = db.pool.query("SELECT * FROM main_site_articles WHERE slug = $1", [slug]);
    const productPromise = db.pool.query("SELECT * FROM main_site_products WHERE slug = $1", [slug]);
    const projectPromise = db.pool.query("SELECT * FROM main_site_projects WHERE slug = $1", [slug]);

    const [articleRes, productRes, projectRes] = await Promise.all([articlePromise, productPromise, projectPromise]);

    const format = req.query.format;

    // 1. Resolve Article
    if (articleRes.rows.length > 0) {
      const article = articleRes.rows[0];
      const schemaData = getSchemaData(article, 'article', baseUrl);

      if (format === 'json') {
        return res.json({ article, schemaData });
      } else if (format === 'raw' || format === 'md') {
        res.setHeader('Content-Type', 'text/plain');
        let markdownText = `# ${article.title}\n`;
        markdownText += `*Author: ${article.author} | Category: ${article.category} | Published: ${article.created_at}*\n\n`;
        markdownText += `${article.content}`;
        return res.send(markdownText);
      }

      const currentTab = article.category === 'news' ? 'news' : 'tips';
      return res.render('article', { 
        article, 
        title: article.title, 
        meta_description: article.meta_description, 
        tags: article.tags, 
        schemaData, 
        currentTab,
        noindex: article.noindex,
        ogType: 'article',
        ogImage: baseUrl + '/logo.png'
      });
    }

    // 2. Resolve Product
    if (productRes.rows.length > 0) {
      const product = productRes.rows[0];
      const schemaData = getSchemaData(product, 'product', baseUrl);

      const specs = typeof product.specifications === 'string' ? JSON.parse(product.specifications) : product.specifications;

      if (format === 'json') {
        return res.json({ product, schemaData });
      } else if (format === 'raw' || format === 'md') {
        res.setHeader('Content-Type', 'text/plain');
        let markdownText = `# ${product.name}\n`;
        markdownText += `*Brand: ${product.brand} | Category: Hardware Product*\n\n`;
        markdownText += `${product.summary}\n\n`;
        markdownText += `## Technical Specifications\n`;
        markdownText += `| Specification | Value |\n`;
        markdownText += `| --- | --- |\n`;
        Object.entries(specs).forEach(([key, val]) => {
          const cleanKey = key.replace(/_/g, ' ').toUpperCase();
          markdownText += `| ${cleanKey} | ${val} |\n`;
        });
        markdownText += `\n## Description\n${product.description}`;
        return res.send(markdownText);
      }

      return res.render('product', { 
        product, 
        specifications: specs,
        title: `${product.name} Specs & Details - Eternalgy`, 
        meta_description: product.summary, 
        schemaData, 
        currentTab: 'home' 
      });
    }

    // 3. Resolve Project Case Study
    if (projectRes.rows.length > 0) {
      const project = projectRes.rows[0];
      const schemaData = getSchemaData(project, 'project', baseUrl);

      if (format === 'json') {
        return res.json({ project, schemaData });
      } else if (format === 'raw' || format === 'md') {
        res.setHeader('Content-Type', 'text/plain');
        let markdownText = `# ${project.title}\n`;
        markdownText += `*Client: ${project.client_name} | Capacity: ${project.capacity_kwp} kWp | Location: ${project.location}*\n`;
        markdownText += `*Commissioned: ${project.commission_date ? new Date(project.commission_date).toLocaleDateString() : 'N/A'}*\n\n`;
        markdownText += `${project.summary}\n\n`;
        markdownText += `## Engineering Details\n${project.details}`;
        return res.send(markdownText);
      }

      return res.render('project', { 
        project, 
        title: `${project.title} - Solar Case Study`, 
        meta_description: project.summary, 
        schemaData, 
        currentTab: 'home' 
      });
    }

    // If nothing matches, page not found
    return res.status(404).send('Page not found');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database lookup error');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
