import { useMemo } from "react";
import { AppConfig } from "@/src/constants/app";

interface PricingSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  tier: "SLOW" | "STANDARD" | "FAST" | "ULTRA";
  tierLabel: string;
  reasoning: string;
}

function getPricingTier(powerKw: number): PricingSuggestion["tier"] {
  if (powerKw <= 7) return "SLOW";
  if (powerKw <= 22) return "STANDARD";
  if (powerKw <= 50) return "FAST";
  return "ULTRA";
}

const TIER_LABELS: Record<PricingSuggestion["tier"], string> = {
  SLOW: "Slow (≤7 kW)",
  STANDARD: "Standard (7-22 kW)",
  FAST: "Fast (22-50 kW)",
  ULTRA: "Ultra-Fast (50+ kW)",
};

/**
 * Smart pricing assistant for hosts.
 * Suggests a price based on charger power, connector type, and market band.
 */
export function usePricingAssistant(powerKw: number): PricingSuggestion {
  return useMemo(() => {
    const tier = getPricingTier(powerKw);
    const band = AppConfig.PRICING[tier];

    // Adjust suggested price slightly based on exact power within tier
    const tierRanges: Record<string, [number, number]> = {
      SLOW: [3, 7],
      STANDARD: [7, 22],
      FAST: [22, 50],
      ULTRA: [50, 350],
    };
    const [tierMin, tierMax] = tierRanges[tier];
    const positionInTier = Math.min(1, Math.max(0, (powerKw - tierMin) / (tierMax - tierMin)));

    // Higher power within tier = slightly higher suggested price
    const adjustedSuggested = band.min + (band.suggested - band.min) + positionInTier * (band.max - band.suggested) * 0.3;
    const suggestedPrice = Math.round(Math.min(band.max, Math.max(band.min, adjustedSuggested)) * 100) / 100;

    const reasoning =
      `Based on ${TIER_LABELS[tier]} market rates in Australia. ` +
      `Typical range: $${band.min.toFixed(2)}-$${band.max.toFixed(2)}/kWh. ` +
      `Your ${powerKw}kW charger is well-positioned at $${suggestedPrice.toFixed(2)}/kWh.`;

    return {
      suggestedPrice,
      minPrice: band.min,
      maxPrice: band.max,
      tier,
      tierLabel: TIER_LABELS[tier],
      reasoning,
    };
  }, [powerKw]);
}
