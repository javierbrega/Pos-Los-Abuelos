import React, { useEffect, useState } from 'react';
import { supabase, Sale, SaleItem } from '../lib/supabase';
import { Trash2, Eye, Receipt, X } from 'lucide-react';
import { toast } from 'sonner';

interface SaleWithItems extends Sale {
  items?: (SaleItem & { productos: { nombre: string; sku: string } })[];
}

export function SalesHistory() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [viewingSale, setViewingSale] = useState<SaleWithItems | null>(null);

  useEffect(() => {
    fetchSales();
  }, []);

  async function fetchSales() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSales(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error al cargar el historial de ventas');
    } finally {
      setLoading(false);
    }
  }

  const fetchSaleDetails = async (sale: SaleWithItems) => {
    try {
      const { data, error } = await supabase
        .from('venta_items')
        .select(`
          *,
          productos (
            nombre,
            sku
          )
        `)
        .eq('venta_id', sale.id);

      if (error) throw error;
      
      setViewingSale({ ...sale, items: data as any });
    } catch (error) {
      console.error('Error fetching sale details:', error);
      toast.error('Error al cargar los detalles de la venta');
    }
  };

  const executeDelete = async () => {
    if (!saleToDelete) return;
    
    try {
      // 1. Fetch items to restore stock
      const { data: items, error: itemsError } = await supabase
        .from('venta_items')
        .select('producto_id, cantidad')
        .eq('venta_id', saleToDelete);

      if (itemsError) throw itemsError;

      // 2. Restore stock for each product
      if (items && items.length > 0) {
        for (const item of items) {
          // Get current stock
          const { data: product, error: productError } = await supabase
            .from('productos')
            .select('stock_actual')
            .eq('id', item.producto_id)
            .single();
            
          if (productError) throw productError;

          // Update stock
          const { error: updateError } = await supabase
            .from('productos')
            .update({ stock_actual: product.stock_actual + item.cantidad })
            .eq('id', item.producto_id);

          if (updateError) throw updateError;
        }
      }

      // 3. Delete the sale (cascade will delete venta_items)
      const { error: deleteError } = await supabase
        .from('ventas')
        .delete()
        .eq('id', saleToDelete);

      if (deleteError) throw deleteError;

      toast.success('Venta eliminada y stock restaurado');
      fetchSales();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Error al eliminar la venta');
    } finally {
      setSaleToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Historial de Ventas</h2>
        <p className="text-slate-500 mt-2">Revisa las ventas realizadas y elimina registros de prueba.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Fecha y Hora</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">ID Venta</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Método de Pago</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Total</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">Cargando historial...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">No hay ventas registradas.</td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                    <td className="p-4 align-middle font-medium text-slate-900">
                      {new Date(sale.created_at!).toLocaleString('es-AR')}
                    </td>
                    <td className="p-4 align-middle text-slate-500 text-xs font-mono">
                      {sale.id.split('-')[0]}...
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.metodo_pago === 'Efectivo' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {sale.metodo_pago}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right font-bold text-slate-900">
                      ${sale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => fetchSaleDetails(sale)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-blue-600 h-10 w-10 text-slate-500">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => setSaleToDelete(sale.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-red-600 h-10 w-10 text-slate-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h2 className="text-lg font-semibold mb-2">¿Eliminar venta?</h2>
            <div className="py-4 text-slate-600">
              Esta acción eliminará la venta permanentemente y <strong>restaurará el stock</strong> de los productos involucrados.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setSaleToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-slate-300 bg-transparent hover:bg-slate-100 h-10 py-2 px-4 text-slate-900">
                Cancelar
              </button>
              <button onClick={executeDelete} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-red-600 text-white hover:bg-red-700 h-10 py-2 px-4">
                Eliminar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Dialog */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 relative my-auto">
            <button onClick={() => setViewingSale(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Venta
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                  <p className="text-slate-500">Fecha</p>
                  <p className="font-medium">{new Date(viewingSale.created_at!).toLocaleString('es-AR')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Método de Pago</p>
                  <p className="font-medium">{viewingSale.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-slate-500">ID Venta</p>
                  <p className="font-mono text-xs mt-1">{viewingSale.id}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-bold text-lg text-emerald-600">${viewingSale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-slate-900 mb-3">Productos Vendidos</h4>
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b bg-slate-50">
                        <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                          <th className="h-10 px-4 text-left align-middle font-medium text-slate-500">Producto</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Cant.</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Precio Un.</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-slate-500">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {viewingSale.items ? (
                          viewingSale.items.map((item) => (
                            <tr key={item.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                              <td className="p-4 align-middle">
                                <div className="font-medium">{item.productos?.nombre || 'Producto Eliminado'}</div>
                                <div className="text-xs text-slate-500">{item.productos?.sku || '-'}</div>
                              </td>
                              <td className="p-4 align-middle text-right">{item.cantidad}</td>
                              <td className="p-4 align-middle text-right">${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-4 align-middle text-right font-medium">${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-500">Cargando productos...</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
