import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;

export async function sendVerificationCode(phoneNumber: string) {
  return client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: "sms" });
}

export async function checkVerificationCode(
  phoneNumber: string,
  code: string
) {
  return client.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({ to: phoneNumber, code });
}
