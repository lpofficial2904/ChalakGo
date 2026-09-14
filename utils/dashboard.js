export const builtInPages = ['home', 'about', 'pricing', 'services', 'blog', 'contact', 'how-it-works', 'fleet', 'reviews', 'faqs', 'terms-and-conditions'];
export function periodStarts(now = new Date()) {
  const offset = 330 * 60000;
  const local = new Date(now.getTime() + offset);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return { today: new Date(day - offset), week: new Date(day - ((local.getUTCDay() + 6) % 7) * 86400000 - offset), month: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset) };
}
export function publicationCounts(items, key) {
  const active = items.filter(item => item[key] !== false).length;
  return { total: items.length, active, inactive: items.length - active };
}
export function pageCounts(pages) {
  const records = new Map(builtInPages.map(slug => [slug, { slug, isPublished: true }]));
  pages.forEach(page => records.set(page.slug, page));
  return publicationCounts([...records.values()], 'isPublished');
}
export async function requestCounts(Model, now = new Date()) {
  const periods = periodStarts(now);
  const [result] = await Model.aggregate([{ $group: {
    _id: null, total: { $sum: 1 },
    ...Object.fromEntries(Object.entries(periods).map(([key, start]) => [key, { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', start] }, { $lte: ['$createdAt', now] }] }, 1, 0] } }]))
  } }]);
  const { _id, ...counts } = result || { total: 0, today: 0, week: 0, month: 0 };
  return counts;
}
