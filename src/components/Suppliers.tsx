import React, { useEffect, useState } from 'react';
import { supabase, Proveedor } from '../lib/supabase';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Proveedor | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    empresa: '',
    telefono: ''
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
      telefono: supplier.telefono
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setFormData({ nombre: '', empresa: '', telefono: '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('proveedores')
          .update(formData)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        toast.success('Proveedor actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('proveedores')
          .insert([formData]);
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
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Proveedores</h2>
          <p className="text-slate-500 mt-2">Gestiona los proveedores de tus productos.</p>
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
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
            <button onClick={() => setIsDialogOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-4">{editingSupplier ? 'Editar Proveedor' : 'Crear Proveedor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="nombre" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nombre del Contacto</label>
                <input id="nombre" name="nombre" value={formData.nombre} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="empresa" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Empresa</label>
                <input id="empresa" name="empresa" value={formData.empresa} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="telefono" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Teléfono</label>
                <input id="telefono" name="telefono" value={formData.telefono} onChange={handleInputChange} required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50" />
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

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              placeholder="Buscar por nombre o empresa..." 
              className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {supplierToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
              <h2 className="text-lg font-semibold mb-2">¿Eliminar proveedor?</h2>
              <p className="text-slate-600 mb-6">Esta acción no se puede deshacer. El proveedor será eliminado permanentemente.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setSupplierToDelete(null)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-slate-300 bg-transparent hover:bg-slate-100 h-10 py-2 px-4 text-slate-900">
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
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Nombre</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Empresa</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-slate-500">Teléfono</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">Cargando proveedores...</td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">No se encontraron proveedores.</td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b transition-colors hover:bg-slate-100/50 data-[state=selected]:bg-slate-100">
                    <td className="p-4 align-middle font-semibold text-slate-900">{supplier.nombre}</td>
                    <td className="p-4 align-middle text-slate-600">{supplier.empresa}</td>
                    <td className="p-4 align-middle text-slate-600">{supplier.telefono}</td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditDialog(supplier)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-blue-600 h-10 w-10 text-slate-500">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setSupplierToDelete(supplier.id)} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 hover:text-red-600 h-10 w-10 text-slate-500">
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
