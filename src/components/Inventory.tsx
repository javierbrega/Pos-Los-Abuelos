import React, { useEffect, useState } from 'react';
import { supabase, Product, Proveedor } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Filter, PackagePlus, History } from 'lucide-react';
import { toast } from 'sonner';

interface StockEntry {
  id: string;
  producto_id: string;
  cantidad: number;
  fecha: string;
  comprobante: string;
  created_at: string;
  productos?: { nombre: string; sku: string };
}

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<StockEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    sku: '',
    precio_costo: '',
    precio_venta: '',
    stock_actual: '',
    categoria: '',
    proveedor_id: '',
    peso_kg: '',
    precio_suelto: '',
    precio_costo_suelto: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    comprobante: '',
    condicion_pago: 'contado'
  });

  // Stock entry form state
  const [stockFormData, setStockFormData] = useState({
    producto_id: '',
    cantidad: '',
    fecha: new Date().toISOString().split('T')[0],
    comprobante: '',
    condicion_pago: 'contado'
  });

  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('productos')
        .select(`
          *,
          proveedores (
            nombre
          )
        `)
        .order('nombre');
      
      if (productsError) throw productsError;
      
      // Fetch suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre');
        
      if (suppliersError) throw suppliersError;
      
      setProducts(productsData || []);
      setProveedores(suppliersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  };

  const filteredProducts = products.filter(p => {
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch = normalizeText(p.nombre).includes(normalizedSearch) || 
                          normalizeText(p.sku).includes(normalizedSearch);
    const matchesSupplier = supplierFilter === '' || p.proveedor_id === supplierFilter;
    return matchesSearch && matchesSupplier;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      sku: product.sku,
      precio_costo: product.precio_costo.toString(),
      precio_venta: product.precio_venta.toString(),
      stock_actual: product.stock_actual.toString(),
      categoria: product.categoria,
      proveedor_id: product.proveedor_id || '',
      peso_kg: product.peso_kg ? product.peso_kg.toString() : '',
      precio_suelto: product.precio_suelto ? product.precio_suelto.toString() : '',
      precio_costo_suelto: product.precio_costo_suelto ? product.precio_costo_suelto.toString() : '',
      fecha_ingreso: new Date().toISOString().split('T')[0],
      comprobante: '',
      condicion_pago: 'contado'
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData({ 
      nombre: '', 
      sku: '', 
      precio_costo: '', 
      precio_venta: '', 
      stock_actual: '', 
      categoria: '', 
      proveedor_id: proveedores.length > 0 ? proveedores[0].id : '',
      peso_kg: '',
      precio_suelto: '',
      precio_costo_suelto: ''
    });
    setIsDialogOpen(true);
  };

  const handleStockInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setStockFormData({ ...stockFormData, [e.target.name]: e.target.value });
  };

  const openStockDialog = () => {
    setStockFormData({
      producto_id: '',
      cantidad: '',
      fecha: new Date().toISOString().split('T')[0],
      comprobante: '',
      condicion_pago: 'contado'
    });
    setStockSearchTerm('');
    setIsStockDropdownOpen(false);
    setIsStockDialogOpen(true);
  };

  const fetchStockHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('entradas_stock')
        .select(`
          *,
          productos (
            nombre,
            sku
          )
        `)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet
          toast.error('La tabla de historial no existe. Por favor ejecuta el script SQL.');
          return;
        }
        throw error;
      }
      setStockHistory(data || []);
    } catch (error) {
      console.error('Error fetching stock history:', error);
      toast.error('Error al cargar el historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistoryDialog = () => {
    setIsHistoryDialogOpen(true);
    fetchStockHistory();
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cantidad = parseFloat(stockFormData.cantidad);
      if (isNaN(cantidad) || cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a 0');
        return;
      }

      const product = products.find(p => p.id === stockFormData.producto_id);
      if (!product) {
        toast.error('Producto no encontrado');
        return;
      }

      // 1. Insert into entradas_stock
      const { error: insertError } = await supabase
        .from('entradas_stock')
        .insert([{
          producto_id: stockFormData.producto_id,
          cantidad: cantidad,
          fecha: stockFormData.fecha,
          comprobante: stockFormData.comprobante
        }]);

      if (insertError) {
        if (insertError.code === '42P01') {
          toast.error('Falta crear la tabla en la base de datos. Pídele al asistente que te dé el código SQL.');
          return;
        }
        throw insertError;
      }

      // 2. Update product stock
      const newStock = Number(product.stock_actual) + cantidad;
      const { error: updateError } = await supabase
        .from('productos')
        .update({ stock_actual: newStock })
        .eq('id', product.id);

      if (updateError) throw updateError;

      // 3. Update Supplier Debt if 'cuenta_corriente'
      if (stockFormData.condicion_pago === 'cuenta_corriente' && product.proveedor_id) {
        const totalCosto = cantidad * Number(product.precio_costo);
        const prov = proveedores.find(p => p.id === product.proveedor_id);
        
        if (prov) {
          const newDebt = Number(prov.saldo_deuda || 0) + totalCosto;
          const { error: debtError } = await supabase
            .from('proveedores')
            .update({ saldo_deuda: newDebt })
            .eq('id', prov.id);
            
          if (debtError) {
            console.error('Error updating supplier debt:', debtError);
            toast.error('Se ingresó el stock, pero hubo un error al actualizar la cuenta corriente');
          } else {
            toast.success(`Cuenta corriente actualizada: sumados $${totalCosto}`);
          }
        }
      }

      toast.success('Mercadería ingresada exitosamente');
      setIsStockDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving stock entry:', error);
      toast.error(`Error al ingresar mercadería: ${error?.message || 'Verifica los datos'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedProveedor = proveedores.find(p => p.id === formData.proveedor_id);
      
      let calculatedPrecioCostoSuelto = null;
      if (formData.precio_costo_suelto) {
        calculatedPrecioCostoSuelto = parseFloat(formData.precio_costo_suelto);
      } else if (formData.peso_kg && parseFloat(formData.peso_kg) > 0) {
        calculatedPrecioCostoSuelto = parseFloat(formData.precio_costo) / parseFloat(formData.peso_kg);
      }

      const productData = {
        nombre: formData.nombre,
        sku: formData.sku,
        precio_costo: parseFloat(formData.precio_costo),
        precio_venta: parseFloat(formData.precio_venta),
        stock_actual: parseFloat(formData.stock_actual), // Allow decimal stock for "sueltos"
        categoria: formData.categoria,
        proveedor_id: formData.proveedor_id || null,
        proveedor: selectedProveedor ? selectedProveedor.nombre : 'Sin proveedor', // Mantenemos compatibilidad con la columna anterior
        peso_kg: formData.peso_kg ? parseFloat(formData.peso_kg) : null,
        precio_suelto: formData.precio_suelto ? parseFloat(formData.precio_suelto) : null,
        precio_costo_suelto: calculatedPrecioCostoSuelto
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;

        // Actualizar cuenta corriente retrospectivamente si el usuario lo eligió al editar
        if (formData.condicion_pago === 'cuenta_corriente' && productData.proveedor_id) {
          const totalCosto = productData.stock_actual * productData.precio_costo;
          const prov = proveedores.find(p => p.id === productData.proveedor_id);
          
          if (prov && totalCosto > 0) {
            const newDebt = Number(prov.saldo_deuda || 0) + totalCosto;
            const { error: debtError } = await supabase
              .from('proveedores')
              .update({ saldo_deuda: newDebt })
              .eq('id', prov.id);
              
            if (debtError) {
              console.error('Error updating supplier debt on edit:', debtError);
              toast.error('Producto editado, pero hubo un error al sumar la deuda');
            } else {
              toast.success(`Deuda retrospectiva añadida: $${totalCosto}`);
            }
          }
        } else {
          toast.success('Producto actualizado exitosamente');
        }
      } else {
        const { data: newProd, error } = await supabase
          .from('productos')
          .insert([productData])
          .select()
          .single();
        if (error) throw error;

        // Si se ingresó stock inicial, registrar la entrada de stock
        if (productData.stock_actual > 0) {
          const { error: stockError } = await supabase
            .from('entradas_stock')
            .insert([{
              producto_id: newProd.id,
              cantidad: productData.stock_actual,
              fecha: formData.fecha_ingreso || new Date().toISOString().split('T')[0],
              comprobante: formData.comprobante || ''
            }]);
          
          if (stockError) {
            console.error('Error recording initial stock entry:', stockError);
          }
          
          // Actualizar cuenta corriente si es necesario
          if (formData.condicion_pago === 'cuenta_corriente' && productData.proveedor_id) {
            const totalCosto = productData.stock_actual * productData.precio_costo;
            const prov = proveedores.find(p => p.id === productData.proveedor_id);
            
            if (prov) {
              const newDebt = Number(prov.saldo_deuda || 0) + totalCosto;
              const { error: debtError } = await supabase
                .from('proveedores')
                .update({ saldo_deuda: newDebt })
                .eq('id', prov.id);
                
              if (debtError) {
                console.error('Error updating supplier debt:', debtError);
              }
            }
          }
        }

        toast.success('Producto creado exitosamente');
      }

      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(`Error al guardar: ${error?.message || 'Verifica los datos'}`);
    }
  };

  const executeDelete = async () => {
    if (!productToDelete) return;
    
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productToDelete);
        
      if (error) {
        if (error.code === '23503') {
          toast.error('No se puede eliminar: El producto ya tiene ventas registradas. Te recomendamos editarlo y poner su stock en 0.');
          return;
        }
        throw error;
      }
      
      toast.success('Producto eliminado');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    } finally {
      setProductToDelete(null);
    }
  };

  const getSupplierName = (product: any) => {
    if (product.proveedores && product.proveedores.nombre) {
      return product.proveedores.nombre;
    }
    return product.proveedor || 'Sin proveedor';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Inventario</h2>
          <p className="text-zinc-400 mt-2">Gestiona los productos, costos y proveedores.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={openHistoryDialog} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-950 h-10 py-2 px-4 shadow-sm"
          >
            <History className="w-4 h-4 mr-2" />
            Historial Ingresos
          </button>
          <button 
            onClick={openStockDialog} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-blue-600 text-white hover:bg-blue-700 h-10 py-2 px-4 shadow-sm"
          >
            <PackagePlus className="w-4 h-4 mr-2" />
            Ingresar Mercadería
          </button>
          <button 
            onClick={openCreateDialog} 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-lg p-6 relative my-auto">
            <button onClick={() => setIsDialogOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-400">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4">{editingProduct ? 'Editar Producto' : 'Crear Producto'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium leading-none">Nombre</label>
                  <input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sku" className="text-sm font-medium leading-none">SKU</label>
                  <input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="precio_costo" className="text-sm font-medium leading-none">Precio Costo ($)</label>
                  <input id="precio_costo" name="precio_costo" type="number" step="0.01" value={formData.precio_costo} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="precio_venta" className="text-sm font-medium leading-none">Precio Venta ($)</label>
                  <input id="precio_venta" name="precio_venta" type="number" step="0.01" value={formData.precio_venta} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="stock_actual" className="text-sm font-medium leading-none">Stock Inicial</label>
                  <input id="stock_actual" name="stock_actual" type="number" step="0.01" value={formData.stock_actual} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="categoria" className="text-sm font-medium leading-none">Categoría</label>
                  <input id="categoria" name="categoria" value={formData.categoria} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="fecha_ingreso" className="text-sm font-medium leading-none">Fecha de Ingreso de Stock Inicial</label>
                    <input id="fecha_ingreso" name="fecha_ingreso" type="date" value={formData.fecha_ingreso} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent [color-scheme:dark]" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="comprobante" className="text-sm font-medium leading-none">N° Remito/Factura</label>
                    <input id="comprobante" name="comprobante" type="text" placeholder="Opcional" value={formData.comprobante} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="proveedor_id" className="text-sm font-medium leading-none">Proveedor</label>
                  <select 
                    id="proveedor_id" 
                    name="proveedor_id" 
                    value={formData.proveedor_id} 
                    onChange={handleInputChange} 
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  >
                    <option value="" disabled>Seleccione un proveedor</option>
                    {proveedores.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} ({p.empresa})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="peso_kg" className="text-sm font-medium leading-none">
                    Peso del envase (Kg) <span className="text-zinc-500 font-normal">- Opcional</span>
                  </label>
                  <input 
                    id="peso_kg" 
                    name="peso_kg" 
                    type="number" 
                    step="0.01" 
                    value={formData.peso_kg} 
                    onChange={handleInputChange} 
                    placeholder="Ej: 15"
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label htmlFor="condicion_pago" className="text-sm font-medium leading-none text-zinc-100">
                    {editingProduct ? 'Ajuste de Cuenta Corriente' : 'Condición de Pago (Stock Inicial)'}
                  </label>
                  <select 
                    id="condicion_pago" 
                    name="condicion_pago" 
                    value={formData.condicion_pago} 
                    onChange={handleInputChange} 
                    disabled={!formData.proveedor_id || Number(formData.stock_actual) <= 0}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
                  >
                    <option value="contado">{editingProduct ? 'No hacer cambios (Ya pagado/registrado)' : 'Contado / Ya Pagado'}</option>
                    {formData.proveedor_id && <option value="cuenta_corriente">{editingProduct ? 'Sumar valor del stock a la cuenta corriente' : 'Cuenta Corriente (Sumar a deuda)'}</option>}
                  </select>
                  {(!formData.proveedor_id || Number(formData.stock_actual) <= 0) && (
                    <p className="text-[10px] text-zinc-400">Seleccione proveedor y stock inicial mayor a 0 para usar cuenta corriente.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="precio_suelto" className="text-sm font-medium leading-none">
                    Precio Venta Suelto por Kg ($) <span className="text-zinc-500 font-normal">- Opcional</span>
                  </label>
                  <input 
                    id="precio_suelto" 
                    name="precio_suelto" 
                    type="number" 
                    step="0.01" 
                    value={formData.precio_suelto} 
                    onChange={handleInputChange} 
                    placeholder="Ej: 2500"
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="precio_costo_suelto" className="text-sm font-medium leading-none">
                    Precio Costo Suelto por Kg ($) <span className="text-zinc-500 font-normal">- Opcional</span>
                  </label>
                  <input 
                    id="precio_costo_suelto" 
                    name="precio_costo_suelto" 
                    type="number" 
                    step="0.01" 
                    value={formData.precio_costo_suelto} 
                    onChange={handleInputChange} 
                    placeholder="Auto si está vacío"
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4">
                  {editingProduct ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Entry Dialog */}
      {isStockDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsStockDialogOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-400">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-1 text-zinc-100">Ingresar Mercadería</h2>
            <p className="text-sm text-zinc-400 mb-6">Registra la entrada de nuevo stock con su remito o factura.</p>
            
            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-zinc-300">Buscar Producto</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Escribe para buscar..."
                    value={stockSearchTerm}
                    onChange={(e) => {
                      setStockSearchTerm(e.target.value);
                      setIsStockDropdownOpen(true);
                      if (stockFormData.producto_id) {
                        setStockFormData({...stockFormData, producto_id: ''});
                      }
                    }}
                    onFocus={() => setIsStockDropdownOpen(true)}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-100 placeholder:text-zinc-500"
                  />
                  {isStockDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {products.filter(p => p.nombre.toLowerCase().includes(stockSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(stockSearchTerm.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-3 text-sm text-zinc-400">No se encontraron productos...</div>
                      ) : (
                        products.filter(p => p.nombre.toLowerCase().includes(stockSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(stockSearchTerm.toLowerCase())).map(p => (
                          <div
                            key={p.id}
                            onMouseDown={(e) => e.preventDefault()} // Mantiene el foco en el input
                            onClick={() => {
                              setStockFormData({...stockFormData, producto_id: p.id});
                              setStockSearchTerm(`${p.nombre} (Stock: ${p.stock_actual})`);
                              setIsStockDropdownOpen(false);
                            }}
                            className="px-3 py-2 hover:bg-zinc-700 cursor-pointer text-sm text-zinc-100 border-b border-zinc-700/50 last:border-0"
                          >
                            <div className="font-medium inline-block mr-2">{p.nombre}</div>
                            <span className="text-xs text-blue-400 font-semibold">[Stock: {p.stock_actual}]</span>
                            <div className="text-xs text-zinc-400 mt-1">SKU: {p.sku} | Proveedor: {getSupplierName(p)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {/* Hidden input to ensure form validation requires a selected product */}
                <input type="hidden" name="producto_id" value={stockFormData.producto_id} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="cantidad" className="text-sm font-medium text-zinc-300">Cantidad a ingresar</label>
                  <input 
                    id="cantidad" 
                    name="cantidad" 
                    type="number" 
                    step="0.01" 
                    value={stockFormData.cantidad} 
                    onChange={handleStockInputChange} 
                    required 
                    placeholder="Ej: 50"
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="fecha" className="text-sm font-medium text-zinc-300">Fecha de ingreso</label>
                  <input 
                    id="fecha" 
                    name="fecha" 
                    type="date" 
                    value={stockFormData.fecha} 
                    onChange={handleStockInputChange} 
                    required 
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="comprobante" className="text-sm font-medium text-zinc-300">Nº Remito / Factura</label>
                  <input 
                    id="comprobante" 
                    name="comprobante" 
                    type="text" 
                    value={stockFormData.comprobante} 
                    onChange={handleStockInputChange} 
                    placeholder="Ej: R-0001-00001234"
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="stock_condicion_pago" className="text-sm font-medium text-zinc-300">Condición de Pago</label>
                  <select 
                    id="stock_condicion_pago" 
                    name="condicion_pago" 
                    value={stockFormData.condicion_pago} 
                    onChange={handleStockInputChange}
                    disabled={!stockFormData.producto_id || !products.find(p => p.id === stockFormData.producto_id)?.proveedor_id}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="contado">Contado / Pagado</option>
                    {stockFormData.producto_id && products.find(p => p.id === stockFormData.producto_id)?.proveedor_id && (
                      <option value="cuenta_corriente">Cuenta Corriente (Sumar a deuda)</option>
                    )}
                  </select>
                  {(!stockFormData.producto_id || !products.find(p => p.id === stockFormData.producto_id)?.proveedor_id) && (
                    <p className="text-[10px] text-zinc-400">El producto debe tener proveedor asignado.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsStockDialogOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-700 rounded-md hover:bg-zinc-950">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  Confirmar Ingreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Dialog */}
      {isHistoryDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Historial de Ingresos de Mercadería</h2>
                <p className="text-sm text-zinc-400">Registro de todas las entradas de stock con sus comprobantes.</p>
              </div>
              <button onClick={() => setIsHistoryDialogOpen(false)} className="text-zinc-500 hover:text-zinc-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-auto flex-1">
              {loadingHistory ? (
                <div className="text-center py-8 text-zinc-400">Cargando historial...</div>
              ) : stockHistory.length === 0 ? (
                <div className="text-center py-8 text-zinc-400">No hay registros de ingresos de mercadería.</div>
              ) : (
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-950 text-zinc-400 font-medium border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Comprobante</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {stockHistory.map((entry) => (
                        <tr key={entry.id} className="hover:bg-zinc-950">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(entry.fecha + 'T12:00:00').toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-100">{entry.productos?.nombre}</div>
                            <div className="text-xs text-zinc-400">{entry.productos?.sku}</div>
                          </td>
                          <td className="px-4 py-3">
                            {entry.comprobante ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-800 text-zinc-300">
                                {entry.comprobante}
                              </span>
                            ) : (
                              <span className="text-zinc-500 italic text-xs">Sin comprobante</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            +{entry.cantidad}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 rounded-lg shadow-sm border border-zinc-800">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input 
              placeholder="Buscar por nombre o SKU..." 
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-md p-6 relative">
              <h2 className="text-lg font-semibold mb-2">¿Eliminar producto?</h2>
              <p className="text-zinc-400 mb-6">Esta acción no se puede deshacer. El producto será eliminado permanentemente del inventario.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setProductToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-zinc-700 bg-transparent hover:bg-zinc-800 h-10 py-2 px-4 text-zinc-100">
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
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">SKU</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Nombre</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-zinc-400">Proveedor</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Costo</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Venta</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Stock</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-zinc-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400">Cargando inventario...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-400">No se encontraron productos.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 data-[state=selected]:bg-zinc-800">
                    <td className="p-4 align-middle font-medium text-zinc-400">{product.sku}</td>
                    <td className="p-4 align-middle font-semibold text-zinc-100">{product.nombre}</td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-b border-zinc-800lue-500/20">
                        {getSupplierName(product)}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right text-zinc-400">${product.precio_costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 align-middle text-right font-medium">${product.precio_venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 align-middle text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_actual < 10 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {product.stock_actual}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditDialog(product)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-blue-600 h-10 w-10 text-zinc-400">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setProductToDelete(product.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-800 hover:text-red-600 h-10 w-10 text-zinc-400">
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
