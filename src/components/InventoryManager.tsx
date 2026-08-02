import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Boxes,
  Package,
  Tags,
  History,
  TrendingUp,
  BarChart2,
  AlertTriangle,
  QrCode,
  Barcode,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCircle,
  AlertCircle,
  MapPin,
  Warehouse,
  Filter,
  DollarSign,
  PieChart
} from 'lucide-react';

interface InventoryManagerProps {
  token: string;
  tenantDomain: string;
  warehousesList: any[];
  branchesList: any[];
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  fetchWithAuth: (url: string, options?: any) => Promise<any>;
}

export function InventoryManager({
  token,
  tenantDomain,
  warehousesList,
  branchesList,
  showError,
  showSuccess,
  fetchWithAuth
}: InventoryManagerProps) {
  // Navigation tabs for Inventory module
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'products' | 'movements' | 'locations' | 'attributes' | 'valuation'>('dashboard');

  // Core inventories states
  const [productsList, setProductsList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [uomsList, setUomsList] = useState<any[]>([]);
  const [locationsList, setLocationsList] = useState<any[]>([]);
  const [movementsList, setMovementsList] = useState<any[]>([]);
  const [stockLevelsList, setStockLevelsList] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [valuationData, setValuationData] = useState<any>(null);

  // Search & Filter state
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals & Forms visibility
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAttrModal, setShowAttrModal] = useState(false);

  // Attributes form (Categories, Brands, UoMs)
  const [attrType, setAttrType] = useState<'category' | 'brand' | 'uom'>('category');
  const [attrForm, setAttrForm] = useState({ id: '', name: '', code: '', type: 'count', description: '' });

  // Location Form
  const [locationForm, setLocationForm] = useState({
    id: '',
    warehouseId: '',
    name: '',
    code: '',
    zone: '',
    aisle: '',
    shelf: '',
    bin: '',
    status: 'active'
  });

  // Product Form
  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    categoryId: '',
    brandId: '',
    uomId: '',
    code: '',
    sku: '',
    description: '',
    barcode: '',
    status: 'active',
    lowStockThreshold: 10,
    alertEnabled: true,
    costPrice: '0.00',
    sellingPrice: '0.00',
    trackingType: 'none', // 'none' | 'serial' | 'batch'
    variants: [] as any[]
  });

  // Variant helper builder
  const [newVariant, setNewVariant] = useState({ name: '', sku: '', costPrice: '0.00', sellingPrice: '0.00' });

  // Movement Form (Purchase Receiving, Stock OUT, Transfer, Adjustment)
  const [movementForm, setMovementForm] = useState({
    type: 'IN' as 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT',
    sourceWarehouseId: '',
    sourceLocationId: '',
    destWarehouseId: '',
    destLocationId: '',
    notes: '',
    items: [] as any[]
  });

  // Quick transaction item builder
  const [newItem, setNewItem] = useState({
    productId: '',
    variantId: '',
    quantity: 1,
    unitCost: '0.00',
    batchNumber: '',
    serialNumber: '',
    expirationDate: ''
  });

  // ----------------------------------------------------
  // DATA FETCHER ACTIONS
  // ----------------------------------------------------
  const loadInventoryDashboard = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/dashboard');
      if (res.success) setDashboardData(res.data);
    } catch (err: any) {
      showError('Dashboard overview load failed: ' + err.message);
    }
  };

  const loadValuation = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/valuation');
      if (res.success) setValuationData(res.data);
    } catch (err: any) {
      showError('Valuation loading failed: ' + err.message);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/products');
      if (res.success) setProductsList(res.data || []);
    } catch (err: any) {
      showError('Products catalogue loading failed: ' + err.message);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/categories');
      if (res.success) setCategoriesList(res.data || []);
    } catch (err: any) {
      showError('Categories failed to load');
    }
  };

  const loadBrands = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/brands');
      if (res.success) setBrandsList(res.data || []);
    } catch (err: any) {
      showError('Brands failed to load');
    }
  };

  const loadUoms = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/uoms');
      if (res.success) setUomsList(res.data || []);
    } catch (err: any) {
      showError('UOMs failed to load');
    }
  };

  const loadLocations = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/locations');
      if (res.success) setLocationsList(res.data || []);
    } catch (err: any) {
      showError('Stock locations failed to load');
    }
  };

  const loadMovements = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/movements');
      if (res.success) setMovementsList(res.data || []);
    } catch (err: any) {
      showError('Movements ledger failed to load');
    }
  };

  const loadStockLevels = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/stock-levels');
      if (res.success) setStockLevelsList(res.data || []);
    } catch (err: any) {
      showError('On-hand stock levels failed to load');
    }
  };

  const loadAllModules = () => {
    loadCategories();
    loadBrands();
    loadUoms();
    loadProducts();
    loadLocations();
    loadMovements();
    loadStockLevels();
    loadInventoryDashboard();
    loadValuation();
  };

  useEffect(() => {
    loadAllModules();
  }, [activeSubTab]);

  // ----------------------------------------------------
  // SUBMIT HANDLERS
  // ----------------------------------------------------

  // 1. Attributes Submit (Category, Brand, UOM)
  const handleAttrSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const urlMap = {
        category: '/api/v1/erp/inventory/categories',
        brand: '/api/v1/erp/inventory/brands',
        uom: '/api/v1/erp/inventory/uoms'
      };
      const endpoint = attrForm.id ? `${urlMap[attrType]}/${attrForm.id}` : urlMap[attrType];
      const method = attrForm.id ? 'PUT' : 'POST';

      await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(attrForm)
      });

      showSuccess(`${attrType.toUpperCase()} successfully saved.`);
      setShowAttrModal(false);
      setAttrForm({ id: '', name: '', code: '', type: 'count', description: '' });
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteAttribute = async (type: 'category' | 'brand' | 'uom', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const urlMap = {
        category: '/api/v1/erp/inventory/categories',
        brand: '/api/v1/erp/inventory/brands',
        uom: '/api/v1/erp/inventory/uoms'
      };
      await fetchWithAuth(`${urlMap[type]}/${id}`, { method: 'DELETE' });
      showSuccess(`${type.toUpperCase()} removed successfully.`);
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // 2. Locations Submit
  const handleLocationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!locationForm.warehouseId) {
      showError('Please select a parent warehouse first.');
      return;
    }
    try {
      const endpoint = locationForm.id ? `/api/v1/erp/inventory/locations/${locationForm.id}` : '/api/v1/erp/inventory/locations';
      const method = locationForm.id ? 'PUT' : 'POST';

      await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(locationForm)
      });

      showSuccess('Warehouse Location saved successfully.');
      setShowLocationModal(false);
      setLocationForm({ id: '', warehouseId: '', name: '', code: '', zone: '', aisle: '', shelf: '', bin: '', status: 'active' });
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stock location?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/inventory/locations/${id}`, { method: 'DELETE' });
      showSuccess('Location removed successfully.');
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // 3. Products Submit
  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = productForm.id ? `/api/v1/erp/inventory/products/${productForm.id}` : '/api/v1/erp/inventory/products';
      const method = productForm.id ? 'PUT' : 'POST';

      await fetchWithAuth(endpoint, {
        method,
        body: JSON.stringify(productForm)
      });

      showSuccess(`Product ${productForm.name} successfully registered with SKU & Barcodes`);
      setShowProductModal(false);
      setProductForm({
        id: '',
        name: '',
        categoryId: '',
        brandId: '',
        uomId: '',
        code: '',
        sku: '',
        description: '',
        barcode: '',
        status: 'active',
        lowStockThreshold: 10,
        alertEnabled: true,
        costPrice: '0.00',
        sellingPrice: '0.00',
        trackingType: 'none',
        variants: []
      });
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to archive / delete this product?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/inventory/products/${id}`, { method: 'DELETE' });
      showSuccess('Product deleted successfully');
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Add Variant to product builder
  const appendVariant = () => {
    if (!newVariant.name || !newVariant.sku) {
      showError('Please supply name and SKU for variant.');
      return;
    }
    setProductForm({
      ...productForm,
      variants: [...productForm.variants, { ...newVariant }]
    });
    setNewVariant({ name: '', sku: '', costPrice: productForm.costPrice, sellingPrice: productForm.sellingPrice });
  };

  // 4. Stock Movement (Purchase Receiving, Stock OUT, Transfer, etc)
  const handleMovementSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (movementForm.items.length === 0) {
      showError('Please add at least one line item to this stock movement transaction.');
      return;
    }
    if (movementForm.type === 'IN' && !movementForm.destWarehouseId) {
      showError('Please select destination warehouse for IN movement.');
      return;
    }
    if (movementForm.type === 'OUT' && !movementForm.sourceWarehouseId) {
      showError('Please select source warehouse for OUT movement.');
      return;
    }
    if (movementForm.type === 'TRANSFER' && (!movementForm.sourceWarehouseId || !movementForm.destWarehouseId)) {
      showError('Both source and destination warehouses are required for transfer.');
      return;
    }

    try {
      await fetchWithAuth('/api/v1/erp/inventory/movements', {
        method: 'POST',
        body: JSON.stringify(movementForm)
      });

      showSuccess(`Stock movement (${movementForm.type}) successfully logged. Inventory adjusted.`);
      setShowMovementModal(false);
      setMovementForm({
        type: 'IN',
        sourceWarehouseId: '',
        sourceLocationId: '',
        destWarehouseId: '',
        destLocationId: '',
        notes: '',
        items: []
      });
      loadAllModules();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const appendMovementItem = () => {
    if (!newItem.productId) {
      showError('Please select a product first.');
      return;
    }
    const matchedProduct = productsList.find(p => p.id === newItem.productId);
    setMovementForm({
      ...movementForm,
      items: [...movementForm.items, {
        ...newItem,
        productName: matchedProduct?.name || 'Selected product'
      }]
    });
    setNewItem({
      productId: '',
      variantId: '',
      quantity: 1,
      unitCost: '0.00',
      batchNumber: '',
      serialNumber: '',
      expirationDate: ''
    });
  };

  // Filter products Catalog
  const filteredProducts = productsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.code && p.code.toLowerCase().includes(productSearch.toLowerCase()));
    
    const catId = p.categoryId || p.category_id;
    const brdId = p.brandId || p.brand_id;

    const matchesCategory = categoryFilter ? catId === categoryFilter : true;
    const matchesBrand = brandFilter ? brdId === brandFilter : true;
    const matchesStatus = statusFilter ? p.status === statusFilter : true;

    return matchesSearch && matchesCategory && matchesBrand && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Module Title Header */}
      <div className="border-b border-[#F4F1EA] pb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="w-6 h-6 text-[#51794A]" />
            <h1 className="text-2xl font-extrabold tracking-tight">Inventory & Product Hub</h1>
          </div>
          <p className="text-xs text-[#7F7569] mt-1">Multi-tenant isolation active. Managed in PostgreSQL with automatic SKU generation, serial tracking and audit registers.</p>
        </div>

        {/* Action Quick Triggers */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            if (warehousesList.length === 0) {
              showError('Please ensure a warehouse is configured under "Branches & Whs" first.');
              return;
            }
            setShowLocationModal(true);
          }} className="bg-white hover:bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-[#305273]" />
            <span>New Stock Location</span>
          </button>
          
          <button onClick={() => {
            setMovementForm({
              type: 'IN',
              sourceWarehouseId: '',
              sourceLocationId: '',
              destWarehouseId: warehousesList[0]?.id || '',
              destLocationId: '',
              notes: '',
              items: []
            });
            setShowMovementModal(true);
          }} className="bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] hover:bg-[#FAF3D1] text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-2xs">
            <TrendingUp className="w-3.5 h-3.5 text-[#8F6A38]" />
            <span>Process Stock IN (Receiving)</span>
          </button>

          <button onClick={() => {
            setProductForm({
              id: '',
              name: '',
              categoryId: categoriesList[0]?.id || '',
              brandId: brandsList[0]?.id || '',
              uomId: uomsList[0]?.id || '',
              code: '',
              sku: '',
              description: '',
              barcode: '',
              status: 'active',
              lowStockThreshold: 10,
              alertEnabled: true,
              costPrice: '0.00',
              sellingPrice: '0.00',
              trackingType: 'none',
              variants: []
            });
            setShowProductModal(true);
          }} className="bg-[#2C2925] hover:bg-[#1A1816] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Module Horizontal Subtabs */}
      <div className="flex flex-wrap border-b border-[#F4F1EA] gap-1 bg-[#FAF8F5] p-1 rounded-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
          { id: 'products', label: 'Products Catalogue', icon: Package },
          { id: 'movements', label: 'Stock Movements Logs', icon: History },
          { id: 'locations', label: 'Warehouse Bins', icon: MapPin },
          { id: 'valuation', label: 'Financial Valuation', icon: DollarSign },
          { id: 'attributes', label: 'Product Attributes', icon: Tags }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-md transition-all ${
              activeSubTab === tab.id ? 'bg-white text-[#2C2925] shadow-xs border border-[#EBE5DA]' : 'text-[#7F7569] hover:text-[#2C2925]'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SUBTAB VIEW CHANGER */}
      <div className="mt-4">
        {/* TAB 1: DASHBOARD METRICS */}
        {activeSubTab === 'dashboard' && dashboardData && (
          <div className="space-y-6">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#EBE5DA] rounded-xl p-5 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Unique SKUs Catalogued</span>
                <p className="text-3xl font-black text-[#2C2925]">{dashboardData.stats.totalProducts}</p>
                <p className="text-[10px] text-[#51794A] font-semibold">Active in dynamic schema</p>
              </div>
              <div className="bg-white border border-[#EBE5DA] rounded-xl p-5 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Total Stock Items On Hand</span>
                <p className="text-3xl font-black text-[#2C2925]">{dashboardData.stats.totalItemsOnHand}</p>
                <p className="text-[10px] text-[#7F7569]">Distributed physical units</p>
              </div>
              <div className="bg-white border border-[#EBE5DA] rounded-xl p-5 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Assets Valuation (Cost)</span>
                <p className="text-3xl font-black text-[#305273]">${dashboardData.stats.valuationCost}</p>
                <p className="text-[10px] text-[#7F7569]">Calculated cost value</p>
              </div>
              <div className="bg-white border border-[#EBE5DA] rounded-xl p-5 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Potential Profit Margin</span>
                <p className="text-3xl font-black text-[#51794A]">{dashboardData.stats.potentialMargin}%</p>
                <p className="text-[10px] text-[#51794A] font-semibold">Margin potential ({dashboardData.stats.valuationRevenue} potential)</p>
              </div>
            </div>

            {/* Main Dashboard body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Low Stock Threshold Alerts */}
              <div className="lg:col-span-2 border border-[#EBE5DA] bg-[#FDFBF7] rounded-xl p-5 space-y-3.5 shadow-2xs">
                <div className="flex justify-between items-center border-b border-[#EBE5DA] pb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#A82B2B] flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-[#A82B2B]" />
                    <span>Low Stock Warnings & Restock Alerts</span>
                  </h3>
                  <span className="text-[10px] bg-[#FAF3D1] text-[#7B640D] px-2.5 py-0.5 rounded-full border border-[#F5EAA8] font-bold">Auto Warnings</span>
                </div>

                <div className="divide-y divide-[#EBE5DA] space-y-2.5">
                  {dashboardData.lowStock.map((ls: any, idx: number) => (
                    <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-[#2C2925] block">{ls.name}</span>
                        <span className="font-mono text-[10px] bg-[#F4F1EA] px-2 py-0.5 rounded text-[#7F7569] mt-1 inline-block">SKU: {ls.sku}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[#A82B2B] block">{ls.currentStock} remaining</span>
                        <span className="text-[10px] text-[#7F7569]">Threshold limit: {ls.lowStockThreshold}</span>
                      </div>
                    </div>
                  ))}
                  {dashboardData.lowStock.length === 0 && (
                    <div className="text-center py-8 text-[#7F7569] space-y-2">
                      <CheckCircle className="w-8 h-8 text-[#51794A] mx-auto" />
                      <p className="text-xs">All products catalogued exceed low stock thresholds. No restock actions required.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Operations log */}
              <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3.5 bg-white shadow-2xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-2">Recent Movements Ledger</h3>
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {dashboardData.recentMovements.map((rm: any, idx: number) => (
                    <div key={idx} className="text-xs flex justify-between items-start gap-2 border-b border-[#FAF8F5] pb-2 last:border-0 last:pb-0">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          {rm.type === 'IN' ? (
                            <span className="text-[9px] bg-[#EDF7ED] text-[#2E7D32] px-1.5 py-0.5 rounded font-bold uppercase border border-[#D3ECD3]">IN (Receipt)</span>
                          ) : rm.type === 'OUT' ? (
                            <span className="text-[9px] bg-[#FAF3F3] text-[#A82B2B] px-1.5 py-0.5 rounded font-bold uppercase border border-[#F5DCDC]">OUT (Sales)</span>
                          ) : (
                            <span className="text-[9px] bg-[#EAF0F6] text-[#305273] px-1.5 py-0.5 rounded font-bold uppercase border border-[#D1E0EE]">{rm.type}</span>
                          )}
                          <span className="font-bold text-[#2C2925] font-mono">{rm.referenceNumber || rm.reference_number}</span>
                        </div>
                        <p className="text-[10px] text-[#7F7569] mt-1">{rm.notes || 'No reference note attached'}</p>
                      </div>
                      <span className="text-[10px] text-[#A19588] font-mono">{new Date(rm.createdAt || rm.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {dashboardData.recentMovements.length === 0 && (
                    <p className="text-xs text-[#7F7569] text-center py-12">No inventory adjustments or receipts processed yet.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS CATALOGUE (CRUD, SCANNER, SEARCH) */}
        {activeSubTab === 'products' && (
          <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#EBE5DA]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#A19588]" />
                <input
                  type="text"
                  placeholder="Search products by SKU code, barcode, title, or internal prefix..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-white border border-[#EBE5DA] rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none"
                />
              </div>

              {/* Sub filters */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">All Categories</option>
                  {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">All Brands</option>
                  {brandsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs">
                  <option value="">All Statuses</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Draft / Inactive</option>
                </select>
              </div>
            </div>

            {/* Product Cards Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((prod, idx) => (
                <div key={idx} className="border border-[#EBE5DA] rounded-xl bg-white p-5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] bg-[#EAF0F6] text-[#305273] border border-[#D1E0EE] px-2 py-0.5 rounded font-bold uppercase">{prod.category?.name || 'Category Unassigned'}</span>
                      {prod.status === 'active' ? (
                        <span className="text-[9px] bg-[#EDF7ED] text-[#2E7D32] border border-[#D3ECD3] px-2 py-0.5 rounded font-bold uppercase">Active</span>
                      ) : (
                        <span className="text-[9px] bg-[#FAF8F5] text-[#7F7569] border border-[#EBE5DA] px-2 py-0.5 rounded font-bold uppercase">{prod.status}</span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-[#2C2925] text-sm tracking-tight">{prod.name}</h4>
                      <p className="text-[10px] text-[#7F7569] mt-0.5 truncate">{prod.description || 'No detailed product specifications logged.'}</p>
                    </div>

                    <div className="flex items-center space-x-1 font-mono text-[9px] text-[#A19588]">
                      <span>SKU:</span>
                      <span className="font-bold text-[#2C2925]">{prod.sku}</span>
                    </div>

                    {/* QR Code and Barcode visual representatives */}
                    <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#EBE5DA] flex items-center justify-between gap-2.5">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-1 text-[9px] text-[#7F7569]">
                          <Barcode className="w-3 h-3" />
                          <span className="font-semibold uppercase">Barcode scanner</span>
                        </div>
                        <p className="font-mono text-[10px] font-bold text-[#2C2925] tracking-wider">{prod.barcode}</p>
                      </div>
                      
                      {prod.qrCode && (
                        <div className="p-1 bg-white border border-[#EBE5DA] rounded-md shrink-0">
                          <img src={prod.qrCode} alt="QR Code" referrerPolicy="no-referrer" className="w-10 h-10 object-contain" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing and parameters summary */}
                  <div className="border-t border-[#F4F1EA] pt-3 flex justify-between items-center text-xs">
                    <div className="flex space-x-3.5">
                      <div>
                        <span className="text-[9px] text-[#7F7569] block uppercase font-bold">Cost</span>
                        <span className="font-bold text-[#305273]">${prod.costPrice || prod.cost_price}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#7F7569] block uppercase font-bold">Sales Price</span>
                        <span className="font-bold text-[#51794A]">${prod.sellingPrice || prod.selling_price}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#7F7569] block uppercase font-bold">Tracked by</span>
                        <span className="font-bold text-[#8F6A38] uppercase text-[9px]">{prod.trackingType || prod.tracking_type}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex space-x-1 shrink-0">
                      <button onClick={() => {
                        setProductForm({
                          id: prod.id,
                          name: prod.name,
                          categoryId: prod.categoryId || prod.category_id || '',
                          brandId: prod.brandId || prod.brand_id || '',
                          uomId: prod.uomId || prod.uom_id || '',
                          code: prod.code,
                          sku: prod.sku,
                          description: prod.description || '',
                          barcode: prod.barcode || '',
                          status: prod.status || 'active',
                          lowStockThreshold: prod.lowStockThreshold || 10,
                          alertEnabled: prod.alertEnabled !== undefined ? prod.alertEnabled : true,
                          costPrice: prod.costPrice || '0.00',
                          sellingPrice: prod.sellingPrice || '0.00',
                          trackingType: prod.trackingType || 'none',
                          variants: []
                        });
                        setShowProductModal(true);
                      }} className="p-1 hover:bg-[#F4F1EA] rounded text-[#305273]">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteProduct(prod.id)} className="p-1 hover:bg-[#FDF3F3] rounded text-[#A82B2B]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredProducts.length === 0 && (
                <div className="col-span-full bg-white border border-[#EBE5DA] rounded-xl py-16 text-center text-xs text-[#7F7569] space-y-2">
                  <Package className="w-10 h-10 text-[#A19588] mx-auto" />
                  <p className="font-bold text-sm text-[#2C2925]">No Catalogue Products Found</p>
                  <p>Clear current search filter criteria or register a new product item above.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STOCK MOVEMENTS LEDGER (IN, OUT, TRANSFERS, ADJUSTMENTS) */}
        {activeSubTab === 'movements' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#EBE5DA] rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] border-b border-[#EBE5DA] uppercase font-bold text-[#7F7569] text-[10px]">
                  <tr>
                    <th className="p-3.5">Ref / Trans ID</th>
                    <th className="p-3.5">Trans Type</th>
                    <th className="p-3.5">Logistics Scope</th>
                    <th className="p-3.5">Itemized Counts</th>
                    <th className="p-3.5">Authorization User</th>
                    <th className="p-3.5">Logged Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA] text-[#2C2925]">
                  {movementsList.map((mv, idx) => (
                    <tr key={idx} className="hover:bg-[#FCFBFA]">
                      <td className="p-3.5 font-mono font-bold text-[#305273]">{mv.referenceNumber || mv.reference_number}</td>
                      <td className="p-3.5">
                        {mv.type === 'IN' ? (
                          <span className="bg-[#EDF7ED] text-[#2E7D32] border border-[#D3ECD3] text-[9px] font-bold uppercase px-2 py-0.5 rounded">Purchase / Receipt</span>
                        ) : mv.type === 'OUT' ? (
                          <span className="bg-[#FAF3F3] text-[#A82B2B] border border-[#F5DCDC] text-[9px] font-bold uppercase px-2 py-0.5 rounded">Sales / Shipped</span>
                        ) : mv.type === 'TRANSFER' ? (
                          <span className="bg-[#EAF0F6] text-[#305273] border border-[#D1E0EE] text-[9px] font-bold uppercase px-2 py-0.5 rounded">Inter-Depot Transfer</span>
                        ) : (
                          <span className="bg-[#FAF3D1] text-[#7B640D] border border-[#F5EAA8] text-[9px] font-bold uppercase px-2 py-0.5 rounded">Inventory Adjustment</span>
                        )}
                      </td>
                      <td className="p-3.5 space-y-1">
                        {mv.sourceWarehouse && (
                          <div className="flex items-center space-x-1 text-[10px] text-[#A82B2B]">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>From: {mv.sourceWarehouse?.name}</span>
                          </div>
                        )}
                        {mv.destWarehouse && (
                          <div className="flex items-center space-x-1 text-[10px] text-[#51794A]">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>To: {mv.destWarehouse?.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {mv.items?.map((mit: any, mitIdx: number) => (
                            <p key={mitIdx} className="text-[10px] text-[#7F7569]">
                              <span className="font-bold text-[#2C2925]">{mit.product?.name || 'Item'}</span> × {mit.quantity} 
                              {mit.batchNumber && <span className="font-mono bg-[#FAF8F5] border border-[#EBE5DA] rounded px-1 ml-1 text-[9px] font-semibold text-[#8F6A38]">Batch: {mit.batchNumber}</span>}
                              {mit.serialNumber && <span className="font-mono bg-[#FAF8F5] border border-[#EBE5DA] rounded px-1 ml-1 text-[9px] font-semibold text-[#305273]">SN: {mit.serialNumber}</span>}
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 font-medium text-[#7F7569]">Tenant Operator</td>
                      <td className="p-3.5 font-mono text-[10px] text-[#7F7569]">{new Date(mv.createdAt || mv.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {movementsList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-[#7F7569] text-xs">No active ledger transaction movements recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: WAREHOUSE BINS / STOCK LOCATIONS */}
        {activeSubTab === 'locations' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Create stock locations */}
            <form onSubmit={handleLocationSubmit} className="bg-[#FAF8F5] p-5 border border-[#EBE5DA] rounded-xl space-y-4 text-xs h-fit">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-[#2C2925]" />
                <span>Configure Stock Location / Bin</span>
              </h3>

              <div className="space-y-1">
                <label className="font-bold text-[#7F7569] uppercase">Parent Warehouse</label>
                <select value={locationForm.warehouseId} onChange={(e) => setLocationForm({ ...locationForm, warehouseId: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none">
                  <option value="">Select Parent Warehouse</option>
                  {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Location Name</label>
                  <input type="text" required placeholder="Aisle 1 Shelf B" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Location Bin Code</label>
                  <input type="text" required placeholder="A-01-B2" value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs font-mono focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1 col-span-2">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Zone</label>
                  <input type="text" placeholder="Zone A" value={locationForm.zone} onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Aisle</label>
                  <input type="text" placeholder="01" value={locationForm.aisle} onChange={(e) => setLocationForm({ ...locationForm, aisle: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Shelf</label>
                  <input type="text" placeholder="B" value={locationForm.shelf} onChange={(e) => setLocationForm({ ...locationForm, shelf: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#2C2925] text-white hover:bg-[#1A1816] font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-1.5 transition-all">
                <Plus className="w-3.5 h-3.5" />
                <span>Save Stock Location</span>
              </button>
            </form>

            {/* List Locations */}
            <div className="md:col-span-2 border border-[#EBE5DA] rounded-xl p-5 space-y-3 bg-white shadow-2xs">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-2">Active Stock Locations / Aisles & Bins</h3>
              <div className="divide-y divide-[#F4F1EA] max-h-[380px] overflow-y-auto pr-1">
                {locationsList.map((loc, idx) => {
                  const linkedWarehouse = warehousesList.find(w => w.id === loc.warehouseId || w.id === loc.warehouse_id);
                  return (
                    <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[9px] bg-[#EAF0F6] text-[#305273] px-2 py-0.5 rounded font-bold">{loc.code}</span>
                          <span className="font-bold text-[#2C2925]">{loc.name}</span>
                        </div>
                        <p className="text-[10px] text-[#7F7569] mt-1">Warehouse: <span className="font-semibold text-[#2C2925]">{linkedWarehouse?.name || 'Unassigned'}</span></p>
                        {loc.zone && <span className="text-[9px] text-[#A19588] font-mono mt-0.5 block">Zone: {loc.zone} • Aisle: {loc.aisle || 'N/A'} • Shelf: {loc.shelf || 'N/A'}</span>}
                      </div>

                      <div className="flex space-x-2">
                        <button onClick={() => {
                          setLocationForm({
                            id: loc.id,
                            warehouseId: loc.warehouseId || loc.warehouse_id,
                            name: loc.name,
                            code: loc.code,
                            zone: loc.zone || '',
                            aisle: loc.aisle || '',
                            shelf: loc.shelf || '',
                            bin: loc.bin || '',
                            status: loc.status || 'active'
                          });
                        }} className="text-[#305273] hover:underline font-bold">Edit</button>
                        <button onClick={() => deleteLocation(loc.id)} className="text-[#A82B2B] hover:underline font-bold">Remove</button>
                      </div>
                    </div>
                  );
                })}
                {locationsList.length === 0 && (
                  <p className="text-xs text-[#7F7569] text-center py-12">No custom warehouse bins or aisles catalogued.</p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: STOCK VALUATION (FIFO / CHRONOLOGICAL AGGREGATION) */}
        {activeSubTab === 'valuation' && valuationData && (
          <div className="space-y-6">
            <div className="bg-white border border-[#EBE5DA] rounded-xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-[#51794A]" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925]">Chronological Stock Financial Valuation Dashboard</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-[#F4F1EA] pt-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#7F7569]">Capital Tied in Assets (Cost Value)</span>
                  <p className="text-3xl font-black text-[#2C2925]">${valuationData.totalCostValue}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#7F7569]">Projected Retail Turnover (Retail value)</span>
                  <p className="text-3xl font-black text-[#51794A]">${valuationData.totalSellingValue}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#7F7569]">Estimated Retail Gross Margin Profit</span>
                  <p className="text-3xl font-black text-[#305273]">${valuationData.estimatedProfit} <span className="text-xs text-[#51794A] font-bold">({valuationData.profitMarginPercent}% Net)</span></p>
                </div>
              </div>
            </div>

            {/* Category breakdown Valuation */}
            <div className="border border-[#EBE5DA] rounded-xl bg-white p-5 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5 flex justify-between">
                <span>Value Breakdown by Category Grouping</span>
                <span className="text-[10px] text-[#7F7569] font-semibold">PostgreSQL Aggregated</span>
              </h4>
              <div className="divide-y divide-[#F4F1EA] space-y-2.5">
                {valuationData.categoryDistribution.map((cd: any, idx: number) => (
                  <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-[#2C2925]">{cd.name}</span>
                      <span className="text-[10px] text-[#7F7569] block">Total quantity on hand: {cd.count} physical units</span>
                    </div>
                    <div className="text-right flex space-x-6">
                      <div>
                        <span className="text-[9px] text-[#7F7569] block font-bold uppercase">Asset Cost</span>
                        <span className="font-bold text-[#305273]">${cd.costValue}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#7F7569] block font-bold uppercase">Sales Revenue</span>
                        <span className="font-bold text-[#51794A]">${cd.sellingValue}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {valuationData.categoryDistribution.length === 0 && (
                  <p className="text-xs text-center text-[#7F7569] py-8">Configure products and stock inputs to trigger valuation mapping.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PRODUCT ATTRIBUTES CONFIG (CATEGORIES, BRANDS, UOM) */}
        {activeSubTab === 'attributes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Forms column */}
            <div className="bg-[#FAF8F5] p-5 border border-[#EBE5DA] rounded-xl space-y-4 text-xs h-fit">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex items-center space-x-1.5">
                <Tags className="w-4 h-4 text-[#2C2925]" />
                <span>Configure Product Attributes</span>
              </h3>

              <div className="flex gap-1.5 border-b border-[#EBE5DA] pb-3">
                {['category', 'brand', 'uom'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setAttrType(type as any);
                      setAttrForm({ id: '', name: '', code: '', type: 'count', description: '' });
                    }}
                    className={`flex-1 py-1.5 px-2 font-bold text-center rounded text-[10px] uppercase transition-all ${
                      attrType === type ? 'bg-[#2C2925] text-white shadow-xs' : 'bg-white border border-[#EBE5DA] text-[#7F7569]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAttrSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Attribute Name / Value</label>
                  <input type="text" required placeholder={attrType === 'uom' ? 'Boxes (12 Units)' : attrType === 'brand' ? 'Nike Inc' : 'Computer Hardware'} value={attrForm.name} onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Identifier Code Prefix</label>
                  <input type="text" required placeholder={attrType === 'uom' ? 'BOX' : attrType === 'brand' ? 'NKE' : 'HW'} value={attrForm.code} onChange={(e) => setAttrForm({ ...attrForm, code: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs font-mono uppercase focus:outline-none" />
                </div>

                {attrType === 'uom' && (
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">UoM Physical Measurement Type</label>
                    <select value={attrForm.type} onChange={(e) => setAttrForm({ ...attrForm, type: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none">
                      <option value="count">Count (Units, PCS, BOX, Sets)</option>
                      <option value="weight">Weight (KG, Grams, Tons)</option>
                      <option value="volume">Volume (Liters, Milliliters)</option>
                      <option value="length">Length (Meters, Centimeters)</option>
                    </select>
                  </div>
                )}

                {attrType !== 'uom' && (
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">Description / Scope Details</label>
                    <textarea placeholder="General details" value={attrForm.description} onChange={(e) => setAttrForm({ ...attrForm, description: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none resize-none" rows={2} />
                  </div>
                )}

                <button type="submit" className="w-full bg-[#2C2925] text-white hover:bg-[#1A1816] font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-1 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save {attrType.toUpperCase()}</span>
                </button>
              </form>
            </div>

            {/* Right Lists column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Category list */}
              {attrType === 'category' && (
                <div className="border border-[#EBE5DA] rounded-xl p-5 bg-white shadow-2xs space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5">Registered Categories</h3>
                  <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto">
                    {categoriesList.map((cat, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono text-[9px] bg-[#F4F1EA] text-[#2C2925] px-1.5 py-0.5 rounded font-bold mr-2">{cat.code}</span>
                          <span className="font-bold text-[#2C2925]">{cat.name}</span>
                          <span className="text-[10px] text-[#7F7569] block mt-0.5">{cat.description || 'No detailed code specifications logged.'}</span>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => setAttrForm({ id: cat.id, name: cat.name, code: cat.code, type: 'count', description: cat.description || '' })} className="text-[#305273] font-bold hover:underline">Edit</button>
                          <button onClick={() => deleteAttribute('category', cat.id)} className="text-[#A82B2B] font-bold hover:underline">Remove</button>
                        </div>
                      </div>
                    ))}
                    {categoriesList.length === 0 && <p className="text-center py-12 text-[#7F7569]">No categories configured.</p>}
                  </div>
                </div>
              )}

              {/* Brands list */}
              {attrType === 'brand' && (
                <div className="border border-[#EBE5DA] rounded-xl p-5 bg-white shadow-2xs space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5">Registered Brands</h3>
                  <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto">
                    {brandsList.map((brd, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono text-[9px] bg-[#F4F1EA] text-[#2C2925] px-1.5 py-0.5 rounded font-bold mr-2">{brd.code}</span>
                          <span className="font-bold text-[#2C2925]">{brd.name}</span>
                          <span className="text-[10px] text-[#7F7569] block mt-0.5">{brd.description || 'No detailed specifications logged.'}</span>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => setAttrForm({ id: brd.id, name: brd.name, code: brd.code, type: 'count', description: brd.description || '' })} className="text-[#305273] font-bold hover:underline">Edit</button>
                          <button onClick={() => deleteAttribute('brand', brd.id)} className="text-[#A82B2B] font-bold hover:underline">Remove</button>
                        </div>
                      </div>
                    ))}
                    {brandsList.length === 0 && <p className="text-center py-12 text-[#7F7569]">No brands configured.</p>}
                  </div>
                </div>
              )}

              {/* UOM list */}
              {attrType === 'uom' && (
                <div className="border border-[#EBE5DA] rounded-xl p-5 bg-white shadow-2xs space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5">Registered Units of Measure (UoMs)</h3>
                  <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto">
                    {uomsList.map((uom, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono text-[10px] bg-[#FAF3D1] text-[#7B640D] border border-[#F5EAA8] px-2 py-0.5 rounded font-bold mr-2">{uom.code}</span>
                          <span className="font-bold text-[#2C2925]">{uom.name}</span>
                          <span className="text-[10px] text-[#7F7569] block mt-0.5">Physical type: <span className="font-bold uppercase text-[#8F6A38]">{uom.type}</span></span>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => setAttrForm({ id: uom.id, name: uom.name, code: uom.code, type: uom.type, description: '' })} className="text-[#305273] font-bold hover:underline">Edit</button>
                          <button onClick={() => deleteAttribute('uom', uom.id)} className="text-[#A82B2B] font-bold hover:underline">Remove</button>
                        </div>
                      </div>
                    ))}
                    {uomsList.length === 0 && <p className="text-center py-12 text-[#7F7569]">No units of measure configured.</p>}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ----------------------------------------------------
          MODALS SECTION
          ---------------------------------------------------- */}
      
      {/* Product register/Edit modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-2xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base tracking-tight">{productForm.id ? 'Edit Product Item' : 'Register New Enterprise Product'}</h3>
            
            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Product Name</label>
                  <input type="text" required placeholder="MacBook Pro M3 Max" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">Product Code (Optional)</label>
                    <input type="text" placeholder="PRD-001" value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono uppercase" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">SKU Code (Optional)</label>
                    <input type="text" placeholder="SKU-AUTO" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono uppercase" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Category</label>
                  <select value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                    <option value="">Select Category</option>
                    {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Brand</label>
                  <select value={productForm.brandId} onChange={(e) => setProductForm({ ...productForm, brandId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                    <option value="">Select Brand</option>
                    {brandsList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Base Unit (UoM)</label>
                  <select value={productForm.uomId} onChange={(e) => setProductForm({ ...productForm, uomId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                    <option value="">Select UOM</option>
                    {uomsList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Purchase Cost Price ($)</label>
                  <input type="text" placeholder="1000.00" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Selling Retail Price ($)</label>
                  <input type="text" placeholder="1499.00" value={productForm.sellingPrice} onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Stock Tracking System</label>
                  <select value={productForm.trackingType} onChange={(e) => setProductForm({ ...productForm, trackingType: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                    <option value="none">Standard Inventory Count</option>
                    <option value="serial">Individual Serial Number (S/N)</option>
                    <option value="batch">Batch / Lot Tracking (Exp Dates)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Low Stock Safety Threshold</label>
                  <input type="number" value={productForm.lowStockThreshold} onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: parseInt(e.target.value) })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Alert Notifications</label>
                  <select value={productForm.alertEnabled ? 'true' : 'false'} onChange={(e) => setProductForm({ ...productForm, alertEnabled: e.target.value === 'true' })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                    <option value="true">Enable Workspace Alerts</option>
                    <option value="false">Disable Alerts</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#7F7569] uppercase">Product Description Specifications</label>
                <textarea placeholder="Write technical, sizing or packaging specs here..." value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 resize-none" rows={3} />
              </div>

              {/* Product variants Builder */}
              {!productForm.id && (
                <div className="border border-[#EBE5DA] p-4 rounded-xl space-y-3 bg-[#FAF8F5]">
                  <span className="font-bold text-xs uppercase text-[#2C2925] block">Optional Variant Register (Sizes, Colors, etc.)</span>
                  <div className="grid grid-cols-4 gap-2 items-end">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] uppercase font-bold text-[#7F7569]">Variant Spec Name</label>
                      <input type="text" placeholder="Size: L, Color: Titanium Space Grey" value={newVariant.name} onChange={(e) => setNewVariant({ ...newVariant, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-[#7F7569]">Variant Suffix SKU</label>
                      <input type="text" placeholder="L-TGY" value={newVariant.sku} onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white text-xs font-mono uppercase" />
                    </div>
                    <button type="button" onClick={appendVariant} className="bg-[#2C2925] text-white py-2 rounded text-[10px] font-bold uppercase hover:bg-black">Add</button>
                  </div>

                  {productForm.variants.length > 0 && (
                    <div className="pt-2 border-t border-[#EBE5DA] space-y-1">
                      {productForm.variants.map((v: any, vIdx: number) => (
                        <div key={vIdx} className="flex justify-between items-center text-[10px] bg-white border border-[#EBE5DA] rounded px-3 py-1 font-mono">
                          <span>{v.name} (SKU: {v.sku})</span>
                          <button type="button" onClick={() => setProductForm({ ...productForm, variants: productForm.variants.filter((_, i) => i !== vIdx) })} className="text-[#A82B2B] font-bold">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F4F1EA]">
                <button type="button" onClick={() => setShowProductModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Catalogue Product</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Stock movement ledger modal (IN, OUT, TRANSFER, ADJUSTMENT) */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-2xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-base tracking-tight">Process Stock Inventory Transaction</h3>
            
            <form onSubmit={handleMovementSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Transaction Flow Type</label>
                  <select value={movementForm.type} onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as any })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-bold bg-[#FAF8F5]">
                    <option value="IN">IN (Stock Receiving / Purchase Order)</option>
                    <option value="OUT">OUT (Stock Dispatch / Sales order)</option>
                    <option value="TRANSFER">TRANSFER (Inter-depot Stock Transfer)</option>
                    <option value="ADJUSTMENT">ADJUSTMENT (Stock Count Audit Adjustments)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Reference Notes / Memo</label>
                  <input type="text" placeholder="Purchase Order PO-2026-08, Sales Invoice SI-009" value={movementForm.notes} onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
              </div>

              {/* Warehouses Logistics scope mapping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-b border-[#F4F1EA] py-3.5">
                {/* Source warehouse (Required for OUT, TRANSFER, ADJ) */}
                {(movementForm.type === 'OUT' || movementForm.type === 'TRANSFER' || movementForm.type === 'ADJUSTMENT') && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-bold text-[#A82B2B] uppercase text-[10px]">Source Deposing Warehouse</label>
                      <select value={movementForm.sourceWarehouseId} onChange={(e) => setMovementForm({ ...movementForm, sourceWarehouseId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="">Select Origin Warehouse</option>
                        {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase text-[9px]">Source Bin Location (Optional)</label>
                      <select value={movementForm.sourceLocationId} onChange={(e) => setMovementForm({ ...movementForm, sourceLocationId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="">Select Bin Location</option>
                        {locationsList.filter(l => l.warehouseId === movementForm.sourceWarehouseId || l.warehouse_id === movementForm.sourceWarehouseId).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Destination warehouse (Required for IN, TRANSFER, ADJ) */}
                {(movementForm.type === 'IN' || movementForm.type === 'TRANSFER' || movementForm.type === 'ADJUSTMENT') && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="font-bold text-[#51794A] uppercase text-[10px]">Destination Depositing Warehouse</label>
                      <select value={movementForm.destWarehouseId} onChange={(e) => setMovementForm({ ...movementForm, destWarehouseId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="">Select Destination Warehouse</option>
                        {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase text-[9px]">Destination Bin Location (Optional)</label>
                      <select value={movementForm.destLocationId} onChange={(e) => setMovementForm({ ...movementForm, destLocationId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="">Select Bin Location</option>
                        {locationsList.filter(l => l.warehouseId === movementForm.destWarehouseId || l.warehouse_id === movementForm.destWarehouseId).map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized transaction line builder */}
              <div className="border border-[#EBE5DA] rounded-xl p-4 bg-[#FAF8F5] space-y-3">
                <span className="font-bold text-xs uppercase text-[#2C2925] block border-b border-[#EBE5DA] pb-1">Register Item Lines</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[#7F7569]">Select Product</label>
                    <select value={newItem.productId} onChange={(e) => setNewItem({ ...newItem, productId: e.target.value, variantId: '' })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white">
                      <option value="">Select Product Catalogue</option>
                      {productsList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[#7F7569]">Quantity to Adjust</label>
                    <input type="number" min={1} value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white font-bold" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-[#7F7569]">Actual Cost Value ($)</label>
                    <input type="text" value={newItem.unitCost} onChange={(e) => setNewItem({ ...newItem, unitCost: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white font-bold" />
                  </div>
                </div>

                {/* Tracking serial / batch builder */}
                {newItem.productId && productsList.find(p => p.id === newItem.productId)?.trackingType !== 'none' && (
                  <div className="grid grid-cols-2 gap-3 border-t border-[#EBE5DA] pt-2">
                    {productsList.find(p => p.id === newItem.productId)?.trackingType === 'batch' ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-[#8F6A38]">Batch / Lot Number</label>
                          <input type="text" placeholder="LOT-202608-X01" value={newItem.batchNumber} onChange={(e) => setNewItem({ ...newItem, batchNumber: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white font-mono" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-[#8F6A38]">Expiration Date</label>
                          <input type="date" value={newItem.expirationDate} onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white font-mono" />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 col-span-2">
                        <label className="text-[9px] uppercase font-bold text-[#305273]">Serial Number (S/N) - Standard qty is typically 1</label>
                        <input type="text" placeholder="S/N: 72GJK89L1P0" value={newItem.serialNumber} onChange={(e) => setNewItem({ ...newItem, serialNumber: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5 bg-white font-mono uppercase" />
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={appendMovementItem} className="bg-[#2C2925] text-white py-2 px-4 rounded text-[10px] font-bold uppercase hover:bg-black block w-fit ml-auto shadow-xs">Add Item Line</button>

                {movementForm.items.length > 0 && (
                  <div className="pt-2.5 border-t border-[#EBE5DA] space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#7F7569]">Itemized lines:</span>
                    {movementForm.items.map((line: any, lineIdx: number) => (
                      <div key={lineIdx} className="flex justify-between items-center text-[10px] bg-white border border-[#EBE5DA] rounded px-3 py-1.5 shadow-2xs">
                        <div>
                          <span className="font-bold text-[#2C2925]">{line.productName}</span> 
                          <span className="text-[#7F7569] font-mono ml-2">Qty: {line.quantity} • Cost: ${line.unitCost}</span>
                          {(line.batchNumber || line.serialNumber) && (
                            <p className="text-[9px] text-[#8F6A38] mt-0.5 font-mono leading-none">
                              {line.batchNumber && `Batch: ${line.batchNumber} (Exp: ${line.expirationDate || 'None'})`}
                              {line.serialNumber && `Serial No: ${line.serialNumber}`}
                            </p>
                          )}
                        </div>
                        <button type="button" onClick={() => setMovementForm({ ...movementForm, items: movementForm.items.filter((_, i) => i !== lineIdx) })} className="text-[#A82B2B] font-bold">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F4F1EA]">
                <button type="button" onClick={() => setShowMovementModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Commit Stock Adjustment</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Attributes Config general modal (UoMs, Categories, Brands) */}
      {showAttrModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-base tracking-tight uppercase text-[#2C2925]">Save {attrType} Attribute</h3>
            
            <form onSubmit={handleAttrSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#7F7569] uppercase">Attribute Value Name</label>
                <input type="text" required placeholder="Name" value={attrForm.name} onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#7F7569] uppercase font-mono">Short Prefix Code</label>
                <input type="text" required placeholder="Prefix Code" value={attrForm.code} onChange={(e) => setAttrForm({ ...attrForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 uppercase font-mono" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                <button type="button" onClick={() => setShowAttrModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Confirm Attribute</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Warehouse location layout Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-base tracking-tight">Configure Stock Storage Location</h3>
            
            <form onSubmit={handleLocationSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#7F7569] uppercase">Parent Depot Warehouse</label>
                <select value={locationForm.warehouseId} onChange={(e) => setLocationForm({ ...locationForm, warehouseId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 bg-[#FAF8F5] font-bold">
                  <option value="">Select Warehouse Link</option>
                  {warehousesList.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Location Name</label>
                  <input type="text" required placeholder="Aisle 1 Row B" value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Aisle Code / Identifier</label>
                  <input type="text" required placeholder="AISLE-1" value={locationForm.code} onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Zone</label>
                  <input type="text" placeholder="Zone B" value={locationForm.zone} onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Shelf</label>
                  <input type="text" placeholder="03" value={locationForm.shelf} onChange={(e) => setLocationForm({ ...locationForm, shelf: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase text-[9px]">Bin</label>
                  <input type="text" placeholder="Bin 12" value={locationForm.bin} onChange={(e) => setLocationForm({ ...locationForm, bin: e.target.value })} className="w-full border border-[#EBE5DA] rounded px-2.5 py-1.5" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                <button type="button" onClick={() => setShowLocationModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Location Bin</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
