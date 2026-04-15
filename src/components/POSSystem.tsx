import React, { useState, useEffect } from 'react';
import { supabase, Product } from '../lib/supabase';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote } from 'lucide-react';
import { toast } from 'sonner';

interface CartItem extends Product {
  cantidad: number;
}

export function POSSystem() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'Efectivo' | 'Transferencia'>('Efectivo');

  useEffect(() => {
    if (searchTerm.length > 2) {
      searchProducts();
    } else {
      setProducts([]);
    }
  }, [searchTerm]);

  async function searchProducts() {
    try {
      const { data, error } = await supabase
        .from('productos')
        .select(`
          *,
          proveedores (
            nombre
          )
        `)
        .or(`nombre.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .limit(5);
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error searching products:', error);
    }
  }

  const addToCart = (product: Product) => {
    if (product.stock_actual <= 0) {
      toast.error('Producto sin stock');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cantidad >= product.stock_actual) {
          toast.error('Stock máximo alcanzado');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      return [...prev, { ...product, cantidad: 1 }];
    });
    setSearchTerm('');
    setProducts([]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = item.cantidad + delta;
        if (newQuantity > 0 && newQuantity <= item.stock_actual) {
          return { ...item, cantidad: newQuantity };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.precio_venta * item.cantidad), 0);

  const confirmSale = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      // 1. Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('ventas')
        .insert([{ total, metodo_pago: metodoPago }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Create sale items and update stock
      for (const item of cart) {
        // Insert sale item
        const { error: itemError } = await supabase
          .from('venta_items')
          .insert([{
            venta_id: saleData.id,
            producto_id: item.id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_venta,
            subtotal: item.precio_venta * item.cantidad,
            precio_costo: item.precio_costo,
            proveedor: item.proveedor_id || item.proveedor
          }]);
        
        if (itemError) throw itemError;

        // Update stock
        const newStock = item.stock_actual - item.cantidad;
        const { error: stockError } = await supabase
          .from('productos')
          .update({ stock_actual: newStock })
          .eq('id', item.id);

        if (stockError) throw stockError;
      }

      toast.success('Venta confirmada exitosamente');
      setCart([]);
    } catch (error) {
      console.error('Error confirming sale:', error);
      toast.error('Error al procesar la venta');
    } finally {
      setLoading(false);
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Punto de Venta</h2>
        <p className="text-slate-500 mt-2">Registra nuevas ventas, selecciona el método de pago y descuenta stock.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search and Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6 pb-3">
              <h3 className="font-semibold leading-none tracking-tight text-lg text-slate-800">Buscar Productos</h3>
            </div>
            <div className="p-6 pt-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  placeholder="Escribe el nombre o SKU del producto..." 
                  className="flex w-full rounded-md border border-slate-300 bg-transparent px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent pl-10 h-14 text-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {products.length > 0 && (
                <div className="mt-4 border border-slate-200 rounded-md overflow-hidden">
                  <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                      <thead className="[&_tr]:border-b bg-slate-50">
                        <tr className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                          <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Producto</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Proveedor</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Precio</th>
                          <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Stock</th>
                          <th className="h-12 px-4 align-middle font-medium text-slate-500"></th>
                        </tr>
                      </thead>
                      <tbody className="[&_tr:last-child]:border-0">
                        {products.map(product => (
                          <tr key={product.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                            <td className="p-4 align-middle">
                              <div className="font-medium text-slate-900">{product.nombre}</div>
                              <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                            </td>
                            <td className="p-4 align-middle">
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{getSupplierName(product)}</span>
                            </td>
                            <td className="p-4 align-middle text-right font-medium">
                              ${product.precio_venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-4 align-middle text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                product.stock_actual > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {product.stock_actual}
                              </span>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <button 
                                onClick={() => addToCart(product)}
                                disabled={product.stock_actual <= 0}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-slate-900 text-white hover:bg-slate-800 h-9 px-3"
                              >
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cart and Checkout */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm h-full flex flex-col">
            <div className="flex flex-col space-y-1.5 p-6 pb-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
              <h3 className="font-semibold leading-none tracking-tight text-lg text-slate-800 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito Actual
              </h3>
            </div>
            <div className="p-6 pt-0 flex-1 overflow-y-auto px-0 py-0">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
                  <p>El carrito está vacío</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.id} className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-slate-900 line-clamp-2">{item.nombre}</h4>
                          <p className="text-sm text-slate-500">${item.precio_venta.toLocaleString('es-AR', { minimumFractionDigits: 2 })} c/u</p>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-red-600 h-8 w-8 text-slate-400 -mr-2 -mt-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center border border-slate-200 rounded-md">
                          <button onClick={() => updateQuantity(item.id, -1)} className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 h-8 w-8 rounded-none">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-10 text-center text-sm font-medium">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="inline-flex items-center justify-center text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 h-8 w-8 rounded-none">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="font-bold text-slate-900">
                          ${(item.precio_venta * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center p-6 flex-col border-t border-slate-200 bg-slate-50 rounded-b-xl space-y-4">
              
              {/* Payment Method Selector */}
              <div className="w-full space-y-2">
                <label className="text-sm font-medium text-slate-700">Método de Pago</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoPago('Efectivo')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                      metodoPago === 'Efectivo' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Efectivo
                  </button>
                  <button
                    onClick={() => setMetodoPago('Transferencia')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                      metodoPago === 'Transferencia' 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Transferencia
                  </button>
                </div>
              </div>

              <div className="flex justify-between w-full pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-medium">Total a Pagar</span>
                <span className="text-2xl font-bold text-slate-900">
                  ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button 
                className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg py-6 h-14"
                disabled={cart.length === 0 || loading}
                onClick={confirmSale}
              >
                {loading ? 'Procesando...' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
