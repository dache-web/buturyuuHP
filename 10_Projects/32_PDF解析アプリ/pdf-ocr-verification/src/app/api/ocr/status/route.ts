import { NextResponse } from "next/server";

export async function GET() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

  const missingSettings: string[] = [];
  
  if (!projectId) missingSettings.push("GOOGLE_CLOUD_PROJECT_ID");
  if (!location) missingSettings.push("GOOGLE_CLOUD_LOCATION");
  if (!processorId) missingSettings.push("GOOGLE_DOCUMENT_AI_PROCESSOR_ID");

  const configured = missingSettings.length === 0;

  return NextResponse.json({
    configured,
    provider: "google_document_ai",
    missingSettings
  });
}
