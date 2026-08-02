import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  UserPlus,
  Briefcase,
  Layers,
  FileText,
  Truck,
  FileCheck,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Filter,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  Clock,
  User,
  Building,
  Target,
  FileDown,
  RefreshCw,
  Eye,
  Check,
  X
} from 'lucide-react';

interface SalesCrmManagerProps {
  token: string;
  tenantDomain: string;
  showError: (msg: string) => void;
  showSuccess: (msg: string) => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<any>;
  warehousesList: any[];
}

type SubTab = 'dashboard' | 'leads' | 'accounts' | 'pipeline' | 'orders' | 'deliveries' | 'invoices' | 'activities';

export function SalesCrmManager({
  token,
  tenantDomain,
  showError,
  showSuccess,
  fetchWithAuth,
  warehousesList
}: SalesCrmManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('dashboard');
  const [loading, setLoading] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Form Modals states
  const [activeModal, setActiveModal] = useState<string | null>(null); // 'company', 'contact', 'lead', 'opportunity', 'activity', 'order', 'delivery', 'invoice'
  const [editId, setEditId] = useState<string | null>(null);

  // Form values state
  const [companyForm, setCompanyForm] = useState({ name: '', industry: '', website: '', phone: '', email: '', address: '' });
  const [contactForm, setContactForm] = useState({ companyId: '', firstName: '', lastName: '', email: '', phone: '', jobTitle: '', status: 'active' });
  const [leadForm, setLeadForm] = useState({ title: '', source: 'website', status: 'new', value: '0.00', notes: '', companyId: '', contactId: '', assignedTo: '' });
  const [opportunityForm, setOpportunityForm] = useState({ title: '', companyId: '', contactId: '', leadId: '', stage: 'qualification', value: '0.00', probability: 20, expectedCloseDate: '', notes: '', assignedTo: '' });
  const [activityForm, setActivityForm] = useState({ entityType: 'lead' as any, entityId: '', type: 'note' as any, title: '', description: '', status: 'completed' as any, dueDate: '', assignedTo: '' });
  
  // Custom Sales Order Form
  const [orderForm, setOrderForm] = useState({
    type: 'quotation' as 'quotation' | 'sales_order',
    companyId: '',
    contactId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    status: 'draft' as any,
    currency: 'USD',
    paymentTerms: 'Net 30',
    notes: '',
    items: [] as any[] // { productId: string, variantId: string | null, quantity: number, unitPrice: string, discountAmount: string, taxAmount: string }
  });

  // Fetch functions
  const fetchDashboard = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/sales/dashboard');
      if (res.success) setDashboardData(res.data);
    } catch (err) {
      showError('Failed to load Sales KPIs dashboard');
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/crm/companies');
      if (res.success) setCompanies(res.data);
    } catch (err) {}
  };

  const fetchContacts = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/crm/contacts');
      if (res.success) setContacts(res.data);
    } catch (err) {}
  };

  const fetchLeads = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/crm/leads');
      if (res.success) setLeads(res.data);
    } catch (err) {}
  };

  const fetchOpportunities = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/crm/opportunities');
      if (res.success) setOpportunities(res.data);
    } catch (err) {}
  };

  const fetchActivities = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/crm/activities');
      if (res.success) setActivities(res.data);
    } catch (err) {}
  };

  const fetchSalesOrders = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/sales/orders');
      if (res.success) setSalesOrders(res.data);
    } catch (err) {}
  };

  const fetchDeliveries = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/sales/deliveries');
      if (res.success) setDeliveries(res.data);
    } catch (err) {}
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/sales/invoices');
      if (res.success) setInvoices(res.data);
    } catch (err) {}
  };

  const fetchProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/inventory/products');
      if (res.success) setProductsList(res.data);
    } catch (err) {}
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboard(),
      fetchCompanies(),
      fetchContacts(),
      fetchLeads(),
      fetchOpportunities(),
      fetchActivities(),
      fetchSalesOrders(),
      fetchDeliveries(),
      fetchInvoices(),
      fetchProducts()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, [activeSubTab]);

  // Handle submissions
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editId ? `/api/v1/erp/crm/companies/${editId}` : '/api/v1/erp/crm/companies';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });

      if (res.success) {
        showSuccess(editId ? 'Company updated successfully' : 'Company added successfully');
        setActiveModal(null);
        setEditId(null);
        fetchCompanies();
        fetchDashboard();
      } else {
        showError(res.message || 'Error occurred');
      }
    } catch (err: any) {
      showError(err.message || 'Submission error');
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanedForm = {
        ...contactForm,
        companyId: contactForm.companyId || null
      };
      const url = editId ? `/api/v1/erp/crm/contacts/${editId}` : '/api/v1/erp/crm/contacts';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedForm),
      });

      if (res.success) {
        showSuccess(editId ? 'Contact details updated' : 'Contact created');
        setActiveModal(null);
        setEditId(null);
        fetchContacts();
      } else {
        showError(res.message || 'Error occurred');
      }
    } catch (err: any) {
      showError(err.message || 'Submission error');
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleaned = {
        ...leadForm,
        companyId: leadForm.companyId || null,
        contactId: leadForm.contactId || null,
        assignedTo: leadForm.assignedTo || null
      };
      const url = editId ? `/api/v1/erp/crm/leads/${editId}` : '/api/v1/erp/crm/leads';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });

      if (res.success) {
        showSuccess(editId ? 'Lead updated' : 'New Lead recorded');
        setActiveModal(null);
        setEditId(null);
        fetchLeads();
        fetchDashboard();
      } else {
        showError(res.message || 'Error occurred');
      }
    } catch (err: any) {
      showError(err.message || 'Submission error');
    }
  };

  const handleOpportunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleaned = {
        ...opportunityForm,
        companyId: opportunityForm.companyId || null,
        contactId: opportunityForm.contactId || null,
        leadId: opportunityForm.leadId || null,
        assignedTo: opportunityForm.assignedTo || null,
        probability: Number(opportunityForm.probability)
      };
      const url = editId ? `/api/v1/erp/crm/opportunities/${editId}` : '/api/v1/erp/crm/opportunities';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });

      if (res.success) {
        showSuccess(editId ? 'Opportunity updated' : 'Opportunity deal logged');
        setActiveModal(null);
        setEditId(null);
        fetchOpportunities();
        fetchDashboard();
      } else {
        showError(res.message || 'Error occurred');
      }
    } catch (err: any) {
      showError(err.message || 'Submission error');
    }
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleaned = {
        ...activityForm,
        assignedTo: activityForm.assignedTo || null
      };
      const res = await fetchWithAuth('/api/v1/erp/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });

      if (res.success) {
        showSuccess('Activity logged on timelines');
        setActiveModal(null);
        fetchActivities();
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderForm.items.length === 0) {
      showError('You must select at least one product item');
      return;
    }

    try {
      const cleaned = {
        ...orderForm,
        companyId: orderForm.companyId || null,
        contactId: orderForm.contactId || null,
      };
      const res = await fetchWithAuth('/api/v1/erp/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
      });

      if (res.success) {
        showSuccess('Sales Quotation/Order created successfully!');
        setActiveModal(null);
        fetchSalesOrders();
        fetchDashboard();
      } else {
        showError(res.message || 'Error saving order');
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Convert Quotation / update order status
  const updateStatus = async (orderId: string, newStatus: string, warehouseId?: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/erp/sales/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, warehouseId })
      });
      if (res.success) {
        showSuccess(`Sales status updated to ${newStatus}`);
        fetchSalesOrders();
        fetchDashboard();
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Quick helper to auto-prepare delivery document or Invoice
  const prepareInvoice = async (salesOrderId: string) => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/sales/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId,
          status: 'draft',
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        })
      });
      if (res.success) {
        showSuccess(`Invoice draft INV-${res.data.id.substring(0,4).toUpperCase()} successfully created!`);
        fetchInvoices();
        setActiveSubTab('invoices');
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const prepareDelivery = async (salesOrderId: string, orderItems: any[]) => {
    try {
      const matchedWarehouseId = warehousesList[0]?.id || null;
      const res = await fetchWithAuth('/api/v1/erp/sales/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId,
          warehouseId: matchedWarehouseId,
          status: 'pending',
          shippedDate: new Date().toISOString().split('T')[0],
          notes: 'Auto prepared delivery receipt',
          items: orderItems.map((item: any) => ({
            salesOrderItemId: item.id,
            productId: item.productId || item.product_id,
            quantityShipped: item.quantity
          }))
        })
      });
      if (res.success) {
        showSuccess('Delivery shipment document logged!');
        fetchDeliveries();
        setActiveSubTab('deliveries');
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleInvoicePaid = async (invoiceId: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/erp/sales/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' })
      });
      if (res.success) {
        showSuccess('Invoice payment received and status set to Paid!');
        fetchInvoices();
        fetchDashboard();
      } else {
        showError(res.message);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Deletions
  const handleDelete = async (type: 'company' | 'contact' | 'lead' | 'opportunity' | 'order', id: string) => {
    if (!window.confirm(`Are you sure you want to remove this ${type}?`)) return;
    try {
      const path = type === 'company' ? 'crm/companies' :
                   type === 'contact' ? 'crm/contacts' :
                   type === 'lead' ? 'crm/leads' :
                   type === 'opportunity' ? 'crm/opportunities' : 'sales/orders';

      const res = await fetchWithAuth(`/api/v1/erp/${path}/${id}`, { method: 'DELETE' });
      if (res.success) {
        showSuccess(`${type} deleted successfully.`);
        if (type === 'company') fetchCompanies();
        if (type === 'contact') fetchContacts();
        if (type === 'lead') fetchLeads();
        if (type === 'opportunity') fetchOpportunities();
        if (type === 'order') fetchSalesOrders();
        fetchDashboard();
      } else {
        showError(res.message || 'Error during deletion');
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Helper selectors
  const getEntityLabel = (entityType: string, entityId: string) => {
    if (entityType === 'lead') {
      const l = leads.find(item => item.id === entityId);
      return l ? `Lead: ${l.title}` : entityId;
    }
    if (entityType === 'opportunity') {
      const o = opportunities.find(item => item.id === entityId);
      return o ? `Opp: ${o.title}` : entityId;
    }
    if (entityType === 'company') {
      const c = companies.find(item => item.id === entityId);
      return c ? `Company: ${c.name}` : entityId;
    }
    if (entityType === 'contact') {
      const ct = contacts.find(item => item.id === entityId);
      return ct ? `Contact: ${ct.firstName} ${ct.lastName}` : entityId;
    }
    return entityId;
  };

  return (
    <div className="space-y-6" id="sales-crm-manager-module">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#F4F1EA] pb-5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#2C2925] tracking-tight">Sales & CRM Suite</h2>
          <p className="text-xs text-[#7F7569] mt-1">
            Connected ERP Foundation, stock reserves, Kanban pipeline, order preparation and finance invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAllData()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#5C554E] hover:text-[#2C2925] bg-white border border-[#EBE5DA] rounded-lg shadow-2xs transition-all"
            title="Refresh database records"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync</span>
          </button>
          
          <button
            onClick={() => {
              if (activeSubTab === 'leads') {
                setLeadForm({ title: '', source: 'website', status: 'new', value: '0.00', notes: '', companyId: '', contactId: '', assignedTo: '' });
                setEditId(null);
                setActiveModal('lead');
              } else if (activeSubTab === 'accounts') {
                setCompanyForm({ name: '', industry: '', website: '', phone: '', email: '', address: '' });
                setEditId(null);
                setActiveModal('company');
              } else if (activeSubTab === 'pipeline') {
                setOpportunityForm({ title: '', companyId: '', contactId: '', leadId: '', stage: 'qualification', value: '0.00', probability: 20, expectedCloseDate: '', notes: '', assignedTo: '' });
                setEditId(null);
                setActiveModal('opportunity');
              } else if (activeSubTab === 'orders') {
                setOrderForm({
                  type: 'quotation',
                  companyId: '',
                  contactId: '',
                  orderDate: new Date().toISOString().split('T')[0],
                  expirationDate: '',
                  status: 'draft',
                  currency: 'USD',
                  paymentTerms: 'Net 30',
                  notes: '',
                  items: []
                });
                setActiveModal('order');
              } else if (activeSubTab === 'activities') {
                setActivityForm({ entityType: 'lead', entityId: '', type: 'note', title: '', description: '', status: 'completed', dueDate: '', assignedTo: '' });
                setActiveModal('activity');
              } else {
                showSuccess('Please navigate to respective tabs to create records directly');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#2C2925] hover:bg-[#443E38] rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New {activeSubTab === 'leads' ? 'Lead' : activeSubTab === 'accounts' ? 'Company Account' : activeSubTab === 'pipeline' ? 'Deal Opportunity' : activeSubTab === 'orders' ? 'Quote/Order' : 'Activity'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex border-b border-[#F4F1EA] overflow-x-auto gap-2">
        {(['dashboard', 'leads', 'accounts', 'pipeline', 'orders', 'deliveries', 'invoices', 'activities'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all capitalize cursor-pointer ${
              activeSubTab === tab
                ? 'border-[#2C2925] text-[#2C2925]'
                : 'border-transparent text-[#7F7569] hover:text-[#5C554E]'
            }`}
          >
            {tab === 'accounts' ? 'Companies & Contacts' : tab === 'pipeline' ? 'Sales Kanban' : tab}
          </button>
        ))}
      </div>

      {/* Module Loading Screen */}
      {loading && !dashboardData && (
        <div className="py-20 flex justify-center items-center">
          <RefreshCw className="w-6 h-6 animate-spin text-[#7F7569]" />
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: DASHBOARD
          ---------------------------------------------------- */}
      {activeSubTab === 'dashboard' && dashboardData && (
        <div className="space-y-6 animate-fadeIn" id="sales-dashboard-tab">
          
          {/* Bento-grid KPIs metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#F4F1EA] p-5 rounded-xl">
              <span className="text-xs text-[#7F7569] font-medium block">Confirmed Revenue</span>
              <div className="flex items-center gap-2 mt-2">
                <div className="p-2 bg-[#FAF8F5] rounded-lg text-[#2C2925]">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-[#2C2925]">${dashboardData.stats.grossRevenueCollected}</span>
              </div>
              <span className="text-xs text-green-700 font-semibold block mt-2">⭐ Real-time converted order total</span>
            </div>

            <div className="bg-white border border-[#F4F1EA] p-5 rounded-xl">
              <span className="text-xs text-[#7F7569] font-medium block">Pipeline Tied Value</span>
              <div className="flex items-center gap-2 mt-2">
                <div className="p-2 bg-[#FAF8F5] rounded-lg text-amber-800">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-[#2C2925]">${dashboardData.stats.salesPipelineTiedValue}</span>
              </div>
              <span className="text-xs text-[#7F7569] block mt-2">In current live opportunities</span>
            </div>

            <div className="bg-white border border-[#F4F1EA] p-5 rounded-xl">
              <span className="text-xs text-[#7F7569] font-medium block">Qualified Leads</span>
              <div className="flex items-center gap-2 mt-2">
                <div className="p-2 bg-[#FAF8F5] rounded-lg text-blue-800">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-[#2C2925]">{dashboardData.stats.totalLeadsCount}</span>
              </div>
              <span className="text-xs text-[#7F7569] block mt-2">Awaiting qualification</span>
            </div>

            <div className="bg-white border border-[#F4F1EA] p-5 rounded-xl">
              <span className="text-xs text-[#7F7569] font-medium block">Billing Invoices</span>
              <div className="flex items-center gap-2 mt-2">
                <div className="p-2 bg-[#FAF8F5] rounded-lg text-emerald-800">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-2xl font-bold text-[#2C2925]">{dashboardData.stats.invoicesPrepared}</span>
              </div>
              <span className="text-xs text-emerald-700 font-semibold block mt-2">Financial records ready</span>
            </div>
          </div>

          {/* Graphical Pipeline Stages Funnel & Top Customers bento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Opportunity pipeline stage visually custom-plotted */}
            <div className="bg-white border border-[#F4F1EA] p-6 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-[#2C2925]">Opportunity Pipeline Funnel</h3>
              <div className="space-y-3.5 pt-2">
                {Object.entries(dashboardData.funnel).map(([stage, count]: any) => {
                  const maxCount = Math.max(...(Object.values(dashboardData.funnel) as number[]), 1);
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-[#5C554E] capitalize">
                        <span>{stage}</span>
                        <span>{count} deals</span>
                      </div>
                      <div className="w-full bg-[#FAF8F5] h-3 rounded-full overflow-hidden border border-[#EBE5DA]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stage === 'won' ? 'bg-[#2C2925]' :
                            stage === 'lost' ? 'bg-red-300' :
                            stage === 'proposal' ? 'bg-[#5C554E]' : 'bg-[#E0DCD3]'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Best selling products catalog */}
            <div className="bg-white border border-[#F4F1EA] p-6 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-[#2C2925]">Best Selling Products</h3>
              {dashboardData.bestSellers.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#7F7569]">No products sold yet</div>
              ) : (
                <div className="divide-y divide-[#F4F1EA]">
                  {dashboardData.bestSellers.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-[#2C2925]">{item.name}</p>
                        <p className="text-[10px] text-[#7F7569]">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#2C2925]">{item.qty} Sold</p>
                        <p className="text-[10px] text-green-800 font-medium">${parseFloat(item.total).toFixed(2)} Revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Top customer directory contributions */}
          <div className="bg-white border border-[#F4F1EA] p-6 rounded-xl">
            <h3 className="text-sm font-bold text-[#2C2925] mb-4">Top Customers (By Revenue Contribution)</h3>
            {dashboardData.topCustomers.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#7F7569]">No recorded purchases yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData.topCustomers.map((cust: any, idx: number) => (
                  <div key={idx} className="p-4 bg-[#FAF8F5] border border-[#EBE5DA] rounded-lg flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-[#2C2925]">{cust.name}</p>
                      <p className="text-[10px] text-[#7F7569]">{cust.count} transactions</p>
                    </div>
                    <span className="text-xs font-black text-[#2C2925]">${parseFloat(cust.revenue).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          TAB: LEADS
          ---------------------------------------------------- */}
      {activeSubTab === 'leads' && (
        <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden animate-fadeIn" id="crm-leads-tab">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Acquired Raw Leads</h3>
            <span className="text-xs text-[#7F7569]">{leads.length} recorded leads</span>
          </div>

          {leads.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#7F7569]">
              No CRM leads recorded yet. Click "New Lead" above to log custom lead acquisitions.
            </div>
          ) : (
            <div className="divide-y divide-[#F4F1EA]">
              {leads.map((lead) => (
                <div key={lead.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAF8F5] transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#2C2925]">{lead.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lead.status === 'new' ? 'bg-amber-100 text-amber-800' :
                        lead.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                        lead.status === 'qualified' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7F7569]">
                      {lead.company && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          {lead.company.name}
                        </span>
                      )}
                      {lead.contact && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {lead.contact.firstName} {lead.contact.lastName}
                        </span>
                      )}
                      {lead.source && (
                        <span className="bg-[#FAF8F5] border border-[#EBE5DA] px-1.5 py-0.5 rounded text-[10px]">
                          Source: {lead.source}
                        </span>
                      )}
                      <span className="font-semibold text-green-800">
                        Value: ${parseFloat(lead.value || '0').toFixed(2)}
                      </span>
                    </div>
                    {lead.notes && (
                      <p className="text-xs text-[#7F7569] italic bg-[#FAF8F5] p-2 rounded mt-2">
                        "{lead.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    {lead.status !== 'qualified' && (
                      <button
                        onClick={() => {
                          setOpportunityForm({
                            title: `Opp for ${lead.title}`,
                            companyId: lead.companyId || '',
                            contactId: lead.contactId || '',
                            leadId: lead.id,
                            stage: 'qualification',
                            value: lead.value || '0.00',
                            probability: 20,
                            expectedCloseDate: '',
                            notes: lead.notes || '',
                            assignedTo: lead.assignedTo || ''
                          });
                          setActiveModal('opportunity');
                        }}
                        className="px-3 py-1 bg-[#2C2925] hover:bg-[#443E38] text-white text-[10px] font-bold rounded-md cursor-pointer shadow-2xs"
                      >
                        Convert to Deal
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setLeadForm({
                          title: lead.title,
                          source: lead.source || '',
                          status: lead.status || 'new',
                          value: lead.value || '0.00',
                          notes: lead.notes || '',
                          companyId: lead.companyId || '',
                          contactId: lead.contactId || '',
                          assignedTo: lead.assignedTo || ''
                        });
                        setEditId(lead.id);
                        setActiveModal('lead');
                      }}
                      className="p-1 text-[#7F7569] hover:text-[#2C2925]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete('lead', lead.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: COMPANIES & CONTACTS
          ---------------------------------------------------- */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-6 animate-fadeIn" id="crm-accounts-tab">
          
          {/* Companies List section */}
          <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Company Accounts</h3>
              <button
                onClick={() => {
                  setCompanyForm({ name: '', industry: '', website: '', phone: '', email: '', address: '' });
                  setEditId(null);
                  setActiveModal('company');
                }}
                className="text-xs font-bold text-[#2C2925] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Company
              </button>
            </div>

            {companies.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#7F7569]">No companies recorded.</div>
            ) : (
              <div className="divide-y divide-[#F4F1EA]">
                {companies.map((co) => (
                  <div key={co.id} className="p-4 flex justify-between items-center text-xs hover:bg-[#FAF8F5]">
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-[#2C2925]">{co.name}</p>
                      <p className="text-[#7F7569]">
                        Industry: {co.industry || 'General'} | Web: {co.website || 'N/A'} | Address: {co.address || 'N/A'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCompanyForm({
                            name: co.name,
                            industry: co.industry || '',
                            website: co.website || '',
                            phone: co.phone || '',
                            email: co.email || '',
                            address: co.address || ''
                          });
                          setEditId(co.id);
                          setActiveModal('company');
                        }}
                        className="p-1 text-[#7F7569] hover:text-[#2C2925]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('company', co.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contacts List section */}
          <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Contacts Directory</h3>
              <button
                onClick={() => {
                  setContactForm({ companyId: '', firstName: '', lastName: '', email: '', phone: '', jobTitle: '', status: 'active' });
                  setEditId(null);
                  setActiveModal('contact');
                }}
                className="text-xs font-bold text-[#2C2925] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Contact Person
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#7F7569]">No contact persons recorded.</div>
            ) : (
              <div className="divide-y divide-[#F4F1EA]">
                {contacts.map((c) => (
                  <div key={c.id} className="p-4 flex justify-between items-center text-xs hover:bg-[#FAF8F5]">
                    <div className="space-y-1">
                      <p className="font-bold text-[#2C2925]">
                        {c.firstName} {c.lastName} <span className="text-[10px] text-[#7F7569] font-normal">({c.jobTitle || 'Representative'})</span>
                      </p>
                      <div className="flex gap-4 text-[#7F7569]">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email || 'N/A'}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone || 'N/A'}</span>
                        {c.company && <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {c.company.name}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setContactForm({
                            companyId: c.companyId || '',
                            firstName: c.firstName,
                            lastName: c.lastName,
                            email: c.email || '',
                            phone: c.phone || '',
                            jobTitle: c.jobTitle || '',
                            status: c.status || 'active'
                          });
                          setEditId(c.id);
                          setActiveModal('contact');
                        }}
                        className="p-1 text-[#7F7569] hover:text-[#2C2925]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('contact', c.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          TAB: PIPELINE KANBAN BOARD
          ---------------------------------------------------- */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-4 animate-fadeIn" id="sales-kanban-tab">
          <div className="flex justify-between items-center bg-[#FAF8F5] border border-[#F4F1EA] p-3 rounded-lg text-xs text-[#7F7569]">
            <span>💡 Quick drag alternative: use card drop-downs to change status instantly. Deals tie directly to pipeline revenue estimation.</span>
            <span>{opportunities.length} Deals in stages</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(['qualification', 'proposal', 'negotiation', 'won', 'lost'] as const).map((stage) => {
              const items = opportunities.filter((o) => o.stage === stage);
              return (
                <div key={stage} className="bg-[#FAF8F5] border border-[#EBE5DA] rounded-xl p-3 flex flex-col min-h-[400px]">
                  <div className="flex justify-between items-center border-b border-[#EBE5DA] pb-2 mb-3">
                    <span className="text-xs font-bold text-[#2C2925] capitalize">{stage}</span>
                    <span className="bg-white border border-[#EBE5DA] text-[10px] px-2 py-0.5 rounded font-black text-[#5C554E]">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {items.map((opp) => (
                      <div key={opp.id} className="bg-white border border-[#F4F1EA] p-3 rounded-lg shadow-2xs hover:shadow-xs transition-all space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-[#2C2925] block leading-tight">{opp.title}</span>
                          <span className="text-[10px] text-[#7F7569] font-medium">{opp.probability}%</span>
                        </div>

                        <div className="text-[10px] text-[#7F7569] space-y-0.5">
                          {opp.company && <p className="flex items-center gap-1 font-semibold text-[#2C2925]">{opp.company.name}</p>}
                          {opp.expectedCloseDate && <p>Exp Close: {opp.expectedCloseDate}</p>}
                          <p className="text-green-800 font-bold mt-1 text-xs">${parseFloat(opp.value || '0').toFixed(2)}</p>
                        </div>

                        {/* Dropdown status changer (no drag-drop lag) */}
                        <div className="pt-2 border-t border-[#F4F1EA] flex justify-between items-center gap-1">
                          <select
                            value={opp.stage}
                            onChange={async (e) => {
                              try {
                                const res = await fetchWithAuth(`/api/v1/erp/crm/opportunities/${opp.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    ...opp,
                                    stage: e.target.value
                                  })
                                });
                                if (res.success) {
                                  showSuccess('Stage modified successfully');
                                  fetchOpportunities();
                                  fetchDashboard();
                                }
                              } catch (err) {}
                            }}
                            className="bg-[#FAF8F5] text-[10px] border border-[#EBE5DA] rounded p-1 font-semibold text-[#5C554E]"
                          >
                            <option value="qualification">Qualification</option>
                            <option value="proposal">Proposal</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>

                          {opp.stage === 'won' && (
                            <button
                              onClick={() => {
                                // Populate quote form directly from opportunity
                                setOrderForm({
                                  type: 'quotation',
                                  companyId: opp.companyId || '',
                                  contactId: opp.contactId || '',
                                  orderDate: new Date().toISOString().split('T')[0],
                                  expirationDate: '',
                                  status: 'draft',
                                  currency: 'USD',
                                  paymentTerms: 'Net 30',
                                  notes: `Converted from Deal Opportunity: ${opp.title}`,
                                  items: []
                                });
                                setActiveModal('order');
                              }}
                              className="px-2 py-1 bg-green-800 hover:bg-green-900 text-white rounded text-[9px] font-bold"
                              title="Convert to Sales Quote"
                            >
                              Quote
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="py-8 text-center text-[10px] text-[#7F7569] italic">Empty stage</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: QUOTATIONS & SALES ORDERS
          ---------------------------------------------------- */}
      {activeSubTab === 'orders' && (
        <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden animate-fadeIn" id="sales-orders-tab">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Quotations & Orders</h3>
            <span className="text-xs text-[#7F7569]">{salesOrders.length} documents</span>
          </div>

          {salesOrders.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#7F7569]">
              No documents created yet. Choose "New Quote/Order" from top right to construct quotes directly with product catalog.
            </div>
          ) : (
            <div className="divide-y divide-[#F4F1EA]">
              {salesOrders.map((so) => (
                <div key={so.id} className="p-5 hover:bg-[#FAF8F5] transition-all space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#2C2925]">{so.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          so.type === 'sales_order' ? 'bg-[#2C2925] text-white' : 'bg-[#FAF8F5] border border-[#EBE5DA] text-[#5C554E]'
                        }`}>
                          {so.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                          so.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          so.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          so.status === 'invoiced' ? 'bg-indigo-100 text-indigo-800' :
                          so.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {so.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#7F7569]">
                        Order Date: {so.orderDate} | Currency: {so.currency} | Terms: {so.paymentTerms || 'Net 30'}
                      </p>
                      {so.company && <p className="text-xs font-bold text-[#2C2925] flex items-center gap-1 mt-1">🏢 {so.company.name}</p>}
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="text-base font-black text-[#2C2925]">${parseFloat(so.totalAmount || '0').toFixed(2)}</span>
                      <span className="text-[10px] text-[#7F7569]">Tax: ${so.taxAmount} | Disc: ${so.discountAmount}</span>
                    </div>
                  </div>

                  {/* Render Sales Order Items detail grid */}
                  <div className="bg-[#FAF8F5] border border-[#EBE5DA] rounded-lg p-3 space-y-2">
                    <span className="text-[10px] font-bold text-[#7F7569] uppercase tracking-wider block">Ordered Products</span>
                    <div className="divide-y divide-[#EBE5DA]">
                      {so.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between py-1.5 text-xs">
                          <span>
                            {item.product?.name || 'Product Item'} <span className="text-[10px] text-[#7F7569]">x{item.quantity}</span>
                          </span>
                          <span className="font-semibold text-[#2C2925]">${parseFloat(item.totalAmount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operational Order Workflows */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F4F1EA]">
                    <div className="flex items-center gap-1.5">
                      {so.status === 'draft' && (
                        <button
                          onClick={() => updateStatus(so.id, 'sent')}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#FAF8F5] border border-[#EBE5DA] hover:bg-[#FAF8F5] rounded text-[#5C554E]"
                        >
                          Mark Sent
                        </button>
                      )}
                      
                      {/* Confirming reserves stocks */}
                      {(so.status === 'draft' || so.status === 'sent') && (
                        <button
                          onClick={() => {
                            const whId = warehousesList[0]?.id;
                            if (!whId) {
                              showError('Create a warehouse first under Branch settings before confirming stock allocations.');
                              return;
                            }
                            updateStatus(so.id, 'confirmed', whId);
                          }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#2C2925] hover:bg-[#443E38] text-white rounded"
                        >
                          Confirm & Reserve Stock
                        </button>
                      )}

                      {/* Prepared delivery receipt */}
                      {so.status === 'confirmed' && (
                        <button
                          onClick={() => prepareDelivery(so.id, so.items)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#FAF8F5] border border-[#EBE5DA] text-blue-800 rounded flex items-center gap-1"
                        >
                          <Truck className="w-3 h-3" /> Ship Dispatch
                        </button>
                      )}

                      {/* Invoice creation */}
                      {(so.status === 'confirmed' || so.status === 'delivered') && (
                        <button
                          onClick={() => prepareInvoice(so.id)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-[#FAF8F5] border border-[#EBE5DA] text-green-800 rounded flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> Prepare Invoice
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete('order', so.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: DELIVERY ORDERS (LOGISTICS)
          ---------------------------------------------------- */}
      {activeSubTab === 'deliveries' && (
        <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden animate-fadeIn" id="sales-deliveries-tab">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Logistics Delivery Orders</h3>
            <span className="text-xs text-[#7F7569]">{deliveries.length} shipments pending</span>
          </div>

          {deliveries.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#7F7569]">
              No physical shipments triggered yet. Confirm a Sales Order first to generate dispatch papers.
            </div>
          ) : (
            <div className="divide-y divide-[#F4F1EA]">
              {deliveries.map((del) => (
                <div key={del.id} className="p-5 hover:bg-[#FAF8F5] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-sm text-[#2C2925]">{del.deliveryNumber}</p>
                      <p className="text-[#7F7569]">
                        Order Reference: {del.salesOrder?.orderNumber || 'SO'} | Shipped Date: {del.shippedDate || 'N/A'}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-[4px] text-[10px] font-extrabold capitalize">
                      {del.status}
                    </span>
                  </div>

                  <div className="bg-[#FAF8F5] border border-[#EBE5DA] rounded-lg p-3 text-xs">
                    <p className="font-bold text-[#2C2925] mb-2">Package Items Content:</p>
                    {del.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] py-1">
                        <span>{item.product?.name || 'Item'}</span>
                        <span className="font-bold text-[#2C2925]">{item.quantityShipped || item.quantity_shipped} Shipped</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: INVOICES & FINANCE BILLING
          ---------------------------------------------------- */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white border border-[#F4F1EA] rounded-xl overflow-hidden animate-fadeIn" id="sales-invoices-tab">
          <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
            <h3 className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Invoices & Billing Registry</h3>
            <span className="text-xs text-[#7F7569]">{invoices.length} invoices issued</span>
          </div>

          {invoices.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#7F7569]">
              No finance invoices created. Invoices can be drafted quickly from confirmed sales orders list.
            </div>
          ) : (
            <div className="divide-y divide-[#F4F1EA]">
              {invoices.map((inv) => (
                <div key={inv.id} className="p-5 hover:bg-[#FAF8F5] space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-sm text-[#2C2925]">{inv.invoiceNumber}</p>
                      <p className="text-[#7F7569]">
                        Issue Date: {inv.issueDate} | Due Date: {inv.dueDate || 'N/A'} | Order: {inv.salesOrder?.orderNumber || 'SO'}
                      </p>
                      {inv.company && <p className="font-bold text-[#2C2925] mt-1">🏢 {inv.company.name}</p>}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-base font-black text-[#2C2925] block">${parseFloat(inv.totalAmount || '0').toFixed(2)}</span>
                        <span className="text-[10px] text-[#7F7569]">VAT/Taxes: ${inv.taxAmount}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>

                  {inv.status !== 'paid' && (
                    <div className="pt-2 border-t border-[#F4F1EA] flex justify-end">
                      <button
                        onClick={() => handleInvoicePaid(inv.id)}
                        className="px-3 py-1 bg-[#2C2925] hover:bg-[#443E38] text-white text-[10px] font-bold rounded"
                      >
                        Mark as Paid
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          TAB: CRM ACTIVITIES & CHRONOLOGICAL TIMELINE
          ---------------------------------------------------- */}
      {activeSubTab === 'activities' && (
        <div className="space-y-6 animate-fadeIn" id="crm-timeline-tab">
          
          {/* Quick logger widget */}
          <div className="bg-white border border-[#F4F1EA] p-5 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-[#2C2925]">Log Call, Task or Note</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={activityForm.entityType}
                onChange={(e) => setActivityForm({ ...activityForm, entityType: e.target.value as any, entityId: '' })}
                className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925]"
              >
                <option value="lead">Link to Lead</option>
                <option value="opportunity">Link to Opportunity</option>
                <option value="company">Link to Company</option>
              </select>

              <select
                value={activityForm.entityId}
                onChange={(e) => setActivityForm({ ...activityForm, entityId: e.target.value })}
                className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925]"
              >
                <option value="">-- Choose Entity target --</option>
                {activityForm.entityType === 'lead' && leads.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                {activityForm.entityType === 'opportunity' && opportunities.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
                {activityForm.entityType === 'company' && companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925]"
              >
                <option value="note">📝 Local Note / Observation</option>
                <option value="call">📞 Telephone Call Log</option>
                <option value="meeting">🤝 Client Meeting</option>
                <option value="email">✉️ Sent/Received Email Log</option>
                <option value="task">⏰ Upcoming Task</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Short title / outcome summary"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925]"
              />
              <input
                type="date"
                value={activityForm.dueDate}
                onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })}
                className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925]"
              />
            </div>

            <textarea
              placeholder="Provide details of transaction conversation notes..."
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="bg-white border border-[#EBE5DA] p-2 rounded text-xs text-[#2C2925] w-full h-20"
            />

            <button
              onClick={handleActivitySubmit}
              disabled={!activityForm.entityId || !activityForm.title}
              className="px-4 py-2 bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold rounded-lg disabled:opacity-50"
            >
              Log Activity on Timeline
            </button>
          </div>

          {/* Interactive Timeline Feed */}
          <div className="bg-white border border-[#F4F1EA] p-6 rounded-xl space-y-6">
            <h3 className="text-sm font-bold text-[#2C2925]">Chronological Interaction Timeline</h3>
            {activities.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#7F7569] italic">No activities logged on timeline yet.</div>
            ) : (
              <div className="relative border-l-2 border-[#F4F1EA] ml-3 pl-6 space-y-6">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    {/* Dot Indicator */}
                    <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#2C2925] flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2C2925]" />
                    </span>

                    <div className="space-y-1 bg-[#FAF8F5] p-3 border border-[#EBE5DA] rounded-lg">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#2C2925] capitalize">{act.type} Logged</span>
                        <span className="text-[10px] text-[#7F7569]">{new Date(act.createdAt || act.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#2C2925]">{act.title}</p>
                      {act.description && <p className="text-xs text-[#7F7569] italic">"{act.description}"</p>}
                      <div className="pt-2 flex justify-between items-center text-[10px] text-[#7F7569] border-t border-[#EBE5DA] mt-2">
                        <span>Target: {getEntityLabel(act.entityType, act.entityId)}</span>
                        {act.dueDate && <span>Due Date: {act.dueDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: ADD/EDIT CRM COMPANY
          ---------------------------------------------------- */}
      {activeModal === 'company' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-[#F4F1EA] max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2C2925] uppercase">{editId ? 'Edit CRM Account' : 'Add CRM Company Account'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#7F7569] hover:text-[#2C2925]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCompanySubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Industry</label>
                  <input
                    type="text"
                    value={companyForm.industry}
                    onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Website URL</label>
                  <input
                    type="text"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Telephone</label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Email</label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Physical Address</label>
                <textarea
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925] h-16"
                />
              </div>

              <button type="submit" className="w-full bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold p-2.5 rounded-lg">
                Save Company Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: ADD/EDIT CRM CONTACT
          ---------------------------------------------------- */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-[#F4F1EA] max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2C2925] uppercase">{editId ? 'Edit Contact Person' : 'Create Contact Representative'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#7F7569] hover:text-[#2C2925]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleContactSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">First Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.firstName}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Last Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.lastName}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Affiliated Company / Client Account</label>
                <select
                  value={contactForm.companyId}
                  onChange={(e) => setContactForm({ ...contactForm, companyId: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                >
                  <option value="">No affiliation (Standalone contact)</option>
                  {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Representative Title</label>
                  <input
                    type="text"
                    value={contactForm.jobTitle}
                    onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Rep Phone</label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Rep Email Address</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                />
              </div>

              <button type="submit" className="w-full bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold p-2.5 rounded-lg">
                Save Contact details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: CREATE/EDIT CRM LEAD
          ---------------------------------------------------- */}
      {activeModal === 'lead' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-[#F4F1EA] max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2C2925] uppercase">{editId ? 'Modify Acquisition Lead' : 'Log New Lead Acquisition'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#7F7569] hover:text-[#2C2925]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleLeadSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Lead Title Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100x office workstations"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Estimated Deal Value ($)</label>
                  <input
                    type="text"
                    required
                    value={leadForm.value}
                    onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Lead Origin Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="website">Website Portal</option>
                    <option value="referral">Direct Referral</option>
                    <option value="cold_call">Cold Call Outbound</option>
                    <option value="event">Industry Event</option>
                    <option value="advertising">Paid Campaigns</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Link Company</label>
                  <select
                    value={leadForm.companyId}
                    onChange={(e) => setLeadForm({ ...leadForm, companyId: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="">-- Standalone --</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Link Contact Rep</label>
                  <select
                    value={leadForm.contactId}
                    onChange={(e) => setLeadForm({ ...leadForm, contactId: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="">-- Standalone --</option>
                    {contacts.map(ct => <option key={ct.id} value={ct.id}>{ct.firstName} {ct.lastName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Acquisition Status</label>
                <select
                  value={leadForm.status}
                  onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as any })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                >
                  <option value="new">New lead</option>
                  <option value="contacted">Contacted / Pitching</option>
                  <option value="qualified">Qualified</option>
                  <option value="unqualified">Unqualified / Lost</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Lead Notes</label>
                <textarea
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925] h-16"
                />
              </div>

              <button type="submit" className="w-full bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold p-2.5 rounded-lg">
                Log Acquisition Lead
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: CREATE/EDIT OPPORTUNITY DEAL
          ---------------------------------------------------- */}
      {activeModal === 'opportunity' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg border border-[#F4F1EA] max-w-md w-full overflow-hidden animate-scaleIn">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2C2925] uppercase">Log Pipeline Deal Opportunity</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#7F7569] hover:text-[#2C2925]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleOpportunitySubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Opportunity Deal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise CRM rollout proposal"
                  value={opportunityForm.title}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Link Company</label>
                  <select
                    value={opportunityForm.companyId}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, companyId: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="">-- Choose Account --</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Expected Value ($)</label>
                  <input
                    type="text"
                    required
                    value={opportunityForm.value}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, value: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Stage</label>
                  <select
                    value={opportunityForm.stage}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, stage: e.target.value as any })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="qualification">Qualification</option>
                    <option value="proposal">Proposal Out</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="won">Won Deal</option>
                    <option value="lost">Lost Deal</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={opportunityForm.probability}
                    onChange={(e) => setOpportunityForm({ ...opportunityForm, probability: Number(e.target.value) })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Expected Target Close Date</label>
                <input
                  type="date"
                  value={opportunityForm.expectedCloseDate}
                  onChange={(e) => setOpportunityForm({ ...opportunityForm, expectedCloseDate: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                />
              </div>

              <button type="submit" className="w-full bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold p-2.5 rounded-lg">
                Log Deal Opportunity
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MODAL: QUOTATION & SALES ORDER BUILDER
          ---------------------------------------------------- */}
      {activeModal === 'order' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg border border-[#F4F1EA] max-w-2xl w-full overflow-hidden animate-scaleIn my-8">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#F4F1EA] flex justify-between items-center">
              <h3 className="text-xs font-black text-[#2C2925] uppercase">Quotation & Sales Order Builder</h3>
              <button onClick={() => setActiveModal(null)} className="text-[#7F7569] hover:text-[#2C2925]"><X className="w-4 h-4" /></button>
            </div>
            
            <form onSubmit={handleOrderSubmit} className="p-4 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Document Type</label>
                  <select
                    value={orderForm.type}
                    onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value as any })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="quotation">Sales Quotation (Estimate)</option>
                    <option value="sales_order">Sales Order (Confirmed contract)</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Client Company</label>
                  <select
                    value={orderForm.companyId}
                    onChange={(e) => setOrderForm({ ...orderForm, companyId: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="">-- Standalone Client --</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Order Date</label>
                  <input
                    type="date"
                    required
                    value={orderForm.orderDate}
                    onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Validity / Expiry Date</label>
                  <input
                    type="date"
                    value={orderForm.expirationDate}
                    onChange={(e) => setOrderForm({ ...orderForm, expirationDate: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Currency</label>
                  <select
                    value={orderForm.currency}
                    onChange={(e) => setOrderForm({ ...orderForm, currency: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Payment Terms</label>
                  <input
                    type="text"
                    value={orderForm.paymentTerms}
                    onChange={(e) => setOrderForm({ ...orderForm, paymentTerms: e.target.value })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                    placeholder="e.g. Net 30, COD"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#7F7569] uppercase">Initial Status</label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as any })}
                    className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925]"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent to client</option>
                  </select>
                </div>
              </div>

              {/* Real Inventory Product Selection & Dynamic Pricing */}
              <div className="border-t border-[#F4F1EA] pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#2C2925] uppercase tracking-wider">Item Catalog List</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderForm({
                        ...orderForm,
                        items: [...orderForm.items, { productId: '', variantId: null, quantity: 1, unitPrice: '0.00', discountAmount: '0.00', taxAmount: '0.00' }]
                      });
                    }}
                    className="text-[10px] font-bold text-white bg-[#2C2925] px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Product Line
                  </button>
                </div>

                <div className="space-y-2.5">
                  {orderForm.items.map((item, index) => (
                    <div key={index} className="bg-[#FAF8F5] border border-[#EBE5DA] p-3 rounded-lg grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                      
                      {/* Product Selector */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-[#7F7569] uppercase">Product from Inventory</label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => {
                            const prodId = e.target.value;
                            const matchedProd = productsList.find(p => p.id === prodId);
                            const updated = [...orderForm.items];
                            updated[index] = {
                              ...updated[index],
                              productId: prodId,
                              unitPrice: matchedProd ? parseFloat(matchedProd.sellingPrice || '0').toFixed(2) : '0.00'
                            };
                            setOrderForm({ ...orderForm, items: updated });
                          }}
                          className="w-full bg-white border border-[#EBE5DA] rounded p-1 text-xs text-[#2C2925]"
                        >
                          <option value="">-- Pick Product --</option>
                          {productsList.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#7F7569] uppercase">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...orderForm.items];
                            updated[index].quantity = Number(e.target.value);
                            setOrderForm({ ...orderForm, items: updated });
                          }}
                          className="w-full bg-white border border-[#EBE5DA] rounded p-1 text-xs text-[#2C2925]"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#7F7569] uppercase">Unit Price</label>
                        <input
                          type="text"
                          required
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...orderForm.items];
                            updated[index].unitPrice = e.target.value;
                            setOrderForm({ ...orderForm, items: updated });
                          }}
                          className="w-full bg-white border border-[#EBE5DA] rounded p-1 text-xs text-[#2C2925]"
                        />
                      </div>

                      {/* Line discount / Taxes */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#7F7569] uppercase">Tax ($)</label>
                        <input
                          type="text"
                          value={item.taxAmount}
                          onChange={(e) => {
                            const updated = [...orderForm.items];
                            updated[index].taxAmount = e.target.value;
                            setOrderForm({ ...orderForm, items: updated });
                          }}
                          className="w-full bg-white border border-[#EBE5DA] rounded p-1 text-xs text-[#2C2925]"
                        />
                      </div>

                      <div className="flex gap-1 items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = orderForm.items.filter((_, i) => i !== index);
                            setOrderForm({ ...orderForm, items: updated });
                          }}
                          className="p-1 text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#7F7569] uppercase">Internal Notes & Remarks</label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full bg-white border border-[#EBE5DA] rounded p-2 text-xs text-[#2C2925] h-12"
                />
              </div>

              <button type="submit" className="w-full bg-[#2C2925] hover:bg-[#443E38] text-white text-xs font-bold p-2.5 rounded-lg">
                Generate Quotation/Order Document
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
