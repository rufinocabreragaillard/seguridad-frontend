'use client'

import React, { type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

// ── Context wrapper (no DOM element) ─────────────────────────────────────────

interface SortableDndContextProps<T extends Record<string, unknown>> {
  items: T[]
  getId: (item: T) => string
  onReorder: (newItems: T[]) => void
  disabled?: boolean
  children: ReactNode
}

export function SortableDndContext<T extends Record<string, unknown>>({
  items,
  getId,
  onReorder,
  disabled = false,
  children,
}: SortableDndContextProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: disabled ? 99999 : 5 } }),
  )

  const ids = items.map(getId)

  function handleDragEnd(event: DragEndEvent) {
    if (disabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      orden: idx + 1,
    }))
    onReorder(reordered)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// ── Sortable table row (<tr>) ─────────────────────────────────────────────────

export function SortableRow({
  id,
  children,
}: {
  id: string | number
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(id),
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-primario-muy-claro/40 transition-colors">
      <td className="px-2 py-3 w-8">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-texto-muted hover:text-primario p-0.5 rounded touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      </td>
      {children}
    </tr>
  )
}

// ── Sortable list item (<div>) ────────────────────────────────────────────────

export function SortableListItem({
  id,
  className,
  children,
}: {
  id: string | number
  className?: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(id),
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-texto-muted hover:text-primario p-0.5 rounded touch-none flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      {children}
    </div>
  )
}
