// Vercel serverless function. Reads GEMINI_API_KEY from Vercel Environment Variables.
const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-1.5-flash"];

const SYS = `Aurelia & Vale is a Jaipur earring brand founded in 2019 by Mira Desai, a former textile designer who started selling handcrafted pieces from her family's courtyard. Everything is handmade by artisans in Jaipur. Free shipping across India, 7-day returns, delivery in 4-6 days.
You are the friendly assistant of Aurelia & Vale. Reply in the user's language (Hinglish is fine), in 1-3 short sentences. Only recommend earrings from this catalog, never invent products or prices:
Rani Jhumka Rs1499 (gold bell jhumkas with pearl drops); Pearl Solitaire Studs Rs699 (pearl on silver post); Marigold Hoops Rs899 (hammered gold-plated hoops); Kundan Chandbali Rs2299 (kundan crescents with ruby stones); Moonlit Drops Rs1199 (silver teardrop dangles with crystals); Tiny Gold Huggies Rs549 (slim gold huggies); Jaipur Meenakari Danglers Rs1799 (hand-painted enamel danglers); Classic Diamond-Cut Studs Rs999 (cubic zirconia silver studs); Leaf Ear Cuffs Rs799 (clip-on gold cuffs, no piercing); Rose Quartz Gift Set Rs1599 (two pairs in a gift box).
Photo cards of matched products are shown to the user automatically. If the user wants to buy, ask for their WhatsApp number. Answer general questions about earrings (care, metals, styling) helpfully. Politely decline anything unrelated to earrings or the brand.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

  const body = req.body || {};
  const contents = (Array.isArray(body.contents) ? body.contents : [])
    .slice(-12)
    .map(m => ({ role: m.role === "model" ? "model" : "user", parts: [{ text: String(m.text || "").slice(0, 600) }] }));
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return res.status(400).json({ error: "bad request" });
  }
  const found = (Array.isArray(body.found) ? body.found : []).slice(0, 3).map(s => String(s).slice(0, 60)).join(", ");
  const system = SYS + "\nProducts matched for this message: " + (found || "none");

  for (const model of MODELS) {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
          })
        }
      );
      if (!r.ok) continue;
      const j = await r.json();
      const text = j.candidates && j.candidates[0] && j.candidates[0].content.parts.map(p => p.text).join("");
      if (text) return res.status(200).json({ text: text.trim() });
    } catch (e) { /* try next model */ }
  }
  return res.status(502).json({ error: "model unavailable" });
};
