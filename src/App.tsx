/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { POSSystem } from './components/POSSystem';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'pos' && <POSSystem />}
        {activeTab === 'inventory' && <Inventory />}
      </Layout>
      <Toaster position="top-right" />
    </>
  );
}
