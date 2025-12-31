"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConversionDetails } from "@/components/conversion/conversion-details";

export default function ConversionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <Link
        href="/gallery"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Gallery
      </Link>

      <ConversionDetails 
        conversionId={id} 
        isLive={false}
        showBackLink={true}
      />
    </div>
  );
}
