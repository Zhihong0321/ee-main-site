// ============================================================
// Service-area / local agent pages — /agent/{state}/{town}
// SEO + GEO: one indexable page per town, with a named area
// representative, structured data, and AI-readable alternates.
// ============================================================
const serviceAreas = require('../data/service-areas');

const DEFAULT_AGENT = {
  name: 'our dedicated solar agent',
  phone: '+60 11-2100 0099',
  wa: '601121000099'
};

const COMPANY = {
  name: 'Eternalgy Sdn Bhd',
  legalName: 'Eternalgy Sdn Bhd',
  email: 'enquiry@eternalgy.me',
  phone: '+60 11-2100 0099',
  wa: '601121000099',
  sameAs: [
    'https://eternalgy.com',
    'https://solarpanels.my',
    'https://solarpanels.onesync.my',
    'https://solar100.com.my'
  ]
};

const STATE_ISO = {
  Johor: 'MY-01',
  Kedah: 'MY-02',
  Kelantan: 'MY-03',
  Melaka: 'MY-04',
  'Melaka (Malacca)': 'MY-04',
  'Negeri Sembilan': 'MY-05',
  Pahang: 'MY-06',
  Penang: 'MY-07',
  'Pulau Pinang': 'MY-07',
  Perak: 'MY-08',
  Perlis: 'MY-09',
  Selangor: 'MY-10',
  Terengganu: 'MY-11',
  'Federal Territories': 'MY-14'
};

const SERVICES = [
  'Commercial & industrial rooftop solar PV (EPC)',
  'Zero-capex solar investment (RPVI / PPA)',
  'Solar PV operation & maintenance (O&M)',
  'In-house electrical engineering (CIDB G3 licensed)'
];

module.exports = function registerServiceAreaRoutes(app, getBaseUrl) {
  const agentFor = (record) => record.agent || DEFAULT_AGENT;

  function nearbyTowns(record, st, limit) {
    const cap = limit || 12;
    if (!st || !st.districts) return [];
    const district = st.districts.find((d) => d.district === record.district);
    const pool = (district && district.towns) ? district.towns : [];
    const same = pool.filter((t) => t.townSlug !== record.townSlug);
    if (same.length >= 3 || !st.districts.length) return same.slice(0, cap);
    const extra = [];
    st.districts.forEach((d) => {
      (d.towns || []).forEach((t) => {
        if (t.townSlug !== record.townSlug && !same.some((s) => s.townSlug === t.townSlug)
            && !extra.some((s) => s.townSlug === t.townSlug)) {
          extra.push(t);
        }
      });
    });
    return same.concat(extra).slice(0, cap);
  }

  function localityLabel(record) {
    if (record.isDistrict || record.note === 'District') return 'district';
    if (record.parent) return 'locality';
    return 'town';
  }

  function coverageSentence(record) {
    const kind = localityLabel(record);
    let s = `Eternalgy Sdn Bhd is a SEDA-registered solar PV EPC company serving the ${kind} of ${record.town}`;
    if (record.parent) s += ` in ${record.parent}`;
    s += `, ${record.district}, ${record.stateName}, Malaysia.`;
    if (record.note && record.note !== 'District') {
      if (record.note === 'partially') s += ` Coverage of ${record.town} is partial.`;
      else s += ` Local note: ${record.note}.`;
    }
    return s;
  }

  function faqsFor(record, agent) {
    return [
      {
        q: `Does Eternalgy install solar PV in ${record.town}?`,
        a: `Yes. Our service region includes ${record.town} in ${record.district}, ${record.stateName}. ${agent.name} is the area representative for this ${localityLabel(record)}, and Eternalgy's nationwide engineering team delivers the project.`
      },
      {
        q: `Who is the solar PV area representative in ${record.town}?`,
        a: `${agent.name} is Eternalgy's area representative for ${record.town}. Call or WhatsApp ${agent.phone} for a free consultation, site survey and solar PV quote.`
      },
      {
        q: `How much does solar PV cost in ${record.town}?`,
        a: `Cost depends on roof size, energy usage and system capacity. A typical commercial system in ${record.town} is quoted after a free site survey — call ${agent.name} at ${agent.phone} for a no-obligation estimate.`
      },
      {
        q: `How do I get a solar quote in ${record.town}?`,
        a: `Call or WhatsApp ${agent.name} at ${agent.phone}. We will arrange a free consultation and site survey in ${record.town}, ${record.stateName}.`
      }
    ];
  }

  function orgNode(baseUrl) {
    return {
      '@type': 'Organization',
      '@id': baseUrl + '#organization',
      name: COMPANY.name,
      legalName: COMPANY.legalName,
      url: baseUrl,
      email: COMPANY.email,
      telephone: COMPANY.phone,
      logo: {
        '@type': 'ImageObject',
        url: baseUrl + '/logo.png'
      },
      address: {
        '@type': 'PostalAddress',
        streetAddress: '21-01, Jalan Mutiara Emas 10/19, Taman Mount Austin',
        addressLocality: 'Johor Bahru',
        addressRegion: 'Johor',
        postalCode: '81100',
        addressCountry: 'MY'
      },
      areaServed: { '@type': 'Country', name: 'Malaysia' },
      sameAs: COMPANY.sameAs
    };
  }

  function townPayload(record, baseUrl, st) {
    const agent = agentFor(record);
    const nearby = nearbyTowns(record, st);
    return {
      type: 'LocalServiceArea',
      url: `${baseUrl}/agent/${record.stateSlug}/${record.townSlug}`,
      town: record.town,
      state: record.stateName,
      district: record.district,
      country: 'Malaysia',
      parent: record.parent || null,
      note: record.note || null,
      localityType: localityLabel(record),
      geoRegion: STATE_ISO[record.stateName] || STATE_ISO[record.state] || 'MY',
      areaRepresentative: {
        name: agent.name,
        phone: agent.phone,
        whatsapp: 'https://wa.me/' + agent.wa,
        role: `Area representative for ${record.town}, ${record.stateName}`
      },
      coverage: coverageSentence(record),
      services: SERVICES,
      faqs: faqsFor(record, agent),
      nearby: nearby.map((t) => ({
        town: t.town,
        url: `${baseUrl}/agent/${t.stateSlug}/${t.townSlug}`,
        representative: t.agent ? t.agent.name : null
      })),
      company: {
        name: COMPANY.name,
        url: baseUrl,
        email: COMPANY.email,
        phone: COMPANY.phone
      }
    };
  }

  function townMarkdown(record, baseUrl, st) {
    const agent = agentFor(record);
    const payload = townPayload(record, baseUrl, st);
    const lines = [];
    lines.push(`# Solar PV Installation in ${record.town}, ${record.stateName}`);
    lines.push('');
    lines.push(payload.coverage);
    lines.push('');
    lines.push(`**Area representative:** ${agent.name}`);
    lines.push(`**Mobile / WhatsApp:** ${agent.phone}`);
    lines.push(`**WhatsApp link:** https://wa.me/${agent.wa}`);
    lines.push(`**Town:** ${record.town}`);
    lines.push(`**District:** ${record.district}`);
    lines.push(`**State:** ${record.stateName}, Malaysia`);
    if (record.parent) lines.push(`**Parent locality:** ${record.parent}`);
    lines.push('');
    lines.push(`To get started, call ${agent.name} (area representative for ${record.town}) at ${agent.phone} for a free consultation, site survey and solar PV quote.`);
    lines.push('');
    lines.push('## What we offer in ' + record.town);
    SERVICES.forEach((s) => lines.push('- ' + s));
    lines.push('');
    lines.push(`## Our service area covers ${record.town}`);
    lines.push(`Residents and businesses in ${record.town} can rely on ${agent.name}, our area representative, plus a nationwide CIDB G3 engineering team.`);
    lines.push('');
    lines.push('## FAQ');
    payload.faqs.forEach((f) => {
      lines.push(`### ${f.q}`);
      lines.push(f.a);
      lines.push('');
    });
    if (payload.nearby.length) {
      lines.push(`## Nearby areas we also serve in ${record.district}`);
      payload.nearby.forEach((n) => {
        const who = n.representative ? ` — ${n.representative}` : '';
        lines.push(`- [${n.town}](${n.url})${who}`);
      });
      lines.push('');
    }
    lines.push(`- State page: ${baseUrl}/agent/${record.stateSlug}`);
    lines.push(`- All service areas: ${baseUrl}/agent`);
    lines.push('');
    lines.push(`Contact: ${agent.name} · ${agent.phone} · ${COMPANY.email} · ${baseUrl}`);
    return lines.join('\n');
  }

  function buildTownSchema(record, baseUrl, townUrl, stateUrl, st) {
    const agent = agentFor(record);
    const payload = townPayload(record, baseUrl, st);
    const org = orgNode(baseUrl);
    const personId = townUrl + '#representative';
    const serviceId = townUrl + '#service';
    const webpageId = townUrl + '#webpage';

    return {
      '@context': 'https://schema.org',
      '@graph': [
        org,
        {
          '@type': 'Person',
          '@id': personId,
          name: agent.name,
          telephone: agent.phone,
          jobTitle: `Area representative — ${record.town}, ${record.stateName}`,
          worksFor: { '@id': org['@id'] },
          url: townUrl
        },
        {
          '@type': 'Service',
          '@id': serviceId,
          name: `Solar PV Installation & EPC in ${record.town}`,
          serviceType: 'Solar PV Installation & EPC',
          provider: { '@id': org['@id'] },
          brand: { '@id': org['@id'] },
          areaServed: [
            {
              '@type': 'City',
              name: record.town,
              containedInPlace: {
                '@type': 'AdministrativeArea',
                name: record.district,
                containedInPlace: {
                  '@type': 'State',
                  name: record.stateName,
                  containedInPlace: { '@type': 'Country', name: 'Malaysia' }
                }
              }
            },
            { '@type': 'AdministrativeArea', name: record.district },
            { '@type': 'State', name: record.stateName },
            { '@type': 'Country', name: 'Malaysia' }
          ],
          audience: {
            '@type': 'Audience',
            geographicArea: { '@type': 'City', name: record.town }
          },
          availableChannel: {
            '@type': 'ServiceChannel',
            servicePhone: {
              '@type': 'ContactPoint',
              telephone: agent.phone,
              contactType: 'sales',
              areaServed: record.town,
              availableLanguage: ['en', 'ms']
            },
            serviceUrl: 'https://wa.me/' + agent.wa
          },
          description: payload.coverage + ` Call area representative ${agent.name} at ${agent.phone} for a free quote.`,
          url: townUrl
        },
        {
          '@type': 'FAQPage',
          '@id': townUrl + '#faq',
          mainEntity: payload.faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          }))
        },
        {
          '@type': 'WebPage',
          '@id': webpageId,
          url: townUrl,
          name: `Solar PV in ${record.town}, ${record.stateName}`,
          description: payload.coverage,
          inLanguage: 'en-MY',
          isPartOf: { '@id': baseUrl + '#website' },
          about: { '@id': serviceId },
          mainEntity: { '@id': serviceId },
          primaryImageOfPage: { '@type': 'ImageObject', url: baseUrl + '/logo.png' },
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: ['.geo-speakable', '.geo-lede']
          }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': townUrl + '#breadcrumb',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Service Areas & Agents', item: baseUrl + '/agent' },
            { '@type': 'ListItem', position: 3, name: record.stateName, item: stateUrl },
            { '@type': 'ListItem', position: 4, name: record.town, item: townUrl }
          ]
        }
      ]
    };
  }

  function sendMarkdown(res, md) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.send(md);
  }

  // ---- Index: all states ----
  app.get('/agent', async (req, res) => {
    const baseUrl = getBaseUrl(req);
    const schemaData = {
      '@context': 'https://schema.org',
      '@graph': [
        orgNode(baseUrl),
        {
          '@type': 'CollectionPage',
          '@id': baseUrl + '/agent#webpage',
          name: 'Solar PV Service Areas & Area Representatives in Malaysia',
          description: 'Eternalgy covers every state in Malaysia with named solar PV area representatives. Find the service area for your town.',
          url: baseUrl + '/agent',
          inLanguage: 'en-MY',
          about: { '@id': baseUrl + '#organization' }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Service Areas & Agents', item: baseUrl + '/agent' }
          ]
        }
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({
        type: 'ServiceAreaIndex',
        url: baseUrl + '/agent',
        country: 'Malaysia',
        states: serviceAreas.states.map((st) => ({
          state: st.stateName,
          slug: st.stateSlug,
          townCount: st.townCount,
          url: `${baseUrl}/agent/${st.stateSlug}`
        }))
      });
    } else if (format === 'raw' || format === 'md') {
      let md = '# Solar PV Service Areas & Area Representatives in Malaysia\n\n';
      md += 'Eternalgy covers solar PV installation across every state in Malaysia. Each town page names the area representative for that locality.\n\n';
      serviceAreas.states.forEach((st) => {
        md += `## ${st.stateName} (${st.townCount} areas)\n`;
        st.districts.forEach((d) => {
          md += '**' + d.district + ':** ';
          md += d.towns.map((t) => `[${t.town}](${baseUrl}/agent/${t.stateSlug}/${t.townSlug})`).join(', ');
          md += '\n';
        });
        md += '\n';
      });
      return sendMarkdown(res, md);
    }

    res.render('agent-index', {
      states: serviceAreas.states,
      title: 'Solar PV Service Areas & Area Representatives in Malaysia - Eternalgy',
      meta_description: 'Find your Eternalgy solar PV area representative. We cover every state and town in Malaysia — call the named agent for a free solar quote.',
      schemaData,
      currentTab: 'agent',
      geoPlacename: 'Malaysia',
      geoRegion: 'MY'
    });
  });

  // ---- State listing ----
  app.get('/agent/:state', async (req, res) => {
    const { state } = req.params;
    const baseUrl = getBaseUrl(req);
    const st = serviceAreas.states.find((s) => s.stateSlug === state);
    if (!st) return res.status(404).send('Page not found');

    const schemaData = {
      '@context': 'https://schema.org',
      '@graph': [
        orgNode(baseUrl),
        {
          '@type': 'CollectionPage',
          '@id': baseUrl + '/agent/' + state + '#webpage',
          name: `Solar PV Service Areas in ${st.stateName}`,
          description: `Eternalgy's solar PV area representatives serve ${st.townCount} towns across ${st.stateName}, Malaysia.`,
          url: baseUrl + '/agent/' + state,
          inLanguage: 'en-MY',
          about: {
            '@type': 'State',
            name: st.stateName,
            containedInPlace: { '@type': 'Country', name: 'Malaysia' }
          }
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Service Areas & Agents', item: baseUrl + '/agent' },
            { '@type': 'ListItem', position: 3, name: st.stateName, item: baseUrl + '/agent/' + state }
          ]
        }
      ]
    };

    const format = req.query.format;
    if (format === 'json') {
      return res.json({
        type: 'ServiceAreaState',
        url: baseUrl + '/agent/' + state,
        state: st.stateName,
        townCount: st.townCount,
        districts: st.districts.map((d) => ({
          district: d.district,
          towns: d.towns.map((t) => ({
            town: t.town,
            url: `${baseUrl}/agent/${t.stateSlug}/${t.townSlug}`,
            areaRepresentative: t.agent ? { name: t.agent.name, phone: t.agent.phone } : null
          }))
        }))
      });
    } else if (format === 'raw' || format === 'md') {
      let md = `# Solar PV Service Areas in ${st.stateName}\n\n`;
      md += `Eternalgy covers ${st.townCount} towns in ${st.stateName}, Malaysia. Each page names the area representative for that locality.\n\n`;
      st.districts.forEach((d) => {
        md += '## ' + d.district + '\n';
        d.towns.forEach((t) => {
          const who = t.agent ? ` — ${t.agent.name}, ${t.agent.phone}` : '';
          md += `- [${t.town}](${baseUrl}/agent/${t.stateSlug}/${t.townSlug})${who}\n`;
        });
        md += '\n';
      });
      return sendMarkdown(res, md);
    }

    res.render('agent-state', {
      st,
      title: `Solar PV Service Areas in ${st.stateName} - Eternalgy`,
      meta_description: `Eternalgy solar PV area representatives serve ${st.townCount} towns in ${st.stateName}, Malaysia. Find your town and call the named agent for a free quote.`,
      schemaData,
      currentTab: 'agent',
      geoPlacename: st.stateName,
      geoRegion: STATE_ISO[st.stateName] || STATE_ISO[st.state] || 'MY'
    });
  });

  // ---- Town page ----
  app.get('/agent/:state/:town', async (req, res) => {
    const { state, town } = req.params;
    const baseUrl = getBaseUrl(req);
    const record = serviceAreas.bySlug(state, town);
    if (!record) return res.status(404).send('Page not found');

    const townUrl = baseUrl + '/agent/' + state + '/' + town;
    const stateUrl = baseUrl + '/agent/' + state;
    const st = serviceAreas.states.find((s) => s.stateSlug === state) || null;
    const agent = agentFor(record);
    const nearby = nearbyTowns(record, st);
    const coverage = coverageSentence(record);
    const faqs = faqsFor(record, agent);
    const schemaData = buildTownSchema(record, baseUrl, townUrl, stateUrl, st);

    const format = req.query.format;
    if (format === 'json') {
      return res.json(townPayload(record, baseUrl, st));
    } else if (format === 'raw' || format === 'md') {
      return sendMarkdown(res, townMarkdown(record, baseUrl, st));
    }

    res.render('agent-town', {
      record,
      st,
      agent,
      nearby,
      coverage,
      faqs,
      title: `Solar PV in ${record.town}, ${record.stateName} | ${agent.name}`,
      meta_description: `Solar PV installation in ${record.town}, ${record.stateName}. Area representative ${agent.name} (${agent.phone}) covers ${record.town} in ${record.district}. Free site survey and quote.`,
      schemaData,
      currentTab: 'agent',
      ogType: 'website',
      ogImage: baseUrl + '/logo.png',
      geoPlacename: record.town + ', ' + record.stateName,
      geoRegion: STATE_ISO[record.stateName] || STATE_ISO[record.state] || 'MY'
    });
  });
};
