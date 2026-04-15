import React, { useEffect, useState } from 'react';
import { supabase, Sale, SaleItem } from '../lib/supabase';
import { Calculator, DollarSign, TrendingUp, Save } from 'lucide-react';
import { toast } from 'sonner';

export function CashRegister() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [retiroGanancia, setRetiroGanancia] = useState<string>('');
  const [saldoApertura, setSaldoApertura] = useState<string>('');
  
  const [stats, setStats] = useState({
    totalVentas: 0,
    totalEfectivo: 0,
    totalTransferencias: 0,
    costoMercaderia: 0,
    gananciaNeta: 0
  });

  useEffect(() => {
    fetchTodaySales();
  }, []);

  async function fetchTodaySales() {
    try {
      setLoading(true);
      
      // Get today's date at midnight for filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: salesData, error: salesError } = await supabase
        .from('ventas')
        .select('*')
        .gte('created_at', today.toISOString());
      
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
          .select('cantidad, precio_costo')
          .in('venta_id', saleIds);
          
        if (itemsError) throw itemsError;
        
        if (itemsData) {
          totalCosto = itemsData.reduce((acc, item) => acc + (item.cantidad * item.precio_costo), 0);
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

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('cierres_caja')
        .insert([{
          fecha: today,
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
      
    } catch (error: any) {
      console.error('Error saving cash register close:', error);
      toast.error(`Error al registrar el cierre: ${error?.message || ''}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Cierre de Caja</h2>
        <p className="text-slate-500 mt-2">Resumen de ventas del día y cálculo de ganancias.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Total Ventas (Hoy)</h3>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold">${stats.totalVentas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-slate-500">Efectivo: ${stats.totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500">Transferencias: ${stats.totalTransferencias.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Costo de Mercadería</h3>
            <Calculator className="h-4 w-4 text-slate-500" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-red-600">-${stats.costoMercaderia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-emerald-50 text-slate-950 shadow-sm">
          <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium text-emerald-800">Ganancia Neta</h3>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="p-6 pt-0">
            <div className="text-2xl font-bold text-emerald-700">${stats.gananciaNeta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6 border-b border-slate-100">
            <h3 className="font-semibold leading-none tracking-tight">Estado de Caja (Efectivo)</h3>
            <p className="text-sm text-slate-500">Control del dinero físico en la caja registradora.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Saldo de Apertura</span>
              <span className="font-medium">${(parseFloat(saldoApertura) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Ventas en Efectivo</span>
              <span className="font-medium text-emerald-600">+ ${stats.totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Retiro de Ganancia</span>
              <span className="font-medium text-red-600">- ${(parseFloat(retiroGanancia) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold text-slate-900">Efectivo Esperado en Caja</span>
              <span className="text-xl font-bold text-slate-900">
                ${((parseFloat(saldoApertura) || 0) + stats.totalEfectivo - (parseFloat(retiroGanancia) || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
          <div className="flex flex-col space-y-1.5 p-6">
            <h3 className="font-semibold leading-none tracking-tight">Registrar Cierre</h3>
            <p className="text-sm text-slate-500">Ingresa los datos para cerrar el turno.</p>
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
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button 
              onClick={handleCierreCaja}
              disabled={loading || stats.totalVentas === 0}
              className="inline-flex w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4 mt-4"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Cierre de Caja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
