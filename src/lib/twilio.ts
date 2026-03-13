import twilio from "twilio";

function getClient() {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_VERIFY_SERVICE_SID
  ) {
    throw new Error("Twilio environment variables are not configured");
  }
  return {
    client: twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    ),
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
}

export async function sendVerificationCode(phoneNumber: string) {
  const { client, verifyServiceSid } = getClient();
  return client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: "sms" });
}

export async function checkVerificationCode(
  phoneNumber: string,
  code: string
) {
  const { client, verifyServiceSid } = getClient();
  return client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phoneNumber, code });
}
