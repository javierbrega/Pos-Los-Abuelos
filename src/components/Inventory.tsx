import React, { useEffect, useState } from 'react';
import { supabase, Product } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/Dialog';
import { Label } from '@/components/ui/Label';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
    proveedor: 'Proveedor A'
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.proveedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      proveedor: product.proveedor
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData({ nombre: '', sku: '', precio_costo: '', precio_venta: '', stock_actual: '', categoria: '', proveedor: 'Proveedor A' });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        nombre: formData.nombre,
        sku: formData.sku,
        precio_costo: parseFloat(formData.precio_costo),
        precio_venta: parseFloat(formData.precio_venta),
        stock_actual: parseInt(formData.stock_actual, 10),
        categoria: formData.categoria,
        proveedor: formData.proveedor
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
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error al guardar el producto');
    }
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
  };

  const executeDelete = async () => {
    if (!productToDelete) return;
    
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', productToDelete);
        
      if (error) {
        // Código 23503 es violación de llave foránea en PostgreSQL
        if (error.code === '23503') {
          toast.error('No se puede eliminar: El producto ya tiene ventas registradas. Te recomendamos editarlo y poner su stock en 0.');
          return;
        }
        throw error;
      }
      
      toast.success('Producto eliminado');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Error al eliminar el producto');
    } finally {
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inventario</h2>
          <p className="text-slate-500 mt-2">Gestiona los productos, costos y proveedores.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white" />}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Producto' : 'Crear Producto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" name="sku" value={formData.sku} onChange={handleInputChange} required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="precio_costo">Precio Costo ($)</Label>
                  <Input id="precio_costo" name="precio_costo" type="number" step="0.01" value={formData.precio_costo} onChange={handleInputChange} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="precio_venta">Precio Venta ($)</Label>
                  <Input id="precio_venta" name="precio_venta" type="number" step="0.01" value={formData.precio_venta} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stock_actual">Stock Inicial</Label>
                  <Input id="stock_actual" name="stock_actual" type="number" value={formData.stock_actual} onChange={handleInputChange} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Input id="categoria" name="categoria" value={formData.categoria} onChange={handleInputChange} required />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="proveedor">Proveedor</Label>
                <select 
                  id="proveedor" 
                  name="proveedor" 
                  value={formData.proveedor} 
                  onChange={handleInputChange} 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                >
                  <option value="Proveedor A">Proveedor A</option>
                  <option value="Proveedor B">Proveedor B</option>
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {editingProduct ? 'Actualizar' : 'Guardar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, SKU o proveedor..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>¿Eliminar producto?</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-slate-600">
              Esta acción no se puede deshacer. El producto será eliminado permanentemente del inventario.
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setProductToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Eliminar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Venta</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">Cargando inventario...</TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">No se encontraron productos.</TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium text-slate-600">{product.sku}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{product.nombre}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {product.proveedor}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-slate-500">${product.precio_costo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-medium">${product.precio_venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.stock_actual < 10 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {product.stock_actual}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} className="text-slate-500 hover:text-blue-600">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-slate-500 hover:text-red-600">
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
    </div>
  );
}
