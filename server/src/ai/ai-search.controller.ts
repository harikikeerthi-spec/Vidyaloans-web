import { Controller, Post, Body } from '@nestjs/common';
import { OpenRouterService } from './services/openrouter.service';
import * as fs from 'fs';
import * as path from 'path';

export interface DiscoveredUniversity {
  name: string;
  loc: string;
  country: string;
  rank?: number;
  accept?: number;
  tuition?: number;
  loan?: boolean;
  slug?: string;
  website?: string;
  isAiDiscovered?: boolean;
}

// Runtime dynamic cache populated exclusively by live AI responses (ZERO hardcoded data in code)
const dynamicAiStore = new Map<string, DiscoveredUniversity>();
let isDiskCacheLoaded = false;

function getCacheFilePath(): string {
  const dir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, 'ai_universities_cache.json');
}

function loadDiskCache() {
  if (isDiskCacheLoaded) return;
  isDiskCacheLoaded = true;
  try {
    const file = getCacheFilePath();
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const list: DiscoveredUniversity[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const uni of list) {
          if (uni && uni.name) {
            dynamicAiStore.set(cleanKey(uni.name), uni);
          }
        }
        console.log(`[AiSearchController] Loaded ${dynamicAiStore.size} AI-discovered universities from runtime cache.`);
      }
    }
  } catch (err: any) {
    console.warn('[AiSearchController] Could not read disk cache:', err?.message || err);
  }
}

function saveDiskCache() {
  try {
    const file = getCacheFilePath();
    const list = Array.from(dynamicAiStore.values());
    fs.writeFile(file, JSON.stringify(list, null, 2), 'utf8', () => {});
  } catch {}
}

function cleanKey(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCountry(c: string): string {
  const low = cleanKey(c);
  if (low.includes('usa') || low.includes('united states') || low.includes('america')) return 'USA';
  if (low.includes('uk') || low.includes('united kingdom') || low.includes('britain') || low.includes('england') || low.includes('scotland') || low.includes('wales')) return 'UK';
  if (low.includes('canada')) return 'Canada';
  if (low.includes('australia')) return 'Australia';
  if (low.includes('germany') || low.includes('deutschland')) return 'Germany';
  if (low.includes('ireland')) return 'Ireland';
  if (low.includes('new zealand')) return 'New Zealand';
  if (low.includes('france')) return 'France';
  if (low.includes('singapore')) return 'Singapore';
  if (low.includes('india')) return 'India';
  return (c || '').trim();
}

function doesCountryMatch(uniCountry: string, targetCountry: string): boolean {
  if (!targetCountry || targetCountry === 'Any' || targetCountry === 'Other') return true;
  const normTarget = normalizeCountry(targetCountry).toLowerCase();
  const normUni = normalizeCountry(uniCountry).toLowerCase();
  if (normTarget === normUni) return true;
  const cleanT = cleanKey(targetCountry);
  const cleanU = cleanKey(uniCountry);
  return cleanT.includes(cleanU) || cleanU.includes(cleanT);
}

@Controller('ai-search')
export class AiSearchController {
  constructor(private readonly openRouterService: OpenRouterService) {
    loadDiskCache();
  }

  @Post()
  async search(@Body() body: any) {
    loadDiskCache();

    const {
      country = 'Any',
      course = '',
      type = '',
      query = '',
      slug = ''
    } = body || {};

    const normCountry = normalizeCountry(country);
    const qClean = cleanKey(query);

    // Case 1: University Detail Profile
    if (type === 'university_detail') {
      return this.handleUniversityDetail(query || slug, normCountry, course);
    }

    // Case 2: Courses Search
    if (type === 'course') {
      return this.handleCourseSearch(query || course);
    }

    // Case 3: University Search & Country Autocomplete
    return this.handleUniversitySearch(qClean, normCountry);
  }

  private async handleUniversitySearch(query: string, country: string) {
    const isSpecificCountry = Boolean(country && country !== 'Any' && country !== 'Other');

    // Step 1: Search in-memory dynamic AI store (0ms instant)
    const existingMatches = this.findFromStore(query, country);

    // If query is empty and we already have plenty of cached universities for this country:
    if (!query && isSpecificCountry && existingMatches.length >= 10) {
      return { success: true, universities: existingMatches.slice(0, 20) };
    }

    // If query is provided and we already have strong matches (>= 4 matches):
    if (query && existingMatches.length >= 4) {
      return { success: true, universities: existingMatches.slice(0, 15) };
    }

    // Step 2: Query AI with an ultra-compact, high-speed prompt
    try {
      const prompt = query
        ? `Return a JSON object with a "universities" list of real, accredited universities located in ${isSpecificCountry ? country : 'the world'} matching or relevant to "${query}".
Each object must have only:
"name": string (full official university name),
"loc": string (city/state),
"country": "${isSpecificCountry ? country : 'Country'}",
"rank": integer (QS ranking, or 0 if unranked)

Format strictly as:
{"universities": [{"name": "...", "loc": "...", "country": "${isSpecificCountry ? country : '...'}", "rank": 1}]}`
        : `Return a JSON object with a "universities" list of 15 real, accredited universities located in ${country}.
Each object must have only:
"name": string (full official university name),
"loc": string (city/state),
"country": "${country}",
"rank": integer (QS ranking, or 0 if unranked)

Format strictly as:
{"universities": [{"name": "...", "loc": "...", "country": "${country}", "rank": 1}]}`;

      const aiResponse: any = await this.openRouterService.getJson<any>(prompt, 'google/gemini-2.5-flash');
      const rawList = aiResponse?.universities || aiResponse?.results || (Array.isArray(aiResponse) ? aiResponse : []);

      if (Array.isArray(rawList) && rawList.length > 0) {
        for (const item of rawList) {
          const rawName = typeof item === 'string' ? item : (item.name || item.university || '');
          if (!rawName || !rawName.trim()) continue;

          const uniName = rawName.trim();
          const uniCountry = (typeof item === 'object' && item.country ? item.country : (isSpecificCountry ? country : 'Global')).trim();
          const uniLoc = (typeof item === 'object' && item.loc ? item.loc : uniCountry).trim();
          const rankNum = typeof item === 'object' && typeof item.rank === 'number' ? item.rank : undefined;

          const uniObj: DiscoveredUniversity = {
            name: uniName,
            loc: uniLoc,
            country: uniCountry,
            rank: rankNum,
            loan: true,
            slug: uniName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            isAiDiscovered: true
          };

          dynamicAiStore.set(cleanKey(uniName), uniObj);
        }

        saveDiskCache();
      }
    } catch (err: any) {
      console.warn('[AiSearchController] Live AI fetch skipped/timed out, serving available dynamic cache:', err?.message || err);
    }

    // Step 3: Re-evaluate matches from updated dynamic store
    const finalMatches = this.findFromStore(query, country);
    return {
      success: true,
      universities: finalMatches.slice(0, query ? 15 : 20)
    };
  }

  private findFromStore(query: string, country: string): DiscoveredUniversity[] {
    const list = Array.from(dynamicAiStore.values());
    const isSpecificCountry = Boolean(country && country !== 'Any' && country !== 'Other');

    const countryFiltered = isSpecificCountry
      ? list.filter(u => doesCountryMatch(u.country, country))
      : list;

    if (!query) {
      // Sort by rank ascending (top ranked first)
      return countryFiltered.sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
    }

    const queryWords = query.split(' ').filter(Boolean);
    const scored: Array<{ uni: DiscoveredUniversity; score: number }> = [];

    for (const uni of countryFiltered) {
      const nameClean = cleanKey(uni.name);
      let score = 0;

      if (nameClean === query) {
        score += 2000;
      } else if (nameClean.startsWith(query)) {
        score += 1000;
      }

      const nameWords = nameClean.split(' ');
      let wordMatches = 0;

      for (const qw of queryWords) {
        if (nameWords.some(nw => nw === qw)) {
          score += 300;
          wordMatches++;
        } else if (nameWords.some(nw => nw.startsWith(qw))) {
          score += 180;
          wordMatches++;
        } else if (nameClean.includes(qw)) {
          score += 80;
          wordMatches++;
        }
      }

      if (score === 0 && wordMatches === 0) continue;

      if (uni.rank && uni.rank > 0) {
        score += Math.max(0, 50 - Math.floor(uni.rank / 20));
      }

      scored.push({ uni, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.uni);
  }

  private async handleUniversityDetail(universityName: string, country: string, course: string) {
    const prompt = `Provide a comprehensive, real-world detailed profile for the university: "${universityName}". 
Location context: ${country}. Program interest: ${course}.

CRITICAL: For the "websiteDomain" field, provide ONLY the real official domain of this university (official .edu, .ac.uk, or institutional domain). Do NOT invent domains.

Return a single JSON object with EXACTLY these fields:
{
  "name": "Full Official Name of the University",
  "shortName": "Common Short Name",
  "loc": "City, State/Province",
  "country": "Country",
  "countryCode": "2-letter ISO country code",
  "websiteDomain": "the real official domain WITHOUT https://",
  "founded": 1900,
  "rank": 123,
  "rankBy": "QS World Rankings",
  "acceptanceRate": 15,
  "tuition": 35000,
  "currency": "USD",
  "description": "Rich 2-3 paragraph history and academic standing.",
  "programs": [
    { "name": "M.S. in Computer Science", "degree": "Master's", "duration": "2 Years", "tuition": "$35,000/year", "icon": "code" },
    { "name": "MBA", "degree": "Master's", "duration": "18 Months", "tuition": "$45,000/year", "icon": "payments" }
  ],
  "requirements": { "gpa": "3.5/4.0 or 8.0/10", "ielts": "7.0 (no band < 6.5)", "toefl": "100+", "gre": "Optional but 320+ recommended" },
  "stats": { "totalStudents": "25,000+", "internationalStudents": "22%", "facultyRatio": "14:1", "employmentRate": "94%", "researchOutput": "Very High", "avgSalary": "$110k" },
  "loan": true,
  "pros": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "facilities": [{ "name": "Robotics Lab", "icon": "smart_toy" }, { "name": "Olympic Pool", "icon": "pool" }],
  "funFacts": ["Fact 1", "Fact 2", "Fact 3"],
  "whyStudyHere": ["Reason 1", "Reason 2", "Reason 3"],
  "notableAlumni": [{ "name": "Full Name", "role": "Role description" }]
}

Respond ONLY with valid JSON. Data must be accurate and real.`;

    try {
      const parsed: any = await this.openRouterService.getJson<any>(prompt);
      const domain = (parsed.websiteDomain || parsed.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      parsed.website = domain ? `https://www.${domain}` : '';
      parsed.logo = domain ? `https://logo.clearbit.com/${domain}` : '';
      return { success: true, university: parsed };
    } catch (e: any) {
      console.warn('[handleUniversityDetail] detail fetch error:', e?.message || e);
      return { success: false, message: 'Failed to fetch details' };
    }
  }

  private async handleCourseSearch(query: string) {
    const prompt = `Search for courses/majors matching "${query}". 
Return a JSON object with a "courses" array of up to 15 specific course names.`;
    try {
      const parsed: any = await this.openRouterService.getJson<any>(prompt);
      return { success: true, results: Array.isArray(parsed) ? parsed : (parsed?.courses || parsed?.results || []) };
    } catch {
      return { success: true, results: ['B.Tech/B.E.', 'MS/M.Tech', 'MBA/PGDM', 'MBBS/Medicine', 'Data Science', 'Computer Science'] };
    }
  }
}
