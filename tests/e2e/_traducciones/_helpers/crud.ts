import type { Locator, Page } from '@playwright/test'

/**
 * Locators genéricos derivados de los patrones REALES del frontend serverlm
 * (verificados en src/app/(admin)/users/page.tsx y src/components/ui/):
 *  - lucide-react renderiza <svg class="lucide lucide-<nombre>">
 *  - Botón "Nuevo" del encabezado: <Boton variante="primario"> con <Plus/>
 *  - Acciones de fila: <button title="Editar"> con <Pencil/>, <button> con <Trash2/>
 *  - Modales: Radix Dialog → role="dialog"
 *  - ModalConfirmar: dos botones (Cancelar=contorno, Confirmar=peligro/primario)
 *  - Toasts: ToastProvider en <div class="fixed top-4 right-4 z-[100]">
 *  - Tabs a nivel de página: <button class="tab-nav"> (no usan role="tab")
 *
 * Si un selector no resuelve, el llamador degrada la etapa a OMITIDA — no falla.
 */

/** Botón "Crear/Nuevo" del encabezado (ícono Plus, fuera de cualquier dialog). */
export function botonNuevo(page: Page): Locator {
  const porIcono = page.locator('button:has(svg.lucide-plus)').filter({
    has: page.locator(':scope:not([role="dialog"] *)'),
  })
  const porTexto = page.getByRole('button', {
    name: /^(new|add|create|nuevo|crear|agregar|añadir)\b/i,
  })
  // Preferimos el del encabezado; si hay varios Plus (ej. "Asignar" dentro de
  // modal), el primero visible del documento suele ser el del encabezado.
  return porIcono.or(porTexto).first()
}

/** Modal abierto (Radix Dialog). */
export function modal(page: Page): Locator {
  return page.getByRole('dialog')
}

/** Fila de la tabla que contiene el texto sentinel. */
export function filaSentinel(page: Page, sentinel: string): Locator {
  return page.locator('tr', { hasText: sentinel })
}

/** Botón editar de una fila (ícono Pencil o title Editar/Edit). */
export function botonEditarFila(page: Page, sentinel: string): Locator {
  const fila = filaSentinel(page, sentinel)
  return fila
    .locator('button:has(svg.lucide-pencil)')
    .or(fila.getByRole('button', { name: /edit|editar/i }))
    .first()
}

/** Botón eliminar de una fila (ícono Trash2 o title Eliminar/Delete). */
export function botonEliminarFila(page: Page, sentinel: string): Locator {
  const fila = filaSentinel(page, sentinel)
  return fila
    .locator('button:has(svg.lucide-trash-2)')
    .or(fila.getByRole('button', { name: /delete|eliminar|borrar/i }))
    .first()
}

/** Botón de confirmación dentro de un ModalConfirmar (acción primaria/peligro). */
export function botonConfirmar(page: Page): Locator {
  const dlg = modal(page)
  return dlg
    .getByRole('button', {
      name: /^(confirm|delete|yes|save|sí|si|confirmar|eliminar|guardar|aceptar)\b/i,
    })
    .last()
}

/** Botón de cancelar/cerrar dentro de un modal. */
export function botonCancelar(page: Page): Locator {
  const dlg = modal(page)
  return dlg
    .getByRole('button', { name: /^(cancel|close|cancelar|cerrar)\b/i })
    .first()
}

/** Contenedor de toasts (éxito/error). */
export function toasts(page: Page): Locator {
  return page.locator('.fixed.top-4.right-4')
}

/** Tabs a nivel de página (clase tab-nav) o role=tab como fallback. */
export function tabs(page: Page): Locator {
  return page.locator('button.tab-nav').or(page.getByRole('tab'))
}
