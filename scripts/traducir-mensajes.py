#!/usr/bin/env python3
"""
Genera archivos de mensajes traducidos para i18n.
Lee messages/es.json como fuente y genera messages/{locale}.json para cada idioma destino.
Usa Google Gemini Flash para la traducción.

Uso:
  python scripts/traducir-mensajes.py [--idiomas pt,fr,de] [--api-key KEY]

La API key se lee de GOOGLE_API_KEY del entorno o del argumento --api-key.
"""

import json
import os
import sys
import argparse
import urllib.request

MESSAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "messages")

IDIOMAS_DEFAULT = ["pt", "fr", "de"]

NOMBRES_IDIOMAS = {
    "en": "English",
    "pt": "Portuguese (Brazilian)",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ja": "Japanese",
    "zh": "Chinese (Simplified)",
}


def traducir_con_anthropic(texto_json: dict, idioma_destino: str, api_key: str) -> dict:
    """Traduce un JSON de mensajes usando Claude Haiku (Anthropic)."""
    nombre_idioma = NOMBRES_IDIOMAS.get(idioma_destino, idioma_destino)

    prompt = (
        f"Translate the following JSON file of UI messages from Spanish to {nombre_idioma}.\n"
        f"Return ONLY the complete translated JSON. Keep the same structure and keys.\n"
        f"Keep variable placeholders like {{name}} and {{count}} unchanged.\n"
        f"Keep technical terms unchanged.\n"
        f"For short UI labels, keep translations concise and natural.\n\n"
        f"{json.dumps(texto_json, ensure_ascii=False, indent=2)}"
    )

    body = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 8192,
        "system": "You are a professional UI translator. Return only valid JSON, no markdown fences, no explanation.",
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    url = "https://api.anthropic.com/v1/messages"

    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    })

    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    text = data["content"][0]["text"]

    # Limpiar markdown fences si las hay
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    return json.loads(text)


def main():
    parser = argparse.ArgumentParser(description="Genera archivos de mensajes traducidos")
    parser.add_argument("--idiomas", default=",".join(IDIOMAS_DEFAULT), help="Idiomas destino separados por coma")
    parser.add_argument("--api-key", default=os.environ.get("ANTHROPIC_API_KEY"), help="Anthropic API key")
    args = parser.parse_args()

    if not args.api_key:
        print("ERROR: Se necesita ANTHROPIC_API_KEY en el entorno o --api-key", file=sys.stderr)
        sys.exit(1)

    idiomas = [l.strip() for l in args.idiomas.split(",") if l.strip()]

    # Leer fuente
    es_path = os.path.join(MESSAGES_DIR, "es.json")
    with open(es_path, "r", encoding="utf-8") as f:
        es_json = json.load(f)

    print(f"Fuente: {es_path} ({len(es_json)} namespaces)")
    print(f"Idiomas destino: {', '.join(idiomas)}")
    print()

    import time

    for idioma in idiomas:
        dest_path = os.path.join(MESSAGES_DIR, f"{idioma}.json")
        nombre = NOMBRES_IDIOMAS.get(idioma, idioma)
        print(f"Traduciendo a {nombre} ({idioma})...")

        # Traducir por bloques de namespaces para evitar rate limiting
        namespaces = list(es_json.keys())
        traducido = {}
        BATCH_SIZE = 8
        for i in range(0, len(namespaces), BATCH_SIZE):
            batch_keys = namespaces[i:i + BATCH_SIZE]
            batch = {k: es_json[k] for k in batch_keys}
            try:
                if i > 0:
                    time.sleep(4)  # pausa entre batches para evitar 429
                result = traducir_con_anthropic(batch, idioma, args.api_key)
                traducido.update(result)
                print(f"  batch {i // BATCH_SIZE + 1}: {', '.join(batch_keys[:3])}... ✓")
            except Exception as e:
                print(f"  batch {i // BATCH_SIZE + 1}: ✗ Error: {e}", file=sys.stderr)
                # Retry once after 10s
                try:
                    time.sleep(10)
                    result = traducir_con_anthropic(batch, idioma, args.api_key)
                    traducido.update(result)
                    print(f"  batch {i // BATCH_SIZE + 1}: retry ✓")
                except Exception as e2:
                    print(f"  batch {i // BATCH_SIZE + 1}: retry ✗ {e2}", file=sys.stderr)

        if traducido:
            with open(dest_path, "w", encoding="utf-8") as f:
                json.dump(traducido, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(f"  ✓ Escrito: {dest_path} ({len(traducido)}/{len(es_json)} namespaces)")
        else:
            print(f"  ✗ No se pudo traducir a {idioma}", file=sys.stderr)

        # Pausa entre idiomas
        if idioma != idiomas[-1]:
            time.sleep(5)

    print("\nListo.")


if __name__ == "__main__":
    main()
