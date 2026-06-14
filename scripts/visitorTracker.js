const db = require('../db');

/**
 * Classifies a user-agent string into visitor types: human, seo_crawler, ai_crawler, or other_bot
 * @param {string} ua User-Agent string
 * @returns {{ type: string, name: string|null }}
 */
function classifyVisitor(ua) {
  if (!ua) return { type: 'human', name: null };
  const uaLower = ua.toLowerCase();

  // 1. LLM / AI Bots
  const aiBots = [
    { name: 'GPTBot', pattern: 'gptbot' },
    { name: 'OAI-SearchBot', pattern: 'oai-searchbot' },
    { name: 'ClaudeBot', pattern: 'claudebot' },
    { name: 'Claude-Web', pattern: 'claude-web' },
    { name: 'PerplexityBot', pattern: 'perplexitybot' },
    { name: 'Google-Extended', pattern: 'google-extended' },
    { name: 'Applebot-Extended', pattern: 'applebot-extended' },
    { name: 'Cohere', pattern: 'cohere-ai' },
    { name: 'Cohere', pattern: 'cohere' },
    { name: 'MetaBot', pattern: 'metabot' },
    { name: 'MetaBot', pattern: 'facebookexternalhit' },
    { name: 'CCBot', pattern: 'ccbot' },
    { name: 'Diffbot', pattern: 'diffbot' },
    { name: 'YouBot', pattern: 'youbot' }
  ];

  for (const bot of aiBots) {
    if (uaLower.includes(bot.pattern)) {
      return { type: 'ai_crawler', name: bot.name };
    }
  }

  // 2. SEO Spiders
  const seoSpiders = [
    { name: 'Googlebot', pattern: 'googlebot' },
    { name: 'Bingbot', pattern: 'bingbot' },
    { name: 'Baiduspider', pattern: 'baiduspider' },
    { name: 'YandexBot', pattern: 'yandexbot' },
    { name: 'Sogou Spider', pattern: 'sogouspider' },
    { name: 'DuckDuckBot', pattern: 'duckduckbot' },
    { name: 'Yahoo! Slurp', pattern: 'yahoo! slurp' }
  ];

  for (const bot of seoSpiders) {
    if (uaLower.includes(bot.pattern)) {
      return { type: 'seo_crawler', name: bot.name };
    }
  }

  // 3. General bots/crawlers/scrapers
  const generalBots = ['bot', 'crawler', 'spider', 'scrap', 'curl', 'wget', 'python', 'node-fetch', 'headless', 'selenium', 'playwright'];
  for (const botPattern of generalBots) {
    if (uaLower.includes(botPattern)) {
      return { type: 'other_bot', name: 'Generic Bot/Scraper' };
    }
  }

  // 4. Default to Human
  return { type: 'human', name: null };
}

/**
 * Express middleware to track visitor information and log it to PostgreSQL
 */
function trackVisitor(req, res, next) {
  // Exclude static assets
  const staticAssetRegex = /\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map|json|xml)$/i;
  
  const isStatic = staticAssetRegex.test(req.path) || 
                   req.path.startsWith('/css/') || 
                   req.path.startsWith('/logo.png') ||
                   req.path.startsWith('/favicon.ico');
                   
  if (isStatic) {
    return next();
  }

  const start = Date.now();

  // Listen to response finish to log details asynchronously
  res.on('finish', async () => {
    const duration = Date.now() - start;
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    // If x-forwarded-for has multiple IPs, take the first one
    if (ip && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }
    const ua = req.get('User-Agent') || '';
    const url = req.originalUrl || req.url;
    const referer = req.get('Referer') || req.get('Referrer') || '';
    const method = req.method;
    const statusCode = res.statusCode;
    // req.isMobile is set by the detectDevice middleware
    const deviceType = req.isMobile ? 'mobile' : 'desktop';

    const { type: visitorType, name: botName } = classifyVisitor(ua);

    try {
      await db.pool.query(
        `INSERT INTO main_site_visitor_logs 
         (ip_address, user_agent, url, referer, method, status_code, device_type, visitor_type, bot_name, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ip, ua, url, referer, method, statusCode, deviceType, visitorType, botName, duration]
      );
    } catch (err) {
      console.error('Failed to log visitor details:', err);
    }
  });

  next();
}

module.exports = {
  classifyVisitor,
  trackVisitor
};
