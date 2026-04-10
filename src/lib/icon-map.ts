/**
 * Mapeo de nombres de icono (string almacenado en BD) a componentes Lucide React.
 *
 * Para agregar un icono nuevo:
 * 1. Importarlo de 'lucide-react'
 * 2. Agregarlo al objeto iconMap con la clave exacta que se usa en la BD
 */

import {
  type LucideIcon,
  Circle,
  LayoutDashboard,
  Users,
  Shield,
  ShieldCheck,
  Building2,
  Layers,
  SlidersHorizontal,
  ClipboardList,
  Database,
  AppWindow,
  Settings,
  FileText,
  BarChart3,
  Home,
  Mail,
  Bell,
  Lock,
  Key,
  UserCheck,
  UserCog,
  FolderOpen,
  FolderTree,
  Globe,
  Briefcase,
  Calendar,
  MessageSquare,
  Search,
  Wrench,
  Cog,
  Activity,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  DollarSign,
  CreditCard,
  Heart,
  Star,
  Zap,
  AlertTriangle,
  Info,
  HelpCircle,
  BookOpen,
  Clipboard,
  Map,
  Navigation,
  Phone,
  Video,
  Image,
  Music,
  Download,
  Upload,
  Files,
  Copy,
  Tag,
  Tags,
  ListOrdered,
  Brain,
  Cpu,
  Gauge,
  MessageCircle,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  // Navegacion y layout
  LayoutDashboard,
  Home,
  Globe,
  Navigation,
  Map,

  // Usuarios y seguridad
  Users,
  Shield,
  ShieldCheck,
  Lock,
  Key,
  UserCheck,
  UserCog,

  // Organizacion
  Building2,
  Layers,
  Briefcase,
  FolderOpen,
  FolderTree,

  // Configuracion
  Settings,
  SlidersHorizontal,
  Wrench,
  Cog,

  // Listas
  ListOrdered,

  // Datos y reportes
  Database,
  ClipboardList,
  Clipboard,
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,

  // Aplicaciones
  AppWindow,
  Package,

  // Comunicacion
  Mail,
  Bell,
  MessageSquare,
  Phone,
  Video,

  // Comercio
  DollarSign,
  CreditCard,
  Truck,

  // Copiar y archivos
  Files,
  Copy,

  // Etiquetas
  Tag,
  Tags,

  // IA / Procesamiento
  Brain,
  Cpu,
  Gauge,
  MessageCircle,

  // Varios
  Calendar,
  Search,
  BookOpen,
  Image,
  Music,
  Download,
  Upload,
  Heart,
  Star,
  Zap,
  AlertTriangle,
  Info,
  HelpCircle,
}

/**
 * Obtiene un componente de icono Lucide a partir de su nombre (string).
 * Si el nombre no existe en el mapa, retorna Circle como fallback.
 */
export function obtenerIcono(nombre: string | null | undefined): LucideIcon {
  if (!nombre) return Circle
  return iconMap[nombre] || Circle
}

export { iconMap }
export type { LucideIcon }
