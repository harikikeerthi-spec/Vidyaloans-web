
import { Injectable, Optional } from '@nestjs/common';
import { SiteSettingsService } from '../../site-settings/site-settings.service';

@Injectable()
export class OpenRouterService {
    private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private readonly defaultApiKey = process.env.OPENROUTER_API_KEY || '';
    private readonly REQUEST_TIMEOUT_MS = 30_000; // 30 seconds

    constructor(@Optional() private readonly siteSettingsService?: SiteSettingsService) {}

    public async getApiKey(): Promise<string> {
        if (this.siteSettingsService) {
            try {
                const settings = await this.siteSettingsService.getSettings();
                if (settings?.openRouterApiKey && settings.openRouterApiKey.startsWith('sk-')) {
                    return settings.openRouterApiKey;
                }
            } catch (e) {}
        }
        return this.defaultApiKey;
    }
    
    // Fallback models to try if primary model fails (in order of preference)
    private readonly FALLBACK_MODELS = [
        'google/gemini-2.5-flash',
        'openai/gpt-4o-mini',
        'meta-llama/llama-3.3-70b-instruct',
        'mistralai/mistral-7b-instruct:free',
    ];
    
    private readonly VISION_FALLBACK_MODELS = [
        'google/gemini-2.5-flash',
        'google/gemini-2.0-flash-001',
        'openai/gpt-4o-mini',
        'meta-llama/llama-3.2-11b-vision-instruct:free',
    ];

    /** Create an AbortSignal that auto-aborts after the configured timeout. */
    private createTimeoutSignal(customTimeoutMs?: number): AbortSignal {
        return AbortSignal.timeout(customTimeoutMs || this.REQUEST_TIMEOUT_MS);
    }

    async chat(prompt: string, model: string = 'openai/gpt-4o-mini'): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
            console.warn('OPENROUTER_API_KEY is not set. Using mock response or failing.');
            throw new Error('OPENROUTER_API_KEY is not configured in environment variables.');
        }

        const requestBody: any = {
            model: model,
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 2048,
        };

        const maskedKey = apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (len ${apiKey.length})` : '[NOT SET]';
        console.log('OpenRouter request:', {
            url: this.apiUrl,
            model: requestBody.model,
            promptLength: prompt.length,
            openRouterKey: maskedKey
        });

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://vidyaloan.com',
                    'X-Title': 'VidyaLoan',
                },
                body: JSON.stringify(requestBody),
                signal: this.createTimeoutSignal(),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('OpenRouter API error details:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorBody
                });
                throw new Error(`OpenRouter API error: ${response.statusText} - ${errorBody}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error('OpenRouter request failed:', error?.message || error);
            // Handle timeout errors
            if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || error?.message?.includes('timed out')) {
                console.warn('OpenRouter request timed out after', this.REQUEST_TIMEOUT_MS, 'ms');
                if (prompt.includes('universities')) {
                    return JSON.stringify({ universities: [] });
                }
                return "Our AI assistant is temporarily busy. Please try again in a few minutes.";
            }
            if (error?.message?.includes('429') || error?.message?.includes('rate_limit')) {
                console.warn('Rate limit hit. Returning mock response for stability.');
                if (prompt.includes('universities')) {
                    return JSON.stringify([{
                        name: "Stanford University (Mock)", loc: "California, USA", slug: "stanford",
                        rank: 3, accept: 4, tuition: 55000, country: "USA", description: "A top research university."
                    }]);
                }
                return "Our AI assistant is temporarily busy due to high demand. Please try again in a few minutes.";
            }
            throw error;
        }
    }

    async getJson<T>(prompt: string, model: string = 'google/gemini-2.5-flash'): Promise<T> {
        const jsonPrompt = `${prompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include markdown formatting.`;
        const apiKey = await this.getApiKey();
        if (!apiKey || apiKey === 'your_openrouter_api_key_here') throw new Error('OPENROUTER_API_KEY is not configured');

        // Build list of models to try
        const modelsToTry = [model, ...this.FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i); // Remove duplicates
        let lastError: Error | null = null;
        let content = '';

        for (const currentModel of modelsToTry) {
            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://vidyaloan.com',
                        'X-Title': 'VidyaLoan',
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: [{ role: 'user', content: jsonPrompt }],
                        response_format: { type: "json_object" },
                        max_tokens: 2048,
                    }),
                    signal: this.createTimeoutSignal(),
                });

                if (response.ok) {
                    const data = await response.json();
                    content = data.choices?.[0]?.message?.content || '';
                    if (content) {
                        console.log(`[getJson] Successfully used model: ${currentModel}`);
                        break; // Successfully got content, exit loop
                    }
                } else {
                    const errorBody = await response.text();
                    if (response.status === 404 && (errorBody.includes('No endpoints found') || errorBody.includes('does not exist'))) {
                        console.warn(`Model ${currentModel} not found (404). Trying fallback model...`);
                        lastError = new Error(`Model not found: ${currentModel}`);
                        continue; // Try next model
                    } else if (response.status === 400 && errorBody.includes('json_validate_failed')) {
                        console.warn(`Model ${currentModel}: Native JSON mode failed. Retrying with standard mode...`);
                        content = await this.chat(jsonPrompt, currentModel);
                        if (content) break;
                    } else if (response.status === 429 || errorBody.includes('rate_limit')) {
                        console.warn(`Model ${currentModel}: Rate limited. Trying fallback...`);
                        lastError = new Error(`Rate limit hit for ${currentModel}`);
                        continue;
                    } else {
                        console.warn(`Model ${currentModel} failed with status ${response.status}. Trying fallback...`);
                        lastError = new Error(`OpenRouter error: ${response.statusText}`);
                        continue;
                    }
                }
            } catch (error) {
                console.warn(`[getJson] Model ${currentModel} attempt failed:`, error?.message || error);
                lastError = error as Error;
                
                // On timeout/abort, skip to next model
                if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || error?.message?.includes('timed out')) {
                    continue;
                }
                // For other errors, also continue to next model
                continue;
            }
        }

        if (!content && lastError) {
            console.error('All getJson models failed. Returning empty result.');
            // Return empty result for specific request types
            if (prompt.includes('universities')) return { universities: [] } as any;
            if (prompt.includes('courses')) return { courses: [] } as any;
            return {} as T;
        }

        try {
            let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const firstBrace = cleaned.indexOf('{');
            const firstBracket = cleaned.indexOf('[');
            let start = -1;
            let end = -1;

            if (firstBrace !== -1 && (firstBracket === -1 || (firstBrace < firstBracket && firstBrace !== -1))) {
                start = firstBrace;
                end = cleaned.lastIndexOf('}');
            } else if (firstBracket !== -1) {
                start = firstBracket;
                end = cleaned.lastIndexOf(']');
            }

            if (start === -1 || end === -1 || end < start) {
                if (prompt.includes('universities')) return { universities: [] } as any;
                throw new Error('No valid JSON structure found in response');
            }

            let jsonString = cleaned.slice(start, end + 1);
            jsonString = jsonString.replace(/:\s*(\d+)-(\d+)\s*(,|})/g, ': "$1-$2"$3');
            return JSON.parse(jsonString) as T;
        } catch (e) {
            console.error('Failed to parse JSON response:', content);
            if (prompt.includes('universities')) return { universities: [] } as any;
            throw new Error(`AI response was not valid JSON: ${e.message}`);
        }
    }

    async searchAdvice(query: string, type: 'university' | 'course' | 'ug_university', context?: any): Promise<any[]> {
        let prompt = '';
        if (type === 'university') {
            const country = context?.country || '';
            const course = context?.course || '';

            prompt = `Search for REAL, ACCREDITED universities ${query ? `matching or relevant to "${query}"` : 'that are popular'} for international students.
            ${country ? `PRIORITY: Focus PRIMARILY on universities located in "${country}".` : ''}
            ${course ? `SECONARY FOCUS: Universities strong in "${course}".` : ''}
            CRITICAL REQUIREMENT: Focus on finding top universities that have the HIGHEST acceptance rates for international students. Ensure the acceptance rate data is highly accurate. Please rank the returned universities in descending order of their acceptance rates (highest to lowest).

            Context Details: ${JSON.stringify(context || {})}

            Requirement: Return a JSON object with a "universities" key.
            The "universities" key should be an array of up to 12 objects.
            For each university, provide:
            - name, loc, slug, rank, accept, tuition, country, description, website, courses

            MUST respond ONLY with JSON.`;
        } else if (type === 'ug_university') {
            prompt = `Search for REAL undergraduate degree or engineering colleges/universities matching or relevant to "${query || ''}". 
            STRICT CRITICAL REQUIREMENT: Return ONLY colleges and universities located INSIDE THE COUNTRY OF INDIA. Do not include any university, college, or institution from any country other than India.
            Return a JSON object with a "universities" key.
            The "universities" key should be an array of up to 5 objects.
            For each university, provide:
            - name, loc (City, State, India), country: "India", pincode
            
            MUST respond ONLY with JSON.`;
        } else {
            prompt = `Search for valid courses/fields of study matching or relevant to "${query || ''}".
            Return a JSON object with a "courses" key.
            MUST respond ONLY with JSON.`;
        }

        const res = await this.getJson<any>(prompt);
        return ((res && (res.universities || res.courses)) || []) as any[];
    }

    async chatWithVision(prompt: string, imageUrl: string, model: string = 'google/gemini-2.5-flash'): Promise<string> {
        const apiKey = await this.getApiKey();
        if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
            throw new Error('OPENROUTER_API_KEY is not configured');
        }

        const modelsToTry = Array.from(new Set([
            model,
            ...this.VISION_FALLBACK_MODELS,
        ]));

        let lastError: Error | null = null;
        for (const currentModel of modelsToTry) {
            console.log(`[OpenRouter Vision] Attempting extraction with model: ${currentModel}...`);
            const isPdf = imageUrl.startsWith('data:application/pdf');
            
            // Standard OpenAI/OpenRouter vision format uses image_url (which also accepts data:application/pdf for Gemini)
            const contentItems: any[] = [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                }
            ];

            const requestBody = {
                model: currentModel,
                messages: [
                    {
                        role: 'user',
                        content: contentItems
                    }
                ],
                max_tokens: 2048,
                temperature: 0,
            };

            try {
                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://vidyaloan.com',
                        'X-Title': 'VidyaLoan',
                    },
                    body: JSON.stringify(requestBody),
                    signal: this.createTimeoutSignal(90_000), // 90 seconds timeout for vision/PDF tasks
                });

                if (!response.ok) {
                    const errorBody = await response.text();
                    if (response.status === 404 && (errorBody.includes('No endpoints found') || errorBody.includes('does not exist'))) {
                        console.warn(`[OpenRouter Vision] Model ${currentModel} not found (404). Trying next model...`);
                        lastError = new Error(`Model not found: ${currentModel}`);
                        continue;
                    }
                    throw new Error(`OpenRouter Vision API error: ${response.status} - ${errorBody}`);
                }

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (content) {
                    console.log(`[OpenRouter Vision] Successfully extracted details using model: ${currentModel}`);
                    return content;
                }
            } catch (err: any) {
                console.warn(`[OpenRouter Vision] Model ${currentModel} failed: ${err.message || err}`);
                lastError = err;
                // Continue to next model on error
                continue;
            }
        }
        throw lastError || new Error('All vision endpoints failed to respond.');
    }
}
