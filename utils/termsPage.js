import { readFileSync } from "node:fs";
import Page from "../models/Page.js";

const content = readFileSync(new URL("../content/terms.txt", import.meta.url), "utf8");

export async function ensureTermsPage() {
  // Insert the supplied starting copy once. Never overwrite admin edits or
  // the publication status on subsequent requests/redeploys.
  await Page.updateOne({ slug: "terms-and-conditions" }, { $setOnInsert: {
    title: "Terms & Conditions",
    heroTitle: "Terms & Conditions",
    navigationLabel: "Terms & Conditions",
    content,
    seoTitle: "Terms & Conditions | ChalakGo",
    seoDescription: "Terms for ChalakGo driver hiring, cab bookings, service fees and replacement support.",
    isPublished: true,
    statusOnly: false,
  } }, { upsert: true, setDefaultsOnInsert: true, timestamps: false });
}
