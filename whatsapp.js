import express from "express";
import twilio from "twilio";

/**
 * WhatsApp integration via Twilio.
 *
 * This replaces whatsapp_mcp_enhanced.js. The original file ran an Express
 * webhook AND a stdio-based MCP server in the same process — the stdio
 * transport is for a local MCP client (e.g. Claude Desktop) piping into this
 * process's stdin/stdout, which has nothing to do with an autonomous local
 * agent. It's removed here. This module just does two things:
 *
 *   1. Runs the Twilio webhook (`/incoming`) and queues inbound messages
 *   2. Exposes a real `sendWhatsAppMessage()` that actually calls Twilio
 *
 * agent_loop.js is the only consumer — no MCP server is involved.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const USER_WHATSAPP_NUMBER = process.env.USER_WHATSAPP_NUMBER;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.warn("⚠️  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — WhatsApp will not function.");
}
if (!TWILIO_WHATSAPP_NUMBER) {
  console.warn("⚠️  TWILIO_WHATSAPP_NUMBER not set.");
}
if (!USER_WHATSAPP_NUMBER) {
  console.warn("⚠️  USER_WHATSAPP_NUMBER not set — agent has nowhere to send replies.");
}

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

// In-memory inbound queue. agent_loop.js drains this each iteration.
let incomingQueue = [];

/**
 * Starts the Express webhook server that receives inbound WhatsApp messages
 * from Twilio. Point your Twilio WhatsApp sender's inbound webhook at:
 *   https://<your-tunnel-url>/incoming
 */
export function startWhatsAppServer(port = 3000) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.post("/incoming", (req, res) => {
    const body = req.body.Body;
    const from = req.body.From;
    console.log(`\n📨 Incoming WhatsApp from ${from}: "${body}"`);
    incomingQueue.push({ body, from, timestamp: Date.now() });

    // Empty TwiML response — we reply asynchronously from the agent loop,
    // not synchronously in the webhook handler (Claude calls can take
    // several seconds, too slow for Twilio's webhook response window).
    res.set("Content-Type", "text/xml");
    res.status(200).send("<Response></Response>");
  });

  app.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      whatsapp_number: TWILIO_WHATSAPP_NUMBER || null,
      queued_messages: incomingQueue.length,
    });
  });

  app.listen(port, () => {
    console.log(`✓ WhatsApp webhook listening on port ${port} (POST /incoming)`);
  });

  return app;
}

/**
 * Drains and returns all messages received since the last call.
 * Returns [] if nothing new has arrived.
 */
export function getIncomingMessages() {
  const msgs = incomingQueue;
  incomingQueue = [];
  return msgs;
}

/**
 * Actually sends a WhatsApp message via Twilio. The original
 * sendWhatsAppReply() in agent_loop.js only console.log'd this — it never
 * called Twilio. This is the real implementation.
 */
export async function sendWhatsAppMessage(body) {
  if (!twilioClient) {
    console.error("✗ Cannot send WhatsApp message — Twilio client not configured.");
    return { success: false, error: "Twilio not configured" };
  }
  if (!USER_WHATSAPP_NUMBER) {
    console.error("✗ Cannot send WhatsApp message — USER_WHATSAPP_NUMBER not set.");
    return { success: false, error: "USER_WHATSAPP_NUMBER not set" };
  }

  try {
    const msg = await twilioClient.messages.create({
      body,
      from: TWILIO_WHATSAPP_NUMBER,
      to: USER_WHATSAPP_NUMBER,
    });
    console.log(`✓ WhatsApp sent (sid: ${msg.sid})`);
    return { success: true, sid: msg.sid };
  } catch (err) {
    console.error("✗ WhatsApp send error:", err.message);
    return { success: false, error: err.message };
  }
}
