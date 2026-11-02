const fs = require('fs');
let c = fs.readFileSync('frontend/components/AdminBlogBuilder.tsx', 'utf8');

const startMarker = 'case "journey_card": {\r\n                const cardTitle = block.title';
const startMarkerLF = 'case "journey_card": {\n                const cardTitle = block.title';
let startIdx = c.indexOf(startMarker);
if (startIdx === -1) startIdx = c.indexOf(startMarkerLF);

const endMarker = 'case "heading": {\r\n                            const lvl = (b.level';
const endMarkerLF = 'case "heading": {\n                            const lvl = (b.level';
let endIdx = c.indexOf(endMarker);
if (endIdx === -1) endIdx = c.indexOf(endMarkerLF);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `case "journey_card": {
                            const cardTitle = b.title || "Start Your Education Loan Journey";
                            const cardDesc = b.content || "Explore education financing assistance through VidyaLoans.";
                            const btnText = b.buttonText || "Visit VidyaLoans →";
                            const btnUrl = b.buttonUrl || "/apply-loan";
                            const refs = (b.items && b.items.length > 0) ? b.items : [
                                "Reserve Bank of India|https://www.rbi.org.in",
                                "Ministry of Education|https://www.education.gov.in",
                                "PM-Vidyalaxmi Scheme|https://www.vidyalakshmi.co.in"
                            ];
                            const refsHtml = refs.map((ref) => {
                                const [label, link] = ref.includes("|") ? ref.split("|") : [ref, "https://www.vidyaloans.in"];
                                return \`<li class="flex items-center gap-2"><a href="\${link.trim()}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa !important; font-weight: 600; text-decoration: none;"><span>•</span><span>\${label.trim()}</span><span class="text-xs" style="font-size: 11px;">↗</span></a></li>\`;
                            }).join("");
                            return \`<div class="blog-cta-card not-prose my-10 rounded-2xl p-6 md:p-8 shadow-xl" style="background: linear-gradient(135deg, #0d213f 0%, #152e55 100%); border: 1px solid rgba(255, 255, 255, 0.08); color: #ffffff;"><h3 class="text-xl md:text-2xl font-bold tracking-tight mb-2" style="color: #ffffff !important; margin-top: 0;">\${cardTitle}</h3><p class="text-sm md:text-base leading-relaxed mb-6" style="color: #cbd5e1 !important;">\${cardDesc}</p><div class="mb-6"><a href="\${btnUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8 !important; text-decoration: none; font-weight: 700;">\${btnText}</a></div>\${refs.length > 0 ? \`<div class="pt-5 mt-4 border-t" style="border-color: rgba(255, 255, 255, 0.12);"><p class="text-xs font-bold uppercase tracking-wider mb-2.5" style="color: #94a3b8 !important;">Official References</p><ul class="space-y-1.5 list-none pl-0 text-sm mb-0">\${refsHtml}</ul></div>\` : ""}</div>\`;
                        }\n                        `;
    c = c.slice(0, startIdx) + replacement + c.slice(endIdx);
    fs.writeFileSync('frontend/components/AdminBlogBuilder.tsx', c);
    console.log('SUCCESS');
} else {
    console.log('NOT FOUND', startIdx, endIdx);
}

