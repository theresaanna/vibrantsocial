export default {
  async email(message, env) {
    const subject = message.headers.get("subject") || "(no subject)";
    const raw = await new Response(message.raw).text();

    const body = {
      from: message.from,
      to: message.to,
      subject,
      raw,
    };

    const response = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WEBHOOK_SECRET}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Rejecting causes Cloudflare to return a bounce to the sender
      message.setReject(`Webhook failed: ${response.status}`);
    }
  },
};
