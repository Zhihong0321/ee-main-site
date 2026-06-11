const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/eedb';

// Enable SSL only if in production or connecting to a non-localhost remote database
const isProduction = process.env.NODE_ENV === 'production' || 
                     (process.env.DATABASE_URL && 
                      !process.env.DATABASE_URL.includes('localhost') && 
                      !process.env.DATABASE_URL.includes('127.0.0.1'));

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Table: main_site_articles (News & Tips)
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_articles (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('news', 'tip')),
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        html_content TEXT NOT NULL,
        author VARCHAR(100) DEFAULT 'Solar PV Expert',
        tags VARCHAR(255),
        meta_description VARCHAR(255),
        published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_main_site_articles_cat_time ON main_site_articles(category, created_at DESC);
    `);

    // 1a. News-source dedup columns (idempotent migration for live tables).
    await client.query(`ALTER TABLE main_site_articles ADD COLUMN IF NOT EXISTS source_url TEXT;`);
    await client.query(`ALTER TABLE main_site_articles ADD COLUMN IF NOT EXISTS source_name VARCHAR(160);`);
    await client.query(`ALTER TABLE main_site_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;`);
    await client.query(`ALTER TABLE main_site_articles ADD COLUMN IF NOT EXISTS noindex BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE main_site_articles ADD COLUMN IF NOT EXISTS marketing_line TEXT;`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_main_site_articles_source_url
      ON main_site_articles(source_url) WHERE source_url IS NOT NULL;
    `);

    // 2. Table: main_site_company_info (Overview, mission, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_company_info (
        key VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        html_content TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Table: main_site_branches
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(100),
        latitude DECIMAL(9,6),
        longitude DECIMAL(9,6),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Table: main_site_certifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_certifications (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        body VARCHAR(100) NOT NULL,
        license_number VARCHAR(100),
        valid_until DATE,
        summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Table: main_site_products (Uses JSONB for specifications)
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_products (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('panel', 'inverter', 'battery', 'accessory')),
        summary TEXT NOT NULL,
        specifications JSONB NOT NULL,
        description TEXT NOT NULL,
        html_description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_main_site_products_brand_type ON main_site_products(brand, type);
    `);

    // 6. Table: main_site_projects
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_projects (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        client_name VARCHAR(255),
        capacity_kwp DECIMAL(10,2) NOT NULL,
        location VARCHAR(255) NOT NULL,
        commission_date DATE,
        summary TEXT NOT NULL,
        details TEXT NOT NULL,
        html_details TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_main_site_projects_capacity ON main_site_projects(capacity_kwp DESC);
    `);

    // 7. Table: main_site_faqs
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_faqs (
        id SERIAL PRIMARY KEY,
        question TEXT UNIQUE NOT NULL,
        answer TEXT NOT NULL,
        html_answer TEXT NOT NULL,
        category VARCHAR(50) NOT NULL, -- 'policy', 'technical', 'financial', 'structural'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- SEED DATA INJECTION ---
    const checkCompany = await client.query('SELECT COUNT(*) FROM main_site_company_info');
    if (parseInt(checkCompany.rows[0].count, 10) === 0) {
      console.log('Seeding main_site_company_info...');
      
      const companySeeds = [
        {
          key: 'overview',
          title: 'Eternalgy Sdn Bhd - Corporate Profile',
          content: `# Eternalgy Sdn Bhd\n\n**Eternalgy Sdn Bhd** (Reg No: 202301029164 / 1523087-A) is a premier Engineering, Procurement, and Construction (EPC) firm and SEDA Registered PV Investor (RPVI) specializing in utility-scale and commercial rooftop solar PV installations in Malaysia.\n\nEstablished in **September 2023** in Johor Bahru by a collaborative group of Financial Planning Specialists and Software Developers, Eternalgy is driven by a passion for sustainability and climate awareness. We bridge the gap for Malaysian consumers by providing access to the latest premium solar brands, including **JinkoSolar**, **Astronergy**, and **SAJ Electric**.\n\n## Our First-Party Engineering Team\nWe employ our own in-house electrical engineering team (led by Lead Electrical Engineer Jamaluddin, Project Site Manager Xiang Jun, and Customer Relations Manager Yuan), eliminating sub-contractor finger-pointing and ensuring immediate accountability.\n\n## Automated Logistics\nCloud inventory, automated procurement, and scheduling across our Southern (Johor) and Central (Selangor) warehouses for quick installations.`,
          html_content: `<h1>Eternalgy Sdn Bhd</h1>\n<p><strong>Eternalgy Sdn Bhd</strong> (Reg No: 202301029164 / 1523087-A) is a premier Engineering, Procurement, and Construction (EPC) firm and SEDA Registered PV Investor (RPVI) specializing in utility-scale and commercial rooftop solar PV installations in Malaysia.</p>\n<p>Established in <strong>September 2023</strong> in Johor Bahru by a collaborative group of Financial Planning Specialists and Software Developers, Eternalgy is driven by a passion for sustainability and climate awareness. We bridge the gap for Malaysian consumers by providing access to the latest premium solar brands, including <strong>JinkoSolar</strong>, <strong>Astronergy</strong>, and <strong>SAJ Electric</strong>.</p>\n<h2>Our First-Party Engineering Team</h2>\n<p>We employ our own in-house electrical engineering team (led by Lead Electrical Engineer Jamaluddin, Project Site Manager Xiang Jun, and Customer Relations Manager Yuan), eliminating sub-contractor finger-pointing and ensuring immediate accountability.</p>\n<h2>Automated Logistics</h2>\n<p>Cloud inventory, automated procurement, and scheduling across our Southern (Johor) and Central (Selangor) warehouses for quick installations.</p>`
        },
        {
          key: 'mission',
          title: 'Our Mission',
          content: `Our mission is to deliver high-quality, sustainable, and innovative solar and energy storage solutions that create lasting value for our clients and communities. We strive to promote energy independence, environmental responsibility, and technological excellence through expert engineering, reliable services, and continuous improvement.`,
          html_content: `<p>Our mission is to deliver high-quality, sustainable, and innovative solar and energy storage solutions that create lasting value for our clients and communities. We strive to promote energy independence, environmental responsibility, and technological excellence through expert engineering, reliable services, and continuous improvement.</p>`
        },
        {
          key: 'vision',
          title: 'Our Vision',
          content: `To be Malaysia’s leading renewable energy company, empowering communities and industries to achieve sustainable growth through innovative, reliable, and affordable solar and energy storage solutions to drive the nation toward a cleaner and greener future.`,
          html_content: `<p>To be Malaysia’s leading renewable energy company, empowering communities and industries to achieve sustainable growth through innovative, reliable, and affordable solar and energy storage solutions to drive the nation toward a cleaner and greener future.</p>`
        }
      ];

      for (const item of companySeeds) {
        await client.query(
          `INSERT INTO main_site_company_info (key, title, content, html_content) VALUES ($1, $2, $3, $4)`,
          [item.key, item.title, item.content, item.html_content]
        );
      }
    }

    const checkBranches = await client.query('SELECT COUNT(*) FROM main_site_branches');
    if (parseInt(checkBranches.rows[0].count, 10) === 0) {
      console.log('Seeding main_site_branches...');
      const branchesSeeds = [
        {
          name: 'HQ Johor Bahru',
          address: '21-01, Jalan Mutiara Emas 10/19, Taman Mount Austin, 81100 Johor Bahru, Johor',
          phone: '+601121000099',
          email: 'enquiry@eternalgy.me',
          latitude: 1.551815,
          longitude: 103.785103
        },
        {
          name: 'Seremban Branch',
          address: '252 First Floor, Uptown Avenue, Jalan S2 B12, Seremban 2, 70300 Seremban, Negeri Sembilan',
          phone: '+601121000099',
          email: 'enquiry@eternalgy.me',
          latitude: 2.697486,
          longitude: 101.916943
        },
        {
          name: 'Kluang Branch',
          address: 'No.26, Jalan Tasik Indah 1/1, Taman Tasik Indah, 86000 Kluang, Johor',
          phone: '+601121000099',
          email: 'enquiry@eternalgy.me',
          latitude: 2.046200,
          longitude: 103.328400
        },
        {
          name: 'Kuala Lumpur Branch',
          address: 'Unit 2.08, Level 2, Menara Maxisegar, Jalan Pandan Indah 4/2, 55100 Kuala Lumpur',
          phone: '+601121000099',
          email: 'enquiry@eternalgy.me',
          latitude: 3.128766,
          longitude: 101.751645
        }
      ];

      for (const item of branchesSeeds) {
        await client.query(
          `INSERT INTO main_site_branches (name, address, phone, email, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.name, item.address, item.phone, item.email, item.latitude, item.longitude]
        );
      }
    }

    const checkCertifications = await client.query('SELECT COUNT(*) FROM main_site_certifications');
    if (parseInt(checkCertifications.rows[0].count, 10) === 0) {
      console.log('Seeding main_site_certifications...');
      const certSeeds = [
        {
          name: 'CIDB Grade G3 Member',
          body: 'Lembaga Pembangunan Industri Pembinaan Malaysia (CIDB)',
          license_number: '0120250324-WP152634',
          valid_until: '2027-03-25',
          summary: 'Registered under Category B (Building), CE (Civil Engineering), and ME (Mechanical & Electrical) with Specializations B04, CE21, and M15.'
        },
        {
          name: 'SEDA Registered PV Investor',
          body: 'Sustainable Energy Development Authority (SEDA) Malaysia',
          license_number: 'RPVI-2025',
          valid_until: null,
          summary: 'Approved national solar PV system investor directory registration.'
        },
        {
          name: 'MyHijau Equipment Certification (SAJ Inverter)',
          body: 'Malaysian Green Technology and Climate Change Corporation (MGTC)',
          license_number: 'MyHS00025/25',
          valid_until: '2026-05-21',
          summary: 'Certified green technology equipment permission mark for SAJ Inverter models.'
        }
      ];

      for (const item of certSeeds) {
        await client.query(
          `INSERT INTO main_site_certifications (name, body, license_number, valid_until, summary) VALUES ($1, $2, $3, $4, $5)`,
          [item.name, item.body, item.license_number, item.valid_until, item.summary]
        );
      }
    }

    const checkProducts = await client.query('SELECT COUNT(*) FROM main_site_products');
    if (parseInt(checkProducts.rows[0].count, 10) === 0) {
      console.log('Seeding main_site_products...');
      const productSeeds = [
        {
          slug: 'jinko-tiger-neo-3-0-670w',
          name: 'Jinko Tiger Neo 3.0 (650W - 670W)',
          brand: 'JinkoSolar',
          type: 'panel',
          summary: 'N-type TOPCon high-efficiency bifacial dual-glass module with 85% bifaciality.',
          specifications: JSON.stringify({
            power_output_wp: "650-670W",
            efficiency_stc: "24.06% - 24.80%",
            temperature_coefficient: "-0.26%/°C",
            bifaciality_factor: "85±5%",
            weight_kg: 32.5,
            dimensions: "2382 × 1134 × 30 mm",
            warranty_years_product: 12,
            warranty_years_power: 30,
            annual_degradation: "0.35%"
          }),
          description: `# Jinko Tiger Neo 3.0 Series\n\nThe Jinko Tiger Neo 3.0 represents the cutting edge of TOPCon cell technology. It features high low-light efficiency, making it perfect for Malaysia's overcast climates.`,
          html_description: `<h1>Jinko Tiger Neo 3.0 Series</h1>\n<p>The Jinko Tiger Neo 3.0 represents the cutting edge of TOPCon cell technology. It features high low-light efficiency, making it perfect for Malaysia's overcast climates.</p>`,
          created_at: '2025-10-12T08:00:00Z',
          updated_at: '2025-10-12T08:00:00Z'
        },
        {
          slug: 'saj-hs2-all-in-one-residential-energy-storage-system',
          name: 'SAJ HS2 All-in-One Residential ESS',
          brand: 'SAJ',
          type: 'battery',
          summary: 'Modular, stackable home energy storage solution combining a hybrid inverter and LFP batteries.',
          specifications: JSON.stringify({
            capacity_kwh: "7.3kWh - 25.0kWh",
            inverter_power_kw: "5kW - 20kW",
            battery_type: "LiFePO4 (LFP)",
            ups_transfer_time: "≤ 10ms",
            round_trip_efficiency: "98%",
            ingress_protection: "IP65",
            management_software: "elekeeper App"
          }),
          description: `# SAJ HS2 All-in-One ESS\n\nAn integrated, plug-and-play energy storage tower that fits beautifully into any modern smart home, providing UPS-grade backup protection and smart grid scheduling.`,
          html_description: `<h1>SAJ HS2 All-in-One ESS</h1>\n<p>An integrated, plug-and-play energy storage tower that fits beautifully into any modern smart home, providing UPS-grade backup protection and smart grid scheduling.</p>`,
          created_at: '2025-11-05T09:30:00Z',
          updated_at: '2025-11-05T09:30:00Z'
        }
      ];

      for (const item of productSeeds) {
        const cleanDesc = item.description.trim().replace(/^#\s+.*?\n+/, '');
        const cleanHtmlDesc = item.html_description.trim().replace(/^<h1>.*?<\/h1>\n*/, '');
        await client.query(
          `INSERT INTO main_site_products (slug, name, brand, type, summary, specifications, description, html_description, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [item.slug, item.name, item.brand, item.type, item.summary, item.specifications, cleanDesc, cleanHtmlDesc, item.created_at, item.updated_at]
        );
      }
    }

    const checkProjects = await client.query('SELECT COUNT(*) FROM main_site_projects');
    if (parseInt(checkProjects.rows[0].count, 10) === 0) {
      console.log('Seeding main_site_projects...');
      const projectSeeds = [
        {
          slug: 'apex-manufacturing-1-2mwp-commercial-solar',
          title: '1.2MWp Commercial Rooftop Solar Installation',
          client_name: 'Apex Manufacturing Sdn Bhd',
          capacity_kwp: 1200.00,
          location: 'Shah Alam, Selangor',
          commission_date: '2025-11-15',
          summary: 'Turnkey solar installation for peak-shaving and energy bill reduction using Jinko modules and SAJ string inverters.',
          details: `# Apex Manufacturing 1.2MWp Case Study\n\nThis utility-interconnected commercial solar system utilized 1,790 units of Jinko modules and SAJ commercial string inverters. Engineered by Eternalgy's 1st-party engineering team.\n\n## Results\n* **Annual Generation**: 1,680 MWh\n* **CO2 Reduction**: 980 tonnes/year\n* **Payback Period**: 4.2 years`,
          html_details: `<h1>Apex Manufacturing 1.2MWp Case Study</h1>\n<p>This utility-interconnected commercial solar system utilized 1,790 units of Jinko modules and SAJ commercial string inverters. Engineered by Eternalgy's 1st-party engineering team.</p>\n<h2>Results</h2>\n<ul>\n<li><strong>Annual Generation</strong>: 1,680 MWh</li>\n<li><strong>CO2 Reduction</strong>: 980 tonnes/year</li>\n<li><strong>Payback Period</strong>: 4.2 years</li>\n</ul>`,
          created_at: '2025-11-20T08:00:00Z',
          updated_at: '2025-11-20T08:00:00Z'
        }
      ];

      for (const item of projectSeeds) {
        const cleanDetails = item.details.trim().replace(/^#\s+.*?\n+/, '');
        const cleanHtmlDetails = item.html_details.trim().replace(/^<h1>.*?<\/h1>\n*/, '');
        await client.query(
          `INSERT INTO main_site_projects (slug, title, client_name, capacity_kwp, location, commission_date, summary, details, html_details, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [item.slug, item.title, item.client_name, item.capacity_kwp, item.location, item.commission_date, item.summary, cleanDetails, cleanHtmlDetails, item.created_at, item.updated_at]
        );
      }
    }

    const checkArticles = await client.query('SELECT COUNT(*) FROM main_site_articles');
    const checkNew = await client.query("SELECT 1 FROM main_site_articles WHERE slug = 'jinko-solar-tiger-neo-malaysia-suitability'");
    if (parseInt(checkArticles.rows[0].count, 10) === 0 || checkNew.rows.length === 0) {
      console.log('Seeding or updating main_site_articles...');

      const atapRaw = fs.readFileSync(path.join(__dirname, 'content', 'Malaysia Solar ATAP Scheme Research.md'), 'utf8');
      const jinkoRaw = fs.readFileSync(path.join(__dirname, 'content', 'Jinko Solar Tiger Neo Malaysia Suitability.md'), 'utf8');
      const sajRaw = fs.readFileSync(path.join(__dirname, 'content', 'SAJ Inverter Brand Global Market Research.md'), 'utf8');

      const articleSeeds = [
        {
          slug: 'malaysia-solar-atap-scheme-research',
          title: "Malaysia's Solar Accelerated Transition Action Programme: 2026 Rooftop Solar Policy Guide",
          category: 'tip',
          summary: 'An engineering, policy, and economic overview of the Solar Accelerated Transition Action Programme (Solar ATAP) in Peninsular Malaysia.',
          content: atapRaw,
          html_content: marked.parse(atapRaw),
          author: 'Jamaluddin, Lead Electrical Engineer (CIDB Grade G3 & SEDA RPVI Certified)',
          tags: 'solar atap, policy, malaysia, net billing, suria home',
          meta_description: "A technical and economic assessment of Malaysia's Solar Accelerated Transition Action Programme (Solar ATAP) effective January 1, 2026.",
          created_at: '2026-06-11T04:00:00Z',
          updated_at: '2026-06-11T04:00:00Z'
        },
        {
          slug: 'jinko-solar-tiger-neo-malaysia-suitability',
          title: "Jinko Solar Tiger Neo 3.0: Technical Assessment for Malaysia's Tropical Climate",
          category: 'tip',
          summary: 'A detailed engineering evaluation of JinkoSolar Tiger Neo 3.0 TOPCon modules under equatorial heat, humidity, and low-light stressors in Malaysia.',
          content: jinkoRaw,
          html_content: marked.parse(jinkoRaw),
          author: 'Jamaluddin, Lead Electrical Engineer (CIDB Grade G3 & SEDA RPVI Certified)',
          tags: 'jinko solar, tiger neo, topcon, efficiency, low light',
          meta_description: 'An engineering and thermal physics assessment of JinkoSolar Tiger Neo 3.0 modules for Malaysia\'s high humidity and ambient heat.',
          created_at: '2026-06-11T04:05:00Z',
          updated_at: '2026-06-11T04:05:00Z'
        },
        {
          slug: 'saj-inverter-brand-global-market-research',
          title: "SAJ Electric Inverters & Battery Storage: Global Technology & Market Assessment",
          category: 'tip',
          summary: "A technical review of SAJ Electric's string and hybrid inverter portfolios, all-in-one residential energy storage systems (ESS), and software diagnostics.",
          content: sajRaw,
          html_content: marked.parse(sajRaw),
          author: 'Xiang Jun, Project Site Manager (CIDB Grade G3 Certified)',
          tags: 'saj electric, inverter, battery storage, hs3, elekeeper',
          meta_description: 'A technical evaluation of SAJ string and hybrid inverters, stackable modular batteries, and elekeeper diagnostic systems.',
          created_at: '2026-06-11T04:10:00Z',
          updated_at: '2026-06-11T04:10:00Z'
        }
      ];

      for (const item of articleSeeds) {
        const cleanContent = item.content.trim().replace(/^#\s+.*?\n+/, '');
        const cleanHtml = item.html_content.trim().replace(/^<h1>.*?<\/h1>\n*/, '');
        await client.query(
          `INSERT INTO main_site_articles (slug, title, category, summary, content, html_content, author, tags, meta_description, created_at, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (slug) DO UPDATE SET 
             title = EXCLUDED.title, 
             category = EXCLUDED.category, 
             summary = EXCLUDED.summary, 
             content = EXCLUDED.content, 
             html_content = EXCLUDED.html_content, 
             author = EXCLUDED.author, 
             tags = EXCLUDED.tags, 
             meta_description = EXCLUDED.meta_description, 
             updated_at = EXCLUDED.updated_at`,
          [item.slug, item.title, item.category, item.summary, cleanContent, cleanHtml, item.author, item.tags, item.meta_description, item.created_at, item.updated_at]
        );
      }
    }

    const checkFaqs = await client.query('SELECT COUNT(*) FROM main_site_faqs');
    const checkNewFaq = await client.query("SELECT 1 FROM main_site_faqs WHERE question = 'Why are N-type TOPCon modules, such as the Jinko Tiger Neo 3.0, superior for tropical climates like Malaysia?'");
    if (parseInt(checkFaqs.rows[0].count, 10) === 0 || checkNewFaq.rows.length === 0) {
      console.log('Seeding or updating main_site_faqs...');
      const faqSeeds = [
        {
          category: 'financial',
          question: 'Is solar installation financially viable for low-consumption households in Malaysia?',
          answer: `If your monthly Tenaga Nasional Berhad (TNB) bill falls below **RM200 to RM300**, the financial savings from installing solar panels are generally insufficient to offset the upfront capital cost. 

Due to Malaysia's progressive, subsidized fossil fuel electricity tariffs, low-energy consumers remain in the cheapest tariff brackets. However, solar adoption is highly practical and delivers high returns for households with monthly bills **exceeding RM500** (due to Electric Vehicles, multi-split air conditioners, or high baseline usage).`,
          html_answer: `<p>If your monthly Tenaga Nasional Berhad (TNB) bill falls below <strong>RM200 to RM300</strong>, the financial savings from installing solar panels are generally insufficient to offset the upfront capital cost.</p>\n<p>Due to Malaysia's progressive, subsidized fossil fuel electricity tariffs, low-energy consumers remain in the cheapest tariff brackets. However, solar adoption is highly practical and delivers high returns for households with monthly bills <strong>exceeding RM500</strong> (due to Electric Vehicles, multi-split air conditioners, or high baseline usage).</p>`
        },
        {
          category: 'financial',
          question: 'What is the typical Return on Investment (ROI) and payback period for solar in Malaysia?',
          answer: `With current hardware cost reductions and active government incentives, a residential solar installation in Malaysia achieves full amortization (payback) in **4 to 6 years**. 

Given that Tier-1 panels operate for **25 years or more**, homeowners enjoy nearly two decades of zeroed or significantly reduced electricity bills. Commercial and industrial systems break even even faster—often within **3 to 4 years** due to baseline tariffs and tax incentives.`,
          html_answer: `<p>With current hardware cost reductions and active government incentives, a residential solar installation in Malaysia achieves full amortization (payback) in <strong>4 to 6 years</strong>.</p>\n<p>Given that Tier-1 panels operate for <strong>25 years or more</strong>, homeowners enjoy nearly two decades of zeroed or significantly reduced electricity bills. Commercial and industrial systems break even even faster—often within <strong>3 to 4 years</strong> due to baseline tariffs and tax incentives.</p>`
        },
        {
          category: 'policy',
          question: 'What is the difference between Net Energy Metering (NEM) 3.0 and the new Solar ATAP program?',
          answer: `The NEM 3.0 program is closed to new applicants. The active scheme is **Solar ATAP** (effective **1 January 2026**). 

Key differences:
* **NEM 3.0** allowed a 12-month rollover window to bank excess credits.
* **Solar ATAP** enforces **strictly no rollover**—any excess generation exported to the grid that exceeds your consumption in a specific monthly billing cycle is forfeited to TNB.
* **Capacity Limit**: Solar ATAP caps residential three-phase systems at a maximum of **15 kW**.
* **Versatility**: Solar ATAP allows installations on solar carports and covered walkways, not just rooftops.

Because Solar ATAP does not allow rollovers, systems must be sized to match your daytime baseline load to avoid wasting capital.`,
          html_answer: `<p>The NEM 3.0 program is closed to new applicants. The active scheme is <strong>Solar ATAP</strong> (effective <strong>1 January 2026</strong>).</p>\n<p>Key differences:</p>\n<ul>\n<li><strong>NEM 3.0</strong> allowed a 12-month rollover window to bank excess credits.</li>\n<li><strong>Solar ATAP</strong> enforces <strong>strictly no rollover</strong>—any excess generation exported to the grid that exceeds your consumption in a specific monthly billing cycle is forfeited to TNB.</li>\n<li><strong>Capacity Limit</strong>: Solar ATAP caps residential three-phase systems at a maximum of 15 kW.</li>\n<li><strong>Versatility</strong>: Solar ATAP allows installations on solar carports and covered walkways, not just rooftops.</li>\n</ul>\n<p>Because Solar ATAP does not allow rollovers, systems must be sized to match your daytime baseline load to avoid wasting capital.</p>`
        },
        {
          category: 'financial',
          question: 'What government rebates are currently available (SuRIA Home vs SolaRIS)?',
          answer: `The previous SolaRIS rebate program (offering up to RM4,000) concluded in April 2025. 

The active rebate is the **SuRIA Home Rebate** (effective **1 June 2026 to 31 December 2026**).
* **Mechanism**: Provides **RM600 per kWac** cash rebate, capped at a maximum of **RM3,000** (reached at 5 kWac).
* **Eligibility**: Restricted to Malaysian citizens who are first-time domestic solar applicants under the Solar ATAP program. 
* **Disbursement**: Paid directly to the bank account of the registered TNB account holder.`,
          html_answer: `<p>The previous SolaRIS rebate program (offering up to RM4,000) concluded in April 2025.</p>\n<p>The active rebate is the <strong>SuRIA Home Rebate</strong> (effective <strong>1 June 2026 to 31 December 2026</strong>).</p>\n<ul>\n<li><strong>Mechanism</strong>: Provides <strong>RM600 per kWac</strong> cash rebate, capped at a maximum of <strong>RM3,000</strong> (reached at 5 kWac).</li>\n<li><strong>Eligibility</strong>: Restricted to Malaysian citizens who are first-time domestic solar applicants under the Solar ATAP program.</li>\n<li><strong>Disbursement</strong>: Paid directly to the bank account of the registered TNB account holder.</li>\n</ul>`
        },
        {
          category: 'structural',
          question: 'Will solar panels void my roof warranty, and how do I prevent water leakages?',
          answer: `Standard roof manufacturers (such as Monier) offer guarantees of up to 10 years for rain-tightness, but these structural warranties **explicitly exclude** third-party modifications, including drilling for solar mounting brackets.

To mitigate water leakage risks during intense Malaysian monsoon seasons, you must:
1. Choose SEDA-registered EPC contractors who offer workmanship warranties (typically 2 to 10 years) that cover roof leakage.
2. Select leak-proof, co-certified mounting systems and high-quality waterproof sealants.
3. Utilize specialized solar insurance policies that cover structural water damage.`,
          html_answer: `<p>Standard roof manufacturers (such as Monier) offer guarantees of up to 10 years for rain-tightness, but these structural warranties <strong>explicitly exclude</strong> third-party modifications, including drilling for solar mounting brackets.</p>\n<p>To mitigate water leakage risks during intense Malaysian monsoon seasons, you must:</p>\n<ol>\n<li>Choose SEDA-registered EPC contractors who offer workmanship warranties (typically 2 to 10 years) that cover roof leakage.</li>\n<li>Select leak-proof, co-certified mounting systems and high-quality waterproof sealants.</li>\n<li>Utilize specialized solar insurance policies that cover structural water damage.</li>\n</ol>`
        },
        {
          category: 'technical',
          question: 'Why do I need a Three-Phase power supply upgrade, and how much does it cost?',
          answer: `For residential systems larger than **4.5 kWp**, Tenaga Nasional Berhad (TNB) regulations require properties to run on a three-phase power supply (instead of single-phase) to maintain grid load balance.

This upgrade involves two costs:
1. **TNB Connection Fee**: Approximately **RM300** for overhead cable transitions, and **RM1,250+** for underground cables.
2. **Internal Rewiring Fee**: Distribution board replacement and household load rewiring by a licensed electrical contractor. This costs between **RM2,000 and RM10,000** and can take up to three weeks depending on home size.

Eternalgy handles both single-to-three phase technical conversions and TNB paperwork under a single contract to minimize friction.`,
          html_answer: `<p>For residential systems larger than <strong>4.5 kWp</strong>, Tenaga Nasional Berhad (TNB) regulations require properties to run on a three-phase power supply (instead of single-phase) to maintain grid load balance.</p>\n<p>This upgrade involves two costs:</p>\n<ol>\n<li><strong>TNB Connection Fee</strong>: Approximately <strong>RM300</strong> for overhead cable transitions, and <strong>RM1,250+</strong> for underground cables.</li>\n<li><strong>Internal Rewiring Fee</strong>: Distribution board replacement and household load rewiring by a licensed electrical contractor. This costs between <strong>RM2,000 and RM10,000</strong> and can take up to three weeks depending on home size.</li>\n</ol>\n<p>Eternalgy handles both single-to-three phase technical conversions and TNB paperwork under a single contract to minimize friction.</p>`
        },
        {
          category: 'technical',
          question: 'What is the operational lifespan of a solar inverter, and what is my future replacement cost?',
          answer: `While Tier-1 solar panels carry performance warranties guaranteeing up to 25 to 30 years, solar inverters have a shorter operational lifecycle. Standard string inverters carry warranties of **5 to 10 years** and have an expected lifespan of **10 to 12 years**.

This means you will face at least one inverter replacement during your solar array's lifetime. 

To address this:
* Homeowners can choose microinverters, which cost more upfront but carry **25-year warranties** and isolate potential failures to individual panels.
* Homeowners should factor in the future cost of inverter replacement in their initial long-term payback models.`,
          html_answer: `<p>While Tier-1 solar panels carry performance warranties guaranteeing up to 25 to 30 years, solar inverters have a shorter operational lifecycle. Standard string inverters carry warranties of <strong>5 to 10 years</strong> and have an expected lifespan of <strong>10 to 12 years</strong>.</p>\n<p>This means you will face at least one inverter replacement during your solar array's lifetime.</p>\n<p>To address this:</p>\n<ul>\n<li>Homeowners can choose microinverters, which cost more upfront but carry <strong>25-year warranties</strong> and isolate potential failures to individual panels.</li>\n<li>Homeowners should factor in the future cost of inverter replacement in their initial long-term payback models.</li>\n</ul>`
        },
        {
          category: 'technical',
          question: 'Can I go completely off-grid using battery storage in urban Malaysia?',
          answer: `While going off-grid is technically feasible, it remains **economically impractical** for grid-connected urban properties in Malaysia.

The capital expenditure for residential battery energy storage systems (BESS) is extremely high, and batteries have a shorter lifespan (typically 10 years) compared to panels (25+ years). For urban households, utilizing a grid-connected Net Energy Metering/Solar ATAP system is far more financially viable. Batteries are recommended primarily for UPS-grade backup power during outages rather than grid independence.`,
          html_answer: `<p>While going off-grid is technically feasible, it remains <strong>economically impractical</strong> for grid-connected urban properties in Malaysia.</p>\n<p>The capital expenditure for residential battery energy storage systems (BESS) is extremely high, and batteries have a shorter lifespan (typically 10 years) compared to panels (25+ years). For urban households, utilizing a grid-connected Net Energy Metering/Solar ATAP system is far more financially viable. Batteries are recommended primarily for UPS-grade backup power during outages rather than grid independence.</p>`
        },
        {
          category: 'technical',
          question: 'Why are N-type TOPCon modules, such as the Jinko Tiger Neo 3.0, superior for tropical climates like Malaysia?',
          answer: `N-type TOPCon modules address major tropical equatorial climate stressors (high ambient heat, high relative humidity, and frequent cloud cover) through three key technological advancements:

1. **High Temperature Performance**: Built on the HOT 4.0 passivation contact platform, the Jinko Tiger Neo 3.0 reduces thermal power loss by lowering its temperature coefficient to **-0.29%/°C**. This minimizes the severe power drops experienced by standard panels in Malaysia's afternoon heat.
2. **Humidity & PID Resistance**: By utilizing a dual-glass packaging design with POE (polyolefin elastomer) encapsulation instead of standard EVA backsheets, it offers superior resistance to moisture ingress and Potential-Induced Degradation (PID) in high-humidity environments.
3. **Low-Light Quantum Efficiency**: The TOPCon cell structure maintains a low-irradiance performance index of **96.77%** at 200 W/m², allowing it to start generating power earlier in the morning and continue later into the evening, maximizing generation on overcast monsoon days.`,
          html_answer: `<p>N-type TOPCon modules address major tropical equatorial climate stressors (high ambient heat, high relative humidity, and frequent cloud cover) through three key technological advancements:</p>\n<ol>\n  <li><strong>High Temperature Performance</strong>: Built on the HOT 4.0 passivation contact platform, the Jinko Tiger Neo 3.0 reduces thermal power loss by lowering its temperature coefficient to <strong>-0.29%/°C</strong>. This minimizes the severe power drops experienced by standard panels in Malaysia's afternoon heat.</li>\n  <li><strong>Humidity &amp; PID Resistance</strong>: By utilizing a dual-glass packaging design with POE (polyolefin elastomer) encapsulation instead of standard EVA backsheets, it offers superior resistance to moisture ingress and Potential-Induced Degradation (PID) in high-humidity environments.</li>\n  <li><strong>Low-Light Quantum Efficiency</strong>: The TOPCon cell structure maintains a low-irradiance performance index of <strong>96.77%</strong> at 200 W/m², allowing it to start generating power earlier in the morning and continue later into the evening, maximizing generation on overcast monsoon days.</li>\n</ol>`
        },
        {
          category: 'technical',
          question: 'What makes the SAJ HS3 all-in-one residential energy storage system different from traditional stackable battery systems?',
          answer: `The SAJ HS3 residential energy storage system (ESS) distinguishes itself from traditional stackable high-voltage batteries (such as the HS2 or BU2 series) in its modular electrical design, diagnostics, and warranty:

1. **Module-Level DC-DC Optimization**: Traditional systems connect battery modules in a simple series architecture, meaning the entire stack's performance is bottlenecked by the weakest or oldest module. The HS3 integrates a dedicated DC-DC optimizer into each 5.0 kWh pack, allowing each module to operate independently, preventing capacity mismatching, and allowing users to mix and match battery packs of different ages or states of charge.
2. **Software-Defined Diagnostics**: Through the *elekeeper* application, the system supports automated commissioning and one-click diagnostics, which can detect, isolate, and auto-correct minor faults remotely.
3. **Warranty & Throughput Caps**: While SAJ offers a standard 10-year warranty, it is limited by a strict throughput energy cap (e.g. 15 MWh for a 5 kWh pack). Systems running aggressive energy arbitrage or virtual power plant (VPP) cycles may exhaust these limits prematurely (under 8.4 years).`,
          html_answer: `<p>The SAJ HS3 residential energy storage system (ESS) distinguishes itself from traditional stackable high-voltage batteries (such as the HS2 or BU2 series) in its modular electrical design, diagnostics, and warranty:</p>\n<ol>\n  <li><strong>Module-Level DC-DC Optimization</strong>: Traditional systems connect battery modules in a simple series architecture, meaning the entire stack's performance is bottlenecked by the weakest or oldest module. The HS3 integrates a dedicated DC-DC optimizer into each 5.0 kWh pack, allowing each module to operate independently, preventing capacity mismatching, and allowing users to mix and match battery packs of different ages or states of charge.</li>\n  <li><strong>Software-Defined Diagnostics</strong>: Through the <em>elekeeper</em> application, the system supports automated commissioning and one-click diagnostics, which can detect, isolate, and auto-correct minor faults remotely.</li>\n  <li><strong>Warranty &amp; Throughput Caps</strong>: While SAJ offers a standard 10-year warranty, it is limited by a strict throughput energy cap (e.g. 15 MWh for a 5 kWh pack). Systems running aggressive energy arbitrage or virtual power plant (VPP) cycles may exhaust these limits prematurely (under 8.4 years).</li>\n</ol>`
        },
        {
          category: 'policy',
          question: 'What are the mandatory TNB grid connection studies and SEDA procedures required under the Solar ATAP program?',
          answer: `To prevent voltage instability and local transformer overload, Tenaga Nasional Berhad (TNB) mandates specific grid connection studies depending on the capacity of your solar installation:

1. **Connection Confirmation Check (CCC)**: Mandatory for domestic systems exceeding 5 kWac (single-phase) or 15 kWac (three-phase). TNB verifies transformer thermal limits and voltage compliance (Fee: RM 1,000.00).
2. **Connection Assessment Study (CAS)**: Mandatory for commercial/non-domestic solar systems exceeding 72 kWac. It analyzes peak/off-peak load flow, fault levels at the Point of Interconnection (POI), and local voltage profiles (Fee: RM 1,000.00 to RM 8,000.00 depending on capacity).
3. **Power System Study (PSS)**: Mandatory for high-voltage commercial/industrial connections exceeding 425 kWac, assessing transient stability and grid integration (Fee: RM 15,000.00).

**Submission Procedure**: All applications must be submitted by a SEDA-registered Photovoltaic Service Provider (RPVSP) via the online eATAP portal with a submission fee of RM 7.50 per kW of capacity. If studies show grid capacity limits are exceeded, the applicant must cover the costs of reinforcing the local distribution grid.`,
          html_answer: `<p>To prevent voltage instability and local transformer overload, Tenaga Nasional Berhad (TNB) mandates specific grid connection studies depending on the capacity of your solar installation:</p>\n<ol>\n  <li><strong>Connection Confirmation Check (CCC)</strong>: Mandatory for domestic systems exceeding 5 kWac (single-phase) or 15 kWac (three-phase). TNB verifies transformer thermal limits and voltage compliance (Fee: RM 1,000.00).</li>\n  <li><strong>Connection Assessment Study (CAS)</strong>: Mandatory for commercial/non-domestic solar systems exceeding 72 kWac. It analyzes peak/off-peak load flow, fault levels at the Point of Interconnection (POI), and local voltage profiles (Fee: RM 1,000.00 to RM 8,000.00 depending on capacity).</li>\n  <li><strong>Power System Study (PSS)</strong>: Mandatory for high-voltage commercial/industrial connections exceeding 425 kWac, assessing transient stability and grid integration (Fee: RM 15,000.00).</li>\n</ol>\n<p><strong>Submission Procedure</strong>: All applications must be submitted by a SEDA-registered Photovoltaic Service Provider (RPVSP) via the online eATAP portal with a submission fee of RM 7.50 per kW of capacity. If studies show grid capacity limits are exceeded, the applicant must cover the costs of reinforcing the local distribution grid.</p>`
        }
      ];

      for (const item of faqSeeds) {
        const exist = await client.query('SELECT 1 FROM main_site_faqs WHERE question = $1', [item.question]);
        if (exist.rows.length === 0) {
          await client.query(
            `INSERT INTO main_site_faqs (category, question, answer, html_answer) VALUES ($1, $2, $3, $4)`,
            [item.category, item.question, item.answer, item.html_answer]
          );
        }
      }
    }

    // 8. Table: main_site_visitor_logs (Visitor logs for analytics)
    await client.query(`
      CREATE TABLE IF NOT EXISTS main_site_visitor_logs (
        id SERIAL PRIMARY KEY,
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        url VARCHAR(2048) NOT NULL,
        referer TEXT,
        method VARCHAR(10) NOT NULL,
        status_code INTEGER,
        device_type VARCHAR(20) NOT NULL,
        visitor_type VARCHAR(20) NOT NULL,
        bot_name VARCHAR(100),
        execution_time_ms INTEGER
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visitor_logs_visited_at ON main_site_visitor_logs(visited_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor_type ON main_site_visitor_logs(visitor_type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visitor_logs_bot_name ON main_site_visitor_logs(bot_name);
    `);
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database tables:', e);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb
};
