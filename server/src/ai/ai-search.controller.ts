import { Controller, Post, Body } from '@nestjs/common';
import { OpenRouterService } from './services/openrouter.service';

// Server-side in-memory cache for fast repeated queries (12h TTL)
const serverAiSearchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;


@Controller('ai-search')
export class AiSearchController {
  constructor(private readonly openRouterService: OpenRouterService) {}

  @Post()
  async search(@Body() body: any) {
    const { country = 'Any', course = '', gpa = 0, bachelors = '', target_university = '', type = '', query = '', slug = '' } = body;

    let prompt = '';
    if (type === 'university_detail') {
      prompt = `Provide a comprehensive, real-world detailed profile for the university: "${query || slug}". 
      Location context: ${country}. Program interest: ${course}.
      
      CRITICAL: For the "websiteDomain" field, provide ONLY the real official domain of this university (official .edu, .ac.uk, or institutional domain). Do NOT invent domains. This must be the actual domain students visit.

      Return a single JSON object with EXACTLY these fields:
      {
        "name": "Full Official Name of the University",
        "shortName": "Common Short Name",
        "loc": "City, State/Province",
        "country": "Country",
        "countryCode": "2-letter ISO country code",
        "websiteDomain": "the real official domain WITHOUT https:// (e.g. official institutional domain)",
        "founded": 1900,
        "rank": 123,
        "rankBy": "QS World Rankings",
        "acceptanceRate": 15,
        "tuition": 35000,
        "currency": "USD",
        "description": "Rich 2-3 paragraph history and academic standing. Be detailed and accurate.",
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
    } else if (type === 'course') {
      prompt = `Search for courses/majors matching "${query || course}". 
      Return a JSON object with a "courses" array of up to 15 specific course names.`;
    } else {
      if (query && query.trim().length > 0) {
        prompt = `You are a university database. The user is searching for a university named: "${query}".
        Country context: ${country || 'any country'}.

        TASK: Return up to 25 REAL universities in ${country || 'the world'} whose name contains or closely matches "${query}".
        IMPORTANT: Return actual real universities that exist in ${country || 'the world'}.
        
        For each university return these exact fields:
        - name: full official name of the university (MUST be accurate and real)
        - loc: "City, State/Region"
        - country: country name
        - rank: approximate global QS or US News ranking (integer, use 0 if unranked)
        - accept: acceptance rate percentage (integer)
        - tuition: approximate annual tuition in USD (integer)
        - loan: true
        - slug: url-friendly name (lowercase, hyphens)
        - website: official university URL
        
        Return ONLY a JSON object: { "universities": [...] }`;
      } else {
        prompt = `Return a list of 25 real universities located in ${country}.
        Include a diverse mix: top-ranked, mid-tier, and regional accredited universities in ${country}.
        
        For each real university include ALL of these exact fields:
        - name: full official name of the university
        - loc: city, state/region
        - country: "${country}"
        - rank: global QS ranking (integer, 0 if unranked)
        - accept: acceptance rate percentage (integer)
        - tuition: annual tuition in USD (integer)
        - min_gpa: minimum GPA required (float, scale 0-10)
        - min_ielts: minimum IELTS score required (float)
        - min_toefl: minimum TOEFL iBT score required (integer)
        - courses: array of offered master's programs relevant to ${course || 'various fields'}
        - loan: true
        - slug: url-friendly name
        - website: official university URL
        
        Return ONLY a JSON object with a "universities" key containing the array.`;
      }
    }

    try {
      const parsed: any = await this.openRouterService.getJson<any>(prompt);

      if (type === 'university_detail') {
        const domain = (parsed.websiteDomain || parsed.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        parsed.website = domain ? `https://www.${domain}` : '';
        parsed.logo = domain ? `https://logo.clearbit.com/${domain}` : '';

        const countryKey = (parsed.country || country || '').toLowerCase();
        const HERO_IMAGES: Record<string, string> = {
          'united kingdom': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
          'uk': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1600&q=80',
          'usa': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
          'united states': 'https://images.unsplash.com/photo-1562774053-701939374585?w=1600&q=80',
          'canada': 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=800&q=80',
          'australia': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1600&q=80',
          'germany': 'https://images.unsplash.com/photo-1597672890275-702a4953ff1f?w=1600&q=80',
          'ireland': 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?w=1600&q=80',
          'france': 'https://images.unsplash.com/photo-1549144511-f099e773c147?w=1600&q=80',
          'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&q=80',
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
          : defaultCampus;

        return { success: true, university: parsed };
      }
      if (type === 'course') {
        return { success: true, results: Array.isArray(parsed) ? parsed : (parsed.courses || parsed.results || []) };
      }
      const unis = parsed?.universities || parsed?.results || (Array.isArray(parsed) ? parsed : []);
      if (Array.isArray(unis) && unis.length > 0) {
        return { success: true, universities: unis };
      }
      const fallbackList: any[] = [];
      return { success: true, universities: fallbackList };
    } catch (e: any) {
      console.warn('OpenRouter search encountered issue, returning empty fallback list:', e?.message || e);
      if (type === 'course') {
        return { success: true, results: ['B.Tech/B.E.', 'MS/M.Tech', 'MBA/PGDM', 'MBBS/Medicine', 'Data Science', 'Computer Science', 'Business Analytics'] };
      }
      const fallbackList: any[] = [];
      return { success: true, universities: fallbackList };
    }
  }
}
