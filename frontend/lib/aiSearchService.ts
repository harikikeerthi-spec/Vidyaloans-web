import { universities as localUniversitiesMap } from './universityData';
import { searchCachedUniversities, FastUniversity } from './universitySearchEngine';

export type ReqBody = {
  country?: string;
  course?: string;
  gpa?: number;
  bachelors?: string;
  target_university?: string;
  type?: string;
  query?: string;
  slug?: string;
};

// High-speed server-side in-memory cache (24 hours TTL)
const serverCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;


export function getFallbackUniversities(country?: string, query?: string): Array<{ name: string; loc: string; country: string; rank?: number; badge?: string; slug?: string }> {
  const cached = searchCachedUniversities(query || '', country || '', 30);
  return cached.map(u => ({
    name: u.name,
    loc: u.loc,
    country: u.country,
    rank: u.rank,
    badge: u.badge,
    slug: u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }));
}


const OPENROUTER_MODELS = [
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-7b-instruct:free'
];

async function callOpenRouterWithFallback(prompt: string, systemPrompt?: string) {
  const API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  if (!API_KEY) return null;

  const messages: any[] = [];
  messages.push({
    role: 'system',
    content: systemPrompt || 'You are a higher education database assistant. Output ONLY valid, strict JSON object. No markdown, no prose outside JSON.'
  });
  messages.push({ role: 'user', content: prompt });

  for (const model of OPENROUTER_MODELS) {
    // 1st attempt: standard json_object response format with 3.5s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://vidyaloan.com',
          'X-Title': 'VidyaLoan',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 600,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content);
        }
      } else {
        const errText = await res.text();
        console.warn(`OpenRouter model ${model} failed, trying next:`, errText);
      }
    } catch (e) {
      console.warn(`OpenRouter model ${model} 1st attempt exception:`, e);
    }

    // 2nd attempt: plain text output with sanitization and timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://vidyaloan.com',
          'X-Title': 'VidyaLoan',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 600,
          temperature: 0.1,
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const sanitized = content
          .replace(/"([a-zA-Z0-9_]+)=\[/g, '"$1": [')
          .replace(/"([a-zA-Z0-9_]+)=\{/g, '"$1": {')
          .replace(/"([a-zA-Z0-9_]+)="([^"]*)"/g, '"$1": "$2"');

        const match = sanitized.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
          return JSON.parse(match[0]);
        }
      }
    } catch (e) {
      console.warn(`OpenRouter model ${model} 2nd attempt exception:`, e);
    }
  }

  return null;
}

export async function fetchUniversityData(body: ReqBody) {
  const { country = 'Any', course = '', gpa = 0, bachelors = '', target_university = '', type = '', query = '', slug = '' } = body;

  const cacheKey = JSON.stringify({ type, query: (query || '').toLowerCase().trim(), country: (country || '').toLowerCase().trim(), slug });
  const cached = serverCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let prompt = '';
  let systemPrompt = 'You are a higher education database assistant. Output ONLY valid, strict, clean JSON object.';

  if (type === 'university_detail') {
    prompt = `Provide a comprehensive, real-world detailed profile for the university: "${query || slug}". 
    Location context: ${country}. Program interest: ${course}.
    
    CRITICAL: For the "websiteDomain" field, provide ONLY the real official domain of this university (official .edu, .ac.uk, or institutional domain). Do NOT invent domains.

    Return a single JSON object with EXACTLY these key-value pairs (use double quotes for all keys and strings, and standard colons between key and value):
    {
      "name": "Full Official Name of the University",
      "shortName": "Common Short Name",
      "loc": "City, State/Province",
      "country": "Country",
      "countryCode": "2-letter ISO country code",
      "websiteDomain": "university.edu",
      "founded": 1900,
      "rank": 123,
      "rankBy": "QS World Rankings",
      "acceptanceRate": 15,
      "tuition": 35000,
      "currency": "USD",
      "description": "Rich history and academic standing.",
      "programs": [
        { "name": "M.S. in Computer Science", "degree": "Master's", "duration": "2 Years", "tuition": "$35,000/year", "icon": "code" }
      ],
      "requirements": { "gpa": "3.5/4.0 or 8.0/10", "ielts": "7.0", "toefl": "100+", "gre": "Optional" },
      "stats": { "totalStudents": "25,000+", "internationalStudents": "22%", "facultyRatio": "14:1", "employmentRate": "94%", "researchOutput": "Very High", "avgSalary": "$110k" },
      "loan": true,
      "pros": ["Top faculty", "Great campus"],
      "facilities": [{ "name": "Robotics Lab", "icon": "smart_toy" }],
      "funFacts": ["Fact 1", "Fact 2"],
      "whyStudyHere": ["Reason 1", "Reason 2"],
      "notableAlumni": [{ "name": "Full Name", "role": "Role description" }]
    }`;
  } else if (type === 'course') {
    systemPrompt = 'You are a course database assistant. Output ONLY a valid JSON object with a "courses" array.';
    prompt = `Search for courses/majors matching "${query || course}". 
    Return a JSON object: { "courses": ["Course 1", "Course 2"] }`;
  } else {
    if (query && query.trim().length > 0) {
      prompt = `Return a JSON object { "universities": [...] } with up to 15 real, accredited universities matching "${query}" located in ${country && country !== 'Any' ? country : 'the world'}.
      For each university, return:
      - name: Full official name of the university
      - loc: City, State/Province
      - country: Country Name
      - rank: approximate global QS ranking (integer)
      - slug: url-friendly slug`;
    } else {
      prompt = `Return a JSON object { "universities": [...] } with 20 real, accredited universities located in ${country}.
      Include top-tier and accredited universities in ${country}.
      For each university, return:
      - name: Full official name
      - loc: City, State/Province
      - country: "${country}"
      - rank: global QS ranking (integer)
      - slug: url-friendly slug`;
    }
  }

  const parsed = await callOpenRouterWithFallback(prompt, systemPrompt);


  if (parsed) {
    if (type === 'university_detail') {
      const domain = (parsed.websiteDomain || parsed.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

      parsed.website = domain ? `https://www.${domain}` : (parsed.website || '');
      parsed.logo = domain ? `https://logo.clearbit.com/${domain}` : (parsed.logo || '');

      const countryKey = (parsed.country || country || '').toLowerCase();
      const HERO_IMAGES: Record<string, string> = {
        'united kingdom': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
        'uk': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
        'usa': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
        'united states': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
        'canada': 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=1600&q=80',
        'australia': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1600&q=80',
        'germany': 'https://images.unsplash.com/photo-1597672890275-702a4953ff1f?w=1600&q=80',
        'ireland': 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?w=1600&q=80',
        'france': 'https://images.unsplash.com/photo-1549144511-f099e773c147?w=1600&q=80',
        'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&q=80',
      };
      const CAMPUS_IMAGES: Record<string, string[]> = {
        'united kingdom': [
          'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80',
          'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=800&q=80',
          'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
        ],
        'uk': [
          'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80',
          'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=800&q=80',
          'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
        ],
        'usa': [
          'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&q=80',
          'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=800&q=80',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        ],
        'united states': [
          'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&q=80',
          'https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=800&q=80',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
        ],
      };
      const defaultHero = 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&q=80';
      const defaultCampus = [
        'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80',
        'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
      ];

      parsed.heroImage = parsed.heroImage || HERO_IMAGES[countryKey] || defaultHero;
      parsed.campusImages = (parsed.campusImages && parsed.campusImages.length > 0)
        ? parsed.campusImages
        : (CAMPUS_IMAGES[countryKey] || defaultCampus);

      // Ensure pros is an array
      if (typeof parsed.pros === 'string') {
        parsed.pros = [parsed.pros];
      }

      return { university: parsed };
    }
    if (type === 'course') return { results: Array.isArray(parsed) ? parsed : (parsed.courses || parsed.results || []) };

    const aiUnis = parsed.universities || parsed.results || [];
    if (Array.isArray(aiUnis) && aiUnis.length > 0) {
      const ret = { universities: aiUnis };
      serverCache.set(cacheKey, { data: ret, timestamp: Date.now() });
      return ret;
    }
  }

  // Fail-Safe Fallback: When AI fails or OPENROUTER_API_KEY is not set on server, return dataset
  if (type === 'university_detail') {
    const slugKey = (slug || query || '').toLowerCase();
    const found = localUniversitiesMap[slugKey] || Object.values(localUniversitiesMap).find(u => u.name.toLowerCase().includes(slugKey));
    const ret = { university: found || null };
    serverCache.set(cacheKey, { data: ret, timestamp: Date.now() });
    return ret;
  }
  if (type === 'course') return { results: ['B.Tech/B.E.', 'MS/M.Tech', 'MBA/PGDM', 'MBBS/Medicine', 'Data Science', 'Computer Science', 'Business Analytics'] };

  const fallbackUnis = getFallbackUniversities(country, query);
  const ret = { universities: fallbackUnis };
  serverCache.set(cacheKey, { data: ret, timestamp: Date.now() });
  return ret;
}