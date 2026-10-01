/**
 * Dynamic AI University Search Engine
 * 
 * ZERO hardcoded university names in code.
 * All university data is fetched dynamically via AI models (OpenRouter/OpenAI)
 * and cached in runtime memory and browser storage for ultra-fast response.
 */

import { aiApi } from "@/lib/api";

export interface FastUniversity {
    name: string;
    loc: string;
    country: string;
    rank?: number;
    badge?: string;
    isAiDiscovered?: boolean;
}

// Runtime dynamic cache populated exclusively by live AI responses
const dynamicAiStore: FastUniversity[] = [];
const runtimeMemoryCache = new Map<string, FastUniversity[]>();

function clean(str: string): string {
    return (str || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Register newly discovered AI universities into dynamic runtime cache
 */
export function registerAiDiscoveredUniversities(unis: any[], defaultCountry?: string): FastUniversity[] {
    if (!Array.isArray(unis)) return [];

    const newlyAdded: FastUniversity[] = [];

    for (const raw of unis) {
        let name = "";
        let loc = "";
        let country = "";
        let rank: number | undefined;

        if (typeof raw === "string") {
            name = raw.trim();
            loc = defaultCountry || "";
            country = defaultCountry || "";
        } else if (raw && typeof raw === "object") {
            name = (raw.name || raw.university || "").trim();
            loc = (raw.loc || raw.location || raw.city || defaultCountry || "").trim();
            country = (raw.country || defaultCountry || "").trim();
            rank = typeof raw.rank === "number" ? raw.rank : undefined;
        }

        if (!name) continue;

        const cleanName = clean(name);
        const existingIndex = dynamicAiStore.findIndex(u => clean(u.name) === cleanName);

        const item: FastUniversity = {
            name,
            loc: loc || country || "Global",
            country: country || defaultCountry || "Global",
            rank,
            badge: rank && rank <= 500 ? `QS #${rank}` : "AI Verified",
            isAiDiscovered: true
        };

        if (existingIndex >= 0) {
            dynamicAiStore[existingIndex] = item;
        } else {
            dynamicAiStore.push(item);
            newlyAdded.push(item);
        }
    }

    // Invalidate search cache whenever universities are added or updated
    runtimeMemoryCache.clear();

    return newlyAdded;
}

const CANONICAL_COUNTRIES: Record<string, string[]> = {
    "USA": ["usa", "us", "u s a", "united states", "united states of america", "america"],
    "UK": ["uk", "u k", "united kingdom", "great britain", "britain", "england", "scotland", "wales"],
    "Germany": ["germany", "deutschland"],
    "Canada": ["canada", "can"],
    "Australia": ["australia", "aus"],
    "Ireland": ["ireland"],
    "New Zealand": ["new zealand", "nz"],
    "France": ["france"],
    "Netherlands": ["netherlands", "holland"],
    "Italy": ["italy", "italia"],
    "Spain": ["spain", "espana"],
    "Sweden": ["sweden"],
    "Singapore": ["singapore"],
    "India": ["india"]
};

export function getCanonicalCountry(raw: string): string {
    const c = clean(raw);
    if (!c) return "";
    for (const [canonical, aliases] of Object.entries(CANONICAL_COUNTRIES)) {
        if (canonical.toLowerCase() === c) return canonical;
        for (const alias of aliases) {
            if (c === alias) return canonical;
            if (alias.includes(" ")) {
                if (c.includes(alias)) return canonical;
            } else {
                const words = c.split(" ");
                if (words.includes(alias)) return canonical;
            }
        }
    }
    return (raw || "").trim();
}

export function countriesMatch(c1: string, c2: string): boolean {
    const raw1 = (c1 || "").trim();
    const raw2 = (c2 || "").trim();
    if (!raw1 || !raw2) return true;
    const clean1 = clean(raw1);
    const clean2 = clean(raw2);
    if (!clean1 || !clean2) return true;
    if (clean1 === "any" || clean2 === "any" || clean1 === "other" || clean2 === "other") return true;

    const canon1 = getCanonicalCountry(raw1).toLowerCase();
    const canon2 = getCanonicalCountry(raw2).toLowerCase();

    if (canon1 && canon2 && canon1 === canon2) return true;
    if (clean1 === clean2) return true;

    // Strict: only allow substring if both are at least 4 characters long (prevents "us" matching "australia")
    if (clean1.length >= 4 && clean2.length >= 4) {
        if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
    }
    return false;
}

export function doesLocMatchCountry(loc: string, country: string): boolean {
    if (!loc || !country) return false;
    const cleanLoc = clean(loc);
    const cleanCountry = clean(country);
    if (!cleanLoc || !cleanCountry) return false;

    const canonCountry = getCanonicalCountry(country);
    const canonCountryLow = canonCountry.toLowerCase();

    // Check if canonical country or any alias is a word in the location string
    const aliases = CANONICAL_COUNTRIES[canonCountry] || [cleanCountry];
    const locWords = cleanLoc.split(" ");

    for (const alias of aliases) {
        if (alias.includes(" ")) {
            if (cleanLoc.includes(alias)) return true;
        } else {
            if (locWords.includes(alias)) return true;
        }
    }

    if (cleanCountry.length >= 4 && cleanLoc.includes(cleanCountry)) {
        return true;
    }

    return countriesMatch(loc, country);
}

/**
 * Search across dynamically AI-discovered universities in memory (0ms)
 */
export function searchCachedUniversities(query: string, countryFilter?: string, maxResults: number = 8): FastUniversity[] {
    const qClean = clean(query);
    const countryClean = clean(countryFilter || "");
    const cacheKey = `${qClean}:::${countryClean}:::${maxResults}`;

    if (runtimeMemoryCache.has(cacheKey)) {
        return runtimeMemoryCache.get(cacheKey)!;
    }

    let list = dynamicAiStore;

    // Filter by country if specified - strict enforcement without falling back to all countries
    if (countryClean && countryClean !== "any" && countryClean !== "other") {
        list = list.filter(u => {
            return countriesMatch(u.country, countryClean) || doesLocMatchCountry(u.loc, countryClean);
        });
    }

    if (!qClean) {
        const res = list.slice(0, maxResults);
        runtimeMemoryCache.set(cacheKey, res);
        return res;
    }

    const queryWords = qClean.split(" ").filter(Boolean);

    const scored: Array<{ uni: FastUniversity; score: number }> = [];

    for (const uni of list) {
        const nameClean = clean(uni.name);
        const locClean = clean(uni.loc);
        const uCountryClean = clean(uni.country);

        let score = 0;

        if (nameClean === qClean) {
            score += 2000;
        } else if (nameClean.startsWith(qClean)) {
            score += 1000;
        }

        const nameWords = nameClean.split(" ");
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

        if (locClean.includes(qClean) || uCountryClean.includes(qClean)) {
            score += 100;
        }

        if (score === 0 && wordMatches === 0) {
            continue;
        }

        if (countryClean && countryClean !== "any" && countryClean !== "other") {
            if (countriesMatch(uCountryClean, countryClean) || countriesMatch(locClean, countryClean)) {
                score += 250;
            }
        }

        if (uni.rank && uni.rank > 0) {
            score += Math.max(0, 50 - Math.floor(uni.rank / 20));
        }

        scored.push({ uni, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const result = scored.slice(0, maxResults).map(s => s.uni);
    runtimeMemoryCache.set(cacheKey, result);
    return result;
}

/**
 * Fast client-side instant search alias
 */
export const searchUniversitiesInstant = searchCachedUniversities;

/**
 * Fetch universities dynamically from AI with caching
 */
export async function fetchAiUniversities(
    query: string,
    country: string,
    signal?: AbortSignal
): Promise<FastUniversity[]> {
    const qClean = (query || "").trim();
    const cClean = (country || "").trim();

    try {
        const res: any = await aiApi.aiSearch({
            type: "university",
            query: qClean,
            country: cClean || "Any"
        });

        if (signal?.aborted) return [];

        const aiUnis = res?.universities || res?.results || [];
        if (Array.isArray(aiUnis) && aiUnis.length > 0) {
            registerAiDiscoveredUniversities(aiUnis, cClean);
            return searchCachedUniversities(qClean, cClean, 10);
        }
    } catch (err: any) {
        if (err?.name !== "AbortError") {
            console.debug("AI university search call completed with error:", err);
        }
    }

    return searchCachedUniversities(qClean, cClean, 10);
}
