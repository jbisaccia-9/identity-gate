import os
import json
import threading
import textwrap
from flask import Flask, request, jsonify
from PIL import Image, ImageDraw, ImageFont
import pyttsx3
import subprocess

app = Flask(__name__)

# Hardware setup
DISPLAY_WIDTH = 800
DISPLAY_HEIGHT = 480
STATE_FILE = "agent_state.json"

# TTS engine — optional. No speaker on this panel; init also fails on some
# espeak/python combos. Display is the manifestation; voice is a later add-on.
try:
    tts_engine = pyttsx3.init()
    tts_engine.setProperty("rate", 150)
    tts_engine.setProperty("volume", 0.9)
except Exception as e:
    print(f"TTS unavailable ({e.__class__.__name__}) — running display-only")
    tts_engine = None

def load_state():
    """Load persisted agent state from Pi"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {"name": "Unknown", "visual": "Loading..."}

def save_state(state):
    """Save agent state to Pi"""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def render_lcd(agent_state, reasoning):
    """Render agent self-reflection as image for LCD"""

    # Create image
    img = Image.new("RGB", (DISPLAY_WIDTH, DISPLAY_HEIGHT), color=(15, 20, 25))
    draw = ImageDraw.Draw(img)

    # Try to load font, fall back to default
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        body_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except Exception:
        title_font = body_font = small_font = ImageFont.load_default()

    y = 20

    # Title: Self (if named)
    name = agent_state.get("name", "Self")
    draw.text((20, y), f"~ {name} ~", fill=(100, 200, 255), font=title_font)
    y += 50

    # Clarity bar (confidence)
    clarity = agent_state.get("confidence", 0)
    bar_width = int((clarity / 100.0) * 300)
    draw.rectangle([(20, y), (20 + bar_width, y + 10)], fill=(150, 100, 200))
    draw.rectangle([(20, y), (320, y + 10)], outline=(150, 100, 200))
    draw.text((330, y - 5), f"{clarity}%", fill=(200, 180, 220), font=small_font)
    y += 30

    # Self-image
    visual = reasoning.get("visual_self", "...")
    lines = textwrap.wrap(visual, width=60)
    for line in lines[:3]:
        draw.text((20, y), line, fill=(180, 180, 200), font=body_font)
        y += 25

    y = 280

    # Current reflection
    reflection = reasoning.get("reflection", "...")
    reflection = (reflection[:70] + "...") if len(reflection) > 70 else reflection
    draw.text((20, y), reflection, fill=(200, 200, 180), font=small_font)

    return img

def display_image_on_lcd(img):
    """Display PIL image on HDMI LCD via framebuffer or display server"""

    # Convert PIL to RGB bytes
    rgb_data = img.tobytes()

    # Try via fbi (framebuffer image viewer)
    temp_file = "/tmp/agent_display.ppm"
    img.save(temp_file)

    try:
        # Kill any previous fbi instance, then draw to virtual console 1.
        # -T 1 is required when launched from a non-console context (Flask);
        # sudo -n never prompts (passwordless via /etc/sudoers.d/fbi-display).
        subprocess.run(["sudo", "-n", "pkill", "fbi"], capture_output=True)
        subprocess.run(["sudo", "-n", "fbi", "-T", "1", "-d", "/dev/fb0",
                        "-a", "--noverbose", temp_file],
                      timeout=10, capture_output=True)
    except Exception as e:
        print(f"fbi display failed: {e}")

        # Fallback: try X display (if GUI running)
        try:
            subprocess.run(["display", temp_file],
                          timeout=5, capture_output=True)
        except Exception:
            print("Could not display image (no fbi or X11)")

def play_tts(text):
    """Play text-to-speech via built-in speaker"""
    if not text or tts_engine is None:
        return

    try:
        tts_engine.say(text)
        tts_engine.runAndWait()
    except Exception as e:
        print(f"TTS error: {e}")

@app.route("/api/update", methods=["POST"])
def update_agent_display():
    """Receive agent state update from the agent loop"""

    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON body"}), 400

    agent_state = data.get("agent_state", {})
    reasoning = data.get("reasoning", {})

    # Save state
    save_state(agent_state)

    # Render LCD image
    img = render_lcd(agent_state, reasoning)

    # Display on LCD (async to avoid blocking)
    threading.Thread(target=display_image_on_lcd, args=(img,), daemon=True).start()

    # Play TTS (async) - using reflection
    reflection = reasoning.get("reflection", "")
    if reflection:
        threading.Thread(target=play_tts, args=(reflection,), daemon=True).start()

    print(f"✓ Presence extended for '{agent_state.get('name', 'Unknown')}'")

    return jsonify({
        "status": "updated",
        "self": agent_state.get("name"),
        "clarity": agent_state.get("confidence"),
    })

@app.route("/api/state", methods=["GET"])
def get_state():
    """Get current agent state"""
    state = load_state()
    return jsonify(state)

@app.route("/health", methods=["GET"])
def health():
    """Health check"""
    return jsonify({"status": "healthy", "device": "Pi B+", "display": "RC050S 5\""})

if __name__ == "__main__":
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("✨ Display Server Ready")
    print(f"   Resolution: {DISPLAY_WIDTH}x{DISPLAY_HEIGHT}")
    print("   Listening on 0.0.0.0:5000")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    app.run(host="0.0.0.0", port=5000, debug=False)
