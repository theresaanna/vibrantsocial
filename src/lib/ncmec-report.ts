import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import * as Sentry from "@sentry/nextjs";

const PRODUCTION_URL = "https://report.cybertip.org/ispws";
const TEST_URL = "https://exttest.cybertip.org/ispws";

function getBaseUrl(): string {
  return process.env.NCMEC_ENVIRONMENT === "test" ? TEST_URL : PRODUCTION_URL;
}

function getAuthHeader(): string {
  const username = process.env.NCMEC_USERNAME;
  const password = process.env.NCMEC_PASSWORD;
  if (!username || !password) {
    throw new Error("NCMEC credentials not configured");
  }
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface NCMECResponse {
  reportResponse: {
    responseCode: number;
    responseDescription: string;
    reportId?: number;
  };
}

interface ReportParams {
  quarantinedUploadId: string;
  userId: string;
  username: string;
  email: string | null;
  classification: string;
  sha256: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  ipAddress: string | null;
  userAgent: string | null;
  imageBuffer: Buffer | Uint8Array;
  incidentDateTime: Date;
}

async function ncmecFetch(
  endpoint: string,
  body: string | Uint8Array,
  contentType: string
): Promise<Response> {
  let fetchBody: BodyInit;
  if (typeof body === "string") {
    fetchBody = body;
  } else {
    const ab = new ArrayBuffer(body.byteLength);
    new Uint8Array(ab).set(body);
    fetchBody = new Blob([ab], { type: contentType });
  }
  const response = await fetch(`${getBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: getAuthHeader(),
    },
    body: fetchBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `NCMEC API error ${response.status}: ${text.slice(0, 500)}`
    );
  }

  return response;
}

function parseResponse(xml: string): NCMECResponse {
  const parsed = xmlParser.parse(xml);
  return parsed as NCMECResponse;
}

/**
 * Submit a CSAM report to the NCMEC CyberTipline.
 *
 * Follows the multi-step workflow:
 * 1. POST /submit — send incident report XML, receive report ID
 * 2. POST /upload — attach the flagged file
 * 3. POST /fileinfo — attach file metadata
 * 4. POST /finish — finalize the report
 *
 * Updates the QuarantinedUpload record with the NCMEC report ID on success.
 */
export async function submitNCMECReport(
  params: ReportParams
): Promise<{ reportId: number }> {
  const {
    quarantinedUploadId,
    userId,
    username,
    email,
    classification,
    sha256,
    fileName,
    fileSize,
    mimeType,
    ipAddress,
    userAgent,
    imageBuffer,
    incidentDateTime,
  } = params;

  // Step 1: Submit the initial report
  const reportXml = xmlBuilder.build({
    report: {
      "@_xmlns": "https://report.cybertip.org",
      incidentSummary: {
        incidentType: "Child Pornography (possession, manufacture, and distribution)",
        incidentDateTime: incidentDateTime.toISOString(),
      },
      internetDetails: {
        webPageIncident: {
          url: process.env.NEXT_PUBLIC_APP_URL ?? "https://vibrantsocial.app",
        },
      },
      reporteeInformation: {
        reporteeUserName: username,
        ...(email ? { reporteeEmailAddress: email } : {}),
        ...(ipAddress
          ? {
              reporteeIPCaptureEvent: {
                ipAddress,
                dateTime: incidentDateTime.toISOString(),
                ipType: "upload",
              },
            }
          : {}),
      },
      additionalInfo: `Detected via Project Arachnid Shield. Classification: ${classification}. SHA-256: ${sha256}. User ID: ${userId}. Upload endpoint: VibrantSocial file upload.${userAgent ? ` User-Agent: ${userAgent}` : ""}`,
    },
  });

  const submitResponse = await ncmecFetch(
    "/submit",
    reportXml,
    "application/xml"
  );
  const submitResult = parseResponse(await submitResponse.text());

  if (submitResult.reportResponse.responseCode !== 0) {
    throw new Error(
      `NCMEC submit failed: ${submitResult.reportResponse.responseDescription}`
    );
  }

  const reportId = submitResult.reportResponse.reportId;
  if (!reportId) {
    throw new Error("NCMEC submit succeeded but no reportId returned");
  }

  // Step 2: Upload the flagged file
  const uploadUrl = `/upload?id=${reportId}&filename=${encodeURIComponent(fileName)}`;
  const uploadResponse = await ncmecFetch(
    uploadUrl,
    new Uint8Array(imageBuffer),
    mimeType
  );
  const uploadResult = parseResponse(await uploadResponse.text());

  if (uploadResult.reportResponse.responseCode !== 0) {
    // Retract the report if upload fails — don't leave it dangling
    await retractReport(reportId).catch((e) =>
      Sentry.captureException(e, { extra: { reportId, step: "retract-after-upload-fail" } })
    );
    throw new Error(
      `NCMEC upload failed: ${uploadResult.reportResponse.responseDescription}`
    );
  }

  const fileId = uploadResult.reportResponse.reportId;

  // Step 3: Submit file metadata
  if (fileId) {
    const fileInfoXml = xmlBuilder.build({
      fileDetails: {
        "@_xmlns": "https://report.cybertip.org",
        fileId,
        fileName,
        fileSize,
        hash: {
          hashType: "SHA256",
          hashValue: sha256,
        },
        additionalInfo: `Arachnid Shield classification: ${classification}`,
      },
    });

    const fileInfoResponse = await ncmecFetch(
      `/fileinfo?id=${reportId}`,
      fileInfoXml,
      "application/xml"
    );
    const fileInfoResult = parseResponse(await fileInfoResponse.text());

    if (fileInfoResult.reportResponse.responseCode !== 0) {
      Sentry.captureMessage(
        `NCMEC fileinfo warning: ${fileInfoResult.reportResponse.responseDescription}`,
        { extra: { reportId } }
      );
      // Non-fatal — continue to finish
    }
  }

  // Step 4: Finish the report
  const finishResponse = await ncmecFetch(
    `/finish?id=${reportId}`,
    "",
    "application/xml"
  );
  const finishResult = parseResponse(await finishResponse.text());

  if (finishResult.reportResponse.responseCode !== 0) {
    throw new Error(
      `NCMEC finish failed: ${finishResult.reportResponse.responseDescription}`
    );
  }

  // Update the quarantined upload record with the NCMEC report ID
  await prisma.quarantinedUpload.update({
    where: { id: quarantinedUploadId },
    data: {
      ncmecReportId: reportId,
      ncmecReportedAt: new Date(),
    },
  });

  return { reportId };
}

async function retractReport(reportId: number): Promise<void> {
  await ncmecFetch(`/retract?id=${reportId}`, "", "application/xml");
}

/**
 * Check NCMEC API connectivity and authentication.
 */
export async function checkNCMECStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/status`, {
      headers: { Authorization: getAuthHeader() },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Returns true if NCMEC credentials are configured.
 */
export function isNCMECConfigured(): boolean {
  return !!(process.env.NCMEC_USERNAME && process.env.NCMEC_PASSWORD);
}
