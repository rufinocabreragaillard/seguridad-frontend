'use client'

import { useEffect, useState, useCallback } from 'react'
import { Pencil, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PieBotonesModal } from '@/components/ui/pie-botones-modal'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { ubicacionesDocsApi } from '@/lib/api'
import type { UbicacionDoc } from '@/lib/tipos'
import { useAuth } from '@/context/AuthContext'
import { BotonChat } from '@/components/ui/boton-chat'

export default function PaginaAreas() {
  useAuth()
  const t = useTranslations('areas')
  const tc = useTranslations('common')

  const [areas, setAreas] = useState<UbicacionDoc[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<UbicacionDoc | null>(null)
  const [form, setForm] = useState({ nombre_ubicacion: '', alias_ubicacion: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setAreas(await ubicacionesDocsApi.listar({ tipo: 'AREA' }))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirEditar = (u: UbicacionDoc) => {
    setEditando(u)
    setForm({
      nombre_ubicacion: u.nombre_ubicacion,
      alias_ubicacion: u.alias_ubicacion || '',
    })
    setError('')
    setModal(true)
  }

  const guardar = async (cerrar = true) => {
    if (!editando) return
    if (!form.nombre_ubicacion.trim()) {
      setError(t('errorNombreObligatorio'))
      return
    }
    setGuardando(true)
    try {
      await ubicacionesDocsApi.actualizar(editando.codigo_ubicacion, {
        nombre_ubicacion: form.nombre_ubicacion,
        alias_ubicacion: form.alias_ubicacion || undefined,
      })
      if (cerrar) setModal(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : tc('errorAlGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const filtrados = busqueda
    ? areas.filter(
        (a) =>
          a.nombre_ubicacion.toLowerCase().includes(busqueda.toLowerCase()) ||
          (a.alias_ubicacion || '').toLowerCase().includes(busqueda.toLowerCase()) ||
          (a.ruta_completa || '').toLowerCase().includes(busqueda.toLowerCase()) ||
          (a.codigo_entidad || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : areas

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl">
      <BotonChat className="top-0 right-0" />
      <div className="pr-28">
        <h2 className="page-heading">{t('titulo')}</h2>
        <p className="text-sm text-texto-muted mt-1">
          {t('subtitulo')}
        </p>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder={t('buscarPlaceholder')}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icono={<Search size={15} />}
        />
      </div>

      <div className="border border-borde rounded-lg bg-fondo-tarjeta overflow-hidden">
        {cargando ? (
          <div className="py-8 text-center text-texto-muted">{tc('cargando')}</div>
        ) : filtrados.length === 0 ? (
          <div className="py-8 text-center text-texto-muted">{t('sinAreas')}</div>
        ) : (
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaTh>{t('colEntidad')}</TablaTh>
                <TablaTh>{t('colNombre')}</TablaTh>
                <TablaTh>{t('colAlias')}</TablaTh>
                <TablaTh>{t('colRuta')}</TablaTh>
                <TablaTh>{t('colNivel')}</TablaTh>
                <TablaTh className="w-24">{tc('acciones')}</TablaTh>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {filtrados.map((a) => (
                <TablaFila key={a.codigo_ubicacion}>
                  <TablaTd className="text-xs text-texto-muted" onDoubleClick={() => abrirEditar(a)}>{a.codigo_entidad || '—'}</TablaTd>
                  <TablaTd className="font-medium" onDoubleClick={() => abrirEditar(a)}>{a.nombre_ubicacion}</TablaTd>
                  <TablaTd className="text-texto-muted" onDoubleClick={() => abrirEditar(a)}>{a.alias_ubicacion || '—'}</TablaTd>
                  <TablaTd className="text-xs text-texto-muted">{a.ruta_completa || '—'}</TablaTd>
                  <TablaTd className="text-xs">{a.nivel}</TablaTd>
                  <TablaTd>
                    <button
                      onClick={() => abrirEditar(a)}
                      className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                  </TablaTd>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        )}
      </div>

      <Modal
        abierto={modal}
        alCerrar={() => setModal(false)}
        titulo={editando ? t('editarTitulo', { nombre: editando.nombre_ubicacion }) : t('editarTitulo', { nombre: '' })}
      >
        <div className="flex flex-col gap-4 min-w-[450px]">
          <Input
            etiqueta={t('etiquetaNombre')}
            value={form.nombre_ubicacion}
            onChange={(e) => setForm({ ...form, nombre_ubicacion: e.target.value })}
          />
          <Input
            etiqueta={t('etiquetaAlias')}
            value={form.alias_ubicacion}
            onChange={(e) => setForm({ ...form, alias_ubicacion: e.target.value })}
            placeholder={t('placeholderAlias')}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <PieBotonesModal
            editando={!!editando}
            onGuardar={() => guardar(false)}
            onGuardarYSalir={() => guardar(true)}
            onCerrar={() => setModal(false)}
            cargando={guardando}
          />
        </div>
      </Modal>
    </div>
  )
}
