import { testimonials as defaultTestimonials } from '../data/home';

export interface DynamicReview {
  quote: string;
  name: string;
  school: string;
  avatar: string;
  bg?: string;
  icon?: string;
  highlight?: string;
  highlightLabel?: string;
}

export async function fetchTopGoogleReviews(): Promise<DynamicReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // Placeholder Place ID — replace with VidyaLoans' official Google Place ID
  // and provide a GOOGLE_PLACES_API_KEY in your environment.
  const placeId = process.env.GOOGLE_PLACE_ID || 'ChIJN1t_tDeuEmsRUsoyG83frY4'; 

  // If we don't have the API key, return the fallback hardcoded reviews from data/home.ts
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY is not set. Using fallback dynamic reviews.");
    return defaultTestimonials;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 86400 } }); // Cache for 24 hours
    const data = await response.json();

    if (data.status === 'OK' && data.result.reviews) {
      // 1. Filter for ONLY top ratings (5 stars)
      const topReviews = data.result.reviews.filter((r: any) => r.rating === 5);

      // 2. Map Google reviews to the format used in our UI
      const bgs = ["bg-[#e7e1f7]", "bg-[#fdfaf2]", "bg-[#e1f0f7]", "bg-[#f0e7f7]", "bg-[#e7f7e1]", "bg-[#f7e7e1]"];
      const mappedReviews = topReviews.map((r: any, index: number) => {
        return {
          quote: r.text.length > 250 ? r.text.substring(0, 247) + '...' : r.text,
          name: r.author_name,
          school: "Google Reviewer",
          avatar: r.author_name.toLowerCase().replace(/\s+/g, '-'),
          bg: bgs[index % bgs.length],
          icon: "/images/testimonials/graduation-cap.png",
          highlight: "5 Stars",
          highlightLabel: "Google Review"
        };
      });

      return mappedReviews.length > 0 ? mappedReviews : defaultTestimonials;
    } else {
      console.warn("Failed to fetch Google reviews:", data.status);
      return defaultTestimonials;
    }
  } catch (error) {
    console.error("Error fetching Google reviews:", error);
    return defaultTestimonials;
  }
}
