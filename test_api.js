import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
client.messages.create({
  model: process.env.AGENT_MODEL || "claude-sonnet-5",
  max_tokens: 50,
  messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
})
  .then(r => console.log("✓ API key works:", r.content[0].text))
  .catch(e => console.error("✗ API error:", e.message));
