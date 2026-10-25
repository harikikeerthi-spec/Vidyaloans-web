"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AnimatedNumber – SSR-safe scroll-triggered count-up animation.
 * Renders the final value server-side to guarantee SEO and ensure
 * numbers are never stuck at "0+" or "0%" if JS or observers delay.
 *
 * Usage:
 *   <AnimatedNumber value="500+" />        → SSR: "500+", client: animates 0 → 500
 *   <AnimatedNumber value="₹45L" />        → SSR: "₹45L"
 *   <AnimatedNumber value="98%" />          → SSR: "98%"
 *   <AnimatedNumber value="Pre-Arrival" />  → SSR: "Pre-Arrival" (safely bypassed)
 */
export default function AnimatedNumber({
    value,
    duration = 1.8,
    className = "",
}: {
    value: string | number;
    duration?: number;
    className?: string;
}) {
    const strValue = String(value ?? "");
    const match = strValue.match(/^([₹$€]?)([0-9,.]+)(.*)$/);
    const prefix = match ? match[1] : "";
    const numericPart = match ? parseFloat(match[2].replace(/,/g, "")) : NaN;
    const suffix = match ? match[3] : "";

    // Parse the decimal places in the incoming value
    const decimalMatches = strValue.match(/\.(\d+)/);
    const decimalPlaces = decimalMatches ? decimalMatches[1].length : 0;

    // Server-Side & Hydration Default: Render the full final value!
    const [count, setCount] = useState<number>(isNaN(numericPart) ? 0 : numericPart);
    const ref = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (isNaN(numericPart) || numericPart === 0) return;
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    let startTime: number;
                    let animationFrame: number;

                    setCount(0);
                    const end = numericPart;

                    const animate = (timestamp: number) => {
                        if (!startTime) startTime = timestamp;
                        const progress = timestamp - startTime;
                        const linear = Math.min(progress / (duration * 1000), 1);
                        // Ease-out cubic for snappy feel
                        const eased = 1 - Math.pow(1 - linear, 3);

                        setCount(end * eased);

                        if (linear < 1) {
                            animationFrame = requestAnimationFrame(animate);
                        } else {
                            setCount(end);
                        }
                    };

                    animationFrame = requestAnimationFrame(animate);
                }
            },
            { threshold: 0.15 }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [numericPart, duration]);

    // If non-numeric (e.g. "Pre-Arrival"), render directly as-is
    if (isNaN(numericPart) || !match) {
        return <span className={`tabular-nums ${className}`}>{strValue}</span>;
    }

    // Format the displayed number
    const displayNum = count.toLocaleString("en-IN", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    });

    return (
        <span ref={ref} className={`tabular-nums ${className}`}>
            {prefix}{displayNum}{suffix}
        </span>
    );
}

