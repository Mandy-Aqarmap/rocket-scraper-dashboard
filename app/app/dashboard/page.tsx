'use client';
import { useState, useEffect } from 'react';

interface ScrapeResult {
  id: string; platform: string; category: string; url: string;
  totalListings: number | null; status: 'success' | 'failed';
  responseTimeMs: number | null; scrapedAt: string; market: string;
}

export default function Dashboard() {
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [loading, setLoading] = useState(false);

  const scrape = async () => {
    setLoading(true);
    const res = await fetch('/api/scraper', { method: 'POST' });
    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  };

  useEffect(() => scrape(), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent">
          🚀 Rocket Scraper Dashboard
        </h1>
        
        <button 
          onClick={scrape} 
          disabled={loading}
          className="mb-8 px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold rounded-2xl hover:scale-105 shadow-2xl"
        >
          {loading ? '🛰️ Scraping...' : '🚀 Launch Scrape'}
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((r) => (
            <div key={r.id} className="bg-white/5 backdrop-blur p-6 rounded-3xl border border-white/10 hover:bg-white/10">
              <h3 className="font-bold text-xl mb-2">{r.platform}</h3>
              <p className="text-gray-400 mb-4">{r.category}</p>
              <div className="text-3xl font-bold mb-2">
                {r.totalListings?.toLocaleString() || 'N/A'}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                r.status === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {r.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
