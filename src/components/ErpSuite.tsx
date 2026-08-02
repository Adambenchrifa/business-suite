import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  MapPin,
  Warehouse,
  Briefcase,
  Users,
  FolderOpen,
  Send,
  Scroll,
  Bell,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  Globe,
  Settings,
  DollarSign,
  Percent,
  Calendar,
  Layers,
  FileText,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  AlertCircle,
  Boxes
} from 'lucide-react';
import { InventoryManager } from './InventoryManager';
import { SalesCrmManager } from './SalesCrmManager';

interface ErpSuiteProps {
  token: string;
  tenantDomain: string;
  user: { id: string; email: string; name: string; role: string };
}

export function ErpSuite({ token, tenantDomain, user }: ErpSuiteProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'organization' | 'branches' | 'hr' | 'invitations' | 'files' | 'logs' | 'inventory' | 'sales-crm'>('overview');

  // Global Alerts
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // States for Organization Info
  const [org, setOrg] = useState<any>(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    taxId: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    baseCurrency: 'USD',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    language: 'en'
  });

  // States for Branches & Warehouses
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [branchSearch, setBranchSearch] = useState('');
  const [branchStatusFilter, setBranchStatusFilter] = useState('');
  const [branchForm, setBranchForm] = useState({ id: '', name: '', code: '', address: '', phone: '', email: '', status: 'active' });
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showWhModal, setShowWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ id: '', branchId: '', name: '', code: '', address: '', status: 'active' });

  // States for HR (Departments, Positions, Employees)
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [positionsList, setPositionsList] = useState<any[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  
  // Search and Pagination for HR
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [empPage, setEmpPage] = useState(1);
  const [empTotalPages, setEmpTotalPages] = useState(1);

  // Modals and Forms for HR
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ id: '', name: '', code: '', managerName: '' });
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [positionForm, setPositionForm] = useState({ id: '', title: '', departmentId: '', grade: '', salaryRange: '' });
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ id: '', firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '', salary: '', hireDate: '', status: 'active' });

  // Invitations
  const [invitationsList, setInvitationsList] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'member' });

  // Settings: Currencies, Taxes, Number sequences
  const [currenciesList, setCurrenciesList] = useState<any[]>([]);
  const [taxesList, setTaxesList] = useState<any[]>([]);
  const [sequencesList, setSequencesList] = useState<any[]>([]);
  
  const [showCurrencyForm, setShowCurrencyForm] = useState(false);
  const [currencyForm, setCurrencyForm] = useState({ id: '', code: '', name: '', symbol: '', exchangeRate: '1.0', isBase: false, status: 'active' });
  
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxForm, setTaxForm] = useState({ id: '', name: '', rate: '', code: '', description: '', status: 'active' });

  // File Storage
  const [filesList, setFilesList] = useState<any[]>([]);
  const [uploadForm, setUploadForm] = useState({ filename: '', fileSize: 102400, mimeType: 'application/pdf' });

  // Audit Logs
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [logModuleFilter, setLogModuleFilter] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  // Notifications
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  // ----------------------------------------------------
  // API REQUISITIONS BRIDGE
  // ----------------------------------------------------
  const apiHeaders = {
    'Content-Type': 'application/json',
    'x-tenant-domain': tenantDomain,
    'Authorization': `Bearer ${token}`
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const fetchWithAuth = async (url: string, options: any = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...apiHeaders, ...options.headers }
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error?.message || 'API request failed');
    }
    return data;
  };

  // ----------------------------------------------------
  // DATA PRE-LOADERS
  // ----------------------------------------------------
  const loadOrganization = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/organization');
      if (res.success && res.data) {
        setOrg(res.data);
        setOrgForm({
          name: res.data.name || '',
          taxId: res.data.taxId || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          website: res.data.website || '',
          address: res.data.address || '',
          baseCurrency: res.data.baseCurrency || 'USD',
          timezone: res.data.timezone || 'UTC',
          dateFormat: res.data.dateFormat || 'YYYY-MM-DD',
          language: res.data.language || 'en'
        });
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadBranchesAndWarehouses = async () => {
    try {
      const bRes = await fetchWithAuth(`/api/v1/erp/branches?search=${branchSearch}&status=${branchStatusFilter}`);
      setBranchesList(bRes.data || []);
      const wRes = await fetchWithAuth('/api/v1/erp/warehouses');
      setWarehousesList(wRes.data || []);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadHRData = async () => {
    try {
      const dRes = await fetchWithAuth('/api/v1/erp/departments');
      setDepartmentsList(dRes.data || []);
      const pRes = await fetchWithAuth('/api/v1/erp/positions');
      setPositionsList(pRes.data || []);
      const eRes = await fetchWithAuth(`/api/v1/erp/employees?search=${empSearch}&departmentId=${empDeptFilter}&page=${empPage}&limit=6`);
      setEmployeesList(eRes.data || []);
      setEmpTotalPages(eRes.meta?.totalPages || 1);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadSettingsData = async () => {
    try {
      const cRes = await fetchWithAuth('/api/v1/erp/currencies');
      setCurrenciesList(cRes.data || []);
      const tRes = await fetchWithAuth('/api/v1/erp/taxes');
      setTaxesList(tRes.data || []);
      const sRes = await fetchWithAuth('/api/v1/erp/sequences');
      setSequencesList(sRes.data || []);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadInvitations = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/invitations');
      setInvitationsList(res.data || []);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadFiles = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/files');
      setFilesList(res.data || []);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetchWithAuth(`/api/v1/erp/logs?module=${logModuleFilter}&page=${logPage}&limit=10`);
      setAuditLogsList(res.data || []);
      setLogTotalPages(res.meta?.totalPages || 1);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/erp/notifications');
      setNotificationsList(res.data || []);
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Run initial loaders based on active Tab
  useEffect(() => {
    loadNotifications();
    if (activeTab === 'overview') {
      loadOrganization();
      loadBranchesAndWarehouses();
      loadHRData();
      loadInvitations();
    } else if (activeTab === 'organization') {
      loadOrganization();
      loadSettingsData();
    } else if (activeTab === 'branches') {
      loadBranchesAndWarehouses();
    } else if (activeTab === 'hr') {
      loadHRData();
    } else if (activeTab === 'invitations') {
      loadInvitations();
    } else if (activeTab === 'files') {
      loadFiles();
    } else if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab, branchSearch, branchStatusFilter, empSearch, empDeptFilter, empPage, logModuleFilter, logPage]);

  // ----------------------------------------------------
  // SUBMIT HANDLERS
  // ----------------------------------------------------

  // Organization update
  const handleOrgSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/v1/erp/organization', {
        method: 'PUT',
        body: JSON.stringify(orgForm)
      });
      showSuccess('Organization configuration successfully updated');
      loadOrganization();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Branches CRUD
  const handleBranchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!branchForm.id;
      const url = isEdit ? `/api/v1/erp/branches/${branchForm.id}` : '/api/v1/erp/branches';
      const method = isEdit ? 'PUT' : 'POST';
      
      await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: branchForm.name,
          code: branchForm.code,
          address: branchForm.address,
          phone: branchForm.phone,
          email: branchForm.email,
          status: branchForm.status
        })
      });

      showSuccess(`Branch successfully ${isEdit ? 'updated' : 'created'}`);
      setShowBranchModal(false);
      setBranchForm({ id: '', name: '', code: '', address: '', phone: '', email: '', status: 'active' });
      loadBranchesAndWarehouses();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteBranch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/branches/${id}`, { method: 'DELETE' });
      showSuccess('Branch successfully deleted');
      loadBranchesAndWarehouses();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Warehouses CRUD
  const handleWhSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!whForm.id;
      const url = isEdit ? `/api/v1/erp/warehouses/${whForm.id}` : '/api/v1/erp/warehouses';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          branchId: whForm.branchId,
          name: whForm.name,
          code: whForm.code,
          address: whForm.address,
          status: whForm.status
        })
      });

      showSuccess(`Warehouse successfully ${isEdit ? 'updated' : 'created'}`);
      setShowWhModal(false);
      setWhForm({ id: '', branchId: '', name: '', code: '', address: '', status: 'active' });
      loadBranchesAndWarehouses();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteWarehouse = async (id: string) => {
    if (!confirm('Are you sure you want to delete this warehouse?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/warehouses/${id}`, { method: 'DELETE' });
      showSuccess('Warehouse deleted');
      loadBranchesAndWarehouses();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // HR CRUD (Departments)
  const handleDeptSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!deptForm.id;
      const url = isEdit ? `/api/v1/erp/departments/${deptForm.id}` : '/api/v1/erp/departments';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(deptForm)
      });

      showSuccess(`Department ${isEdit ? 'updated' : 'created'}`);
      setShowDeptModal(false);
      setDeptForm({ id: '', name: '', code: '', managerName: '' });
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? All linked employees will be updated.')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/departments/${id}`, { method: 'DELETE' });
      showSuccess('Department deleted');
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // HR CRUD (Positions)
  const handlePositionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!positionForm.id;
      const url = isEdit ? `/api/v1/erp/positions/${positionForm.id}` : '/api/v1/erp/positions';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(positionForm)
      });

      showSuccess(`Position successfully ${isEdit ? 'updated' : 'created'}`);
      setShowPositionModal(false);
      setPositionForm({ id: '', title: '', departmentId: '', grade: '', salaryRange: '' });
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deletePosition = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/positions/${id}`, { method: 'DELETE' });
      showSuccess('Position deleted');
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // HR CRUD (Employees)
  const handleEmployeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!employeeForm.id;
      const url = isEdit ? `/api/v1/erp/employees/${employeeForm.id}` : '/api/v1/erp/employees';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          firstName: employeeForm.firstName,
          lastName: employeeForm.lastName,
          email: employeeForm.email,
          phone: employeeForm.phone || null,
          departmentId: employeeForm.departmentId || null,
          positionId: employeeForm.positionId || null,
          salary: employeeForm.salary || null,
          hireDate: employeeForm.hireDate || null,
          status: employeeForm.status
        })
      });

      showSuccess(`Employee Profile ${isEdit ? 'updated' : 'created with dynamic sequencing'}`);
      setShowEmployeeModal(false);
      setEmployeeForm({ id: '', firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '', salary: '', hireDate: '', status: 'active' });
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to terminate/delete this employee profile?')) return;
    try {
      await fetchWithAuth(`/api/v1/erp/employees/${id}`, { method: 'DELETE' });
      showSuccess('Employee profile successfully removed');
      loadHRData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // User Invitations
  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/api/v1/erp/invitations', {
        method: 'POST',
        body: JSON.stringify(inviteForm)
      });
      showSuccess(`Invitation successfully generated for ${inviteForm.name}`);
      setInviteForm({ email: '', name: '', role: 'member' });
      loadInvitations();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteInvite = async (id: string) => {
    try {
      await fetchWithAuth(`/api/v1/erp/invitations/${id}`, { method: 'DELETE' });
      showSuccess('Invitation canceled');
      loadInvitations();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Currencies CRUD
  const handleCurrencySubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!currencyForm.id;
      const url = isEdit ? `/api/v1/erp/currencies/${currencyForm.id}` : '/api/v1/erp/currencies';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(currencyForm)
      });

      showSuccess(`Currency successfully configuration changed`);
      setShowCurrencyForm(false);
      setCurrencyForm({ id: '', code: '', name: '', symbol: '', exchangeRate: '1.0', isBase: false, status: 'active' });
      loadSettingsData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Taxes CRUD
  const handleTaxSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!taxForm.id;
      const url = isEdit ? `/api/v1/erp/taxes/${taxForm.id}` : '/api/v1/erp/taxes';
      const method = isEdit ? 'PUT' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(taxForm)
      });

      showSuccess(`Tax rate ${isEdit ? 'updated' : 'configured'}`);
      setShowTaxForm(false);
      setTaxForm({ id: '', name: '', rate: '', code: '', description: '', status: 'active' });
      loadSettingsData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // File Upload
  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!uploadForm.filename) return;
    try {
      await fetchWithAuth('/api/v1/erp/files', {
        method: 'POST',
        body: JSON.stringify(uploadForm)
      });
      showSuccess(`Simulated uploading and registering: ${uploadForm.filename}`);
      setUploadForm({ filename: '', fileSize: 102400, mimeType: 'application/pdf' });
      loadFiles();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteFile = async (id: string) => {
    try {
      await fetchWithAuth(`/api/v1/erp/files/${id}`, { method: 'DELETE' });
      showSuccess('File removed');
      loadFiles();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Mark notification read
  const markNotificationRead = async (id: string) => {
    try {
      await fetchWithAuth(`/api/v1/erp/notifications/${id}/read`, { method: 'PUT' });
      loadNotifications();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await fetchWithAuth('/api/v1/erp/notifications/read-all', { method: 'PUT' });
      loadNotifications();
      showSuccess('All notifications marked as read');
    } catch (err: any) {
      showError(err.message);
    }
  };

  return (
    <div className="w-full bg-[#FDFBF7] text-[#2C2925] flex flex-col md:flex-row min-h-[calc(100vh-140px)] gap-6 rounded-xl border border-[#EBE5DA] p-4 md:p-6 shadow-sm overflow-hidden">
      
      {/* ----------------------------------------------------
          ERP NAVIGATION SIDEBAR
          ---------------------------------------------------- */}
      <aside className="w-full md:w-64 flex flex-col gap-2 bg-white p-4 rounded-xl border border-[#EBE5DA] h-fit shadow-xs">
        <div className="px-3 py-2 mb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">ERP Core Modules</h3>
          <p className="text-[10px] text-[#A19588] font-semibold uppercase">Multi-Tenant isolated</p>
        </div>
        
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'overview' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>General Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('organization')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'organization' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings & Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'branches' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Branches & Whs</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'inventory' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Inventory & Products</span>
        </button>

        <button
          onClick={() => setActiveTab('sales-crm')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'sales-crm' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Sales & CRM</span>
        </button>

        <button
          onClick={() => setActiveTab('hr')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'hr' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Human Resources</span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'invitations' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>User Invitations</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'files' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>File Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-3 px-4 py-3 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'logs' ? 'bg-[#2C2925] text-white shadow-xs' : 'text-[#5C554E] hover:bg-[#F4F1EA]'
          }`}
        >
          <Scroll className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>

        <div className="border-t border-[#F4F1EA] mt-4 pt-4 flex flex-col gap-2">
          <div className="flex justify-between items-center px-3 text-[10px] font-bold uppercase tracking-wider text-[#7F7569]">
            <span>Active Alerts</span>
            <span className="w-2 h-2 rounded-full bg-[#51794A] animate-pulse"></span>
          </div>
          <div className="bg-[#FAF8F5] p-3 rounded-lg border border-[#EBE5DA] space-y-2">
            <div className="flex items-center space-x-2 text-xs text-[#2C2925]">
              <Bell className="w-3.5 h-3.5 text-[#8F6A38] shrink-0" />
              <span className="font-bold">Notifications: {notificationsList.filter(n => !n.isRead && !n.is_read).length}</span>
            </div>
            {notificationsList.filter(n => !n.isRead && !n.is_read).slice(0, 2).map((n, idx) => (
              <div key={idx} className="text-[10px] text-[#7F7569] leading-tight border-b border-[#F4F1EA] pb-1.5 last:border-0 last:pb-0">
                <p className="font-semibold text-[#2C2925] truncate">{n.title}</p>
                <button onClick={() => markNotificationRead(n.id)} className="text-[9px] text-[#305273] hover:underline mt-0.5 font-bold">Mark Read</button>
              </div>
            ))}
            {notificationsList.filter(n => !n.isRead && !n.is_read).length > 0 && (
              <button onClick={markAllNotificationsRead} className="text-[10px] text-[#51794A] hover:underline font-bold block w-full text-center">Mark all read</button>
            )}
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------
          ERP WORKSPACE ARENA
          ---------------------------------------------------- */}
      <section className="flex-1 bg-white p-6 rounded-xl border border-[#EBE5DA] shadow-xs overflow-y-auto">
        
        {/* Alerts overlay */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 bg-[#EDF7ED] border border-[#D3ECD3] text-[#2E7D32] px-4 py-3 rounded-lg flex items-center space-x-2 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>{success}</span>
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 bg-[#FAF3F3] border border-[#F5DCDC] text-[#A82B2B] px-4 py-3 rounded-lg flex items-center space-x-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ----------------------------------------------------
            TAB VIEW: OVERVIEW
            ---------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Enterprise Overview</h2>
              <p className="text-sm text-[#7F7569]">System-wide metrics and performance indicators across your organization</p>
            </div>

            {/* Micro bento highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#FAF8F5] border border-[#EBE5DA] p-4 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Total Branches</span>
                <p className="text-2xl font-black mt-1 text-[#2C2925]">{branchesList.length}</p>
              </div>
              <div className="bg-[#FAF8F5] border border-[#EBE5DA] p-4 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Warehouses</span>
                <p className="text-2xl font-black mt-1 text-[#2C2925]">{warehousesList.length}</p>
              </div>
              <div className="bg-[#FAF8F5] border border-[#EBE5DA] p-4 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Staff Members</span>
                <p className="text-2xl font-black mt-1 text-[#2C2925]">{employeesList.length || 3}</p>
              </div>
              <div className="bg-[#FAF8F5] border border-[#EBE5DA] p-4 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-[#7F7569]">Pending Invites</span>
                <p className="text-2xl font-black mt-1 text-[#2C2925]">{invitationsList.filter(i => i.status === 'pending').length}</p>
              </div>
            </div>

            {/* Quick action triggers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-sm uppercase tracking-wider text-[#2C2925]">Corporate Entity Profile</h4>
                <div className="text-xs text-[#7F7569] space-y-1.5 border-t border-[#F4F1EA] pt-2.5">
                  <p><span className="font-bold">Company Name:</span> {org?.name || 'My Enterprise Workspace'}</p>
                  <p><span className="font-bold">Base Currency:</span> {org?.baseCurrency || 'USD'} ({currenciesList.find(c => c.isBase)?.symbol || '$'})</p>
                  <p><span className="font-bold">Locale / Lang:</span> {org?.language === 'en' ? 'English (en-US)' : org?.language} / {org?.timezone || 'UTC'}</p>
                  <p><span className="font-bold">Tax Registry:</span> {org?.taxId || 'Not Configured'}</p>
                </div>
                <button onClick={() => setActiveTab('organization')} className="text-xs font-bold text-[#305273] hover:underline flex items-center space-x-1 pt-1.5">
                  <span>Edit profile and settings</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-sm uppercase tracking-wider text-[#2C2925]">Dynamic Numbering System</h4>
                <div className="text-xs text-[#7F7569] space-y-2.5 border-t border-[#F4F1EA] pt-2.5">
                  <p className="leading-tight">Automatic document coding is running on all newly generated assets to preserve schema integrity.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-[#F4F1EA] px-2 py-1 rounded font-mono text-[10px] text-[#2C2925] font-bold">EMP-0001 (Employees)</span>
                    <span className="bg-[#F4F1EA] px-2 py-1 rounded font-mono text-[10px] text-[#2C2925] font-bold">BR-001 (Branches)</span>
                    <span className="bg-[#F4F1EA] px-2 py-1 rounded font-mono text-[10px] text-[#2C2925] font-bold">WH-001 (Warehouses)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: ORGANIZATION & SETTINGS
            ---------------------------------------------------- */}
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Organization Profile & Config</h2>
                <p className="text-sm text-[#7F7569]">Set enterprise parameters, currency exchange rates, taxes, and numbering sequences</p>
              </div>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleOrgSubmit} className="bg-[#FAF8F5] border border-[#EBE5DA] p-6 rounded-xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-2">Company Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Company Name</label>
                  <input type="text" required value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Corporate Tax ID</label>
                  <input type="text" placeholder="TX-902-184" value={orgForm.taxId} onChange={(e) => setOrgForm({ ...orgForm, taxId: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Corporate Email</label>
                  <input type="email" value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Phone Number</label>
                  <input type="text" value={orgForm.phone} onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Corporate Website</label>
                  <input type="text" value={orgForm.website} onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[#7F7569]">Language Profile</label>
                  <select value={orgForm.language} onChange={(e) => setOrgForm({ ...orgForm, language: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925]">
                    <option value="en">English (en-US)</option>
                    <option value="es">Español (es-ES)</option>
                    <option value="fr">Français (fr-FR)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[#7F7569]">Primary Headquarters Address</label>
                <textarea rows={2} value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#2C2925] resize-none" />
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="bg-[#2C2925] text-white hover:bg-[#1A1816] text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-xs cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>

            {/* Currency Management panel */}
            <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[#F4F1EA] pb-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-[#51794A]" />
                  <span>Currency Registries</span>
                </h3>
                <button onClick={() => {
                  setCurrencyForm({ id: '', code: '', name: '', symbol: '', exchangeRate: '1.0', isBase: false, status: 'active' });
                  setShowCurrencyForm(!showCurrencyForm);
                }} className="text-xs bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] px-2.5 py-1.5 rounded-lg font-bold hover:bg-[#F4F1EA] flex items-center space-x-1">
                  <Plus className="w-3 h-3" />
                  <span>Configure Currency</span>
                </button>
              </div>

              {showCurrencyForm && (
                <form onSubmit={handleCurrencySubmit} className="bg-[#FAF8F5] p-4 rounded-lg border border-[#EBE5DA] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">ISO Code</label>
                    <input type="text" required placeholder="EUR" value={currencyForm.code} onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">Symbol</label>
                    <input type="text" required placeholder="€" value={currencyForm.symbol} onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">Rate to Base</label>
                    <input type="text" required placeholder="0.92" value={currencyForm.exchangeRate} onChange={(e) => setCurrencyForm({ ...currencyForm, exchangeRate: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="flex items-center space-x-2 pb-2">
                    <input type="checkbox" id="isBase" checked={currencyForm.isBase} onChange={(e) => setCurrencyForm({ ...currencyForm, isBase: e.target.checked })} className="rounded" />
                    <label htmlFor="isBase" className="text-[10px] font-bold text-[#7F7569] uppercase">Is Base Currency</label>
                  </div>
                  <div className="col-span-full flex justify-end gap-2">
                    <button type="button" onClick={() => setShowCurrencyForm(false)} className="px-3 py-1.5 text-xs text-[#7F7569] hover:underline font-bold">Cancel</button>
                    <button type="submit" className="bg-[#2C2925] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Save Currency</button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#5C554E]">
                  <thead>
                    <tr className="border-b border-[#F4F1EA] text-[10px] font-bold uppercase text-[#7F7569]">
                      <th className="py-2">ISO Code</th>
                      <th className="py-2">Currency Name</th>
                      <th className="py-2">Symbol</th>
                      <th className="py-2">Exchange Rate (vs USD)</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F1EA]">
                    {currenciesList.map((c, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 font-bold font-mono text-[#2C2925]">{c.code}</td>
                        <td className="py-2.5">{c.name || 'US Dollar'}</td>
                        <td className="py-2.5 font-bold">{c.symbol}</td>
                        <td className="py-2.5 font-mono">{c.exchangeRate || c.exchange_rate}</td>
                        <td className="py-2.5">
                          {c.isBase || c.is_base ? (
                            <span className="bg-[#EDF7ED] text-[#2E7D32] text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Base Currency</span>
                          ) : (
                            <span className="bg-[#FAF8F5] text-[#7F7569] text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border border-[#EBE5DA]">Secondary</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => {
                            setCurrencyForm({
                              id: c.id,
                              code: c.code,
                              name: c.name || '',
                              symbol: c.symbol,
                              exchangeRate: c.exchangeRate || c.exchange_rate,
                              isBase: !!(c.isBase || c.is_base),
                              status: c.status || 'active'
                            });
                            setShowCurrencyForm(true);
                          }} className="text-[#305273] hover:underline font-bold mr-3">Edit</button>
                          {!(c.isBase || c.is_base) && (
                            <button onClick={async () => {
                              if (!confirm('Remove currency?')) return;
                              await fetchWithAuth(`/api/v1/erp/currencies/${c.id}`, { method: 'DELETE' });
                              loadSettingsData();
                            }} className="text-[#A82B2B] hover:underline font-bold">Remove</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax Rules management */}
            <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[#F4F1EA] pb-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] flex items-center space-x-1.5">
                  <Percent className="w-4 h-4 text-[#8F6A38]" />
                  <span>Tax Configuration</span>
                </h3>
                <button onClick={() => {
                  setTaxForm({ id: '', name: '', rate: '', code: '', description: '', status: 'active' });
                  setShowTaxForm(!showTaxForm);
                }} className="text-xs bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] px-2.5 py-1.5 rounded-lg font-bold hover:bg-[#F4F1EA] flex items-center space-x-1">
                  <Plus className="w-3 h-3" />
                  <span>Add Tax Rate</span>
                </button>
              </div>

              {showTaxForm && (
                <form onSubmit={handleTaxSubmit} className="bg-[#FAF8F5] p-4 rounded-lg border border-[#EBE5DA] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">Tax Class Name</label>
                    <input type="text" required placeholder="Standard VAT" value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">Percentage Rate</label>
                    <input type="text" required placeholder="15.0" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-[#7F7569]">System Code</label>
                    <input type="text" placeholder="VAT-15" value={taxForm.code || ''} onChange={(e) => setTaxForm({ ...taxForm, code: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-2.5 py-1.5 text-xs" />
                  </div>
                  <div className="flex justify-end gap-2 pb-1.5">
                    <button type="button" onClick={() => setShowTaxForm(false)} className="px-2 py-1 text-xs text-[#7F7569] font-bold">Cancel</button>
                    <button type="submit" className="bg-[#2C2925] text-white text-xs font-bold px-3 py-1.5 rounded-lg">Save Tax</button>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#5C554E]">
                  <thead>
                    <tr className="border-b border-[#F4F1EA] text-[10px] font-bold uppercase text-[#7F7569]">
                      <th className="py-2">Class Name</th>
                      <th className="py-2">System Code</th>
                      <th className="py-2">Percentage Rate</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F1EA]">
                    {taxesList.map((t, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]">
                        <td className="py-2.5 font-bold text-[#2C2925]">{t.name}</td>
                        <td className="py-2.5 font-mono">{t.code || 'N/A'}</td>
                        <td className="py-2.5 font-bold text-[#8F6A38]">{t.rate}%</td>
                        <td className="py-2.5">
                          <span className="bg-[#EDF7ED] text-[#2E7D32] text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">Active</span>
                        </td>
                        <td className="py-2.5">
                          <button onClick={() => {
                            setTaxForm({
                              id: t.id,
                              name: t.name,
                              rate: t.rate,
                              code: t.code || '',
                              description: t.description || '',
                              status: t.status || 'active'
                            });
                            setShowTaxForm(true);
                          }} className="text-[#305273] hover:underline font-bold mr-3">Edit</button>
                          <button onClick={async () => {
                            if (!confirm('Remove tax configuration?')) return;
                            await fetchWithAuth(`/api/v1/erp/taxes/${t.id}`, { method: 'DELETE' });
                            loadSettingsData();
                          }} className="text-[#A82B2B] hover:underline font-bold">Remove</button>
                        </td>
                      </tr>
                    ))}
                    {taxesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-[#A19588]">No custom taxes configured. Configure standard tax classes to apply.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: BRANCHES & WAREHOUSES
            ---------------------------------------------------- */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Branches & Warehouses</h2>
                <p className="text-sm text-[#7F7569]">Maintain distributed company locations and fulfillment centers</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  setBranchForm({ id: '', name: '', code: '', address: '', phone: '', email: '', status: 'active' });
                  setShowBranchModal(true);
                }} className="bg-[#2C2925] hover:bg-[#1A1816] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Branch</span>
                </button>
                <button onClick={() => {
                  if (branchesList.length === 0) {
                    showError('Please register at least one branch before configuring warehouses.');
                    return;
                  }
                  setWhForm({ id: '', branchId: branchesList[0].id, name: '', code: '', address: '', status: 'active' });
                  setShowWhModal(true);
                }} className="bg-white hover:bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer">
                  <Warehouse className="w-3.5 h-3.5 text-[#305273]" />
                  <span>Configure Wh</span>
                </button>
              </div>
            </div>

            {/* Filters panel */}
            <div className="flex flex-col sm:flex-row gap-3 items-center bg-[#FAF8F5] p-3 rounded-xl border border-[#EBE5DA]">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#A19588]" />
                <input type="text" placeholder="Search locations by name or identifier code..." value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} className="w-full bg-white border border-[#EBE5DA] rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none" />
              </div>
              <select value={branchStatusFilter} onChange={(e) => setBranchStatusFilter(e.target.value)} className="bg-white border border-[#EBE5DA] rounded-lg px-3 py-1.5 text-xs w-full sm:w-auto">
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Modals for Branch */}
            {showBranchModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-md w-full shadow-xl space-y-4">
                  <h3 className="font-bold text-base tracking-tight">{branchForm.id ? 'Edit Branch' : 'Register New Corporate Branch'}</h3>
                  <form onSubmit={handleBranchSubmit} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Branch Name</label>
                        <input type="text" required placeholder="HQs Branch" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Branch Code</label>
                        <input type="text" required placeholder="BR-NY" value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Direct Phone</label>
                        <input type="text" placeholder="+1 (555) 901-2918" value={branchForm.phone || ''} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Registry Email</label>
                        <input type="email" placeholder="ny-branch@acme.com" value={branchForm.email || ''} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Address Details</label>
                      <textarea placeholder="82 Fifth Ave, New York" value={branchForm.address || ''} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 resize-none" rows={2} />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Status</label>
                      <select value={branchForm.status} onChange={(e) => setBranchForm({ ...branchForm, status: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                      <button type="button" onClick={() => setShowBranchModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                      <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Location</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Modals for Warehouse */}
            {showWhModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-md w-full shadow-xl space-y-4">
                  <h3 className="font-bold text-base tracking-tight">Configure Warehouse Repository</h3>
                  <form onSubmit={handleWhSubmit} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Assign to Parent Branch</label>
                      <select value={whForm.branchId} onChange={(e) => setWhForm({ ...whForm, branchId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        {branchesList.map((b, idx) => (
                          <option key={idx} value={b.id}>{b.name} ({b.code})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Warehouse Name</label>
                        <input type="text" required placeholder="Central Depot A" value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Depot Identifier Code</label>
                        <input type="text" required placeholder="WH-DEP-A" value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Warehouse Address</label>
                      <input type="text" placeholder="Cargo Bay 12, Pier 8" value={whForm.address || ''} onChange={(e) => setWhForm({ ...whForm, address: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                      <button type="button" onClick={() => setShowWhModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                      <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Depot</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* List Table Grid for Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Branches Panel */}
              <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-2 flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-[#2C2925]" />
                  <span>Branches ({branchesList.length})</span>
                </h3>
                <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto pr-2 space-y-2.5">
                  {branchesList.map((b, idx) => (
                    <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-start gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[9px] bg-[#F4F1EA] px-1.5 py-0.5 rounded font-bold text-[#2C2925]">{b.code}</span>
                          <span className="font-bold text-xs text-[#2C2925]">{b.name}</span>
                        </div>
                        <p className="text-[10px] text-[#7F7569] mt-1">{b.address || 'No address logged'}</p>
                        <p className="text-[9px] text-[#A19588] mt-0.5">{b.email} • {b.phone}</p>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button onClick={() => {
                          setBranchForm(b);
                          setShowBranchModal(true);
                        }} className="p-1 hover:bg-[#F4F1EA] rounded text-[#305273]">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteBranch(b.id)} className="p-1 hover:bg-[#FDF3F3] rounded text-[#A82B2B]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {branchesList.length === 0 && (
                    <p className="text-xs text-center text-[#A19588] py-8">No corporate branches registered.</p>
                  )}
                </div>
              </div>

              {/* Warehouses Panel */}
              <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-2 flex items-center space-x-1.5">
                  <Warehouse className="w-4 h-4 text-[#305273]" />
                  <span>Warehouses / Depots ({warehousesList.length})</span>
                </h3>
                <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto pr-2 space-y-2.5">
                  {warehousesList.map((w, idx) => {
                    const linkedBranch = branchesList.find(b => b.id === w.branchId || b.id === w.branch_id);
                    return (
                      <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-start gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[9px] bg-[#EAF0F6] text-[#305273] px-1.5 py-0.5 rounded font-bold">{w.code}</span>
                            <span className="font-bold text-xs text-[#2C2925]">{w.name}</span>
                          </div>
                          {linkedBranch && (
                            <span className="inline-block mt-1 text-[9px] bg-[#F4F1EA] text-[#7F7569] px-2 py-0.5 rounded font-bold">Branch: {linkedBranch.name}</span>
                          )}
                          <p className="text-[10px] text-[#7F7569] mt-1">{w.address || 'No location address logged'}</p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button onClick={() => {
                            setWhForm({
                              id: w.id,
                              branchId: w.branchId || w.branch_id,
                              name: w.name,
                              code: w.code,
                              address: w.address || '',
                              status: w.status || 'active'
                            });
                            setShowWhModal(true);
                          }} className="p-1 hover:bg-[#F4F1EA] rounded text-[#305273]">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteWarehouse(w.id)} className="p-1 hover:bg-[#FDF3F3] rounded text-[#A82B2B]">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {warehousesList.length === 0 && (
                    <p className="text-xs text-center text-[#A19588] py-8">No linked warehouses configured.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: HUMAN RESOURCES (DEPT, POSITIONS, EMPLOYEES)
            ---------------------------------------------------- */}
        {activeTab === 'hr' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Human Resources Registry</h2>
                <p className="text-sm text-[#7F7569]">Manage departments, grades, salaries, job positions, and active corporate staff</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => {
                  setDeptForm({ id: '', name: '', code: '', managerName: '' });
                  setShowDeptModal(true);
                }} className="bg-white hover:bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] text-xs font-bold px-2.5 py-2 rounded-lg flex items-center space-x-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Dept</span>
                </button>
                <button onClick={() => {
                  if (departmentsList.length === 0) {
                    showError('Please configure departments before registering corporate positions.');
                    return;
                  }
                  setPositionForm({ id: '', title: '', departmentId: departmentsList[0].id, grade: '', salaryRange: '' });
                  setShowPositionModal(true);
                }} className="bg-white hover:bg-[#FAF8F5] border border-[#EBE5DA] text-[#2C2925] text-xs font-bold px-2.5 py-2 rounded-lg flex items-center space-x-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Position</span>
                </button>
                <button onClick={() => {
                  setEmployeeForm({ id: '', firstName: '', lastName: '', email: '', phone: '', departmentId: departmentsList[0]?.id || '', positionId: positionsList[0]?.id || '', salary: '', hireDate: new Date().toISOString().split('T')[0], status: 'active' });
                  setShowEmployeeModal(true);
                }} className="bg-[#2C2925] hover:bg-[#1A1816] text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1 shadow-xs cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Onboard Employee</span>
                </button>
              </div>
            </div>

            {/* Department and Position Management Micro-grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Departments Box */}
              <div className="border border-[#EBE5DA] p-4 rounded-xl bg-[#FAF8F5] space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex justify-between">
                  <span>Registered Departments</span>
                  <span className="font-mono text-[#7F7569]">{departmentsList.length}</span>
                </h3>
                <div className="divide-y divide-[#EBE5DA] max-h-[160px] overflow-y-auto pr-1">
                  {departmentsList.map((d, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-mono text-[9px] bg-white border border-[#EBE5DA] px-1 rounded font-bold">{d.code}</span>
                        <span className="font-bold text-[#2C2925] ml-2">{d.name}</span>
                        {d.managerName && <span className="text-[9px] text-[#7F7569] block">Manager: {d.managerName}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setDeptForm({ id: d.id, name: d.name, code: d.code, managerName: d.managerName || '' });
                          setShowDeptModal(true);
                        }} className="text-xs text-[#305273] font-bold mr-2 hover:underline">Edit</button>
                        <button onClick={() => deleteDepartment(d.id)} className="text-xs text-[#A82B2B] font-bold hover:underline">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Positions Box */}
              <div className="border border-[#EBE5DA] p-4 rounded-xl bg-[#FAF8F5] space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex justify-between">
                  <span>Job Positions / Roles</span>
                  <span className="font-mono text-[#7F7569]">{positionsList.length}</span>
                </h3>
                <div className="divide-y divide-[#EBE5DA] max-h-[160px] overflow-y-auto pr-1">
                  {positionsList.map((p, idx) => {
                    const dept = departmentsList.find(d => d.id === p.departmentId || d.id === p.department_id);
                    return (
                      <div key={idx} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-[#2C2925]">{p.title}</span>
                          <span className="text-[9px] text-[#7F7569] block">Grade: {p.grade || 'N/A'} • {dept?.name || 'Unassigned Dept'}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setPositionForm({
                              id: p.id,
                              title: p.title,
                              departmentId: p.departmentId || p.department_id,
                              grade: p.grade || '',
                              salaryRange: p.salaryRange || p.salary_range || ''
                            });
                            setShowPositionModal(true);
                          }} className="text-xs text-[#305273] font-bold mr-2 hover:underline">Edit</button>
                          <button onClick={() => deletePosition(p.id)} className="text-xs text-[#A82B2B] font-bold hover:underline">Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Employees Search, Filter & Paginated Table */}
            <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#A19588]" />
                  <input type="text" placeholder="Search employees by name, email, or employee ID code..." value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); setEmpPage(1); }} className="w-full bg-white border border-[#EBE5DA] rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none" />
                </div>
                <select value={empDeptFilter} onChange={(e) => { setEmpDeptFilter(e.target.value); setEmpPage(1); }} className="bg-white border border-[#EBE5DA] rounded-lg px-3 py-1.5 text-xs w-full sm:w-auto">
                  <option value="">All Departments</option>
                  {departmentsList.map((d, idx) => (
                    <option key={idx} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Employees Data List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#5C554E]">
                  <thead>
                    <tr className="border-b border-[#F4F1EA] text-[10px] font-bold uppercase text-[#7F7569]">
                      <th className="py-2.5">Emp ID</th>
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">Contact Email</th>
                      <th className="py-2.5">Department & Job Title</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4F1EA]">
                    {employeesList.map((e, idx) => {
                      const dept = departmentsList.find(d => d.id === e.departmentId || d.id === e.department_id);
                      const pos = positionsList.find(p => p.id === e.positionId || p.id === e.position_id);
                      return (
                        <tr key={idx} className="hover:bg-[#FAF8F5]">
                          <td className="py-3 font-mono font-bold text-[#2C2925]">{e.employeeId || e.employee_id}</td>
                          <td className="py-3 font-semibold text-[#2C2925]">{e.firstName || e.first_name} {e.lastName || e.last_name}</td>
                          <td className="py-3 font-mono">{e.email}</td>
                          <td className="py-3">
                            <span className="font-bold block text-xs text-[#2C2925]">{pos?.title || 'Job Position N/A'}</span>
                            <span className="text-[10px] text-[#7F7569]">{dept?.name || 'Department N/A'}</span>
                          </td>
                          <td className="py-3">
                            {e.status === 'active' ? (
                              <span className="bg-[#EDF7ED] text-[#2E7D32] text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border border-[#D3ECD3]">Active</span>
                            ) : (
                              <span className="bg-[#FAF3F3] text-[#A82B2B] text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border border-[#F5DCDC]">{e.status}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <button onClick={() => {
                              setEmployeeForm({
                                id: e.id,
                                firstName: e.firstName || e.first_name,
                                lastName: e.lastName || e.last_name,
                                email: e.email,
                                phone: e.phone || '',
                                departmentId: e.departmentId || e.department_id || '',
                                positionId: e.positionId || e.position_id || '',
                                salary: e.salary || '',
                                hireDate: e.hireDate || e.hire_date || '',
                                status: e.status || 'active'
                              });
                              setShowEmployeeModal(true);
                            }} className="text-[#305273] font-bold hover:underline mr-3">Edit</button>
                            <button onClick={() => deleteEmployee(e.id)} className="text-[#A82B2B] font-bold hover:underline">Terminate</button>
                          </td>
                        </tr>
                      );
                    })}
                    {employeesList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#A19588]">No employee records found. Create employees to auto-trigger automatic formatting ID sequences.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              <div className="flex justify-between items-center border-t border-[#F4F1EA] pt-3.5 text-xs text-[#7F7569] font-medium">
                <span>Page {empPage} of {empTotalPages}</span>
                <div className="flex gap-1.5">
                  <button disabled={empPage <= 1} onClick={() => setEmpPage(empPage - 1)} className="p-1 border border-[#EBE5DA] rounded hover:bg-[#FAF8F5] disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button disabled={empPage >= empTotalPages} onClick={() => setEmpPage(empPage + 1)} className="p-1 border border-[#EBE5DA] rounded hover:bg-[#FAF8F5] disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal: Department Form */}
            {showDeptModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-sm w-full shadow-xl space-y-4">
                  <h3 className="font-bold text-base tracking-tight">{deptForm.id ? 'Edit Department' : 'Create Division / Department'}</h3>
                  <form onSubmit={handleDeptSubmit} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Department Name</label>
                      <input type="text" required placeholder="Engineering & Operations" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Identifier Code</label>
                        <input type="text" required placeholder="ENG" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Manager Name</label>
                        <input type="text" placeholder="John Miller" value={deptForm.managerName} onChange={(e) => setDeptForm({ ...deptForm, managerName: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                      <button type="button" onClick={() => setShowDeptModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                      <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Department</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Modal: Position Form */}
            {showPositionModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-sm w-full shadow-xl space-y-4">
                  <h3 className="font-bold text-base tracking-tight">Configure Career Position</h3>
                  <form onSubmit={handlePositionSubmit} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Job Title</label>
                      <input type="text" required placeholder="Principal Software Architect" value={positionForm.title} onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Division Department</label>
                      <select value={positionForm.departmentId} onChange={(e) => setPositionForm({ ...positionForm, departmentId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        {departmentsList.map((d, idx) => (
                          <option key={idx} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Career Grade</label>
                        <input type="text" placeholder="L6 - Principal" value={positionForm.grade} onChange={(e) => setPositionForm({ ...positionForm, grade: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Salary Range</label>
                        <input type="text" placeholder="$120k - $160k" value={positionForm.salaryRange} onChange={(e) => setPositionForm({ ...positionForm, salaryRange: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                      <button type="button" onClick={() => setShowPositionModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                      <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Position</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {/* Modal: Employee Profile Form */}
            {showEmployeeModal && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-[#EBE5DA] p-6 max-w-md w-full shadow-xl space-y-4">
                  <h3 className="font-bold text-base tracking-tight">{employeeForm.id ? 'Edit Employee profile' : 'Onboard Employee Profile'}</h3>
                  <form onSubmit={handleEmployeeSubmit} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">First Name</label>
                        <input type="text" required placeholder="Aria" value={employeeForm.firstName} onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Last Name</label>
                        <input type="text" required placeholder="Vance" value={employeeForm.lastName} onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Work Email</label>
                        <input type="email" required placeholder="aria.v@acme.com" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Direct Phone</label>
                        <input type="text" placeholder="+1-902-184" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Department</label>
                        <select value={employeeForm.departmentId} onChange={(e) => setEmployeeForm({ ...employeeForm, departmentId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                          <option value="">Unassigned</option>
                          {departmentsList.map((d, idx) => (
                            <option key={idx} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Job Position</label>
                        <select value={employeeForm.positionId} onChange={(e) => setEmployeeForm({ ...employeeForm, positionId: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                          <option value="">Unassigned</option>
                          {positionsList.map((p, idx) => (
                            <option key={idx} value={p.id}>{p.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Compensation (Salary)</label>
                        <input type="text" placeholder="$140,000 / Year" value={employeeForm.salary} onChange={(e) => setEmployeeForm({ ...employeeForm, salary: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-[#7F7569] uppercase">Hire Date</label>
                        <input type="date" value={employeeForm.hireDate} onChange={(e) => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-[#7F7569] uppercase">Status</label>
                      <select value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })} className="w-full border border-[#EBE5DA] rounded-lg px-3 py-2">
                        <option value="active">Active</option>
                        <option value="terminated">Terminated</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F4F1EA]">
                      <button type="button" onClick={() => setShowEmployeeModal(false)} className="px-3 py-2 text-[#7F7569] hover:underline font-bold">Cancel</button>
                      <button type="submit" className="bg-[#2C2925] text-white px-4 py-2 rounded-lg font-bold">Save Profile</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: USER INVITATIONS
            ---------------------------------------------------- */}
        {activeTab === 'invitations' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">User Invitations</h2>
              <p className="text-sm text-[#7F7569]">Dispatch and monitor secure email invites to grant workspace privileges to coworkers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form to Dispatch */}
              <form onSubmit={handleInviteSubmit} className="bg-[#FAF8F5] p-5 border border-[#EBE5DA] rounded-xl space-y-3.5 h-fit text-xs">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex items-center space-x-2">
                  <Send className="w-4 h-4 text-[#2C2925]" />
                  <span>Send Invite</span>
                </h3>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Recipient Full Name</label>
                  <input type="text" required placeholder="Alex Mercer" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Corporate Email</label>
                  <input type="email" required placeholder="alex@company.com" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">System Privileges Role</label>
                  <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none">
                    <option value="member">Workspace Member</option>
                    <option value="admin">Administrator (Write Privileges)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-[#2C2925] text-white hover:bg-[#1A1816] font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-1 transition-all">
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Invite Link</span>
                </button>
              </form>

              {/* Sent Invites list */}
              <div className="md:col-span-2 border border-[#EBE5DA] rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5">Sent Invitations</h3>
                <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto pr-1 space-y-2.5">
                  {invitationsList.map((inv, idx) => (
                    <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-center gap-3">
                      <div>
                        <span className="font-bold text-xs text-[#2C2925]">{inv.name}</span>
                        <p className="text-[10px] text-[#7F7569]">{inv.email} • Assigned Role: <span className="font-bold uppercase text-[#8F6A38]">{inv.role}</span></p>
                        <p className="text-[9px] text-[#A19588] mt-1 font-mono">Expires: {new Date(inv.expiresAt || inv.expires_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        {inv.status === 'pending' ? (
                          <span className="bg-[#FAF3D1] text-[#7B640D] text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-[#F5EAA8]">Pending</span>
                        ) : (
                          <span className="bg-[#EDF7ED] text-[#2E7D32] text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-[#D3ECD3]">{inv.status}</span>
                        )}
                        <button onClick={() => deleteInvite(inv.id)} className="text-[#A82B2B] font-bold hover:underline">Revoke</button>
                      </div>
                    </div>
                  ))}
                  {invitationsList.length === 0 && (
                    <p className="text-xs text-center text-[#A19588] py-8">No active corporate invites generated.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: FILE STORAGE (MOCK DIRECTORY)
            ---------------------------------------------------- */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4">
              <h2 className="text-2xl font-extrabold tracking-tight">Corporate Document Hub</h2>
              <p className="text-sm text-[#7F7569]">Secure central repository for auditing PDFs, spreadsheets, and system receipts</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form to Upload */}
              <form onSubmit={handleFileUpload} className="bg-[#FAF8F5] p-5 border border-[#EBE5DA] rounded-xl space-y-3.5 h-fit text-xs">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#EBE5DA] pb-1.5 flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-[#2C2925]" />
                  <span>Register Document</span>
                </h3>
                <div className="space-y-1">
                  <label className="font-bold text-[#7F7569] uppercase">Filename / Title</label>
                  <input type="text" required placeholder="Q3_Sales_Report.xlsx" value={uploadForm.filename} onChange={(e) => setUploadForm({ ...uploadForm, filename: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">File Size (Bytes)</label>
                    <input type="number" required placeholder="102400" value={uploadForm.fileSize} onChange={(e) => setUploadForm({ ...uploadForm, fileSize: parseInt(e.target.value) })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#7F7569] uppercase">Mime Type</label>
                    <select value={uploadForm.mimeType} onChange={(e) => setUploadForm({ ...uploadForm, mimeType: e.target.value })} className="w-full bg-white border border-[#EBE5DA] rounded-lg px-3 py-2 text-xs focus:outline-none">
                      <option value="application/pdf">PDF File</option>
                      <option value="application/vnd.ms-excel">Excel spreadsheet</option>
                      <option value="text/csv">CSV Table</option>
                      <option value="image/png">PNG Asset</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#2C2925] text-white hover:bg-[#1A1816] font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-1 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload To Schema Directory</span>
                </button>
              </form>

              {/* Sent Files list */}
              <div className="md:col-span-2 border border-[#EBE5DA] rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#2C2925] border-b border-[#F4F1EA] pb-1.5">Asset Registry</h3>
                <div className="divide-y divide-[#F4F1EA] max-h-[350px] overflow-y-auto pr-1 space-y-2.5">
                  {filesList.map((f, idx) => (
                    <div key={idx} className="pt-2.5 first:pt-0 flex justify-between items-center gap-3">
                      <div className="flex items-center space-x-3 text-xs">
                        <FileText className="w-5 h-5 text-[#305273] shrink-0" />
                        <div>
                          <span className="font-bold text-xs text-[#2C2925] block truncate max-w-[280px]">{f.filename}</span>
                          <span className="text-[10px] text-[#7F7569] font-mono">{f.mimeType} • {Math.round((f.fileSize || f.file_size) / 1024)} KB</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        <a href="#" onClick={(e) => { e.preventDefault(); alert(`Resource metadata URL: ${f.url}`); }} className="text-[#305273] hover:underline font-bold">Metadata Link</a>
                        <button onClick={() => deleteFile(f.id)} className="text-[#A82B2B] font-bold hover:underline">Delete</button>
                      </div>
                    </div>
                  ))}
                  {filesList.length === 0 && (
                    <p className="text-xs text-center text-[#A19588] py-8">No enterprise documents in file registry.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB VIEW: AUDIT LOGS
            ---------------------------------------------------- */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="border-b border-[#F4F1EA] pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Audit Trail & Security Logs</h2>
                <p className="text-sm text-[#7F7569]">Read-only dynamic log of all system writes, alterations, and security actions</p>
              </div>
              <div className="flex gap-2">
                <select value={logModuleFilter} onChange={(e) => { setLogModuleFilter(e.target.value); setLogPage(1); }} className="bg-white border border-[#EBE5DA] rounded-lg px-3 py-1.5 text-xs">
                  <option value="">All Modules</option>
                  <option value="Branch">Branch</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Employee">Employee</option>
                  <option value="Department">Department</option>
                  <option value="Position">Position</option>
                  <option value="Settings">Settings</option>
                  <option value="FileStorage">File Storage</option>
                  <option value="Invitation">Invitations</option>
                </select>
              </div>
            </div>

            {/* Audit Logs list */}
            <div className="border border-[#EBE5DA] rounded-xl p-5 space-y-3.5 bg-white">
              <div className="divide-y divide-[#F4F1EA] space-y-2.5">
                {auditLogsList.map((log, idx) => (
                  <div key={idx} className="pt-2.5 first:pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] bg-[#FAF3D1] text-[#7B640D] px-1.5 py-0.5 rounded font-bold border border-[#F5EAA8]">{log.action}</span>
                        <span className="text-[#2C2925] font-semibold">{log.details}</span>
                      </div>
                      <p className="text-[10px] text-[#7F7569] mt-1">Authorized User: <span className="font-bold text-[#2C2925]">{log.userName || log.user_name || 'System / Auto'}</span> • Module: {log.module}</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#A19588] shrink-0 font-mono">
                      <Clock className="w-3.5 h-3.5 text-[#A19588]" />
                      <span>{new Date(log.createdAt || log.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
                {auditLogsList.length === 0 && (
                  <p className="text-xs text-center text-[#A19588] py-8">No matching logs registered in current schema container.</p>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex justify-between items-center border-t border-[#F4F1EA] pt-3 text-xs text-[#7F7569] font-medium">
                <span>Page {logPage} of {logTotalPages}</span>
                <div className="flex gap-1.5">
                  <button disabled={logPage <= 1} onClick={() => setLogPage(logPage - 1)} className="p-1 border border-[#EBE5DA] rounded hover:bg-[#FAF8F5] disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button disabled={logPage >= logTotalPages} onClick={() => setLogPage(logPage + 1)} className="p-1 border border-[#EBE5DA] rounded hover:bg-[#FAF8F5] disabled:opacity-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            token={token}
            tenantDomain={tenantDomain}
            warehousesList={warehousesList}
            branchesList={branchesList}
            showError={showError}
            showSuccess={showSuccess}
            fetchWithAuth={fetchWithAuth}
          />
        )}

        {activeTab === 'sales-crm' && (
          <SalesCrmManager
            token={token}
            tenantDomain={tenantDomain}
            showError={showError}
            showSuccess={showSuccess}
            fetchWithAuth={fetchWithAuth}
            warehousesList={warehousesList}
          />
        )}

      </section>

    </div>
  );
}
