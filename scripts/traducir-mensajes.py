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
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_resp = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} desde backend: {body_resp[:300]}")
    dur = int(time.time() - t0)
    return data, dur


def _intentar_lote(backend: str, token: str, lote_es: dict, idioma: str, lote_keys: list[str]):
    """Intenta traducir un lote. Retorna (dict_traducciones | None, duracion_s, error_msg)."""
    try:
        data, dur = llamar_endpoint(backend, token, lote_es, [idioma])
        traducido = data.get(idioma, {})
        if isinstance(traducido, dict) and "error" in traducido and not any(
            k in traducido for k in lote_keys
        ):
            return None, dur, f"backend: {traducido['error'][:100]}"
        return traducido, dur, None
    except Exception as e:
        return None, 0, str(e)


def traducir_por_batches(backend: str, token: str, es_json: dict, idioma: str,
                         batch_size: int = 4, max_reintentos: int = 3) -> tuple[dict, list[str]]:
    """Traduce el JSON completo a UN idioma, batchando namespaces desde el cliente.

    Cada llamada al backend lleva pocos namespaces para no exceder el
    timeout HTTP de Railway (~60-120s). Reintenta lotes fallidos hasta
    `max_reintentos` veces antes de rendirse.

    Retorna (resultado, namespaces_no_traducidos).
    """
    namespaces = list(es_json.keys())
    total_lotes = (len(namespaces) + batch_size - 1) // batch_size
    print(f"  {idioma}: {len(namespaces)} namespaces → {total_lotes} lotes de ≤{batch_size}")

    resultado: dict = {}
    pendientes: list[list[str]] = [namespaces[i:i + batch_size]
                                    for i in range(0, len(namespaces), batch_size)]

    for intento in range(1, max_reintentos + 1):
        if not pendientes:
            break
        if intento > 1:
            print(f"  ↻ reintento #{intento - 1} — {len(pendientes)} lotes pendientes")

        siguiente: list[list[str]] = []
        for n, lote_keys in enumerate(pendientes, 1):
            lote_es = {k: es_json[k] for k in lote_keys}
            traducido, dur, err = _intentar_lote(backend, token, lote_es, idioma, lote_keys)
            tag = f"lote {n}/{len(pendientes)}"
            if traducido is None:
                print(f"    {tag} ✗ — {err}", file=sys.stderr)
                siguiente.append(lote_keys)
                continue
            faltan_en_lote = [k for k in lote_keys if k not in traducido]
            resultado.update({k: v for k, v in traducido.items() if k in lote_keys})
            if faltan_en_lote:
                print(f"    {tag} ⚠ ({dur}s) — faltan: {','.join(faltan_en_lote)}")
                siguiente.append(faltan_en_lote)
            else:
                print(f"    {tag} ✓ ({dur}s) — {','.join(lote_keys[:2])}{'...' if len(lote_keys)>2 else ''}")
        pendientes = siguiente

    no_traducidos = [k for lote in pendientes for k in lote]
    return resultado, no_traducidos


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

    incompletos: list[str] = []
    for idioma in idiomas:
        try:
            traducido, no_traducidos = traducir_por_batches(args.backend, args.token, es_json, idioma)
        except Exception as e:
            print(f"  ✗ {idioma}: error global — {e}", file=sys.stderr)
            incompletos.append(idioma)
            continue

        if no_traducidos:
            print(
                f"  ✗ {idioma}: NO se escribe el archivo. Faltan {len(no_traducidos)} "
                f"namespaces tras reintentos: {','.join(no_traducidos)}",
                file=sys.stderr,
            )
            incompletos.append(idioma)
            continue

        # Reordenar siguiendo el orden de es.json para que los diffs sean estables.
        ordenado = {k: traducido[k] for k in es_json.keys() if k in traducido}

        dest_path = os.path.join(MESSAGES_DIR, f"{idioma}.json")
        with open(dest_path, "w", encoding="utf-8") as f:
            json.dump(ordenado, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"  ✓ {idioma}: escrito {dest_path} ({len(ordenado)}/{len(es_json)} namespaces)")
        print()

    if incompletos:
        print(f"\n⚠ Idiomas INCOMPLETOS (archivo NO sobrescrito): {', '.join(incompletos)}",
              file=sys.stderr)
        print("  Vuelve a correr el script para los idiomas faltantes.", file=sys.stderr)
        sys.exit(2)

    print("\nListo. Revisa los diffs y commitea cuando estés conforme.")


if __name__ == "__main__":
    main()
