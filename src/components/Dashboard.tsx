import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { DollarSign, PackageOpen, TrendingUp, AlertTriangle, Truck, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Dashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [supplierDebt, setSupplierDebt] = useState<Record<string, number>>({});
  const [proveedores, setProveedores] = useState<Record<string, string>>({});
  
  // New chart states
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topRevenue, setTopRevenue] = useState<any[]>([]);
  
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
        
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        const { data: sales } = await supabase
          .from('ventas')
          .select('total')
          .gte('created_at', today.toISOString());
        
        const salesTotal = sales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;
        setTodaySales(salesTotal);

        // Fetch last 7 days sales for chart
        const { data: recentSales } = await supabase
          .from('ventas')
          .select('created_at, total, metodo_pago')
          .gte('created_at', sevenDaysAgo.toISOString());

        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date(sevenDaysAgo);
          d.setDate(d.getDate() + i);
          return { 
            date: d.toLocaleDateString('es-AR', { weekday: 'short' }), 
            fullDate: d.toISOString().split('T')[0], 
            total: 0 
          };
        });

        const paymentStats = { Efectivo: 0, Transferencia: 0 };

        if (recentSales) {
          recentSales.forEach(sale => {
            const saleDate = sale.created_at.split('T')[0];
            const dayObj = last7Days.find(d => d.fullDate === saleDate);
            if (dayObj) dayObj.total += Number(sale.total);
          });
        }
        setWeeklySales(last7Days);

        // Fetch month sales for payment methods pie chart
        const { data: monthSales } = await supabase
          .from('ventas')
          .select('total, metodo_pago')
          .gte('created_at', startOfMonth.toISOString());

        if (monthSales) {
          monthSales.forEach(sale => {
            if (sale.metodo_pago === 'Efectivo') paymentStats.Efectivo += Number(sale.total);
            if (sale.metodo_pago === 'Transferencia') paymentStats.Transferencia += Number(sale.total);
          });
        }
        setPaymentMethods([
          { name: 'Efectivo', value: paymentStats.Efectivo },
          { name: 'Transferencia', value: paymentStats.Transferencia }
        ]);

        // Fetch proveedores to map UUIDs to names if needed
        const { data: provData } = await supabase
          .from('proveedores')
          .select('id, nombre');
        
        const provMap: Record<string, string> = {};
        if (provData) {
          provData.forEach(p => {
            provMap[p.id] = p.nombre;
          });
        }
        setProveedores(provMap);

        // Fetch supplier debt (cost of items sold this month) and product stats
        const { data: items } = await supabase
          .from('venta_items')
          .select('cantidad, precio_costo, subtotal, proveedor, producto_id, productos(nombre)')
          .gte('created_at', startOfMonth.toISOString());

        if (items) {
          const debt = items.reduce((acc: Record<string, number>, item: any) => {
            const cost = item.cantidad * item.precio_costo;
            // If the proveedor string is a UUID, map it to the name, otherwise use the string
            const provName = provMap[item.proveedor] || item.proveedor || 'Sin proveedor';
            acc[provName] = (acc[provName] || 0) + cost;
            return acc;
          }, {});
          setSupplierDebt(debt);

          // Calculate top products
          const productStats: Record<string, { nombre: string, cantidad: number, ingresos: number }> = {};
          items.forEach((item: any) => {
            const prodName = item.productos?.nombre || 'Desconocido';
            if (!productStats[item.producto_id]) {
              productStats[item.producto_id] = { nombre: prodName, cantidad: 0, ingresos: 0 };
            }
            productStats[item.producto_id].cantidad += item.cantidad;
            productStats[item.producto_id].ingresos += Number(item.subtotal);
          });

          const sortedByQty = Object.values(productStats).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
          const sortedByRev = Object.values(productStats).sort((a, b) => b.ingresos - a.ingresos).slice(0, 5);

          setTopProducts(sortedByQty);
          setTopRevenue(sortedByRev);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();

    // Subscribe to realtime changes in ventas
    const ventasSubscription = supabase
      .channel('dashboard-ventas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ventas'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ventasSubscription);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Dashboard</h2>
        <p className="text-zinc-400 mt-2">Resumen de la actividad y liquidaciones pendientes.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Ventas de Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">
              ${todaySales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Ingresos brutos del día
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Productos Bajo Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{lowStockCount}</div>
            <p className="text-xs text-zinc-400 mt-1">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Productos</CardTitle>
            <PackageOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{totalProducts}</div>
            <p className="text-xs text-zinc-400 mt-1">
              En catálogo activo
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Tasa de Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">84.2%</div>
            <p className="text-xs text-zinc-400 mt-1">
              +4.3% este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <h3 className="text-xl font-bold tracking-tight text-zinc-100 mt-8 mb-4">Analíticas del Negocio</h3>
      
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Ventas 7 días */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Ventas (Últimos 7 días)</CardTitle>
            <TrendingUp className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklySales} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#a1a1aa'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#a1a1aa'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{borderRadius: '8px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#f4f4f5', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)'}}
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 'Ventas']}
                  />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Métodos de Pago (Mes Actual)</CardTitle>
            <PieChartIcon className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 'Monto']}
                    contentStyle={{borderRadius: '8px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#f4f4f5'}}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Productos Más Vendidos */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Productos Más Vendidos (Mes Actual)</CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] mt-4">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#27272a" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="nombre" type="category" width={100} tick={{fontSize: 11, fill: '#a1a1aa'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#27272a'}}
                      contentStyle={{borderRadius: '8px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#f4f4f5'}}
                      formatter={(value: number) => [value.toLocaleString('es-AR', {maximumFractionDigits: 2}), 'Cantidad']}
                    />
                    <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                      {topProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No hay datos suficientes</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mayor Recaudación */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Mayor Recaudación (Mes Actual)</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="h-[250px] mt-4">
              {topRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topRevenue} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#27272a" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="nombre" type="category" width={100} tick={{fontSize: 11, fill: '#a1a1aa'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{fill: '#27272a'}}
                      contentStyle={{borderRadius: '8px', border: '1px solid #27272a', backgroundColor: '#18181b', color: '#f4f4f5'}}
                      formatter={(value: number) => [`$${value.toLocaleString('es-AR', {minimumFractionDigits: 2})}`, 'Ingresos']}
                    />
                    <Bar dataKey="ingresos" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                      {topRevenue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#34d399'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No hay datos suficientes</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Debt Section */}
      <h3 className="text-xl font-bold tracking-tight text-zinc-100 mt-8 mb-4">Liquidación a Proveedores (Mes Actual)</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(supplierDebt).length > 0 ? (
          Object.entries(supplierDebt).map(([proveedor, deuda]) => (
            <Card key={proveedor} className="bg-zinc-900 border-zinc-800 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">{proveedor}</CardTitle>
                <Truck className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${Number(deuda).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Costo total de mercadería vendida
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 p-8 text-center text-zinc-400 bg-zinc-900 rounded-lg border border-zinc-800 border-dashed">
            No hay ventas registradas este mes para calcular liquidaciones.
          </div>
        )}
      </div>
    </div>
  );
}
