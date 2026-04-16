import React, { useEffect, useState } from 'react';
import { supabase, Product, Proveedor } from '../lib/supabase';
import { AlertTriangle, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';

interface ShortageItem extends Product {
  proveedores?: {
    nombre: string;
    telefono: string;
  };
}

export function Shortages() {
  const [shortages, setShortages] = useState<ShortageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShortages();
  }, []);

  async function fetchShortages() {
    try {
      setLoading(true);
      
      // Fetch products with stock <= 0 and join with proveedores
      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          proveedores (
            nombre,
            telefono
          )
        `)
        .lte('stock_actual', 0)
        .order('proveedor_id');
      
      if (error) throw error;
      
      setShortages(data || []);
    } catch (error) {
      console.error('Error fetching shortages:', error);
      toast.error('Error al cargar los faltantes');
    } finally {
      setLoading(false);
    }
  }

  // Group by supplier
  const groupedShortages = shortages.reduce((acc, item) => {
    const supplierName = item.proveedores?.nombre || item.proveedor || 'Sin Proveedor';
    if (!acc[supplierName]) {
      acc[supplierName] = [];
    }
    acc[supplierName].push(item);
    return acc;
  }, {} as Record<string, ShortageItem[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Faltantes</h2>
          <p className="text-zinc-400 mt-2">Productos sin stock, organizados por proveedor para facilitar pedidos.</p>
        </div>
        <button 
          onClick={fetchShortages}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-zinc-700 bg-transparent hover:bg-zinc-800 h-10 py-2 px-4 text-zinc-100"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Cargando faltantes...</div>
      ) : shortages.length === 0 ? (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
          <PackageSearch className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-zinc-100">¡Todo en orden!</h3>
          <p className="text-zinc-400 mt-1">No hay productos con stock agotado en este momento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedShortages).map(([supplierName, items]) => (
            <div key={supplierName} className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-950 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {supplierName}
                </h3>
                {items[0]?.proveedores?.telefono && (
                  <span className="text-sm text-zinc-400">Tel: {items[0].proveedores.telefono}</span>
                )}
              </div>
              <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b border-zinc-800">
                    <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                      <th className="h-10 px-4 text-left align-middle font-medium text-zinc-400">SKU</th>
                      <th className="h-10 px-4 text-left align-middle font-medium text-zinc-400">Producto</th>
                      <th className="h-10 px-4 text-right align-middle font-medium text-zinc-400">Stock Actual</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                        <td className="p-4 align-middle text-zinc-400 font-mono text-xs">{item.sku}</td>
                        <td className="p-4 align-middle font-medium text-zinc-100">{item.nombre}</td>
                        <td className="p-4 align-middle text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            {item.stock_actual}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
