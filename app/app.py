import os
import time
import json
import glob
import subprocess
from flask import Flask, request, send_file, abort
from langchain_ollama import OllamaLLM, OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

app = Flask(__name__)

BASE_DIR = os.environ.get("BASE_DIR", "/root/.ollama")
DOCS_DIR = os.environ.get("DOCS_DIR", f"{BASE_DIR}/datastore/docs")         # Text, MarkDown, etc...
CODING_DIR = os.environ.get("CODING_DIR", f"{BASE_DIR}/datastore/coding")   # Source codes
CHROMA_DIR = os.environ.get("CHROMA_DIR", f"{BASE_DIR}/chroma")             # Chroma persistent data dir
ARCHIVE_DIR = os.environ.get("ARCHIVE_DIR", f"{BASE_DIR}/archive")          # Archive dir (learn prompts etc)

STORE_LIST = ["conversations", "docs", "coding"]
CHROMA_LIST = {}
MODEL_KEEPALIVE = 7200
ENABLE_PASSIVE_LEARNING = False


### Ingest functions

def _ingest_text(text, chroma_store, metadata=None):
    docs = splitter.create_documents([text], metadatas=[metadata or {}])
    chroma_store.add_documents(docs)

def _ingest_file(path, chroma_store):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            text = fh.read().strip()
        if text:
            _ingest_text(text, chroma_store, metadata={"source": path})
            print(f"[ingest] {path}", flush=True)
    except Exception as exc:
        print(f"[ingest] SKIP {path}: {exc}", flush=True)

def _ingest_directory(directory, chroma_store, extensions):
    if not directory or not os.path.isdir(directory):
        print(f"[ingest] Directory not found or not set: {directory!r}", flush=True)
        return 0
    count = 0
    for ext in extensions:
        for path in glob.glob(os.path.join(directory, "**", f"*{ext}"), recursive=True):
            _ingest_file(path, chroma_store)
            count += 1
    return count


### Prompt functions

def _retrieve_context(query, chroma_store):
    results: list[Document] = chroma_store.similarity_search(query, k=3)
    return "\n\n".join(d.page_content for d in results)

def _build_prompt(user_message, conversation):
    query = user_message
    ctx = {}
    sections = []
    for store_name in STORE_LIST:
        ctx[store_name] = _retrieve_context(query, CHROMA_LIST[store_name])
        sections.append(f"[{store_name}]\n{ctx[store_name]}")

    context_block = "\n\n".join(sections)

    history_lines = []
    for msg in conversation:
        role    = msg.get("role", "user")
        content = msg.get("content", "")
        history_lines.append(f"{role.capitalize()}: {content}")
    history_block = "\n".join(history_lines)

    prompt_parts = []
    if context_block:
        prompt_parts.append(f"Use the following context to answer the user's question.\n\n{context_block}")
    if history_block:
        prompt_parts.append(f"Conversation so far:\n{history_block}")
    prompt_parts.append(f"User: {user_message}\nAssistant:")

    return "\n\n".join(prompt_parts)

### Global functions

def chroma_index():
    result = { "ingest": {} }
    if DOCS_DIR:
        os.makedirs(DOCS_DIR, exist_ok=True)
        extensions = [".txt", ".md", ".markdown", '.conf', '.cfg', '.yml', '.yaml', '.json', ]
        cnt = _ingest_directory(DOCS_DIR, CHROMA_LIST["docs"], extensions)
        result["ingest"][CHROMA_LIST["docs"]] = cnt
    if CODING_DIR:
        os.makedirs(CODING_DIR, exist_ok=True)
        extensions = ['.txt', '.sh', '.py', '.js', '.rb', '.ps1', '.c', '.cpp', '.cc', '.java', '.cs', '.rs', '.go', '.makefile', '.mk', '.html', '.htm', '.css', '.sql']
        cnt = _ingest_directory(CODING_DIR, CHROMA_LIST["coding"], extensions)
        result["ingest"][CHROMA_LIST["coding"]] = cnt
    return result


### Flask routes

@app.route("/", methods=["GET"])
def rt_def():
    return send_file("./web/index.html", mimetype="text/html")

@app.route("/<path:target>", methods=["GET"])
def rt_web(target):
    path = f"./web/{target}"
    if os.path.exists(path):
        ext = os.path.splitext(path)[1].lstrip(".")
        mimetype = "image" if ext in ("ico", "jpg", "png", "gif", "svg", "webp") else "text"
        return send_file(path, mimetype=f"{mimetype}/{ext}")
    abort(404)

@app.route("/list", methods=["GET"])
def rt_list():
    models, errors = [], None
    try:
        result = subprocess.run(
            ["/usr/bin/ollama", "list"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        for line in result.stdout.splitlines()[1:]:
            if " " in line and "-embed" not in line:
                models.append(line.split()[0])
    except Exception as exc:
        errors = str(exc)
    return json.dumps({"models": models, "errors": errors}), 200 if errors is None else 400

@app.route("/ingest", methods=["GET"])
def rt_ingest():
    try:
        result = chroma_index()
        return json.dumps(result), 200
    except Exception as e:
        return json.dumps({ "error": str(e) }), 500

@app.route("/chat", methods=["POST"])
def rt_chat():
    data = request.get_json()
    print(f"[chat] Received: {data}", flush=True)

    conversation: list[dict] = list(data["session"]["conversation"].values())
    user_message: str = next((m["content"] for m in reversed(conversation) if m["role"] == "user"), "")

    force_learn   = user_message.lower().startswith("#learn:")
    passive_learn = ENABLE_PASSIVE_LEARNING
    if force_learn:
        user_message = user_message[len("#learn:"):].strip()
        for msg in reversed(conversation):
            if msg["role"] == "user":
                msg["content"] = user_message
                break

        with open(f"{ARCHIVE_DIR}/learn_{round(time.time())}.txt", "w") as f:
            f.write(user_message)

    if force_learn or passive_learn:
        turn_text = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in conversation
        )
        _ingest_text(turn_text, CHROMA_LIST["conversations"], metadata={"type": "conversation"})
        print("[learn] Stored conversation turn in vector DB.", flush=True)

    llm = OllamaLLM(model=data['model'], keep_alive=MODEL_KEEPALIVE)
    augmented_prompt = _build_prompt(user_message, conversation[:-1])
    response_text: str = llm.invoke(augmented_prompt)
    print(f"[chat] Response: {response_text[:200]}", flush=True)

    return json.dumps({"message": response_text}), 200

if __name__ == "__main__":
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    embeddings = OllamaEmbeddings(model="nomic-embed-text", keep_alive=MODEL_KEEPALIVE)

    for store_name in STORE_LIST:
        CHROMA_LIST[store_name] = Chroma(collection_name=store_name, persist_directory=f"{CHROMA_DIR}/{store_name}",  embedding_function=embeddings)

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    chroma_index()

    app.run(host="0.0.0.0", port=8088, debug=True)
