import React, { useEffect, useState } from 'react';
import { supabase, Product, Proveedor } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X, Filter } from 'lucide-react';
import { toast } from 'sonner';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
    precio_suelto: ''
  });

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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
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
      precio_suelto: product.precio_suelto ? product.precio_suelto.toString() : ''
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
      precio_suelto: ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedProveedor = proveedores.find(p => p.id === formData.proveedor_id);
      
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
        precio_suelto: formData.precio_suelto ? parseFloat(formData.precio_suelto) : null
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('productos')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Producto actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('productos')
          .insert([productData]);
        if (error) throw error;
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inventario</h2>
          <p className="text-slate-500 mt-2">Gestiona los productos, costos y proveedores.</p>
        </div>
        
        <button 
          onClick={openCreateDialog} 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-emerald-600 text-white hover:bg-emerald-700 h-10 py-2 px-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </button>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6 relative my-auto">
            <button onClick={() => setIsDialogOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4">{editingProduct ? 'Editar Producto' : 'Crear Producto'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium leading-none">Nombre</label>
                  <input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sku" className="text-sm font-medium leading-none">SKU</label>
                  <input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="precio_costo" className="text-sm font-medium leading-none">Precio Costo ($)</label>
                  <input id="precio_costo" name="precio_costo" type="number" step="0.01" value={formData.precio_costo} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="precio_venta" className="text-sm font-medium leading-none">Precio Venta ($)</label>
                  <input id="precio_venta" name="precio_venta" type="number" step="0.01" value={formData.precio_venta} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="stock_actual" className="text-sm font-medium leading-none">Stock Inicial</label>
                  <input id="stock_actual" name="stock_actual" type="number" step="0.01" value={formData.stock_actual} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="categoria" className="text-sm font-medium leading-none">Categoría</label>
                  <input id="categoria" name="categoria" value={formData.categoria} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="proveedor_id" className="text-sm font-medium leading-none">Proveedor</label>
                  <select 
                    id="proveedor_id" 
                    name="proveedor_id" 
                    value={formData.proveedor_id} 
                    onChange={handleInputChange} 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    Peso del envase (Kg) <span className="text-slate-400 font-normal">- Opcional</span>
                  </label>
                  <input 
                    id="peso_kg" 
                    name="peso_kg" 
                    type="number" 
                    step="0.01" 
                    value={formData.peso_kg} 
                    onChange={handleInputChange} 
                    placeholder="Ej: 15"
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="precio_suelto" className="text-sm font-medium leading-none">
                    Precio Suelto por Kg ($) <span className="text-slate-400 font-normal">- Opcional</span>
                  </label>
                  <input 
                    id="precio_suelto" 
                    name="precio_suelto" 
                    type="number" 
                    step="0.01" 
                    value={formData.precio_suelto} 
                    onChange={handleInputChange} 
                    placeholder="Ej: 2500"
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" 
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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              placeholder="Buscar por nombre o SKU..." 
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-64">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
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
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
              <h2 className="text-lg font-semibold mb-2">¿Eliminar producto?</h2>
              <p className="text-slate-600 mb-6">Esta acción no se puede deshacer. El producto será eliminado permanentemente del inventario.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setProductToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-slate-300 bg-transparent hover:bg-slate-100 h-10 py-2 px-4 text-slate-900">
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
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">SKU</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Nombre</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Proveedor</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Costo</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Venta</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Stock</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">Cargando inventario...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">No se encontraron productos.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                    <td className="p-4 align-middle font-medium text-slate-600">{product.sku}</td>
                    <td className="p-4 align-middle font-semibold text-slate-900">{product.nombre}</td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {getSupplierName(product)}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right text-slate-500">${product.precio_costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 align-middle text-right font-medium">${product.precio_venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-4 align-middle text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_actual < 10 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {product.stock_actual}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditDialog(product)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-blue-600 h-10 w-10 text-slate-500">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setProductToDelete(product.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-red-600 h-10 w-10 text-slate-500">
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
