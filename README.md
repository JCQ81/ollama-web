# ollama-web

An extremely basic quick'n'dirty web interface for Ollama, running in a single docker container.

![](./img/ollama-web-example.png)

ollama-web relies on:
* [markedjs](https://github.com/markedjs/marked)
* [highlightjs](https://github.com/highlightjs/highlight.js)

### Setup

```bash
git clone https://github.com/JCQ81/ollama-web.git
cd ollama-web
docker build -t ollama-web .

docker volume create ollama-web
docker run -d --name ollama-web -p 8088:8088 \
  -v ollama-web:/root/.ollama \
  ollama-web
```

For GPU support, use: _docker run -d --gpus all ...._

### Models

Make sure you pull at least one model from the [ollama library](https://ollama.com/library)

For pulling a model use the ollama cli

```bash
docker exec -t ollama-web ollama pull starcoder2:3b
```
