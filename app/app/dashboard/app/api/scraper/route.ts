import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type MarketKey = 'turkey' | 'uae' | 'morocco' | 'competitors' | 'clients';

interface ScrapeResult {
  id: string;
  platform: string;
  category: string;
  url: string;
  totalListings: number | null;
  status: 'success' | 'failed';
  responseTimeMs: number | null;
  scrapedAt: string;
  market: MarketKey;
  cached?: boolean;
  error?: string;
}

interface CacheEntry {
  results: ScrapeResult[];
  scrapedAt: string;
}

// In-memory cache per market
const marketCache: Partial<Record<MarketKey, CacheEntry>> = {};

interface TargetDef {
  id: string;
  platform: string;
  category: string;
  url: string;
  market: MarketKey;
  patterns: RegExp[];
}

const COMMON_PATTERNS: RegExp[] = [
  /"totalCount"\s*:\s*(\d+)/,
  /"total_count"\s*:\s*(\d+)/,
  /"total"\s*:\s*(\d+)/,
  /"count"\s*:\s*(\d+)/,
  /data-count="(\d+)"/,
  /data-total="(\d+)"/,
  /"hits"\s*:\s*(\d+)/,
  /"nbHits"\s*:\s*(\d+)/,
  /(\d[\d,]+)\s+(?:properties|listings|results|annonces|إعلان)/i,
  /<span[^>]*class="[^"]*(?:count|total|result)[^"]*"[^>]*>([\d,. ]+)</i,
];

const TARGETS: TargetDef[] = [
  // ── TURKEY ──────────────────────────────────────────────────────────────────
  {
    id: 'sahibinden-ilan', platform: 'Sahibinden', category: 'Tüm İlanlar (Giriş)',
    url: 'https://banaozel.sahibinden.com/', market: 'turkey',
    patterns: [/(\d[\d.,]+)\s*ilan/i, /"totalCount"\s*:\s*(\d+)/, /data-count="(\d+)"/, ...COMMON_PATTERNS],
  },
  {
    id: 'hepsiemlak-satilik', platform: 'Hepsiemlak', category: 'Satılık',
    url: 'https://www.hepsiemlak.com/satilik', market: 'turkey',
    patterns: [/"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, /data-total="(\d+)"/, ...COMMON_PATTERNS],
  },
  {
    id: 'hepsiemlak-kiralik', platform: 'Hepsiemlak', category: 'Kiralık',
    url: 'https://www.hepsiemlak.com/kiralik', market: 'turkey',
    patterns: [/"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'hepsiemlak-gunluk', platform: 'Hepsiemlak', category: 'Günlük Kiralık',
    url: 'https://www.hepsiemlak.com/gunluk-kiralik', market: 'turkey',
    patterns: [/"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-satilik-konut', platform: 'Emlakjet', category: 'Satılık Konut',
    url: 'https://www.emlakjet.com/satilik-konut/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-satilik-isyeri', platform: 'Emlakjet', category: 'Satılık İşyeri',
    url: 'https://www.emlakjet.com/satilik-isyeri/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-satilik-arsa', platform: 'Emlakjet', category: 'Satılık Arsa',
    url: 'https://www.emlakjet.com/satilik-arsa/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-kiralik-konut', platform: 'Emlakjet', category: 'Kiralık Konut',
    url: 'https://www.emlakjet.com/kiralik-konut/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-gunluk-kiralik', platform: 'Emlakjet', category: 'Günlük Kiralık Konut',
    url: 'https://www.emlakjet.com/gunluk-kiralik-konut/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },
  {
    id: 'emlakjet-kiralik-isyeri', platform: 'Emlakjet', category: 'Kiralık İşyeri',
    url: 'https://www.emlakjet.com/kiralik-isyeri/', market: 'turkey',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d.,]+)\s*ilan/i, ...COMMON_PATTERNS],
  },

  // ── UAE ─────────────────────────────────────────────────────────────────────
  {
    id: 'dubizzle-uae', platform: 'Dubizzle', category: 'All Properties',
    url: 'https://uae.dubizzle.com/search/', market: 'uae',
    patterns: [/"totalCount"\s*:\s*(\d+)/, /"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|listings|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'propertyfinder-uae-sale', platform: 'PropertyFinder UAE', category: 'For Sale',
    url: 'https://www.propertyfinder.ae/en/search?c=2&fu=0&rp=y&ob=mr', market: 'uae',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, /"nbHits"\s*:\s*(\d+)/, ...COMMON_PATTERNS],
  },
  {
    id: 'propertyfinder-uae-rent', platform: 'PropertyFinder UAE', category: 'For Rent',
    url: 'https://www.propertyfinder.ae/en/search?c=1&fu=0&ob=mr', market: 'uae',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, /"nbHits"\s*:\s*(\d+)/, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-uae-sale', platform: 'Bayut UAE', category: 'For Sale',
    url: 'https://www.bayut.com/for-sale/property/uae/', market: 'uae',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-uae-rent', platform: 'Bayut UAE', category: 'For Rent',
    url: 'https://www.bayut.com/to-rent/property/uae/', market: 'uae',
    patterns: [/"total"\s*:\s*(\d+)/, /"totalCount"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },

  // ── MOROCCO ──────────────────────────────────────────────────────────────────
  {
    id: 'avito-ma-sale', platform: 'Avito.ma', category: 'Immobilier à Vendre',
    url: 'https://www.avito.ma/fr/maroc/immobilier-%C3%A0_vendre', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, /"count"\s*:\s*(\d+)/, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-sale', platform: 'Mubawab', category: 'Immobilier à Vendre',
    url: 'https://www.mubawab.ma/fr/mp/immobilier-a-vendre', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, /"count"\s*:\s*(\d+)/, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-rent', platform: 'Mubawab', category: 'Immobilier à Louer',
    url: 'https://www.mubawab.ma/fr/mp/immobilier-a-louer', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, /"count"\s*:\s*(\d+)/, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-bureaux-sale', platform: 'Mubawab', category: 'Bureaux & Commerces à Vendre',
    url: 'https://www.mubawab.ma/fr/mp/bureaux-et-commerces-a-vendre', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-terrains', platform: 'Mubawab', category: 'Terrains à Vendre',
    url: 'https://www.mubawab.ma/fr/mp/terrains-a-vendre', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-bureaux-rent', platform: 'Mubawab', category: 'Bureaux & Commerces à Louer',
    url: 'https://www.mubawab.ma/fr/mp/bureaux-et-commerces-a-louer', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-promo', platform: 'Mubawab', category: 'Listing Promotion',
    url: 'https://www.mubawab.ma/fr/pmp/listing-promotion', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, ...COMMON_PATTERNS],
  },
  {
    id: 'mubawab-hmp-rent', platform: 'Mubawab', category: 'Immobilier à Louer (HMP)',
    url: 'https://www.mubawab.ma/fr/hmp/immobilier-a-louer', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+annonces/i, ...COMMON_PATTERNS],
  },
  {
    id: 'sarouty-sale', platform: 'Sarouty', category: 'For Sale',
    url: 'https://www.sarouty.ma/recherche/?cat=1&trans=1', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+(?:annonces|biens)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'sarouty-rent', platform: 'Sarouty', category: 'For Rent',
    url: 'https://www.sarouty.ma/recherche/?cat=1&trans=2', market: 'morocco',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+(?:annonces|biens)/i, ...COMMON_PATTERNS],
  },

  // ── COMPETITORS ──────────────────────────────────────────────────────────────
  {
    id: 'pf-qa-sale', platform: 'PropertyFinder QA', category: 'For Sale',
    url: 'https://www.propertyfinder.qa/en/search?c=2&fu=0&rp=m&ob=mr', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /"nbHits"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-qa-rent', platform: 'PropertyFinder QA', category: 'For Rent',
    url: 'https://www.propertyfinder.qa/en/search?c=1&fu=0&ob=mr', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /"nbHits"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-bh-rent', platform: 'PropertyFinder BH', category: 'For Rent',
    url: 'https://www.propertyfinder.bh/en/search?c=1&fu=0&ob=mr', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /"nbHits"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-bh-sale', platform: 'PropertyFinder BH', category: 'For Sale',
    url: 'https://www.propertyfinder.bh/en/search?c=2&fu=0&rp=m&ob=mr', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /"nbHits"\s*:\s*(\d+)/, /(\d[\d,]+)\s+properties/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-mx-sale', platform: 'Lamudi Mexico', category: 'For Sale',
    url: 'https://www.lamudi.com.mx/for-sale/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|listings|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-mx-rent', platform: 'Lamudi Mexico', category: 'For Rent',
    url: 'https://www.lamudi.com.mx/for-rent/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|listings|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-ph-buy', platform: 'Lamudi Philippines', category: 'Buy',
    url: 'https://www.lamudi.com.ph/buy/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|listings|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-ph-rent', platform: 'Lamudi Philippines', category: 'Rent',
    url: 'https://www.lamudi.com.ph/rent/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|listings|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-id-jual', platform: 'Lamudi Indonesia', category: 'Jual (Sale)',
    url: 'https://www.lamudi.co.id/jual/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d.]+)\s+(?:properti|iklan)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'lamudi-id-sewa', platform: 'Lamudi Indonesia', category: 'Sewa (Rent)',
    url: 'https://www.lamudi.co.id/sewa/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d.]+)\s+(?:properti|iklan)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'zameen-homes', platform: 'Zameen', category: 'Homes',
    url: 'https://www.zameen.com/Homes/Pakistan-1521-1.html', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'zameen-rentals', platform: 'Zameen', category: 'Rentals',
    url: 'https://www.zameen.com/Rentals/Pakistan-1521-1.html', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'zameen-plots', platform: 'Zameen', category: 'Plots',
    url: 'https://www.zameen.com/Plots/Pakistan-1521-1.html', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'zameen-commercial', platform: 'Zameen', category: 'Commercial',
    url: 'https://www.zameen.com/Commercial/Pakistan-1521-1.html', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'zameen-rentals-commercial', platform: 'Zameen', category: 'Commercial Rentals',
    url: 'https://www.zameen.com/Rentals_Commercial/Pakistan-1521-1.html', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-jo-sale', platform: 'Bayut Jordan', category: 'For Sale',
    url: 'https://www.bayut.jo/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9/%D8%A7%D9%84%D8%A3%D8%B1%D8%AF%D9%86/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties|عقار)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-jo-rent', platform: 'Bayut Jordan', category: 'For Rent',
    url: 'https://www.bayut.jo/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A7%D9%8A%D8%AC%D8%A7%D8%B1/%D8%A7%D9%84%D8%A3%D8%B1%D8%AF%D9%86/', market: 'competitors',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:results|properties|عقار)/i, ...COMMON_PATTERNS],
  },

  // ── CLIENTS ──────────────────────────────────────────────────────────────────
  {
    id: 'pf-eg-brokers', platform: 'PropertyFinder EG', category: 'Find Broker',
    url: 'https://www.propertyfinder.eg/en/find-broker/search', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:brokers|agents|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-eg-projects', platform: 'PropertyFinder EG', category: 'New Projects',
    url: 'https://www.propertyfinder.eg/ar/new-projects', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:projects|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-eg-companies', platform: 'Bayut EG', category: 'Real Estate Companies',
    url: 'https://www.bayut.eg/%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA-%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A%D8%A9/%D8%A8%D8%AD%D8%AB/', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:companies|شركة)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-sa-brokers', platform: 'PropertyFinder SA', category: 'Find Broker',
    url: 'https://www.propertyfinder.sa/en/find-broker/search', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:brokers|agents|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-sa-companies', platform: 'Bayut SA', category: 'Real Estate Companies',
    url: 'https://www.bayut.sa/%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA-%D8%A7%D9%84%D8%B9%D9%82%D8%A7%D8%B1%D9%8A%D8%A9/%D8%A8%D8%AD%D8%AB/', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:companies|شركة)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-ae-agents', platform: 'PropertyFinder AE', category: 'Find Agent',
    url: 'https://www.propertyfinder.ae/en/find-agent/search', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:agents|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-ae-projects', platform: 'PropertyFinder AE', category: 'New Projects',
    url: 'https://www.propertyfinder.ae/en/new-projects', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:projects|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'bayut-ae-companies', platform: 'Bayut AE', category: 'Companies Search',
    url: 'https://www.bayut.com/companies/search/', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:companies|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'sarouty-ma-agents', platform: 'Sarouty MA', category: 'Agents',
    url: 'https://www.sarouty.ma/ar/agents/', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d\s]+)\s+(?:agents|وكيل)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-qa-brokers', platform: 'PropertyFinder QA', category: 'Find Broker',
    url: 'https://www.propertyfinder.qa/en/find-broker/search', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:brokers|agents|results)/i, ...COMMON_PATTERNS],
  },
  {
    id: 'pf-bh-brokers', platform: 'PropertyFinder BH', category: 'Find Broker',
    url: 'https://www.propertyfinder.bh/en/find-broker/search', market: 'clients',
    patterns: [/"total"\s*:\s*(\d+)/, /(\d[\d,]+)\s+(?:brokers|agents|results)/i, ...COMMON_PATTERNS],
  },
];

function parseCount(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const raw = match[1].replace(/[\s.,]/g, '');
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

async function scrapeTarget(target: TargetDef): Promise<ScrapeResult> {
  const start = Date.now();
  const scrapedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(target.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,fr;q=0.7,tr;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;

    if (!response.ok) {
      return {
        id: target.id, platform: target.platform, category: target.category,
        url: target.url, totalListings: null, status: 'failed',
        responseTimeMs, scrapedAt, market: target.market,
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const totalListings = parseCount(html, target.patterns);

    return {
      id: target.id, platform: target.platform, category: target.category,
      url: target.url, totalListings, market: target.market,
      status: totalListings !== null ? 'success' : 'failed',
      responseTimeMs, scrapedAt,
      error: totalListings === null ? 'Could not parse listing count from page' : undefined,
    };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      id: target.id, platform: target.platform, category: target.category,
      url: target.url, totalListings: null, status: 'failed',
      responseTimeMs, scrapedAt, market: target.market,
      error: message.includes('abort') ? 'Request timed out (15s)' : message,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const useCache = body?.useCache === true;
    const market: MarketKey | 'all' = body?.market ?? 'all';

    const targetsToScrape = market === 'all'
      ? TARGETS
      : TARGETS.filter((t) => t.market === market);

    // Return cached data if requested
    if (useCache) {
      if (market === 'all') {
        const allCached = Object.values(marketCache).flatMap((c) => c?.results ?? []);
        if (allCached.length > 0) {
          const scrapedAt = Object.values(marketCache).map((c) => c?.scrapedAt ?? '').sort().pop() ?? null;
          return NextResponse.json({ results: allCached.map((r) => ({ ...r, cached: true })), scrapedAt, fromCache: true });
        }
      } else {
        const cached = marketCache[market];
        if (cached) {
          const cacheAge = Date.now() - new Date(cached.scrapedAt).getTime();
          if (cacheAge < 30 * 24 * 60 * 60 * 1000) {
            return NextResponse.json({ results: cached.results.map((r) => ({ ...r, cached: true })), scrapedAt: cached.scrapedAt, fromCache: true });
          }
        }
      }
    }

    // Run scrapes concurrently
    const results = await Promise.all(targetsToScrape.map((t) => scrapeTarget(t)));

    // Merge with cache: keep last known value on failure
    const prevMap = new Map<string, ScrapeResult>();
    Object.values(marketCache).forEach((c) => c?.results.forEach((r) => prevMap.set(r.id, r)));

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'failed') {
        const prev = prevMap.get(results[i].id);
        if (prev && prev.totalListings !== null) {
          results[i] = { ...results[i], totalListings: prev.totalListings, error: (results[i].error ?? '') + ' (showing last known value)' };
        }
      }
    }

    // Update per-market cache
    const byMarket = new Map<MarketKey, ScrapeResult[]>();
    results.forEach((r) => {
      const arr = byMarket.get(r.market) ?? [];
      arr.push(r);
      byMarket.set(r.market, arr);
    });
    const now = new Date().toISOString();
    byMarket.forEach((arr, mk) => { marketCache[mk] = { results: arr, scrapedAt: now }; });

    return NextResponse.json({ results, scrapedAt: now, fromCache: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const allCached = Object.values(marketCache).flatMap((c) => c?.results ?? []);
  if (allCached.length > 0) {
    const scrapedAt = Object.values(marketCache).map((c) => c?.scrapedAt ?? '').sort().pop() ?? null;
    return NextResponse.json({ results: allCached, scrapedAt, fromCache: true });
  }
  return NextResponse.json({ results: [], scrapedAt: null, fromCache: false });
}
