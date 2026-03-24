'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, UserCheck, UserX } from 'lucide-react'
import { Boton } from '@/components/ui/boton'
import { Input } from '@/components/ui/input'
import { Insignia } from '@/components/ui/insignia'
import { Modal } from '@/components/ui/modal'
import { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaTh, TablaTd } from '@/components/ui/tabla'
import { usuariosApi, rolesApi } from '@/lib/api'
import type { Usuario, Rol } from '@/lib/tipos'

export default function PaginaUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Formulario
  const [form, setForm] = useState({
    codigo_usuario: '',
    nombre: '',
    telefono: '',
    rol_principal: '',
    invitar: true,
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [u, r] = await Promise.all([usuariosApi.listar(), rolesApi.listar()])
      setUsuarios(u)
      setRoles(r)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const usuariosFiltrados = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.codigo_usuario.toLowerCase().includes(busqueda.toLowerCase())
  )

  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setForm({ codigo_usuario: '', nombre: '', telefono: '', rol_principal: '', invitar: true })
    setError('')
    setModalAbierto(true)
  }

  const abrirEditar = (u: Usuario) => {
    setUsuarioEditando(u)
    setForm({
      codigo_usuario: u.codigo_usuario,
      nombre: u.nombre,
      telefono: u.telefono || '',
      rol_principal: u.rol_principal || '',
      invitar: false,
    })
    setError('')
    setModalAbierto(true)
  }

  const guardar = async () => {
    setError('')
    if (!form.codigo_usuario || !form.nombre) {
      setError('El correo y el nombre son obligatorios')
      return
    }
    setGuardando(true)
    try {
      if (usuarioEditando) {
        await usuariosApi.actualizar(usuarioEditando.codigo_usuario, {
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol_principal: form.rol_principal || undefined,
        })
      } else {
        await usuariosApi.crear({
          codigo_usuario: form.codigo_usuario,
          nombre: form.nombre,
          telefono: form.telefono || undefined,
          rol_principal: form.rol_principal || undefined,
          invitar: form.invitar,
        })
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const desactivar = async (u: Usuario) => {
    if (!confirm(`¿Desactivar al usuario ${u.nombre}?`)) return
    try {
      await usuariosApi.desactivar(u.codigo_usuario)
      cargar()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al desactivar')
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-texto">Usuarios</h2>
          <p className="text-sm text-texto-muted mt-1">Gestión de usuarios del sistema</p>
        </div>
        <Boton variante="primario" onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo usuario
        </Boton>
      </div>

      {/* Búsqueda */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          icono={<Search size={15} />}
        />
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded-lg border border-borde animate-pulse" />
          ))}
        </div>
      ) : (
        <Tabla>
          <TablaCabecera>
            <tr>
              <TablaTh>Nombre</TablaTh>
              <TablaTh>Correo</TablaTh>
              <TablaTh>Rol principal</TablaTh>
              <TablaTh>Estado</TablaTh>
              <TablaTh>Último acceso</TablaTh>
              <TablaTh className="text-right">Acciones</TablaTh>
            </tr>
          </TablaCabecera>
          <TablaCuerpo>
            {usuariosFiltrados.length === 0 ? (
              <TablaFila>
                <TablaTd className="text-center text-texto-muted py-8" colSpan={6 as never}>
                  No se encontraron usuarios
                </TablaTd>
              </TablaFila>
            ) : (
              usuariosFiltrados.map((u) => (
                <TablaFila key={u.codigo_usuario}>
                  <TablaTd>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-secundario flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.nombre}</span>
                    </div>
                  </TablaTd>
                  <TablaTd className="text-texto-muted">{u.codigo_usuario}</TablaTd>
                  <TablaTd>{u.rol_principal || <span className="text-texto-light">—</span>}</TablaTd>
                  <TablaTd>
                    <Insignia variante={u.activo ? 'exito' : 'error'}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Insignia>
                  </TablaTd>
                  <TablaTd className="text-texto-muted text-xs">
                    {u.ultimo_acceso
                      ? new Date(u.ultimo_acceso).toLocaleDateString('es-CL')
                      : '—'}
                  </TablaTd>
                  <TablaTd>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="p-1.5 rounded-lg hover:bg-primario-muy-claro text-texto-muted hover:text-primario transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => desactivar(u)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.activo
                            ? 'hover:bg-red-50 text-texto-muted hover:text-error'
                            : 'hover:bg-green-50 text-texto-muted hover:text-exito'
                        }`}
                        title={u.activo ? 'Desactivar' : 'Activar'}
                      >
                        {u.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </TablaTd>
                </TablaFila>
              ))
            )}
          </TablaCuerpo>
        </Tabla>
      )}

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        alCerrar={() => setModalAbierto(false)}
        titulo={usuarioEditando ? 'Editar usuario' : 'Nuevo usuario'}
        descripcion={usuarioEditando ? undefined : 'El usuario recibirá una invitación por correo'}
      >
        <div className="flex flex-col gap-4">
          <Input
            etiqueta="Correo electrónico *"
            type="email"
            value={form.codigo_usuario}
            onChange={(e) => setForm({ ...form, codigo_usuario: e.target.value })}
            disabled={!!usuarioEditando}
            placeholder="usuario@correo.com"
          />
          <Input
            etiqueta="Nombre completo *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre Apellido"
          />
          <Input
            etiqueta="Teléfono"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+56 9 1234 5678"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-texto">Rol principal</label>
            <select
              value={form.rol_principal}
              onChange={(e) => setForm({ ...form, rol_principal: e.target.value })}
              className="w-full rounded-lg border border-borde bg-surface px-3 py-2 text-sm text-texto focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Sin rol asignado</option>
              {roles.filter((r) => r.activo).map((r) => (
                <option key={r.codigo_rol} value={r.codigo_rol}>{r.nombre}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Boton variante="contorno" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} cargando={guardando}>
              {usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
