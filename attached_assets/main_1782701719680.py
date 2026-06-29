"""
Free Indian-language/accent TTS — single-file Replit app.

Covers 13 Indian languages with natural neural voices (via Microsoft Edge's
free TTS engine, no API key needed): Hindi, Indian English, Tamil, Telugu,
Bengali, Marathi, Gujarati, Kannada, Malayalam, Urdu, Punjabi, Odia, Assamese.

SETUP ON REPLIT:
1. Create a Python Repl
2. Paste this entire file as main.py
3. In the Shell tab, run:  pip install flask edge-tts
4. Click Run — open the webview, type text, pick a language, hit Play

All voice IDs below (including Punjabi, Odia, and Assamese) have been
verified against Microsoft's official voice list. If Microsoft ever
renames one, run this in the Shell to find the current name:
    edge-tts --list-voices | grep -E "pa-IN|or-IN|as-IN"
"""

from flask import Flask, request, send_file, jsonify, Response
import edge_tts
import asyncio
import uuid
import os

app = Flask(__name__)

VOICES = {
    "en-in":   "en-IN-PrabhatNeural",   # Indian English, male
    "en-in-f": "en-IN-NeerjaNeural",    # Indian English, female
    "hi":      "hi-IN-MadhurNeural",    # Hindi, male
    "hi-f":    "hi-IN-SwaraNeural",     # Hindi, female
    "ta":      "ta-IN-ValluvarNeural",  # Tamil, male
    "ta-f":    "ta-IN-PallaviNeural",   # Tamil, female
    "te":      "te-IN-MohanNeural",     # Telugu, male
    "te-f":    "te-IN-ShrutiNeural",    # Telugu, female
    "bn":      "bn-IN-BashkarNeural",   # Bengali, male
    "bn-f":    "bn-IN-TanishaaNeural",  # Bengali, female
    "mr":      "mr-IN-ManoharNeural",   # Marathi, male
    "mr-f":    "mr-IN-AarohiNeural",    # Marathi, female
    "gu":      "gu-IN-NiranjanNeural",  # Gujarati, male
    "gu-f":    "gu-IN-DhwaniNeural",    # Gujarati, female
    "kn":      "kn-IN-GaganNeural",     # Kannada, male
    "kn-f":    "kn-IN-SapnaNeural",     # Kannada, female
    "ml":      "ml-IN-MidhunNeural",    # Malayalam, male
    "ml-f":    "ml-IN-SobhanaNeural",   # Malayalam, female
    "ur":      "ur-IN-SalmanNeural",    # Urdu, male
    "ur-f":    "ur-IN-GulNeural",       # Urdu, female
    "pa":      "pa-IN-OjasNeural",      # Punjabi, male
    "pa-f":    "pa-IN-VaaniNeural",     # Punjabi, female
    "or":      "or-IN-SukantNeural",    # Odia, male
    "or-f":    "or-IN-SubhasiniNeural", # Odia, female
    "as":      "as-IN-PriyomNeural",    # Assamese, male
    "as-f":    "as-IN-YashicaNeural",   # Assamese, female
}

OUTPUT_DIR = "tts_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

PAGE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>EduBharat TTS Tester</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 16px; }
    textarea { width: 100%; height: 100px; font-size: 16px; padding: 8px; }
    select, button { font-size: 16px; padding: 8px 12px; margin-top: 10px; }
    button { cursor: pointer; }
    #status { margin-top: 10px; color: #555; }
  </style>
</head>
<body>
  <h2>Indian-language TTS Tester</h2>
  <textarea id="text">Welcome to your English lesson</textarea><br/>
  <select id="lang">
    {options}
  </select>
  <button onclick="speak()">▶ Play</button>
  <div id="status"></div>

  <script>
    async function speak() {
      const text = document.getElementById('text').value;
      const lang = document.getElementById('lang').value;
      const status = document.getElementById('status');
      status.textContent = 'Generating...';
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed');
        }
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        status.textContent = 'Playing...';
        audio.play();
        audio.onended = () => status.textContent = 'Done.';
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
      }
    }
  </script>
</body>
</html>
"""


@app.route("/")
def home():
    options = "\n".join(f'<option value="{k}">{k}</option>' for k in VOICES)
    return Response(PAGE.replace("{options}", options), mimetype="text/html")


@app.route("/api/voices", methods=["GET"])
def list_voices():
    return jsonify(list(VOICES.keys()))


@app.route("/api/tts", methods=["POST"])
def tts():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    lang = data.get("lang", "en-in")

    if not text:
        return jsonify({"error": "Missing 'text' field"}), 400

    voice = VOICES.get(lang, VOICES["en-in"])
    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)

    async def generate():
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(filepath)

    try:
        asyncio.run(generate())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    response = send_file(filepath, mimetype="audio/mpeg")

    @response.call_on_close
    def cleanup():
        if os.path.exists(filepath):
            os.remove(filepath)

    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
