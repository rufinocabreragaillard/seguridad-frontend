'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Key, Plus, RefreshCw, Trash2, Copy, Check, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { apiKeysApi, usuariosApi, rolesApi, type ApiKeyResumen, type ApiKeyNueva } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useFuncionActual } from '@/hooks/useFuncionActual'

interface OpcionUsuario { codigo: string; nombre: string }
interface OpcionRol { codigo: string; nombre: string }

const selectCls = 'w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-1 focus:ring-primario'

export default function PaginaApiKeys() {
  const funcion = useFuncionActual()
  const t = useTranslations('apiKeys')
  const tc = useTranslations('common')
  const { usuario: contexto } = useAuth()

  const [keys, setKeys] = useState<ApiKeyResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Catálogos para el modal de creación (solo se cargan al abrir)
  const [usuariosGrupo, setUsuariosGrupo] = useState<OpcionUsuario[]>([])
  const [rolesGrupo, setRolesGrupo] = useState<OpcionRol[]>([])

  // Modal "Crear"
  const [modalCrear, setModalCrear] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [usuarioDestino, setUsuarioDestino] = useState<string>('')
  const [rolSeleccionado, setRolSeleccionado] = useState<string>('')
  const [creando, setCreando] = useState(false)

  // Modal "Token recién creado" — el token solo se muestra una vez
  const [tokenRecien, setTokenRecien] = useState<ApiKeyNueva | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Modal "Confirmar revocar"
  const [paraRevocar, setParaRevocar] = useState<ApiKeyResumen | null>(null)
  const [revocando, setRevocando] = useState(false)

  const cargar = async () => {
    setCargando(true)
    setError(null)
    try {
      const data = await apiKeysApi.listar()
      setKeys(data)
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || t('errorCargar'))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirCrear = async () => {
    setError(null)
    setNombreNueva('')
    setUsuarioDestino(contexto?.codigo_usuario || '')
    setRolSeleccionado('')
    setModalCrear(true)
    try {
      const [users, roles] = await Promise.all([
        usuariosApi.listar(),
        rolesApi.listar(contexto?.grupo_activo, true),
      ])
      setUsuariosGrupo(
        users.map((u) => ({
          codigo: u.codigo_usuario,
          nombre: `${u.nombre || u.codigo_usuario} (${u.codigo_usuario})`,
        }))
      )
      setRolesGrupo(
        roles.map((r) => ({
          codigo: r.codigo_rol,
          nombre: r.codigo_rol,
        }))
      )
    } catch {
      // Si fallan los catálogos, el form funciona igual con defaults.
    }
  }

  const crear = async () => {
    if (!nombreNueva.trim()) return
    setCreando(true)
    setError(null)
    try {
      const data = await apiKeysApi.crear({
        nombre: nombreNueva.trim(),
        codigo_usuario_destino: usuarioDestino || null,
        rol_solicitado: rolSeleccionado || null,
      })
      setTokenRecien(data)
      setModalCrear(false)
      setNombreNueva('')
      await cargar()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || t('errorCrear'))
    } finally {
      setCreando(false)
    }
  }

  const revocar = async () => {
    if (!paraRevocar) return
    setRevocando(true)
    try {
      await apiKeysApi.revocar(paraRevocar.prefijo)
      setParaRevocar(null)
      await cargar()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || t('errorRevocar'))
    } finally {
      setRevocando(false)
    }
  }

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-heading flex items-center gap-2">
            <Key size={22} /> {funcion?.nombre ?? t('titulo')}
          </h2>
          {(funcion?.ayuda || t('subtitulo')) && (
            <p className="text-sm text-texto-muted mt-1">{funcion?.ayuda ?? t('subtitulo')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Boton variante="contorno" onClick={cargar} cargando={cargando}>
            <RefreshCw size={15} /> {tc('actualizar')}
          </Boton>
          <Boton onClick={abrirCrear}>
            <Plus size={15} /> {t('botonNueva')}
          </Boton>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Tabla>
        <TablaCabecera>
          <tr>
            <TablaTh>{t('colNombre')}</TablaTh>
            <TablaTh>{t('colUsuario')}</TablaTh>
            <TablaTh>{t('colPrefijo')}</TablaTh>
            <TablaTh>{t('colRol')}</TablaTh>
            <TablaTh>{t('colCreada')}</TablaTh>
            <TablaTh>{t('colUltimoUso')}</TablaTh>
            <TablaTh className="text-right">{t('colAcciones')}</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>
                {tc('cargando')}
              </TablaTd>
            </TablaFila>
          ) : keys.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>
                {t('sinKeys')}
              </TablaTd>
            </TablaFila>
          ) : (
            keys.map((k) => (
              <TablaFila key={k.id}>
                <TablaTd className="font-medium">{k.nombre}</TablaTd>
                <TablaTd className="text-xs">{k.codigo_usuario}</TablaTd>
                <TablaTd className="font-mono text-xs text-texto-muted">{k.prefijo}…</TablaTd>
                <TablaTd className="text-xs">{k.codigo_rol || '—'}</TablaTd>
                <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                  {new Date(k.creada_en).toLocaleDateString('es-CL')}
                </TablaTd>
                <TablaTd className="text-xs text-texto-muted whitespace-nowrap">
                  {k.ultimo_uso ? new Date(k.ultimo_uso).toLocaleString('es-CL') : '—'}
                </TablaTd>
                <TablaTd className="text-right">
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    onClick={() => setParaRevocar(k)}
                    className="text-error"
                  >
                    <Trash2 size={14} /> {t('botonRevocar')}
                  </Boton>
                </TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <ExternalLink size={14} /> {t('cardUsoTitulo')}
        </p>
        <p>
          {t('cardUsoIntro')}{' '}
          <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">
            Authorization: Bearer slm_live_…
          </code>
          . {t('cardUsoCanales')}{' '}
          <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">serverlm cloud</code>{' '}
          {t('cardUsoMcp')}{' '}
          <a
            href="https://github.com/rufinocabreragaillard/serverlm-backend/blob/main/docs/operativos/chat-externo.md"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            chat-externo.md
          </a>
          .
        </p>
      </div>

      {/* Modal: crear */}
      <Modal
        abierto={modalCrear}
        alCerrar={() => setModalCrear(false)}
        titulo={t('modalCrearTitulo')}
        className="w-[560px] max-w-[95vw]"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-texto mb-1">{t('labelNombre')} *</label>
            <Input
              autoFocus
              placeholder={t('placeholderNombre')}
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1">{t('labelDueno')}</label>
            <select
              className={selectCls}
              value={usuarioDestino}
              onChange={(e) => setUsuarioDestino(e.target.value)}
            >
              <option value="">{t('opcionYoMismo', { usuario: contexto?.codigo_usuario ?? '' })}</option>
              {usuariosGrupo
                .filter((u) => u.codigo !== contexto?.codigo_usuario)
                .map((u) => (
                  <option key={u.codigo} value={u.codigo}>
                    {u.nombre}
                  </option>
                ))}
            </select>
            <p className="text-xs text-texto-muted mt-1">{t('ayudaDueno')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-texto mb-1">{t('labelRol')}</label>
            <select
              className={selectCls}
              value={rolSeleccionado}
              onChange={(e) => setRolSeleccionado(e.target.value)}
            >
              <option value="">{t('opcionRolDefault')}</option>
              {rolesGrupo.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-texto-muted mt-1">{t('ayudaRol')}</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalCrear(false)}>
              {tc('cancelar')}
            </Boton>
            <Boton onClick={crear} cargando={creando} disabled={!nombreNueva.trim()}>
              {tc('crear')}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: token recién creado (copy-once) */}
      <Modal
        abierto={!!tokenRecien}
        alCerrar={() => setTokenRecien(null)}
        titulo={t('modalCreadaTitulo')}
        className="w-[560px] max-w-[95vw]"
      >
        {tokenRecien && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>{t('avisoCopiar')}</strong> {t('avisoCopiarDetalle')}
            </div>
            <div className="text-xs text-texto-muted">
              <span className="block">{t('labelDueno')}: <b>{tokenRecien.codigo_usuario}</b></span>
              <span className="block">{t('labelRol')}: <b>{tokenRecien.codigo_rol || '—'}</b></span>
              <span className="block">{t('labelGrupo')}: <b>{tokenRecien.codigo_grupo}</b></span>
            </div>
            <div>
              <label className="block text-sm font-medium text-texto mb-1">{t('labelToken')}</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono text-xs break-all">
                  {tokenRecien.api_key}
                </code>
                <Boton onClick={() => copiar(tokenRecien.api_key)} variante="contorno">
                  {copiado ? <Check size={15} /> : <Copy size={15} />}
                  {copiado ? t('copiado') : t('copiar')}
                </Boton>
              </div>
            </div>
            <div className="text-xs text-texto-muted">
              <p>{t('ejemploUso')}</p>
              <pre className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-1 overflow-x-auto">
                {`curl -X POST https://seguridad-backend-production-6250.up.railway.app/chat/conversaciones \\
  -H "Authorization: Bearer ${tokenRecien.api_key.slice(0, 16)}…" \\
  -H "Content-Type: application/json" \\
  -d '{"codigo_funcion":"CHAT-USUARIO"}'`}
              </pre>
            </div>
            <div className="flex justify-end">
              <Boton onClick={() => setTokenRecien(null)}>{t('botonEntendido')}</Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: confirmar revocar */}
      <ModalConfirmar
        abierto={!!paraRevocar}
        alCerrar={() => setParaRevocar(null)}
        alConfirmar={revocar}
        titulo={t('modalRevocarTitulo')}
        mensaje={
          paraRevocar
            ? t('modalRevocarMensaje', { nombre: paraRevocar.nombre, usuario: paraRevocar.codigo_usuario })
            : ''
        }
        textoConfirmar={t('botonRevocar')}
        variante="peligro"
        cargando={revocando}
      />
    </div>
  )
}
