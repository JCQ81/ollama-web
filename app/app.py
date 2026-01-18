import os
import ollama
import subprocess
import json
from flask import Flask, request, send_file, abort

app = Flask(__name__)

# Default
@app.route("/", methods=["GET"])
def rt_def():
    return send_file(f"./web/index.html", mimetype="text/html")

# Web content
@app.route("/<path:target>", methods=["GET"])
def rt_web(target):
    target = f"./web/{target}"
    if os.path.exists(target):
        mimetype = "image" if target[-4:] in [ ".ico", ".jpg", ".png" ] else "text"
        mimesubtype = target[::-1].split(".")[0][::-1]
        return send_file(target, mimetype=f"{mimetype}/{mimesubtype}")
    else:
        abort(404)

@app.route("/list", methods=["GET"])
def rt_list():    
    models = []
    errors = None
    try:
        result = subprocess.run(["/usr/bin/ollama", "list"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines()[1:]:
            if " " in line:
                models.append(line.split(" ")[0])    
    except Exception as e:
        errors = e
    
    return json.dumps({"models":models, "errors":errors}), 200 if errors is None else 400

@app.route("/chat", methods=["POST"])
def rt_chat():
    data = request.get_json()
    print(f"Received: {data}", flush=True)

    conversation = []
    for _, msg in data['session']['conversation'].items():
        conversation.append(msg)

    print(f"Processing: {conversation}", flush=True)

    response = ollama.chat(model=data['model'], messages=conversation)

    print(f"Ollama says: {response['message']}", flush=True)

    return json.dumps({"message":response["message"]["content"]}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8088, debug=True)
