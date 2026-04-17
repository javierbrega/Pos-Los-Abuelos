import React, { useEffect, useState } from 'react';
import { supabase, Proveedor } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, DollarSign, History, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Proveedor | null>(null);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Proveedor | null>(null);
  
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Proveedor | null>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    telefono: '',
    saldo_deuda: '0'
  });

  const [paymentData, setPaymentData] = useState({
    monto: '',
    metodo_pago: 'efectivo',
    fecha: new Date().toISOString().split('T')[0],
    notas: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }

  const filteredSuppliers = suppliers.filter(s => 
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.empresa.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openEditDialog = (supplier: Proveedor) => {
    setEditingSupplier(supplier);
    setFormData({
      nombre: supplier.nombre,
      empresa: supplier.empresa,
      telefono: supplier.telefono,
      saldo_deuda: (supplier.saldo_deuda || 0).toString()
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setFormData({ nombre: '', empresa: '', telefono: '', saldo_deuda: '0' });
    setIsDialogOpen(true);
  };

  const openPaymentDialog = (supplier: Proveedor) => {
    setSelectedSupplierForPayment(supplier);
    setPaymentData({
      monto: '',
      metodo_pago: 'efectivo',
      fecha: new Date().toISOString().split('T')[0],
      notas: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPaymentData({ ...paymentData, [e.target.name]: e.target.value });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPayment) return;

    try {
      const monto = parseFloat(paymentData.monto);
      if (isNaN(monto) || monto <= 0) {
        toast.error('El monto debe ser mayor a 0');
        return;
      }

      // 1. Insert payment record
      const { error: paymentError } = await supabase
        .from('pagos_proveedores')
        .insert([{
          proveedor_id: selectedSupplierForPayment.id,
          monto: monto,
          metodo_pago: paymentData.metodo_pago,
          fecha: paymentData.fecha,
          notas: paymentData.notas
        }]);

      if (paymentError) {
        // If table doesn't exist, provide a friendly error
        if (paymentError.code === '42P01') {
          toast.error('Faltan configurar las tablas en la base de datos. Pide la instrucción SQL.');
          return;
        }
        throw paymentError;
      }

      // 2. Reduce supplier debt
      const currentDebt = selectedSupplierForPayment.saldo_deuda || 0;
      const newDebt = currentDebt - monto;

      const { error: updateError } = await supabase
        .from('proveedores')
        .update({ saldo_deuda: newDebt })
        .eq('id', selectedSupplierForPayment.id);

      if (updateError) throw updateError;

      toast.success('Pago registrado exitosamente');
      setIsPaymentDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error('Error al registrar el pago: ' + (error.message || ''));
    }
  };

  const openHistoryDialog = async (supplier: Proveedor) => {
    setSelectedSupplierForHistory(supplier);
    setIsHistoryDialogOpen(true);
    setLoadingHistory(true);
    setHistoryRecords([]);
    
    try {
      // Fetch pagos
      const { data: pagos, error: pagosError } = await supabase
        .from('pagos_proveedores')
        .select('*')
        .eq('proveedor_id', supplier.id);
        
      if (pagosError && pagosError.code !== '42P01') throw pagosError;
        
      // Fetch entradas de stock para sus productos as a proxy for debt charges
      // Note: This relies on the relation existing in PostgREST. If it fails, we fall back to just payments.
      let entradas: any[] = [];
      try {
        const { data: eData, error: eError } = await supabase
          .from('entradas_stock')
          .select(`
            id, cantidad, fecha, comprobante, condicion_pago,
            productos!inner(nombre, proveedor_id, precio_costo)
          `)
          .eq('productos.proveedor_id', supplier.id);
          
        if (!eError && eData) {
          // Si cargaste la deuda a mano al crear el proveedor, eso no genera una entrada de stock.
          // Para las entradas de stock, filtramos solo las que son cuenta corriente.
          // Si el array está vacío, no pasa nada, mostraremos los pagos al menos.
          entradas = eData.filter((e: any) => e.condicion_pago === 'cuenta_corriente');
        }
      } catch(e) {
        console.warn('Could not fetch joined provider stock data:', e);
      }

      // Generar un "Cargo Inicial" manual si la deuda actual no coincide con la suma.
      // Esto pasa porque cuando creaste el proveedor le pusiste una "Deuda actual ($120.000)" a mano en el campito
      // en vez de generarla ingresando productos.
      const totalPagos = (pagos || []).reduce((sum, p) => sum + parseFloat(p.monto), 0);
      const totalCargosGenerados = entradas.reduce((sum, e) => sum + (parseFloat(e.cantidad) * parseFloat(e.productos.precio_costo)), 0);
      
      const balanceCalculado = totalCargosGenerados - totalPagos;
      const deudaDeclarada = supplier.saldo_deuda || 0;
      
      const combined = [
        ...(pagos || []).map((p: any) => ({
          id: `pago-${p.id}`,
          date: new Date(p.fecha),
          type: 'pago',
          description: `Pago registrado (${p.metodo_pago})`,
          amount: -parseFloat(p.monto),
          notas: p.notas
        })),
        ...(entradas || []).map((e: any) => ({
          id: `entrada-${e.id}`,
          date: new Date(e.fecha),
          type: 'cargo',
          description: `Ingreso de stock: ${e.productos.nombre} (x${e.cantidad})`,
          amount: parseFloat(e.cantidad) * parseFloat(e.productos.precio_costo),
          notas: e.comprobante ? `Comprob. / Remito: ${e.comprobante}` : 'Cargo estimado por ingreso'
        }))
      ];

      // Si la deuda que tiene el proveedor anotada es mayor a lo que dice el historial (porque se puso a mano al principio)
      // Agregamos un registro ficticio de "Deuda inicial" para que las cuentas cierren a los ojos del usuario
      if (Math.abs(balanceCalculado - deudaDeclarada) > 0.01) {
         // Verificamos si falta plata (cargo a mano)
         const diferencia = deudaDeclarada - balanceCalculado;
         if (diferencia !== 0) {
           combined.push({
             id: 'ajuste-inicial',
             date: new Date(supplier.created_at || new Date().toISOString()),
             type: 'cargo',
             description: diferencia > 0 ? 'Deuda Inicial Cargada a Mano (👉 Edita al proveedor con el ✏️ para borrar o cambiar esto)' : 'Ajuste de Saldo',
             amount: diferencia,
             notas: 'Ajuste calculado por diferencia de movimientos'
           });
         }
      }

      combined.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setHistoryRecords(combined);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Error al cargar el historial de la cuenta. Intenta más tarde.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('proveedores')
          .update({
            nombre: formData.nombre,
            empresa: formData.empresa,
            telefono: formData.telefono,
            saldo_deuda: parseFloat(formData.saldo_deuda) || 0
          })
          .eq('id', editingSupplier.id);
        if (error) throw error;
        toast.success('Proveedor actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([{
            nombre: formData.nombre,
            empresa: formData.empresa,
            telefono: formData.telefono,
            saldo_deuda: parseFloat(formData.saldo_deuda) || 0
          }]);
        if (error) throw error;
        toast.success('Proveedor creado exitosamente');
      }

      setIsDialogOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Error al guardar el proveedor');
    }
  };

  const executeDelete = async () => {
    if (!supplierToDelete) return;
    
    try {
      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', supplierToDelete);
        
      if (error) {
        if (error.code === '23503') {
          toast.error('No se puede eliminar: El proveedor tiene productos asociados.');
          return;
        }
        throw error;
      }
      
      toast.success('Proveedor eliminado');
      fetchSuppliers();
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar el proveedor');
    } finally {
      setSupplierToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Proveedores</h2>
          <p className="text-zinc-400 mt-2">Gestiona los proveedores de tus productos.</p>
        </div>
        
        <button 
          onClick={openCreateDialog} 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proveedor
        </button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button onClick={() => setIsDialogOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-400">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4">{editingSupplier ? 'Editar Proveedor' : 'Crear Proveedor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nombre" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nombre del Contacto</label>
                <input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="empresa" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Empresa</label>
                <input id="empresa" name="empresa" value={formData.empresa} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="telefono" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Teléfono</label>
                <input id="telefono" name="telefono" value={formData.telefono} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="saldo_deuda" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Deuda Actual ($)</label>
                <input id="saldo_deuda" name="saldo_deuda" type="number" step="0.01" value={formData.saldo_deuda} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="flex justify-end pt-4">
                <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4">
                  {editingSupplier ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal De Pago */}
      {isPaymentDialogOpen && selectedSupplierForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-md p-6 relative flex flex-col max-h-[90vh]">
            <button onClick={() => setIsPaymentDialogOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-400">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">Registrar Pago a {selectedSupplierForPayment.nombre}</h2>
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 mb-4 flex justify-between items-center shrink-0">
              <span className="text-zinc-400">Deuda actual:</span>
              <span className={`font-bold text-lg ${selectedSupplierForPayment.saldo_deuda && selectedSupplierForPayment.saldo_deuda > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                ${(selectedSupplierForPayment.saldo_deuda || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
              </span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 overflow-y-auto pr-2">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-zinc-300">Monto del Pago (*)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input
                    name="monto"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentData.monto}
                    onChange={handlePaymentChange}
                    className="flex h-10 w-full pl-8 rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-zinc-300">Método de Pago</label>
                  <select
                    name="metodo_pago"
                    value={paymentData.metodo_pago}
                    onChange={handlePaymentChange}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none text-zinc-300">Fecha</label>
                  <input
                    name="fecha"
                    type="date"
                    required
                    value={paymentData.fecha}
                    onChange={handlePaymentChange}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none text-zinc-300">Notas / Comprobante (Opcional)</label>
                <input
                  name="notas"
                  type="text"
                  value={paymentData.notas}
                  onChange={handlePaymentChange}
                  placeholder="Ej: Transferencia Banco Nación / Recibo #1234"
                  className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentDialogOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Historial */}
      {isHistoryDialogOpen && selectedSupplierForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 pt-10">
          <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-3xl flex flex-col relative max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start shrink-0">
              <div className="flex items-center gap-3 w-full border-b pb-5 border-zinc-800/50">
                <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 border border-blue-500/20 shadow-sm shrink-0">
                  <History className="w-6 h-6" />
                </div>
                <div className="flex-1 pr-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">Estado de Cuenta</h2>
                    <p className="text-sm text-zinc-400 truncate max-w-[200px] sm:max-w-none">{selectedSupplierForHistory.nombre} ({selectedSupplierForHistory.empresa})</p>
                  </div>
                  <div className="bg-zinc-950 px-4 py-2 rounded-md border border-zinc-800 text-right mt-2 sm:mt-0">
                    <p className="text-xs text-zinc-500 mb-0.5">Saldo Pendiente</p>
                    <p className={`font-mono font-bold text-sm sm:text-base ${selectedSupplierForHistory.saldo_deuda && selectedSupplierForHistory.saldo_deuda > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ${(selectedSupplierForHistory.saldo_deuda || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryDialogOpen(false)} 
                className="absolute top-6 right-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 p-1.5 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-zinc-950/30">
              {loadingHistory ? (
                <div className="p-8 text-center text-zinc-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  Cargando historial de la cuenta...
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="bg-zinc-800/50 p-4 rounded-full mb-3">
                    <History className="w-8 h-8 text-zinc-500" />
                  </div>
                  <p className="text-zinc-400 font-medium tracking-wide">No se encontraron movimientos registrados</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm">Los ingresos de stock y pagos realizados a este proveedor aparecerán aquí para tu control iterativo.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-zinc-400 w-32">Fecha</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-400">Concepto</th>
                      <th className="px-6 py-3 text-left font-medium text-zinc-400">Detalle</th>
                      <th className="px-6 py-3 text-right font-medium text-zinc-400 whitespace-nowrap">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {historyRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-3.5 text-zinc-300 font-mono text-xs whitespace-nowrap">
                          {record.date.toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            record.type === 'pago' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            {record.type === 'pago' ? 'Pago Realizado' : 'Cargo a Cuenta'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-zinc-200">{record.description}</p>
                          {record.notas && <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{record.notas}</p>}
                        </td>
                        <td className={`px-6 py-3.5 text-right font-mono font-medium whitespace-nowrap ${
                          record.type === 'pago' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {record.type === 'pago' ? '-' : '+'}${Math.abs(record.amount).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-900 rounded-b-lg flex justify-between items-center sm:hidden">
                <button 
                  onClick={() => setIsHistoryDialogOpen(false)}
                  className="w-full px-4 py-2 bg-zinc-800 text-zinc-200 rounded-md text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Cerrar Historial
                </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input 
              placeholder="Buscar por nombre o empresa..." 
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {supplierToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-md p-6 relative">
              <h2 className="text-lg font-semibold mb-2">¿Eliminar proveedor?</h2>
              <p className="text-zinc-400 mb-6">Esta acción no se puede deshacer. El proveedor será eliminado permanentemente.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setSupplierToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-zinc-700 bg-transparent hover:bg-zinc-800 h-10 py-2 px-4 text-zinc-100">
                  Cancelar
                </button>
                <button onClick={executeDelete} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-red-600 text-white hover:bg-red-700 h-10 py-2 px-4">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b border-zinc-800">
              <tr className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Nombre</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Empresa</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Teléfono</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Deuda Total</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">Cargando proveedores...</td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-400">No se encontraron proveedores.</td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                    <td className="p-4 align-middle font-semibold text-zinc-100">{supplier.nombre}</td>
                    <td className="p-4 align-middle text-zinc-400">{supplier.empresa}</td>
                    <td className="p-4 align-middle text-zinc-400">{supplier.telefono}</td>
                    <td className={`p-4 align-middle text-right font-medium ${supplier.saldo_deuda && supplier.saldo_deuda > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ${(supplier.saldo_deuda || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => openHistoryDialog(supplier)} 
                          className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-blue-500/20 hover:text-blue-400 px-3 py-2 text-zinc-400 border border-zinc-700 hover:border-blue-500/30"
                          title="Ver Historial"
                        >
                          <History className="h-3.5 w-3.5 mr-1.5" />
                          Historial
                        </button>
                        <button 
                          onClick={() => openPaymentDialog(supplier)} 
                          className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-emerald-500/20 hover:text-emerald-400 px-3 py-2 text-zinc-400 mr-2 border border-zinc-700 hover:border-emerald-500/30"
                          title="Registrar Pago"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                          Pagar
                        </button>
                        <button onClick={() => openEditDialog(supplier)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-blue-400 h-9 w-9 text-zinc-400" title="Editar Proveedor">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setSupplierToDelete(supplier.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-red-400 h-9 w-9 text-zinc-400" title="Eliminar Proveedor">
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
    </div>
  );
}
