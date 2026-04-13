import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { DollarSign, PackageOpen, TrendingUp, AlertTriangle, Truck } from 'lucide-react';

export function Dashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [supplierDebt, setSupplierDebt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch low stock products (stock < 10)
        const { count: lowStock } = await supabase
          .from('productos')
          .select('*', { count: 'exact', head: true })
          .lt('stock_actual', 10);
        
        setLowStockCount(lowStock || 0);

        // Fetch total products
        const { count: totalProd } = await supabase
          .from('productos')
          .select('*', { count: 'exact', head: true });
        
        setTotalProducts(totalProd || 0);

        // Fetch today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: sales } = await supabase
          .from('ventas')
          .select('total')
          .gte('created_at', today.toISOString());
        
        const salesTotal = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
        setTodaySales(salesTotal);

        // Fetch supplier debt (cost of items sold this month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: items } = await supabase
          .from('venta_items')
          .select('cantidad, precio_costo, proveedor')
          .gte('created_at', startOfMonth.toISOString());

        if (items) {
          const debt = items.reduce((acc: Record<string, number>, item) => {
            const cost = item.cantidad * item.precio_costo;
            acc[item.proveedor] = (acc[item.proveedor] || 0) + cost;
            return acc;
          }, {});
          setSupplierDebt(debt);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-2">Resumen de la actividad y liquidaciones pendientes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Ventas de Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              ${todaySales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ingresos brutos del día
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Productos Bajo Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{lowStockCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Productos</CardTitle>
            <PackageOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalProducts}</div>
            <p className="text-xs text-slate-500 mt-1">
              En catálogo activo
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">84.2%</div>
            <p className="text-xs text-slate-500 mt-1">
              +4.3% este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Debt Section */}
      <h3 className="text-xl font-bold tracking-tight text-slate-900 mt-8 mb-4">Liquidación a Proveedores (Mes Actual)</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(supplierDebt).length > 0 ? (
          Object.entries(supplierDebt).map(([proveedor, deuda]) => (
            <Card key={proveedor} className="bg-white border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{proveedor}</CardTitle>
                <Truck className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${Number(deuda).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Costo total de mercadería vendida
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
            No hay ventas registradas este mes para calcular liquidaciones.
          </div>
        )}
      </div>
    </div>
  );
}
