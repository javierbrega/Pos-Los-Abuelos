import React, { useEffect, useState } from 'react';
import { supabase, Sale, SaleItem } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Eye, Receipt } from 'lucide-react';
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y Hora</TableHead>
              <TableHead>ID Venta</TableHead>
              <TableHead>Método de Pago</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">Cargando historial...</TableCell>
              </TableRow>
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">No hay ventas registradas.</TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium text-slate-900">
                    {new Date(sale.created_at!).toLocaleString('es-AR')}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs font-mono">
                    {sale.id.split('-')[0]}...
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      sale.metodo_pago === 'Efectivo' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {sale.metodo_pago}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-900">
                    ${sale.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => fetchSaleDetails(sale)} className="text-slate-500 hover:text-blue-600">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setSaleToDelete(sale.id)} className="text-slate-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!saleToDelete} onOpenChange={(open) => !open && setSaleToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar venta?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-600">
            Esta acción eliminará la venta permanentemente y <strong>restaurará el stock</strong> de los productos involucrados.
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setSaleToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar Venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewingSale} onOpenChange={(open) => !open && setViewingSale(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalle de Venta
            </DialogTitle>
          </DialogHeader>
          {viewingSale && (
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
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Precio Un.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingSale.items ? (
                        viewingSale.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.productos?.nombre || 'Producto Eliminado'}</div>
                              <div className="text-xs text-slate-500">{item.productos?.sku || '-'}</div>
                            </TableCell>
                            <TableCell className="text-right">{item.cantidad}</TableCell>
                            <TableCell className="text-right">${item.precio_unitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-medium">${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-slate-500">Cargando productos...</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
