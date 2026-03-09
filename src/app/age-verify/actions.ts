"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createVerification,
  getVerificationStatus,
  type AgeCheckerStatus,
} from "@/lib/agechecker";
import { revalidatePath } from "next/cache";

interface ActionState {
  success: boolean;
  message: string;
  /** UUID returned by AgeChecker when popup is needed */
  uuid?: string;
  /** Status returned by AgeChecker */
  status?: AgeCheckerStatus;
}

/**
 * Initiates an age verification request via AgeChecker.net.
 * If instant verification succeeds, marks user as age-verified immediately.
 * Otherwise returns the UUID so the client can show the AgeChecker popup.
 */
export async function initiateAgeVerification(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      ageVerified: true,
      dateOfBirth: true,
      email: true,
    },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (user.ageVerified) {
    return { success: true, message: "Already age verified" };
  }

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const city = (formData.get("city") as string)?.trim();
  const state = (formData.get("state") as string)?.trim();
  const zip = (formData.get("zip") as string)?.trim();
  const country = (formData.get("country") as string)?.trim() || "US";

  if (!firstName || !lastName) {
    return { success: false, message: "First and last name are required" };
  }

  if (!user.dateOfBirth) {
    return { success: false, message: "Date of birth is required" };
  }

  const dob = new Date(user.dateOfBirth);
  const callbackUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/agechecker-webhook`
    : undefined;

  try {
    const result = await createVerification(
      {
        first_name: firstName,
        last_name: lastName,
        address: address || "",
        city: city || "",
        state: state || "",
        zip: zip || "",
        country,
        dob_day: dob.getDate(),
        dob_month: dob.getMonth() + 1,
        dob_year: dob.getFullYear(),
        email: user.email || undefined,
      },
      {
        min_age: 18,
        customer_ip:
          (formData.get("customerIp") as string) || undefined,
        callback_url: callbackUrl,
        metadata: {
          userId: session.user.id,
        },
      }
    );

    if (result.status === "accepted") {
      // Instant verification succeeded
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ageVerified: new Date(),
          ageVerificationUuid: result.uuid,
        },
      });

      revalidatePath("/profile");
      revalidatePath("/feed");

      return {
        success: true,
        message: "Age verification successful",
        status: "accepted",
      };
    }

    if (result.status === "not_created") {
      return {
        success: false,
        message:
          "Verification could not be created. You may not meet the minimum age requirement.",
        status: "not_created",
      };
    }

    // Store the UUID for tracking
    if (result.uuid) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { ageVerificationUuid: result.uuid },
      });
    }

    // For photo_id, signature, pending — client needs to show popup
    return {
      success: true,
      message: "Additional verification required",
      uuid: result.uuid,
      status: result.status,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Verification failed";
    return { success: false, message: errorMessage };
  }
}

/**
 * Polls the status of a pending verification.
 */
export async function checkVerificationStatus(): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ageVerified: true, ageVerificationUuid: true },
  });

  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (user.ageVerified) {
    return { success: true, message: "Already age verified", status: "accepted" };
  }

  if (!user.ageVerificationUuid) {
    return { success: false, message: "No pending verification" };
  }

  try {
    const result = await getVerificationStatus(user.ageVerificationUuid);

    if (result.status === "accepted") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { ageVerified: new Date() },
      });

      revalidatePath("/profile");
      revalidatePath("/feed");

      return {
        success: true,
        message: "Age verification successful",
        status: "accepted",
      };
    }

    if (result.status === "denied") {
      return {
        success: false,
        message: `Verification denied: ${result.reason ?? "unknown reason"}`,
        status: "denied",
      };
    }

    return {
      success: true,
      message: "Verification is still pending",
      status: result.status,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Status check failed";
    return { success: false, message: errorMessage };
  }
}
