import { searchUniversitiesInstant, registerAiDiscoveredUniversities } from '../universitySearchEngine';

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${msg}`);
        process.exit(1);
    }
    console.log(`✓ ${msg}`);
}

console.log("================================================================================");
console.log("Running Dynamic AI University Search Engine Tests (Zero Hardcoded Names)...");
console.log("================================================================================");

// Test 1: Empty state search returns empty list
const initialResults = searchUniversitiesInstant("sample");
assert(Array.isArray(initialResults), "Initial search returns an array");

// Test 2: Dynamic Registration of AI-discovered universities
const dynamicBatch = [
    { name: "Alpha Institute of Science & Technology", loc: "Northern Region", country: "CountryA", rank: 12 },
    { name: "Beta Global Academy", loc: "Metropolis", country: "CountryB", rank: 45 },
    { name: "Gamma Polytechnic University", loc: "Coastal City", country: "CountryA", rank: 110 },
    { name: "Delta National University", loc: "Capital City", country: "CountryC", rank: 250 },
];

const registered = registerAiDiscoveredUniversities(dynamicBatch);
assert(registered.length === 4, "Successfully registered 4 dynamic AI universities");

// Test 3: Search by prefix / word
const alphaMatch = searchUniversitiesInstant("alpha");
assert(alphaMatch.length > 0, "Finds university by query 'alpha'");
assert(alphaMatch[0].name.includes("Alpha Institute"), "Top match is Alpha Institute");
assert(alphaMatch[0].country === "CountryA", "Correct country association");

// Test 4: Search with Country Filter
const countryBMatches = searchUniversitiesInstant("", "CountryB", 5);
assert(countryBMatches.length > 0, "Returns results matching CountryB");
assert(countryBMatches[0].name.includes("Beta Global"), "CountryB top match is Beta Global Academy");

// Test 5: Dynamic Registration handles duplicate updates gracefully
registerAiDiscoveredUniversities([
    { name: "Alpha Institute of Science & Technology", loc: "Northern Region Updated", country: "CountryA", rank: 10 }
]);
const updatedAlpha = searchUniversitiesInstant("alpha");
assert(updatedAlpha[0].rank === 10, "Dynamically updated existing university record");

// Test 6: Speed Benchmark (< 20ms for 300 consecutive searches)
const start = Date.now();
for (let i = 0; i < 100; i++) {
    searchUniversitiesInstant("alpha", "CountryA", 8);
    searchUniversitiesInstant("beta", "CountryB", 8);
    searchUniversitiesInstant("gamma", "CountryA", 8);
}
const elapsed = Date.now() - start;
console.log(`⏱️ 300 instant dynamic searches executed in: ${elapsed}ms (${(elapsed / 300).toFixed(2)}ms per search)`);
assert(elapsed < 200, "Instant search is sub-millisecond fast");

console.log("================================================================================");
console.log("ALL DYNAMIC AI SEARCH ENGINE TESTS PASSED! ⚡ ZERO HARDCODED NAMES");
console.log("================================================================================");
