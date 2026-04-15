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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Faltantes</h2>
          <p className="text-slate-500 mt-2">Productos sin stock, organizados por proveedor para facilitar pedidos.</p>
        </div>
        <button 
          onClick={fetchShortages}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-slate-300 bg-transparent hover:bg-slate-100 h-10 py-2 px-4 text-slate-900"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando faltantes...</div>
      ) : shortages.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <PackageSearch className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">¡Todo en orden!</h3>
          <p className="text-slate-500 mt-1">No hay productos con stock agotado en este momento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedShortages).map(([supplierName, items]) => (
            <div key={supplierName} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {supplierName}
                </h3>
                {items[0]?.proveedores?.telefono && (
                  <span className="text-sm text-slate-500">Tel: {items[0].proveedores.telefono}</span>
                )}
              </div>
              <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b">
                    <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                      <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">SKU</th>
                      <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Producto</th>
                      <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Stock Actual</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {items.map((item) => (
                      <tr key={item.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                        <td className="p-4 align-middle text-slate-500 font-mono text-xs">{item.sku}</td>
                        <td className="p-4 align-middle font-medium text-slate-900">{item.nombre}</td>
                        <td className="p-4 align-middle text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
