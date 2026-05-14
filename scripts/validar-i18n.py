#!/usr/bin/env python3
"""
Valida que toda clave `t('...')` usada en src/ esté presente en messages/es.json.

Escanea src/**/*.{ts,tsx} extrayendo, por cada par variable→namespace
(`const t = useTranslations('NS')`, `const tCommon = useTranslations('common')`),
las llamadas `t('clave')` o `tCommon('clave')` correspondientes.

Soporta:
- Claves anidadas con dot-notation: `t('aplicaA.documento')` busca
  es_json['NS']['aplicaA']['documento'].
- Varios `useTranslations` por archivo con identificadores distintos.
- Plantillas con interpolación ignoran las variables: `t('a', { x })` ok.

Falsos positivos conocidos (se loguean como skipped si la variable
"t-like" no fue declarada como useTranslations en el archivo):
- Una función llamada `t(...)` ajena a next-intl.

Sale con código 1 si hay claves usadas pero faltantes.
Reporta huérfanas como warning (o error con --strict).

Uso:
  python scripts/validar-i18n.py [--strict] [--no-huerfanas]
"""

import json
import os
import re
import sys
import argparse
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "src")
ES_PATH = os.path.join(ROOT, "messages", "es.json")

# const <var> = useTranslations('<namespace>')
# captura la variable y el namespace
RE_DECL = re.compile(
    r"""\b(?:const|let|var)\s+(\w+)\s*=\s*useTranslations\(\s*['"]([a-zA-Z0-9_.-]+)['"]"""
)

# <var>('clave') o <var>('clave', ...)
# El cluster (\w+) captura el identificador; comparamos contra los declarados.
RE_CALL = re.compile(r"""\b(\w+)\(\s*['"]([a-zA-Z0-9_.-]+)['"]""")


def lookup_key(bloque: dict, clave_dotted: str) -> bool:
    """¿Existe la clave anidada (dot-notation) en el bloque?"""
    cur = bloque
    for parte in clave_dotted.split("."):
        if not isinstance(cur, dict) or parte not in cur:
            return False
        cur = cur[parte]
    return True


def flatten_keys(bloque, prefijo: str = "") -> set[str]:
    """Aplana un bloque anidado a 'a.b.c' keys."""
    out: set[str] = set()
    if not isinstance(bloque, dict):
        return out
    for k, v in bloque.items():
        compuesta = f"{prefijo}{k}" if not prefijo else f"{prefijo}.{k}"
        if isinstance(v, dict):
            out |= flatten_keys(v, compuesta)
        else:
            out.add(compuesta)
    return out


def scan_file(path: str) -> dict[str, set[str]]:
    """Retorna {namespace: set(claves)} para un archivo."""
    with open(path, "r", encoding="utf-8") as f:
        contenido = f.read()

    # Mapea identificador → namespace
    var_to_ns: dict[str, str] = {}
    for m in RE_DECL.finditer(contenido):
        var, ns = m.group(1), m.group(2)
        var_to_ns[var] = ns

    if not var_to_ns:
        return {}

    uso: dict[str, set[str]] = defaultdict(set)
    for m in RE_CALL.finditer(contenido):
        var, clave = m.group(1), m.group(2)
        if var not in var_to_ns:
            continue
        uso[var_to_ns[var]].add(clave)
    return uso


def recorrer_src() -> dict[str, set[str]]:
    uso_total: dict[str, set[str]] = defaultdict(set)
    for base, _, files in os.walk(SRC_DIR):
        for fname in files:
            if not (fname.endswith(".ts") or fname.endswith(".tsx")):
                continue
            if fname.endswith(".d.ts"):
                continue
            path = os.path.join(base, fname)
            for ns, claves in scan_file(path).items():
                uso_total[ns].update(claves)
    return uso_total


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Trata huérfanas también como error (default: warning)")
    parser.add_argument("--no-huerfanas", action="store_true",
                        help="No reportar huérfanas")
    args = parser.parse_args()

    with open(ES_PATH, "r", encoding="utf-8") as f:
        es_json = json.load(f)

    uso = recorrer_src()

    faltantes: list[tuple[str, str]] = []
    huerfanas: list[tuple[str, str]] = []

    for ns, claves_usadas in uso.items():
        bloque = es_json.get(ns)
        if bloque is None:
            for k in sorted(claves_usadas):
                faltantes.append((ns, k))
            continue
        for k in sorted(claves_usadas):
            if not lookup_key(bloque, k):
                faltantes.append((ns, k))
        claves_es = flatten_keys(bloque)
        for k in sorted(claves_es - claves_usadas):
            huerfanas.append((ns, k))

    if faltantes:
        print(f"\n❌ {len(faltantes)} clave(s) usada(s) en src/ pero FALTANTE(s) en messages/es.json:\n",
              file=sys.stderr)
        por_ns: dict[str, list[str]] = defaultdict(list)
        for ns, k in faltantes:
            por_ns[ns].append(k)
        for ns in sorted(por_ns):
            print(f"  [{ns}] ({len(por_ns[ns])})", file=sys.stderr)
            for k in por_ns[ns]:
                print(f"    - {k}", file=sys.stderr)
        print("", file=sys.stderr)

    if huerfanas and not args.no_huerfanas:
        nivel = "❌" if args.strict else "⚠️ "
        print(f"\n{nivel} {len(huerfanas)} clave(s) en messages/es.json pero NO usada(s) en src/ (huérfanas):\n",
              file=sys.stderr)
        por_ns: dict[str, list[str]] = defaultdict(list)
        for ns, k in huerfanas:
            por_ns[ns].append(k)
        impreso = 0
        for ns in sorted(por_ns):
            if impreso >= 40:
                print(f"  ... (total: {len(huerfanas)})", file=sys.stderr)
                break
            print(f"  [{ns}] ({len(por_ns[ns])})", file=sys.stderr)
            for k in por_ns[ns]:
                if impreso >= 40:
                    break
                print(f"    - {k}", file=sys.stderr)
                impreso += 1
        print("", file=sys.stderr)

    if faltantes or (args.strict and huerfanas):
        return 1
    print(f"✅ i18n OK: {sum(len(v) for v in uso.values())} usos en src/ cubiertos por messages/es.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
