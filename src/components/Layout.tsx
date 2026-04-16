import React, { useRef, useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Settings, LogOut, History, Users, Calculator, AlertTriangle, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(() => {
    return supabase.storage.from('avatars').getPublicUrl('logo-abuelos').data.publicUrl;
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Por favor selecciona una imagen válida');
        return;
      }

      setUploadingLogo(true);
      
      const { error } = await supabase.storage
        .from('avatars')
        .upload('logo-abuelos', file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        if (error.message.includes('The resource was not found') || error.message.includes('bucket')) {
          toast.error('El bucket "avatars" no existe en tu Supabase. Por favor créalo y configúralo como "Public".');
        } else {
          throw error;
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl('logo-abuelos');
      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success('Foto de perfil actualizada exitosamente');

    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('Error al subir la imagen: ' + (err.message || ''));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'suppliers', label: 'Proveedores', icon: Users },
    { id: 'shortages', label: 'Faltantes', icon: AlertTriangle },
    { id: 'sales', label: 'Historial de Ventas', icon: History },
    { id: 'cash', label: 'Cierre de Caja', icon: Calculator },
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden print:h-auto print:overflow-visible print:block">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-300 flex flex-col h-full border-r border-zinc-800 z-10 print:hidden">
        <div className="p-6 flex flex-col items-center border-b border-zinc-800 shrink-0">
          <div className="relative group w-32 h-32 rounded-full mb-3 ring-2 ring-zinc-700 mx-auto">
            <div className="w-full h-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt="Los Abuelos Logo" 
                className="w-full h-full object-cover scale-110"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523741543316-beb7fc7023d8?auto=format&fit=crop&w=200&q=80';
                }}
              />
            </div>
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              {uploadingLogo ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Camera className="w-8 h-8 text-white opacity-80" />
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleLogoUpload}
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 text-center tracking-tight">Los Abuelos</h1>
          <p className="text-xs text-emerald-500 mt-1 uppercase tracking-wider font-semibold">Ramos Generales</p>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm' 
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 print:overflow-visible print:bg-zinc-900 print:p-0">
        <div className="p-8 max-w-7xl mx-auto print:p-0 print:max-w-none print:m-0">
          {children}
        </div>
      </main>
    </div>
  );
}
