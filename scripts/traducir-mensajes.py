#!/usr/bin/env python3
"""
Genera archivos de mensajes traducidos para i18n.

Wrapper que llama al endpoint POST /traducciones/generar-mensajes del backend
de Server LM. El endpoint usa la habilidad TRADUCIR_TEXTOS (que tiene su
system_prompt configurable desde /habilidades, con contexto del producto y
glosario inyectado vía {{include:...}}).

Ver .claude/docs/PLAN_I18N.md sección 3.1 para el flujo completo.

Uso:
  python scripts/traducir-mensajes.py [--idiomas pt,fr,de] [--backend URL] [--token JWT]

Por defecto:
  - Backend: https://seguridad-backend-production-6250.up.railway.app
  - Idiomas: en,pt,fr,de
  - Token: se lee de SERVERLM_TOKEN del entorno

El JWT se obtiene haciendo login con un usuario super-admin (ver CLAUDE.md
para credenciales). Puedes obtenerlo desde la pantalla de login del frontend
(localStorage `serverlm_token`) o con curl al endpoint /auth/login.
"""

import json
import os
import sys
import argparse
import urllib.request
import urllib.error
import time

MESSAGES_DIR = os.path.join(os.path.dirname(__file__), "..", "messages")

IDIOMAS_DEFAULT = ["en", "pt", "fr", "de"]

BACKEND_DEFAULT = "https://seguridad-backend-production-6250.up.railway.app"


def llamar_endpoint(backend: str, token: str, es_json: dict, idiomas: list[str]) -> dict:
    """Invoca POST /traducciones/generar-mensajes y retorna el dict de resultado."""
    url = f"{backend.rstrip('/')}/traducciones/generar-mensajes"
    body = json.dumps({"es_json": es_json, "idiomas": idiomas}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    })
    print(f"  → POST {url} (idiomas={idiomas})...")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} desde backend: {body[:300]}")
    dur = int(time.time() - t0)
    print(f"  ← respuesta en {dur}s")
    return data


def main():
    parser = argparse.ArgumentParser(description="Genera archivos de mensajes traducidos vía backend")
    parser.add_argument("--idiomas", default=",".join(IDIOMAS_DEFAULT),
                        help=f"Idiomas destino separados por coma (default: {','.join(IDIOMAS_DEFAULT)})")
    parser.add_argument("--backend", default=os.environ.get("SERVERLM_BACKEND", BACKEND_DEFAULT),
                        help="URL del backend (default: producción)")
    parser.add_argument("--token", default=os.environ.get("SERVERLM_TOKEN"),
                        help="JWT de super-admin (env SERVERLM_TOKEN)")
    args = parser.parse_args()

    if not args.token:
        print(
            "ERROR: Se necesita JWT de super-admin.\n"
            "  Opción 1: export SERVERLM_TOKEN=<jwt>\n"
            "  Opción 2: pasar --token <jwt>\n"
            "El JWT se obtiene de localStorage('serverlm_token') desde una sesión activa\n"
            "en la pantalla de login del frontend, o haciendo curl a /auth/login.",
            file=sys.stderr,
        )
        sys.exit(1)

    idiomas = [l.strip() for l in args.idiomas.split(",") if l.strip()]

    es_path = os.path.join(MESSAGES_DIR, "es.json")
    with open(es_path, "r", encoding="utf-8") as f:
        es_json = json.load(f)

    print(f"Fuente: {es_path} ({len(es_json)} namespaces)")
    print(f"Idiomas destino: {', '.join(idiomas)}")
    print(f"Backend: {args.backend}")
    print()

    try:
        resultado = llamar_endpoint(args.backend, args.token, es_json, idiomas)
    except Exception as e:
        print(f"ERROR llamando al backend: {e}", file=sys.stderr)
        sys.exit(1)

    # Escribir cada idioma
    for idioma in idiomas:
        traducido = resultado.get(idioma)
        if not traducido:
            print(f"  ✗ {idioma}: backend no devolvió datos", file=sys.stderr)
            continue
        if isinstance(traducido, dict) and "error" in traducido:
            print(f"  ✗ {idioma}: error backend → {traducido['error']}", file=sys.stderr)
            continue

        dest_path = os.path.join(MESSAGES_DIR, f"{idioma}.json")
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(traducido, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  ✓ Escrito: {dest_path} ({len(traducido)} namespaces)")

    print("\nListo. Revisa los diffs y commitea cuando estés conforme.")


if __name__ == "__main__":
    main()
