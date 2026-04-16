import React, { useEffect, useState } from 'react';
import { supabase, Sale, SaleItem, CierreCaja } from '../lib/supabase';
import { Calculator, DollarSign, TrendingUp, Save, List, History, Printer, CheckCircle2, Clock, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type DetailedItem = {
  id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_costo: number;
  subtotal_venta: number;
  subtotal_costo: number;
  ganancia: number;
};

export function CashRegister() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [detailedItems, setDetailedItems] = useState<DetailedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retiroGanancia, setRetiroGanancia] = useState<string>('');
  const [saldoApertura, setSaldoApertura] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'ventas' | 'costos' | 'ganancias' | null>(null);
  const [viewMode, setViewMode] = useState<'actual' | 'historial'>('actual');
  const [history, setHistory] = useState<CierreCaja[]>([]);
  const [unclosedDates, setUnclosedDates] = useState<string[]>([]);
  const [previewCierre, setPreviewCierre] = useState<CierreCaja | null>(null);
  const [isTodayClosed, setIsTodayClosed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [editCierreModal, setEditCierreModal] = useState<{isOpen: boolean, cierre: CierreCaja | null}>({isOpen: false, cierre: null});
  const [editFormData, setEditFormData] = useState({ saldo_apertura: '', retiro_ganancia: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencias: 0,
    costoMercaderia: 0,
    gananciaNeta: 0
  });

  useEffect(() => {
    if (viewMode === 'actual') {
      fetchTodaySales();
    } else {
      fetchHistory();
    }
  }, [viewMode, selectedDate]);

  async function fetchHistory() {
    try {
      setLoading(true);
      const { data: cierresData, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .order('fecha', { ascending: false });
      
      if (error) throw error;
      setHistory(cierresData || []);

      // Find unclosed dates
      const { data: ventasData } = await supabase
        .from('ventas')
        .select('created_at');
        
      if (ventasData) {
        const uniqueDates = Array.from(new Set(ventasData.map(v => v.created_at.split('T')[0])));
        const closedDates = new Set((cierresData || []).map(c => c.fecha));
        const unclosed = uniqueDates.filter(d => !closedDates.has(d)).sort((a, b) => b.localeCompare(a));
        
        // Ensure today is in the unclosed list if it's not closed, even if there are no sales yet
        const todayStr = new Date().toISOString().split('T')[0];
        if (!closedDates.has(todayStr) && !unclosed.includes(todayStr)) {
          unclosed.unshift(todayStr);
        }
        
        setUnclosedDates(unclosed);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTodaySales() {
    try {
      setLoading(true);
      
      const startOfDay = new Date(selectedDate + 'T00:00:00').toISOString();
      const endOfDay = new Date(selectedDate + 'T23:59:59.999').toISOString();
      
      // Check if selected date is already closed
      const { data: cierreData } = await supabase
        .from('cierres_caja')
        .select('id')
        .eq('fecha', selectedDate)
        .maybeSingle();
        
      setIsTodayClosed(!!cierreData);

      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      
      if (salesError) throw salesError;
      
      setSales(salesData || []);
      
      // Calculate costs
      let totalCosto = 0;
      let totalVentas = 0;
      let totalEfectivo = 0;
      let totalTransferencias = 0;
      
      if (salesData && salesData.length > 0) {
        const saleIds = salesData.map(s => s.id);
        
        const { data: itemsData, error: itemsError } = await supabase
          .from('venta_items')
          .select(`
            id,
            cantidad,
            precio_unitario,
            precio_costo,
            subtotal,
            producto_id,
            productos (nombre)
          `)
          .in('venta_id', saleIds);
          
        if (itemsError) throw itemsError;
        
        if (itemsData) {
          totalCosto = itemsData.reduce((acc, item) => acc + (item.cantidad * item.precio_costo), 0);
          
          // Process detailed items
          const itemMap = new Map<string, DetailedItem>();
          
          itemsData.forEach((item: any) => {
            const prodName = item.productos?.nombre || 'Producto Desconocido';
            const prodId = item.producto_id;
            
            if (itemMap.has(prodId)) {
              const existing = itemMap.get(prodId)!;
              existing.cantidad += item.cantidad;
              existing.subtotal_venta += item.subtotal;
              existing.subtotal_costo += (item.cantidad * item.precio_costo);
              existing.ganancia = existing.subtotal_venta - existing.subtotal_costo;
            } else {
              itemMap.set(prodId, {
                id: prodId,
                nombre: prodName,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                precio_costo: item.precio_costo,
                subtotal_venta: item.subtotal,
                subtotal_costo: item.cantidad * item.precio_costo,
                ganancia: item.subtotal - (item.cantidad * item.precio_costo)
              });
            }
          });
          
          setDetailedItems(Array.from(itemMap.values()));
        }
        
        totalVentas = salesData.reduce((acc, sale) => acc + sale.total, 0);
        totalEfectivo = salesData.filter(s => s.metodo_pago === 'Efectivo').reduce((acc, sale) => acc + sale.total, 0);
        totalTransferencias = salesData.filter(s => s.metodo_pago === 'Transferencia').reduce((acc, sale) => acc + sale.total, 0);
      }
      
      setStats({
        totalVentas,
        totalEfectivo,
        totalTransferencias,
        costoMercaderia: totalCosto,
        gananciaNeta: totalVentas - totalCosto
      });
      
    } catch (error) {
      console.error('Error fetching today sales:', error);
      toast.error('Error al cargar las ventas del día');
    } finally {
      setLoading(false);
    }
  }

  const handleCierreCaja = async () => {
    try {
      const retiro = parseFloat(retiroGanancia) || 0;
      const apertura = parseFloat(saldoApertura) || 0;
      
      if (retiro > stats.gananciaNeta) {
        toast.error('El retiro no puede ser mayor a la ganancia neta');
        return;
      }

      const { error } = await supabase
        .from('cierres_caja')
        .insert([{
          fecha: selectedDate,
          saldo_apertura: apertura,
          total_ventas: stats.totalVentas,
          total_efectivo: stats.totalEfectivo,
          total_transferencias: stats.totalTransferencias,
          costo_mercaderia: stats.costoMercaderia,
          ganancia_neta: stats.gananciaNeta,
          retiro_ganancia: retiro
        }]);

      if (error) throw error;

      toast.success('Cierre de caja registrado exitosamente');
      setRetiroGanancia('');
      setSaldoApertura('');
      setIsTodayClosed(true);
      
    } catch (error: any) {
      console.error('Error saving cash register close:', error);
      toast.error(`Error al registrar el cierre: ${error?.message || ''}`);
    }
  };

  const handleDeleteCierre = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.from('cierres_caja').delete().eq('id', id);
      if (error) throw error;
      toast.success('Cierre de caja eliminado exitosamente');
      setDeleteConfirm(null);
      fetchHistory();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar el cierre: ' + (error.message || ''));
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      if (!editCierreModal.cierre) return;
      const apertura = parseFloat(editFormData.saldo_apertura) || 0;
      const retiro = parseFloat(editFormData.retiro_ganancia) || 0;

      if (retiro > editCierreModal.cierre.ganancia_neta) {
        toast.error('El retiro no puede ser mayor a la ganancia neta');
        return;
      }

      setLoading(true);
      const { error } = await supabase
        .from('cierres_caja')
        .update({
          saldo_apertura: apertura,
          retiro_ganancia: retiro
        })
        .eq('id', editCierreModal.cierre.id);

      if (error) throw error;
      
      toast.success('Cierre actualizado exitosamente');
      setEditCierreModal({ isOpen: false, cierre: null });
      fetchHistory();
    } catch (error: any) {
      console.error('Error updating:', error);
      toast.error('Error al actualizar: ' + (error.message || ''));
      setLoading(false);
    }
  };

  const handlePrint = (cierre: CierreCaja) => {
    setPreviewCierre(cierre);
  };

  const renderModal = () => {
    if (!activeModal) return null;

    let title = '';
    let total = 0;
    let columns = [];

    if (activeModal === 'ventas') {
      title = 'Detalle de Ventas';
      total = stats.totalVentas;
      columns = ['Producto', 'Cantidad', 'P. Venta', 'Subtotal'];
    } else if (activeModal === 'costos') {
      title = 'Detalle de Costos de Mercadería';
      total = stats.costoMercaderia;
      columns = ['Producto', 'Cantidad', 'Costo Unit.', 'Costo Total'];
    } else if (activeModal === 'ganancias') {
      title = 'Detalle de Ganancias';
      total = stats.gananciaNeta;
      columns = ['Producto', 'Venta Total', 'Costo Total', 'Ganancia'];
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-zinc-900 rounded-lg w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-xl text-zinc-100">{title}</h3>
              <p className="text-sm text-zinc-400">Respaldo detallado del día</p>
            </div>
            <button 
              onClick={() => setActiveModal(null)}
              className="text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-zinc-950">
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} className={`px-4 py-3 font-medium ${i > 0 ? 'text-right' : ''}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-950/50">
                    <td className="px-4 py-3 font-medium text-zinc-100">{item.nombre}</td>
                    {activeModal === 'ventas' && (
                      <>
                        <td className="px-4 py-3 text-right">{item.cantidad.toLocaleString('es-AR', {maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">${item.precio_unitario.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right font-medium">${item.subtotal_venta.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                      </>
                    )}
                    {activeModal === 'costos' && (
                      <>
                        <td className="px-4 py-3 text-right">{item.cantidad.toLocaleString('es-AR', {maximumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">${item.precio_costo.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">${item.subtotal_costo.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                      </>
                    )}
                    {activeModal === 'ganancias' && (
                      <>
                        <td className="px-4 py-3 text-right">${item.subtotal_venta.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right">${item.subtotal_costo.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">${item.ganancia.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                      </>
                    )}
                  </tr>
                ))}
                {detailedItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">No hay datos para mostrar</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-zinc-950 font-bold">
                <tr>
                  <td className="px-4 py-3 text-zinc-100">TOTAL</td>
                  <td colSpan={2}></td>
                  <td className={`px-4 py-3 text-right ${activeModal === 'costos' ? 'text-red-600' : activeModal === 'ganancias' ? 'text-emerald-600' : 'text-zinc-100'}`}>
                    ${total.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="p-4 border-t border-zinc-800 flex justify-end">
            <button 
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`space-y-6 pb-12 ${previewCierre ? 'print:hidden' : ''}`}>
        <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Cierre de Caja</h2>
          <p className="text-zinc-400 mt-2">Resumen de ventas del día y cálculo de ganancias.</p>
        </div>
        <div className="flex bg-zinc-700 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('actual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'actual' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Caja Actual
          </button>
          <button
            onClick={() => setViewMode('historial')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              viewMode === 'historial' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <History className="w-4 h-4" />
            Historial
          </button>
        </div>
      </div>

      {viewMode === 'actual' ? (
        <>
          <div className="flex items-center gap-4 mb-2 bg-zinc-900 p-4 rounded-lg border border-zinc-800 shadow-sm">
            <label htmlFor="date-picker" className="text-sm font-medium text-zinc-300">
              Fecha de Caja:
            </label>
            <input 
              id="date-picker"
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-zinc-950"
            />
            {selectedDate !== new Date().toISOString().split('T')[0] && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                Viendo fecha anterior
              </span>
            )}
          </div>

          {isTodayClosed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 text-emerald-800 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-medium">La caja de esta fecha ya fue cerrada.</p>
                <p className="text-sm text-emerald-600">Puedes ver los detalles en el Historial.</p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm relative overflow-hidden group">
              <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium">Total Ventas (Hoy)</h3>
                <DollarSign className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold">${stats.totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                <div className="flex flex-col gap-1 mt-2">
                  <p className="text-xs text-zinc-400">Efectivo: ${stats.totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-zinc-400">Transferencias: ${stats.totalTransferencias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal('ventas')}
                className="absolute top-4 right-10 p-1.5 bg-zinc-800 rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700"
                title="Ver detalle"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm relative overflow-hidden group">
              <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium">Costo de Mercadería</h3>
                <Calculator className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold text-red-600">-${stats.costoMercaderia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <button 
                onClick={() => setActiveModal('costos')}
                className="absolute top-4 right-10 p-1.5 bg-zinc-800 rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700"
                title="Ver detalle"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-sm relative overflow-hidden group">
              <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium text-emerald-400">Ganancia Neta</h3>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="p-6 pt-0">
                <div className="text-2xl font-bold text-emerald-400">${stats.gananciaNeta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
              </div>
              <button 
                onClick={() => setActiveModal('ganancias')}
                className="absolute top-4 right-10 p-1.5 bg-emerald-500/20 rounded-md text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-500/30"
                title="Ver detalle"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm">
              <div className="flex flex-col space-y-1.5 p-6 border-b border-zinc-800">
                <h3 className="font-semibold leading-none tracking-tight">Estado de Caja (Efectivo)</h3>
                <p className="text-sm text-zinc-400">Control del dinero físico en la caja registradora.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-sm text-zinc-400">Saldo de Apertura</span>
                  <span className="font-medium">${(parseFloat(saldoApertura) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-sm text-zinc-400">Ventas en Efectivo</span>
                  <span className="font-medium text-emerald-600">+ ${stats.totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-sm text-zinc-400">Retiro de Ganancia</span>
                  <span className="font-medium text-red-600">- ${(parseFloat(retiroGanancia) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-semibold text-zinc-100">Efectivo Esperado en Caja</span>
                  <span className="text-xl font-bold text-zinc-100">
                    ${((parseFloat(saldoApertura) || 0) + stats.totalEfectivo - (parseFloat(retiroGanancia) || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-sm">
              <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="font-semibold leading-none tracking-tight">Registrar Cierre</h3>
                <p className="text-sm text-zinc-400">Ingresa los datos para cerrar el turno.</p>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="apertura" className="text-sm font-medium leading-none">Saldo de Apertura ($)</label>
                  <input 
                    id="apertura" 
                    type="number" 
                    step="0.01"
                    value={saldoApertura}
                    onChange={(e) => setSaldoApertura(e.target.value)}
                    placeholder="Ej: 5000.00"
                    disabled={isTodayClosed}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="retiro" className="text-sm font-medium leading-none">Retiro de Ganancia ($)</label>
                  <input 
                    id="retiro" 
                    type="number" 
                    step="0.01"
                    value={retiroGanancia}
                    onChange={(e) => setRetiroGanancia(e.target.value)}
                    placeholder="0.00"
                    disabled={isTodayClosed}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>
                <button 
                  onClick={handleCierreCaja}
                  disabled={loading || stats.totalVentas === 0 || isTodayClosed}
                  className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4 mt-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isTodayClosed ? 'Caja Cerrada' : 'Guardar Cierre de Caja'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-950 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium">Fecha</th>
                <th className="px-6 py-4 font-medium">Estado</th>
                <th className="px-6 py-4 font-medium text-right">Ventas Totales</th>
                <th className="px-6 py-4 font-medium text-right">Efectivo</th>
                <th className="px-6 py-4 font-medium text-right">Transferencias</th>
                <th className="px-6 py-4 font-medium text-right">Ganancia Neta</th>
                <th className="px-6 py-4 font-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Show unclosed dates */}
              {unclosedDates.map((dateStr) => {
                const dateObj = new Date(dateStr + 'T12:00:00');
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                return (
                  <tr key={`unclosed-${dateStr}`} className="bg-blue-50/50">
                    <td className="px-6 py-4 font-medium text-zinc-100">
                      {dateObj.toLocaleDateString('es-AR')} {isToday ? '(Hoy)' : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-b border-zinc-800lue-500/20">
                        <Clock className="w-3 h-3" />
                        Abierta
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-400">-</td>
                    <td className="px-6 py-4 text-right text-zinc-400">-</td>
                    <td className="px-6 py-4 text-right text-zinc-400">-</td>
                    <td className="px-6 py-4 text-right text-zinc-400">-</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setViewMode('actual');
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                      >
                        Ir a cerrar
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {history.map((cierre) => {
                const dateObj = new Date(cierre.fecha + 'T12:00:00'); // Prevent timezone shift
                return (
                  <tr key={cierre.id} className="hover:bg-zinc-950 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-100">
                      {dateObj.toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Cerrada
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      ${cierre.total_ventas.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-400">
                      ${cierre.total_efectivo.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-400">
                      ${cierre.total_transferencias.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      ${cierre.ganancia_neta.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => {
                            setEditFormData({
                              saldo_apertura: cierre.saldo_apertura.toString(),
                              retiro_ganancia: cierre.retiro_ganancia.toString()
                            });
                            setEditCierreModal({ isOpen: true, cierre });
                          }}
                          className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePrint(cierre)}
                          className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-md transition-colors"
                          title="Imprimir comprobante"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(cierre.id)}
                          className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {history.length === 0 && unclosedDates.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                    No hay historial de cajas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {renderModal()}
    </div>

    {/* Delete Confirm Modal */}
    {deleteConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 print:hidden">
        <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-sm shadow-xl border border-zinc-800">
          <h3 className="font-bold text-lg mb-2 text-zinc-100">Eliminar Cierre</h3>
          <p className="text-sm text-zinc-400 mb-6">¿Estás seguro de que deseas eliminar este cierre de caja? Esta acción restablecerá el estado para que puedas cerrarlo nuevamente.</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 rounded-md transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={() => handleDeleteCierre(deleteConfirm)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Cierre Modal */}
    {editCierreModal.isOpen && editCierreModal.cierre && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 print:hidden">
        <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-sm shadow-xl border border-zinc-800">
          <h3 className="font-bold text-lg mb-4 text-zinc-100">Editar Cierre de Caja</h3>
          
          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Saldo de Apertura ($)</label>
              <input
                type="number"
                step="0.01"
                value={editFormData.saldo_apertura}
                onChange={(e) => setEditFormData({...editFormData, saldo_apertura: e.target.value})}
                className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Retiro de Ganancia ($)</label>
              <input
                type="number"
                step="0.01"
                value={editFormData.retiro_ganancia}
                onChange={(e) => setEditFormData({...editFormData, retiro_ganancia: e.target.value})}
                className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setEditCierreModal({isOpen: false, cierre: null})}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 rounded-md transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Print Preview Modal */}
    {previewCierre && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 print:static print:inset-auto print:bg-zinc-900 print:p-0 print:block">
        <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print:w-full print:max-w-none">
          {/* Header - hidden when printing */}
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center print:hidden">
            <h3 className="font-bold text-lg text-zinc-100">Vista Previa</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (window !== window.parent) {
                    toast.error('Abre la app en una nueva pestaña para imprimir');
                  } else {
                    window.print();
                  }
                }} 
                className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium flex items-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button 
                onClick={() => setPreviewCierre(null)} 
                className="p-2 text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {window !== window.parent && (
            <div className="bg-amber-500/10 text-amber-500 p-4 text-sm border-b border-zinc-800 border-amber-500/20 print:hidden flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <p>
                El navegador bloquea la impresión dentro de esta vista previa. Para poder imprimir, <strong>abre la aplicación en una nueva pestaña</strong> haciendo clic en el ícono <strong>↗️ (Open in new tab)</strong> en la esquina superior derecha de tu pantalla.
              </p>
            </div>
          )}

          {/* Receipt Content */}
          <div className="p-8 overflow-y-auto print:overflow-visible print:p-0 text-black bg-white">
            <div className="max-w-md mx-auto border border-b border-zinc-800lack p-6 print:border-none print:p-0">
              <div className="text-center mb-6 border-b border-zinc-800 border-b border-zinc-800lack pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-widest">Los Abuelos</h1>
                <p className="text-sm uppercase mt-1">Ramos Generales</p>
                <h2 className="text-xl font-bold mt-4">Cierre de Caja</h2>
                <p className="text-sm mt-1">
                  Fecha: {new Date(previewCierre.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-zinc-800 border-gray-300 border-dashed pb-1">
                  <span>Saldo de Apertura:</span>
                  <span>${previewCierre.saldo_apertura.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 border-gray-300 border-dashed pb-1">
                  <span>Ventas en Efectivo:</span>
                  <span>${previewCierre.total_efectivo.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 border-gray-300 border-dashed pb-1">
                  <span>Ventas por Transferencia:</span>
                  <span>${previewCierre.total_transferencias.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between font-bold border-b border-zinc-800 border-b border-zinc-800lack pb-1 mt-2">
                  <span>TOTAL VENTAS:</span>
                  <span>${previewCierre.total_ventas.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                
                <div className="flex justify-between border-b border-zinc-800 border-gray-300 border-dashed pb-1 mt-4">
                  <span>Costo de Mercadería:</span>
                  <span>${previewCierre.costo_mercaderia.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between font-bold border-b border-zinc-800 border-b border-zinc-800lack pb-1 mt-2">
                  <span>GANANCIA NETA:</span>
                  <span>${previewCierre.ganancia_neta.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>

                <div className="flex justify-between border-b border-zinc-800 border-gray-300 border-dashed pb-1 mt-4">
                  <span>Retiro de Ganancia:</span>
                  <span>${previewCierre.retiro_ganancia.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-b border-zinc-800-2 border-b border-zinc-800lack pb-1 mt-2">
                  <span>EFECTIVO EN CAJA:</span>
                  <span>
                    ${(previewCierre.saldo_apertura + previewCierre.total_efectivo - previewCierre.retiro_ganancia).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>

              <div className="text-center mt-8 text-xs text-gray-500">
                <p>Documento interno de control</p>
                <p>Generado el {new Date().toLocaleString('es-AR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
