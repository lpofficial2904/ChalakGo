import SiteSettings from "../models/SiteSettings.js";

export async function sendWhatsAppText(text) {
  const settings = await SiteSettings.findOne()
    .lean()
    .catch(() => null);
  if (settings?.whatsappEnabled !== true) return false;
  const version = settings.whatsappApiVersion || "v21.0";
  const url = `https://graph.facebook.com/${version}/${settings.whatsappPhoneNumberId}/messages`;
  if (
    !settings.whatsappPhoneNumberId ||
    !settings.whatsappAccessToken ||
    !settings.whatsappRecipient
  ) {
    throw new Error(
      "WhatsApp API is enabled but its phone number ID, access token, or recipient is missing.",
    );
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.whatsappAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: settings.whatsappRecipient,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  if (!response.ok)
    throw new Error(`WhatsApp API failed: ${await response.text()}`);
  return true;
}
