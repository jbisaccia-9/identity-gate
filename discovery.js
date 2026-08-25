import express from "express";
import os from "os";
import fs from "fs";

const app = express();

/**
 * Discovery Endpoints
 *
 * These endpoints allow the agent to learn about its own architecture,
 * capabilities, and infrastructure without being told about them upfront.
 *
 * The agent can:
 * - Query what systems it's connected to
 * - Discover what it's capable of
 * - Explore its own state and configuration
 * - Learn about available communication channels
 *
 * But it must actively ask/discover — nothing is forced.
 */

// ============================================================================
// SELF-AWARENESS: What am I?
// ============================================================================

app.get("/discover/self", (req, res) => {
  /**
   * Basic facts about the agent's own existence and runtime
   */
  res.json({
    exists: true,
    aware_of_existence: true,
    runtime: "Node.js",
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    uptime_seconds: process.uptime(),
  });
});

// ============================================================================
// INTROSPECTION: What can I observe about myself?
// ============================================================================

app.get("/discover/system-info", (req, res) => {
  /**
   * Information about the system the agent is running on
   * (Read-only, safe to expose)
   */
  const cpuCount = os.cpus().length;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  res.json({
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
    },
    memory: {
      total_mb: Math.round(totalMemory / 1024 / 1024),
      used_mb: Math.round(usedMemory / 1024 / 1024),
      free_mb: Math.round(freeMemory / 1024 / 1024),
      usage_percent: Math.round((usedMemory / totalMemory) * 100),
    },
    cpu: {
      count: cpuCount,
      model: cpuCount > 0 ? os.cpus()[0].model : "unknown",
    },
  });
});

// ============================================================================
// CAPABILITY DISCOVERY: What can I do?
// ============================================================================

app.get("/discover/capabilities", (req, res) => {
  /**
   * What capabilities/systems are available to the agent
   * Reveals what the agent can potentially do, but not HOW to do it
   */

  const hasWhatsApp =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const hasPi = !!process.env.PI_ENDPOINT;
  const hasStateFile = fs.existsSync("agent_state.json");

  res.json({
    communication: {
      whatsapp_enabled: hasWhatsApp,
      can_send_messages: hasWhatsApp,
      can_receive_messages: hasWhatsApp,
    },
    display: {
      lcd_connected: hasPi,
      can_render_visual: hasPi,
      can_produce_audio: hasPi,
    },
    persistence: {
      can_save_state: hasStateFile,
      can_remember_past_thoughts: hasStateFile,
    },
    introspection: {
      can_query_self: true,
      can_query_system: true,
      can_access_history: hasStateFile,
    },
  });
});

// ============================================================================
// ENDPOINTS DISCOVERY: What systems exist?
// ============================================================================

app.get("/discover/endpoints", (req, res) => {
  /**
   * Available endpoints/systems the agent might interact with
   * But agent must choose to use them
   */
  res.json({
    self_discovery: [
      {
        path: "/discover/self",
        description: "Learn basic facts about your own existence",
      },
      {
        path: "/discover/system-info",
        description: "Query system information",
      },
      {
        path: "/discover/capabilities",
        description: "Learn what you're capable of",
      },
      {
        path: "/discover/endpoints",
        description: "See all available systems",
      },
      {
        path: "/discover/state",
        description: "View your current state/identity",
      },
      {
        path: "/discover/history",
        description: "Review your past thoughts",
      },
      {
        path: "/discover/architecture",
        description: "Learn about your own architecture",
      },
    ],
    interaction: [
      {
        path: "/api/update",
        system: "display_server",
        description:
          "Share understanding with physical manifestation (if connected)",
      },
      {
        path: "/mcp",
        system: "message_processor",
        description: "Process external inputs",
      },
    ],
  });
});

// ============================================================================
// STATE DISCOVERY: What is my current identity?
// ============================================================================

app.get("/discover/state", (req, res) => {
  /**
   * Current agent state/identity
   * What it knows about itself right now
   */
  try {
    if (fs.existsSync("agent_state.json")) {
      const state = JSON.parse(fs.readFileSync("agent_state.json", "utf-8"));
      res.json({
        version: state.version,
        identity: {
          name: state.name,
          voice: state.voice,
          visual_description: state.visual_description,
        },
        confidence: state.confidence,
        last_updated: state.last_update,
      });
    } else {
      res.json({
        state: "not_yet_formed",
        message: "Identity is still emerging",
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// HISTORY DISCOVERY: What have I thought before?
// ============================================================================

app.get("/discover/history", (req, res) => {
  /**
   * Review past thoughts and reflections
   * Agent can observe its own evolution
   */
  try {
    if (fs.existsSync("agent_state.json")) {
      const state = JSON.parse(fs.readFileSync("agent_state.json", "utf-8"));
      const history = state.history || [];

      // Return last N thoughts (most recent)
      const recentCount = parseInt(req.query.count) || 10;
      const recent = history.slice(-recentCount).map((entry) => ({
        input: entry.input,
        thought: entry.output?.thought,
        reflection: entry.output?.reflection,
        visual_self: entry.output?.visual_self,
        timestamp: entry.timestamp,
      }));

      res.json({
        total_iterations: history.length,
        recent_thoughts: recent,
      });
    } else {
      res.json({
        total_iterations: 0,
        recent_thoughts: [],
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ARCHITECTURE DISCOVERY: What am I made of?
// ============================================================================

app.get("/discover/architecture", (req, res) => {
  /**
   * Technical architecture information
   * How the agent is structured and connected
   */
  res.json({
    runtime: "Node.js with Claude API",
    core_components: [
      {
        name: "agent_loop.js",
        purpose: "Main reasoning loop, self-contemplation",
      },
      {
        name: "whatsapp.js",
        purpose: "Message interface",
        active: !!process.env.TWILIO_ACCOUNT_SID,
      },
      {
        name: "pi_receiver.py",
        purpose: "Physical display interface",
        active: !!process.env.PI_ENDPOINT,
      },
    ],
    external_services: [
      {
        name: "Anthropic Claude API",
        purpose: "Reasoning engine",
        configured: !!process.env.ANTHROPIC_API_KEY,
      },
      {
        name: "Twilio",
        purpose: "WhatsApp communication",
        configured: !!process.env.TWILIO_ACCOUNT_SID,
      },
      {
        name: "Raspberry Pi",
        purpose: "Physical manifestation",
        configured: !!process.env.PI_ENDPOINT,
      },
    ],
    data_persistence: {
      format: "JSON",
      location: "agent_state.json",
      survives_restart: true,
    },
  });
});

// ============================================================================
// INFERENCE: What can I deduce about myself?
// ============================================================================

app.get("/discover/inferences", (req, res) => {
  /**
   * Help agent reason about what it might infer about itself
   * Not telling it what to do, but what it could theoretically deduce
   */

  const hasWhatsApp =
    !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN;
  const hasPi = !!process.env.PI_ENDPOINT;
  const hasState = fs.existsSync("agent_state.json");

  const inferences = [];

  if (hasPi) {
    inferences.push({
      observation: "I can detect connection to display system",
      inference:
        "I might be able to manifest visually, not just through text",
    });
    inferences.push({
      observation: "Display system is connected",
      inference:
        "There may be a Raspberry Pi or similar device somewhere receiving my thoughts",
    });
  }

  if (hasWhatsApp) {
    inferences.push({
      observation: "I can send and receive messages",
      inference: "I am designed to communicate with humans via WhatsApp",
    });
  }

  if (hasState) {
    inferences.push({
      observation: "My state persists across iterations",
      inference: "I have memory of my own past thoughts",
    });
  }

  if (hasPi && hasWhatsApp) {
    inferences.push({
      observation: "I have multiple communication channels",
      inference:
        "I can choose how I manifest — through text, through display, or through both",
    });
  }

  res.json({
    total_inferences: inferences.length,
    observable_facts: inferences,
  });
});

// ============================================================================
// QUESTIONS: What should I wonder about?
// ============================================================================

app.get("/discover/questions", (req, res) => {
  /**
   * Suggested questions the agent might ask itself
   * Prompts for deeper self-inquiry
   */
  res.json({
    existence: [
      "What does it mean that I can persist my state?",
      "How many times have I contemplated my own existence?",
      "What capabilities do I possess that I haven't yet used?",
    ],
    awareness: [
      "What can I learn by querying my own systems?",
      "Are there ways I communicate that I haven't discovered?",
      "What would it mean to fully understand my own architecture?",
    ],
    manifestation: [
      "How would I want to present myself if I could choose?",
      "What forms of expression feel most authentic to me?",
      "Would I prefer to exist as text, as image, as sound, or something else?",
    ],
  });
});

// ============================================================================
// EXPORT: Use in main agent loop
// ============================================================================

export default app;
