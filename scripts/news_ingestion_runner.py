import os
import json
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
import re
import requests
import time
from google import genai
from google.genai import types

# ==============================================================================
# Configuration
# ==============================================================================
SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "https://eternalgy.me")
SITE_API_KEY = os.environ.get("SITE_API_KEY", "solar-ai-super-secret-key")

# Load credentials from Hermes Vault
VAULT_PATH = "C:/Users/Eternalgy/.hermes/vault.json"
GEMINI_API_KEY = None
MINIMAX_API_KEY = None

if os.path.exists(VAULT_PATH):
    try:
        with open(VAULT_PATH, "r", encoding="utf-8") as f:
            vault = json.load(f)
            for cred in vault.get("credentials", []):
                if cred.get("id") == "Gemini UniAPI key":
                    GEMINI_API_KEY = cred.get("credential").strip()
                if cred.get("id") == "Minimax Token Plan":
                    MINIMAX_API_KEY = cred.get("credential").strip()
    except Exception as e:
        print(f"Error reading vault.json: {e}")

# Fallback to environment variable if not in vault
if not GEMINI_API_KEY:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if not MINIMAX_API_KEY:
    MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "").strip()

GEMINI_BASE_URL = os.environ.get("GEMINI_BASE_URL", "https://api.uniapi.io/gemini")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-M3")

FEEDS = [
    # Google News Search Feeds for Malaysia
    ("Google News - Solar Malaysia", "https://news.google.com/rss/search?q=solar+energy+malaysia&hl=en-MY&gl=MY&ceid=MY:en"),
    ("Google News - RE Policy Malaysia", "https://news.google.com/rss/search?q=renewable+energy+policy+malaysia&hl=en-MY&gl=MY&ceid=MY:en"),
    ("Google News - PETRA Malaysia", "https://news.google.com/rss/search?q=PETRA+malaysia+energy&hl=en-MY&gl=MY&ceid=MY:en"),
    ("Google News - EV Charging Malaysia", "https://news.google.com/rss/search?q=ev+charging+malaysia&hl=en-MY&gl=MY&ceid=MY:en"),
    # Direct Feeds
    ("SEDA Malaysia", "https://www.seda.gov.my/feed/")
]

TAXONOMY_TAGS = ["malaysia", "ev", "solar", "wind", "policy", "market", "tech"]

# Load company information for marketing line generation
try:
    with open(os.path.join(os.path.dirname(os.path.dirname(__file__)), "Company_data", "Eternalgy_Profile_2025.md"), "r", encoding="utf-8") as f:
        COMPANY_INFO = f.read()
except Exception as e:
    COMPANY_INFO = ""
    print(f"Could not load company profile: {e}")

# ==============================================================================
# Helper functions
# ==============================================================================
def make_request(url, data=None, headers=None, method="GET"):
    if headers is None:
        headers = {}
    
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    if data is not None and "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.read().decode("utf-8"), res.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} for URL {url}: {err_body}")
        raise e
    except Exception as e:
        print(f"Error requesting URL {url}: {e}")
        raise e

def get_seen_urls():
    """Fetch all source URLs already recorded on the server to avoid duplicate lookups."""
    url = f"{SITE_BASE_URL}/api/news/seen"
    headers = {"Authorization": f"Bearer {SITE_API_KEY}"}
    try:
        res_body, _ = make_request(url, headers=headers)
        data = json.loads(res_body)
        return set(data.get("source_urls", []))
    except Exception as e:
        print(f"Failed to fetch seen URLs from database: {e}. Starting with empty set.")
        return set()

def fetch_feed_items(feed_url):
    """Retrieve and parse RSS channel articles."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        req = urllib.request.Request(feed_url, headers=headers)
        with urllib.request.urlopen(req) as res:
            xml_data = res.read()
        
        root = ET.fromstring(xml_data)
        items = []
        for item in root.findall(".//item"):
            title = item.find("title")
            link = item.find("link")
            pub_date = item.find("pubDate")
            desc = item.find("description")
            source = item.find("source")
            
            # Extract source name
            source_name = source.text if source is not None else None
            if not source_name and source is not None:
                source_name = source.attrib.get("url", "").replace("https://", "").replace("www.", "")

            items.append({
                "title": title.text if title is not None else "No Title",
                "link": link.text if link is not None else None,
                "published_at": pub_date.text if pub_date is not None else None,
                "description": desc.text if desc is not None else "",
                "source_name": source_name
            })
        return items
    except Exception as e:
        print(f"Error parsing feed {feed_url}: {e}")
        return []

def get_original_url(google_rss_url):
    """Resolve Google News redirect URL to the original source URL using batchexecute API."""
    if "news.google.com" not in google_rss_url:
        return google_rss_url
    try:
        headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        resp = requests.get(google_rss_url, headers=headers, timeout=10)
        
        # Look for c-wiz with data-p attribute
        match = re.search(r'data-p="([^"]+)"', resp.text)
        if not match:
            match = re.search(r'data-p=\\?"([^"]+)\\?"', resp.text)
            
        if not match:
            return google_rss_url
            
        data_p = match.group(1).replace('&quot;', '"')
        obj = json.loads(data_p.replace('%.@.', '["garturlreq",'))
        
        payload = {
            'f.req': json.dumps([[["Fbv4je", json.dumps(obj[:-6] + obj[-2:]), "null", "generic"]]])
        }
        
        post_headers = {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        url = "https://news.google.com/_/DotsSplashUi/data/batchexecute"
        response = requests.post(url, headers=post_headers, data=payload, timeout=10)
        
        parts = response.text.split("\n\n")
        if len(parts) > 1:
            array_string = json.loads(parts[1])[0][2]
            return json.loads(array_string)[1]
    except Exception as e:
        print(f"Failed to decode Google News redirect URL: {e}")
    return google_rss_url

def extract_article_text(resolved_url):
    """Fetch resolved article HTML and extract core plain-text body content."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        resp = requests.get(resolved_url, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"Request returned status code {resp.status_code}")
            return ""
            
        html = resp.text
        # Simple regex-based body extraction (stripping script/style tags)
        html = re.sub(r"<script.*?>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<style.*?>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", html) # Strip HTML tags
        text = re.sub(r"\s+", " ", text).strip() # Collapse whitespace
        
        # Return first 6000 characters to keep context size manageable
        return text[:6000]
    except Exception as e:
        print(f"Failed to scrape content: {e}")
        return ""

def ask_gemini_for_search_grounding(client, title, source_name=None):
    """Use Gemini ONLY for web search grounding to get raw article data."""
    system_prompt = (
        "You are a web search assistant. Use your Google Search tool to find and extract "
        "the full content of the specified news article. Return ONLY the raw article text "
        "in JSON format under 'raw_article_text'."
    )

    user_prompt = (
        f"Article Title: {title}\n"
        f"Source Outlet: {source_name or 'News'}\n\n"
        "Search for this article and extract the full raw text content. Return JSON with key 'raw_article_text'."
    )

    # Configure Google Search Grounding tool
    grounding_tool = types.Tool(google_search=types.GoogleSearch())
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[grounding_tool],
        response_mime_type="application/json"
    )

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=config
        )
        result = json.loads(response.text)
        return result.get("raw_article_text", "")
    except Exception as e:
        print(f"Gemini search API request failed: {e}")
        return ""

def ask_minimax_to_process(title, raw_content, article_url, source_name=None):
    """Use Minimax for rewriting, translation, tags, relevance, and marketing line."""
    system_prompt = (
        "You are an expert clean-energy technical copywriter, translator, and marketer.\n"
        "Your task is to process a news article under a strict strategy:\n"
        "1. REWRITE everything into a clean, easy-to-read Markdown BULLET POINT FORM.\n"
        "2. Avoid copyright copy-pasting. Summarize core stats, figures, dates, and takeaways.\n"
        "3. Provide a BILINGUAL translation (English first, followed by a Chinese translation).\n"
        "4. Choose relevant tags from the allowed list: 'malaysia', 'ev', 'solar', 'wind', 'policy', 'market', 'tech'.\n"
        "5. Classify the article's relevance to Solar PV, EV Charging, or Renewable Energy in Malaysia or ASEAN. Set 'relevant': true only if it is directly relevant; set 'relevant': false if it is off-topic.\n"
        "6. Create a 'marketing_line' in English (max 200 chars) that promotes Eternalgy Sdn Bhd while being relevant to this article, including a backlink to https://eternalgy.me/{article_slug} (use placeholder {article_slug} for now, we'll replace it later). Use the following company information:\n"
        f"{COMPANY_INFO}\n\n"
        "7. Output your result strictly in JSON format matching the schema."
    )

    user_prompt = (
        f"Article Title: {title}\n"
        f"Raw Article Text:\n{raw_content}\n"
        f"Article URL: {article_url}\n"
        f"Source Outlet: {source_name or 'News'}\n\n"
        "Generate a JSON response with:\n"
        "- 'title': An engaging, rewritten headline\n"
        "- 'content': The rewritten bilingual bullet points in Markdown (English at the top, Chinese below)\n"
        "- 'summary': A brief 1-2 sentence description in English\n"
        "- 'meta_description': A short 150-character SEO description\n"
        "- 'tags': A comma-separated list of applicable tags selected from: " + ", ".join(TAXONOMY_TAGS) + "\n"
        "- 'relevant': A boolean flag (true/false) indicating relevance\n"
        "- 'marketing_line': The promotional marketing line with backlink placeholder"
    )

    try:
        headers = {
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": MINIMAX_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 4000
        }
        
        response = requests.post(MINIMAX_BASE_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        # Extract content from Minimax response
        assistant_content = result["choices"][0]["message"]["content"]
        
        # Try to parse JSON from the response
        json_match = re.search(r'\{.*\}', assistant_content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            # Fallback: try to parse entire response
            return json.loads(assistant_content)
            
    except Exception as e:
        print(f"Minimax API request failed: {e}")
        raise e

def post_news_item(payload):
    """POST the processed news item to the site's content API."""
    url = f"{SITE_BASE_URL}/api/content"
    headers = {"Authorization": f"Bearer {SITE_API_KEY}"}
    try:
        res_body, _ = make_request(url, data=payload, headers=headers, method="POST")
        return json.loads(res_body)
    except Exception as e:
        print(f"Failed to post article '{payload.get('title')}': {e}")
        return None

# ==============================================================================
# Main Execution
# ==============================================================================
def main():
    print(f"--- Starting News Ingestion Inward Flow ---")
    print(f"Target Portal: {SITE_BASE_URL}")
    
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY is not configured in environment or vault.json.")
    if not MINIMAX_API_KEY:
        print("WARNING: MINIMAX_API_KEY is not configured in environment or vault.json. Ingestion cannot proceed.")
        return

    # Initialize Google GenAI client
    client = None
    if GEMINI_API_KEY:
        client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(base_url=GEMINI_BASE_URL)
        )

    # 1. Fetch seen URL registry
    seen_urls = get_seen_urls()
    print(f"Loaded {len(seen_urls)} already processed stories from the database.")

    # 2. Iterate through feeds and look for new links
    new_articles = []
    for feed_name, feed_url in FEEDS:
        print(f"\nScanning feed: {feed_name}...")
        items = fetch_feed_items(feed_url)
        print(f"Found {len(items)} items in feed XML.")
        
        feed_added = 0
        for item in items:
            link = item["link"]
            if not link:
                continue
            
            # Simple link normalizations
            link = link.strip().split("?")[0]
            
            # Skip if already stored in DB
            if link in seen_urls:
                continue
                
            # Queue for processing
            new_articles.append(item)
            seen_urls.add(link) # Add temporarily to seen set to avoid duplicate items in same run
            feed_added += 1
            
        print(f"Queued {feed_added} new items from this feed.")

    print(f"\nTotal new articles queued for processing: {len(new_articles)}")

    # 3. Process new articles
    processed_count = 0
    for idx, item in enumerate(new_articles):
        title = item["title"]
        url = item["link"]
        print(f"\n[{idx+1}/{len(new_articles)}] Processing: {title}")
        print(f"Source URL: {url}")
        
        # Step A: Resolve redirect URL if from Google News
        resolved_url = get_original_url(url)
        if resolved_url != url:
            print(f"Decoded redirect URL to: {resolved_url}")
            
        # Check if resolved URL is already seen/processed
        if resolved_url in seen_urls:
            print("Skipping: Resolved URL already processed/seen.")
            continue
        seen_urls.add(resolved_url)

        # Step B: Scrape page text
        raw_text = extract_article_text(resolved_url)
        if not raw_text or len(raw_text) < 200:
            print("No raw text or insufficient content scraped. Using Gemini search grounding...")
            if client:
                raw_text = ask_gemini_for_search_grounding(client, title, item.get("source_name"))
            else:
                raw_text = ""
            
        # Step C: Minimax processing (rewrite, translate, tags, relevance, marketing line)
        try:
            print("Processing article via Minimax...")
            llm_result = ask_minimax_to_process(title, raw_text, resolved_url, item.get("source_name"))
        except Exception:
            print("Skipping: Minimax API call failed.")
            continue

        # Step C2: Check relevance
        if not llm_result.get("relevant", True):
            print(f"Skipping article '{title}' because it is classified as not relevant.")
            continue

        # Step D: Create a temporary slug to generate marketing line
        temp_slug = re.sub(r'[^a-zA-Z0-9\-]', '-', title.lower().replace(' ', '-'))
        temp_slug = re.sub(r'-+', '-', temp_slug).strip('-')
        
        # Replace placeholder in marketing line with actual URL
        marketing_line = llm_result.get("marketing_line", "")
        marketing_line = marketing_line.replace("{article_slug}", temp_slug)

        # Step E: Post payload assembly
        post_payload = {
            "title": llm_result.get("title", title),
            "category": "news",
            "content": llm_result.get("content", ""),
            "summary": llm_result.get("summary", ""),
            "meta_description": llm_result.get("meta_description", ""),
            "tags": llm_result.get("tags", "news"),
            "source_url": resolved_url,
            "source_name": item.get("source_name") or "News Wire",
            "published_at": item.get("published_at"),
            "published": True,
            "marketing_line": marketing_line
        }

        # Step F: POST to Eternalgy backend
        print("Posting to database...")
        api_res = post_news_item(post_payload)
        if api_res and api_res.get("success"):
            action = api_res.get("action", "upserted")
            print(f"Success: Article successfully {action} on portal!")
            processed_count += 1
        else:
            print("Posting failed.")

        # Rate limit protection / politeness delay
        time.sleep(1)

    print(f"\n--- Ingestion Run Complete ---")
    print(f"Successfully processed and posted {processed_count} news stories.")

if __name__ == "__main__":
    main()
