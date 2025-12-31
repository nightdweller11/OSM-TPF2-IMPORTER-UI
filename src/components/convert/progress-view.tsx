"use client";

// This component is deprecated. Use ConversionDetails instead.
// Keeping for backwards compatibility.

import { ConversionDetails } from "@/components/conversion/conversion-details";

interface ProgressViewProps {
  conversionId: string;
  onComplete?: () => void;
}

/**
 * @deprecated Use ConversionDetails component instead
 */
export function ProgressView({ conversionId, onComplete }: ProgressViewProps) {
  return (
    <ConversionDetails
      conversionId={conversionId}
      isLive={true}
      onComplete={onComplete}
      showBackLink={true}
    />
  );
}
