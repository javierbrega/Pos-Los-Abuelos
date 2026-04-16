import React, { useEffect, useState } from 'react';
import { supabase, Sale, SaleItem } from '../lib/supabase';
import { Trash2, Eye, Receipt, X, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface SaleWithItems extends Sale {
  venta_items?: (SaleItem & { productos: { nombre: string; sku: string } })[];
}

export function SalesHistory() {
  const [sales, setSales] = useState<SaleWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [viewingSale, setViewingSale] = useState<SaleWithItems | null>(null);

  const [dateFilter, setDateFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchSales();
  }, [dateFilter]);

  async function fetchSales() {
    try {
      setLoading(true);
      let query = supabase
        .from('ventas')
        .select(`
          *,
          venta_items (
            id,
            cantidad,
            precio_unitario,
            subtotal,
            productos (
              nombre,
              sku
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (dateFilter) {
        const start = new Date(dateFilter + 'T00:00:00').toISOString();
        const end = new Date(dateFilter + 'T23:59:59.999').toISOString();
        query = query.gte('created_at', start).lte('created_at', end);
      } else {
        query = query.limit(500); // Limit to 500 most recent if no date selected
      }

      const { data, error } = await query;
      if (error) throw error;
      setSales(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error al cargar el historial de ventas');
    } finally {
      setLoading(false);
    }
  }

  const handleViewDetails = (sale: SaleWithItems) => {
    setViewingSale(sale);
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

  // Group sales by date
  const normalizeText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredSales = sales.filter(sale => {
    if (!productSearch.trim()) return true;
    const search = normalizeText(productSearch);
    return sale.venta_items?.some((item: any) => 
      item.productos?.nombre && normalizeText(item.productos.nombre).includes(search)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / itemsPerPage));
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const groupedSales = paginatedSales.reduce((acc, sale) => {
    // We use the local timezone to group by day
    const dateObj = new Date(sale.created_at!);
    const dateStr = dateObj.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    // Capitalize first letter
    const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    if (!acc[formattedDate]) {
      acc[formattedDate] = [];
    }
    acc[formattedDate].push(sale);
    return acc;
  }, {} as Record<string, SaleWithItems[]>);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Historial de Ventas</h2>
        <p className="text-zinc-400 mt-2">Revisa las ventas realizadas y elimina registros de prueba.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input 
            type="text"
            placeholder="Buscar por producto en estas ventas..."
            value={productSearch}
            onChange={(e) => {
              setProductSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="relative w-full sm:w-48">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input 
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {dateFilter && (
          <button 
            onClick={() => setDateFilter('')}
            className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-md text-sm hover:bg-zinc-700 transition-colors font-medium"
          >
            Limpiar Fecha
          </button>
        )}
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800 p-8 text-center text-zinc-400">
            Cargando historial...
          </div>
        ) : sales.length === 0 ? (
          <div className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800 p-8 text-center text-zinc-400">
            No hay ventas registradas.
          </div>
        ) : (
          Object.entries(groupedSales).map(([date, daySales]) => (
            <div key={date} className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800 overflow-hidden">
              <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="font-semibold text-zinc-200 text-lg">{date}</h3>
                <span className="text-sm font-medium text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-md border border-zinc-800 shadow-sm">
                  {daySales.length} {daySales.length === 1 ? 'venta' : 'ventas'} • Total: <span className="text-emerald-600 font-bold">${daySales.reduce((sum, s) => sum + s.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
              <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead className="[&_tr]:border-b border-zinc-800">
                    <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                      <th className="h-12 px-6 text-left align-middle font-medium text-zinc-400 w-32">Hora</th>
                      <th className="h-12 px-6 text-left align-middle font-medium text-zinc-400">ID Venta</th>
                      <th className="h-12 px-6 text-left align-middle font-medium text-zinc-400">Método de Pago</th>
                      <th className="h-12 px-6 text-right align-middle font-medium text-zinc-400">Total</th>
                      <th className="h-12 px-6 text-right align-middle font-medium text-zinc-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {daySales.map((sale) => (
                      <tr key={sale.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                        <td className="p-4 px-6 align-middle font-medium text-zinc-100">
                          {new Date(sale.created_at!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 px-6 align-middle text-zinc-400 text-xs font-mono">
                          {sale.id.split('-')[0]}...
                        </td>
                        <td className="p-4 px-6 align-middle">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            sale.metodo_pago === 'Efectivo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-b border-zinc-800lue-500/20'
                          }`}>
                            {sale.metodo_pago}
                          </span>
                        </td>
                        <td className="p-4 px-6 align-middle text-right font-bold text-zinc-100">
                          ${sale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 px-6 align-middle text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleViewDetails(sale)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-blue-600 h-8 w-8 text-zinc-400">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => setSaleToDelete(sale.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-red-600 h-8 w-8 text-zinc-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 border border-zinc-800 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-950 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-950 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-zinc-300">
                  Mostrando página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
                  {' '}(<span className="font-medium">{filteredSales.length}</span> ventas en total)
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-zinc-500 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Anterior</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-zinc-500 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-950 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                  >
                    <span className="sr-only">Siguiente</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <h2 className="text-lg font-semibold mb-2">¿Eliminar venta?</h2>
            <div className="py-4 text-zinc-400">
              Esta acción eliminará la venta permanentemente y <strong>restaurará el stock</strong> de los productos involucrados.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setSaleToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-zinc-700 bg-transparent hover:bg-zinc-800 h-10 py-2 px-4 text-zinc-100">
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
          <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-2xl p-6 relative my-auto">
            <button onClick={() => setViewingSale(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-400">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Venta
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                <div>
                  <p className="text-zinc-400">Fecha</p>
                  <p className="font-medium">{new Date(viewingSale.created_at!).toLocaleString('es-AR')}</p>
                </div>
                <div>
                  <p className="text-zinc-400">Método de Pago</p>
                  <p className="font-medium">{viewingSale.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-zinc-400">ID Venta</p>
                  <p className="font-mono text-xs mt-1">{viewingSale.id}</p>
                </div>
                <div>
                  <p className="text-zinc-400">Total</p>
                  <p className="font-bold text-lg text-emerald-600">${viewingSale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-zinc-100 mb-3">Productos Vendidos</h4>
                <div className="border border-zinc-800 rounded-md overflow-hidden">
                  <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b border-zinc-800 bg-zinc-950">
                        <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                          <th className="h-10 px-4 text-left align-middle font-medium text-zinc-400">Producto</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-zinc-400">Cant.</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-zinc-400">Precio Un.</th>
                          <th className="h-10 px-4 text-right align-middle font-medium text-zinc-400">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {viewingSale.venta_items ? (
                          viewingSale.venta_items.map((item) => (
                            <tr key={item.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                              <td className="p-4 align-middle">
                                <div className="font-medium">{item.productos?.nombre || 'Producto Eliminado'}</div>
                                <div className="text-xs text-zinc-400">{item.productos?.sku || '-'}</div>
                              </td>
                              <td className="p-4 align-middle text-right">{item.cantidad}</td>
                              <td className="p-4 align-middle text-right">${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-4 align-middle text-right font-medium">${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-zinc-400">Cargando productos...</td>
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
