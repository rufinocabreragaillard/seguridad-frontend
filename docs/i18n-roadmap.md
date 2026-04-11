# Roadmap Multilingüe — cab-seguridad

> Última actualización: abril 2026  
> Stack: Next.js 16 (next-intl, cookie-based) + FastAPI (locales JSON)

---

## Estado actual

El sistema tiene soporte multilingüe **ES / EN** completamente funcional.  
El idioma se controla con la cookie `NEXT_LOCALE` y un selector en el Header (tab Cuenta).

| Fase | Alcance | Estado |
|------|---------|--------|
| 0 | Infraestructura: next-intl, cookie, backend `t()`, login traducido | ✅ Completo |
| 1 | Layout, Header, useCrudPage | ✅ Completo |
| 2 | Todas las pantallas admin (30+ páginas, 30+ namespaces) | ✅ Completo |
| 3 | Locale persistido en BD + sincronizado al login | ⏳ Pendiente |
| 4 | Revisión humana de traducciones + fechas/números formateados | ⏳ Pendiente |
| 5 | Nuevos idiomas (fr-CA, pt-BR, etc.) | ⏳ Según demanda |
| 6 | Datos de BD traducibles (nombres de roles, funciones, etc.) | ⏳ Según demanda |

---

## Arquitectura base (ya implementada)

### Frontend
- **`next-intl`** en modo cookie-based (sin segmento `[locale]` en URLs — no requiere refactorear rutas)
- Cookie `NEXT_LOCALE` = `'es'` | `'en'` | `'fr-CA'` | ...
- Archivos de mensajes: `frontend/messages/{locale}.json`
- Namespaces por módulo: `common`, `layout`, `header`, `login`, `usuarios`, `roles`, etc.
- Patrón estándar en cada página:
  ```tsx
  const t = useTranslations('usuarios')   // strings del módulo
  const tc = useTranslations('common')    // Save, Cancel, Delete, etc.
  ```

### Backend
- Archivos de mensajes: `backend/locales/{locale}.json`
- Helper `app/i18n.py`: función `t(key, locale, **kwargs)` con cache LRU
- Cadena de fallback: `fr-CA → fr → es → en → key literal`
- Locale en request: header `Accept-Language` (enviado automáticamente por el frontend)
- Locale del usuario: columna `usuarios.locale VARCHAR(10) DEFAULT 'es'` (migración 102)

---

## Fase 3 — Locale persistido en BD

**Cuándo aplicar**: cuando el primer cliente opere en un idioma distinto al español de forma habitual.

**Problema que resuelve**: hoy el locale se guarda solo en cookie. Si el usuario borra las cookies o usa otro dispositivo, vuelve a `es`.

### Cambios necesarios

**Frontend — `AuthContext.tsx`**  
Al cargar el contexto del usuario (`GET /auth/me`), leer `usuario.locale` y setear la cookie si no coincide:
```tsx
// En cargarContexto(), después de setUsuario(data)
if (data.locale && data.locale !== cookieLocale) {
  document.cookie = `NEXT_LOCALE=${data.locale};path=/;max-age=31536000`
  window.location.reload()  // refrescar para que next-intl aplique el locale
}
```

**Frontend — `Header.tsx`**  
Al cambiar idioma desde el selector, además de setear la cookie, llamar `PUT /usuarios/{id}` para guardar `locale` en BD:
```tsx
const cambiarLocale = async (nuevoLocale: string) => {
  document.cookie = `NEXT_LOCALE=${nuevoLocale};path=/;max-age=31536000`
  await usuariosApi.actualizar(usuario.codigo_usuario, { locale: nuevoLocale })
  window.location.reload()
}
```

**Backend — `PUT /usuarios/{id}`**  
Ya acepta `locale` en `UsuarioUpdate` (schema ya actualizado en Fase 0).  
Solo verificar que el endpoint lo persista correctamente en BD.

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `frontend/src/context/AuthContext.tsx` | Leer `usuario.locale` y sincronizar cookie al login |
| `frontend/src/components/layout/Header.tsx` | `cambiarLocale()` guarda en BD además de cookie |

---

## Fase 4 — Calidad de traducciones + formato de datos

**Cuándo aplicar**: cuando un cliente anglófono empiece a usar el sistema en producción.

### 4a. Revisión humana de traducciones

Las traducciones actuales en `messages/en.json` son funcionales pero generadas automáticamente.  
Un hablante nativo de inglés debería revisar principalmente:
- Terminología de negocio: "cargo" → "position" vs "job title"
- Mensajes de error: tono y naturalidad
- Textos de confirmación: "¿Eliminar {nombre}?" → "Delete {nombre}?"

Herramienta recomendada: exportar las claves a una hoja de cálculo con columnas ES | EN | Revisado.

### 4b. Formato de fechas y números

Hoy las fechas se muestran en formato ISO tal como vienen del backend.  
Agregar un helper en el frontend:

```tsx
// src/lib/format.ts
export function formatFecha(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { 
    day: '2-digit', month: 'short', year: 'numeric' 
  }).format(new Date(iso))
}
// "2026-04-11" → "11 abr 2026" (es) | "Apr 11, 2026" (en)
```

Aplicar en tablas de auditoría, documentos, usuarios (columna "Último acceso"), cola de estados.

### 4c. Mensajes de error del backend

Hoy solo `auth.py` y validación de passwords están traducidos.  
Los errores de negocio (conflictos de FK, restricciones únicas) retornan mensajes en español hardcodeado desde los routers.

**Solución**: agregar claves en `backend/locales/` para los errores más frecuentes y usar `t(key, locale)` en los bloques `except` de los routers.

---

## Fase 5 — Nuevos idiomas

**Cuándo aplicar**: cuando llegue un cliente que necesite un idioma distinto a ES o EN.

### Agregar un idioma nuevo (ej. fr-CA)

**1. Frontend**  
Crear `frontend/messages/fr-CA.json` copiando la estructura de `en.json` y traduciendo.  
Actualizar `frontend/src/i18n/config.ts`:
```typescript
export const locales = ['es', 'en', 'fr-CA'] as const
```
El selector de idioma en Header se actualiza automáticamente.

**2. Backend**  
Crear `backend/locales/fr-CA.json` con los mensajes de error en francés canadiense.  
La cadena de fallback `fr-CA → fr → es` ya está implementada en `app/i18n.py`.

**3. BD**  
No requiere migración. La columna `usuarios.locale` ya acepta cualquier string de hasta 10 chars.

### Variantes regionales vs idiomas base

Recomendación: mantener un archivo base (`fr.json`) y un archivo de override regional (`fr-CA.json`) solo con los términos que difieren (vocabulario local, formato de moneda, etc.).

---

## Fase 6 — Datos de BD traducibles

**Cuándo aplicar**: solo si hay demanda real de clientes que necesiten que los nombres de sus propios roles, funciones y aplicaciones aparezcan en otro idioma.

> En la práctica la mayoría de organizaciones nombra sus entidades en su propio idioma operativo y no necesita traducción de datos.

### Opción A — Columnas adicionales (simple)

Agregar columnas `nombre_en`, `nombre_fr` en las tablas que lo necesiten:

```sql
ALTER TABLE roles ADD COLUMN nombre_en VARCHAR(120);
ALTER TABLE funciones ADD COLUMN nombre_en VARCHAR(120);
```

El backend devuelve el campo según `locale` del request:
```python
nombre = rol.get(f"nombre_{locale}", rol.get("nombre_rol"))
```

**Pros**: simple, sin nuevo modelo.  
**Contras**: escala mal si hay muchos idiomas o muchas tablas.

### Opción B — Tabla de traducciones (flexible)

```sql
CREATE TABLE traducciones (
  id SERIAL PRIMARY KEY,
  tabla VARCHAR(50),      -- 'roles', 'funciones', 'aplicaciones'
  id_registro VARCHAR(50),
  campo VARCHAR(50),      -- 'nombre', 'descripcion'
  locale VARCHAR(10),
  valor TEXT
);
```

**Pros**: un modelo para todas las tablas y todos los idiomas.  
**Contras**: más complejidad en queries, requiere UI de gestión.

---

## Convenciones del sistema (para mantener coherencia)

### Namespaces en messages JSON

| Namespace | Contenido |
|-----------|-----------|
| `common` | Strings globales: Save, Cancel, Delete, Loading, Active, Inactive, etc. |
| `layout` | Layout admin: Cargando, Sin acceso |
| `header` | Modal Mi Cuenta completo |
| `login` | Página de login y recuperación |
| `{modulo}` | Un namespace por pantalla: `usuarios`, `roles`, `grupos`, etc. |

### Patrón en páginas

```tsx
// Siempre dos hooks: uno específico + common
const t = useTranslations('usuarios')
const tc = useTranslations('common')

// Strings del módulo
t('titulo')                         // "Usuarios"
t('editarTitulo', { codigo })       // "Usuario: U001" (interpolación)

// Strings comunes
tc('guardar')                       // "Guardar" / "Save"
tc('cancelar')                      // "Cancelar" / "Cancel"
tc('activo')                        // "Activo" / "Active"
```

### Agregar strings nuevos

1. Agregar clave en `frontend/messages/es.json` en el namespace del módulo
2. Agregar la traducción en `frontend/messages/en.json`
3. Agregar en los demás idiomas si existen
4. Usar `t('clave')` en el componente

---

## Páginas pendientes de traducir (Fase 3)

| Página | Namespace sugerido |
|--------|--------------------|
| `/compromisos/compromisos` | `compromisos` |
| `/compromisos/conversaciones` | `conversaciones` |
| `/compromisos/datos-basicos` | `datosBasicos` |
| `/datos-basicos` | `datosBasicos` |

Son páginas menores que no afectan el sistema principal.

---

## Criterio de avance entre fases

```
Fase 3 → primer cliente que opera en idioma no español de forma habitual
Fase 4 → primer cliente anglófono en producción
Fase 5 → solicitud concreta de nuevo idioma (fr-CA, pt-BR, etc.)
Fase 6 → solicitud explícita de traducción de datos de BD
```

**Regla general**: no anticipar una fase. La infraestructura ya soporta cada mejora sin refactoreo mayor — solo agregar archivos y pequeños cambios en componentes puntuales.
