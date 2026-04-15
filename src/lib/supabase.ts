import { createClient } from '@supabase/supabase-js';

// These should be configured in your environment variables (.env.example)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types for our database
export type Proveedor = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  created_at?: string;
};

export type CierreCaja = {
  id: string;
  fecha: string;
  total_ventas: number;
  costo_mercaderia: number;
  ganancia_neta: number;
  retiro_ganancia: number;
  created_at?: string;
};

export type Product = {
  id: string;
  nombre: string;
  sku: string;
  precio_costo: number;
  precio_venta: number;
  stock_actual: number;
  categoria: string;
  proveedor_id?: string;
  proveedor?: string; // For backward compatibility if needed
  created_at?: string;
};

export type Sale = {
  id: string;
  total: number;
  metodo_pago: string;
  created_at?: string;
};

export type SaleItem = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  precio_costo: number;
  proveedor: string;
  created_at?: string;
};
