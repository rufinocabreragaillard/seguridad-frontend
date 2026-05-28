'use client'

import { useEffect, useState } from 'react'
import { Key, Plus, RefreshCw, Trash2, Copy, Check, ExternalLink } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ModalConfirmar } from '@/components/ui/modal-confirmar'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { apiKeysApi, type ApiKeyResumen, type ApiKeyNueva } from '@/lib/api'

export default function PaginaApiKeys() {
  const [keys, setKeys] = useState<ApiKeyResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal "Crear"
  const [modalCrear, setModalCrear] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
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
      setError(err.response?.data?.detail || err.message || 'No se pudieron cargar las API Keys')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const crear = async () => {
    if (!nombreNueva.trim()) return
    setCreando(true)
    setError(null)
    try {
      const data = await apiKeysApi.crear(nombreNueva.trim())
      setTokenRecien(data)
      setModalCrear(false)
      setNombreNueva('')
      await cargar()
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err.response?.data?.detail || err.message || 'No se pudo crear la API Key')
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
      setError(err.response?.data?.detail || err.message || 'No se pudo revocar la API Key')
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
          <h1 className="text-2xl font-semibold text-[#074B91] flex items-center gap-2">
            <Key size={24} /> Mis API Keys
          </h1>
          <p className="text-sm text-texto-muted mt-1">
            Tokens de larga duración para consumir el chat y la API de Server LM desde
            aplicaciones externas o agentes de IA. Reemplazan al JWT (1 hora) y heredan
            tu rol y grupo activo al momento de crearlas.
          </p>
        </div>
        <div className="flex gap-2">
          <Boton variante="contorno" onClick={cargar} cargando={cargando}>
            <RefreshCw size={15} /> Actualizar
          </Boton>
          <Boton onClick={() => setModalCrear(true)}>
            <Plus size={15} /> Nueva API Key
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
            <TablaTh>Nombre</TablaTh>
            <TablaTh>Prefijo</TablaTh>
            <TablaTh>Rol</TablaTh>
            <TablaTh>Grupo</TablaTh>
            <TablaTh>Creada</TablaTh>
            <TablaTh>Último uso</TablaTh>
            <TablaTh className="text-right">Acciones</TablaTh>
          </tr>
        </TablaCabecera>
        <TablaCuerpo>
          {cargando ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>
                Cargando…
              </TablaTd>
            </TablaFila>
          ) : keys.length === 0 ? (
            <TablaFila>
              <TablaTd className="py-8 text-center text-texto-muted" colSpan={7 as never}>
                No tienes API Keys activas. Crea una para empezar a consumir Server LM
                desde una aplicación externa.
              </TablaTd>
            </TablaFila>
          ) : (
            keys.map((k) => (
              <TablaFila key={k.id}>
                <TablaTd className="font-medium">{k.nombre}</TablaTd>
                <TablaTd className="font-mono text-xs text-texto-muted">{k.prefijo}…</TablaTd>
                <TablaTd className="text-xs">{k.codigo_rol || '—'}</TablaTd>
                <TablaTd className="text-xs">{k.codigo_grupo}</TablaTd>
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
                    <Trash2 size={14} /> Revocar
                  </Boton>
                </TablaTd>
              </TablaFila>
            ))
          )}
        </TablaCuerpo>
      </Tabla>

      <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <ExternalLink size={14} /> Uso desde aplicaciones externas
        </p>
        <p>
          Envía la API Key en el header{' '}
          <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">
            Authorization: Bearer slm_live_…
          </code>
          . Soportada en endpoints REST (incluido el chat), CLI{' '}
          <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs">serverlm cloud</code>{' '}
          y el servidor MCP remoto. Documentación:{' '}
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
        alCerrar={() => {
          setModalCrear(false)
          setNombreNueva('')
        }}
        titulo="Nueva API Key"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Nombre descriptivo</label>
            <Input
              autoFocus
              placeholder='ej. "Integración Zapier", "Bot de WhatsApp"'
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nombreNueva.trim()) crear()
              }}
            />
            <p className="text-xs text-texto-muted mt-1">
              La key heredará tu rol y grupo activo. El token aparecerá una sola vez —
              guárdalo en un gestor de secretos.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Boton
              variante="contorno"
              onClick={() => {
                setModalCrear(false)
                setNombreNueva('')
              }}
            >
              Cancelar
            </Boton>
            <Boton onClick={crear} cargando={creando} disabled={!nombreNueva.trim()}>
              Crear
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: token recién creado (copy-once) */}
      <Modal
        abierto={!!tokenRecien}
        alCerrar={() => setTokenRecien(null)}
        titulo="API Key creada"
      >
        {tokenRecien && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Cópiala ahora.</strong> Por seguridad no podrás volver a verla; si
              la pierdes, deberás revocar y crear una nueva.
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Token</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono text-xs break-all">
                  {tokenRecien.api_key}
                </code>
                <Boton onClick={() => copiar(tokenRecien.api_key)} variante="contorno">
                  {copiado ? <Check size={15} /> : <Copy size={15} />}
                  {copiado ? 'Copiado' : 'Copiar'}
                </Boton>
              </div>
            </div>
            <div className="text-xs text-texto-muted">
              <p>Ejemplo de uso:</p>
              <pre className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mt-1 overflow-x-auto">
                {`curl -X POST https://seguridad-backend-production-6250.up.railway.app/chat/conversaciones \\
  -H "Authorization: Bearer ${tokenRecien.api_key.slice(0, 16)}…" \\
  -H "Content-Type: application/json" \\
  -d '{"codigo_funcion":"CHAT-USUARIO"}'`}
              </pre>
            </div>
            <div className="flex justify-end">
              <Boton onClick={() => setTokenRecien(null)}>Entendido</Boton>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: confirmar revocar */}
      <ModalConfirmar
        abierto={!!paraRevocar}
        alCerrar={() => setParaRevocar(null)}
        alConfirmar={revocar}
        titulo="Revocar API Key"
        mensaje={
          paraRevocar
            ? `La API Key "${paraRevocar.nombre}" dejará de funcionar inmediatamente. Las aplicaciones que la usen recibirán 401. Esta acción no se puede deshacer.`
            : ''
        }
        textoConfirmar="Revocar"
        variante="peligro"
        cargando={revocando}
      />
    </div>
  )
}
