import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ErpSuite } from './components/ErpSuite';
import { 
  Building2, 
  Lock, 
  Mail, 
  User, 
  Globe, 
  Activity, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  LogOut, 
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function App() {
  // Navigation / Authentication state
  const [currentView, setCurrentView] = useState<'register' | 'login' | 'dashboard'>('register');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [tenantDomain, setTenantDomain] = useState<string | null>(() => localStorage.getItem('tenant_domain'));
  const [user, setUser] = useState<{ id: string; email: string; name: string; role: string } | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [domain, setDomain] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginDomain, setLoginDomain] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Diagnostic states
  const [healthStatus, setHealthStatus] = useState<{ database: string; server: string; latency: number } | null>(null);
  const [activeSchema, setActiveSchema] = useState<string>('public');

  // Clear alerts automatically
  useEffect(() => {
    if (errorMsg || successMsg) {
      const timer = setTimeout(() => {
        setErrorMsg(null);
        setSuccessMsg(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg, successMsg]);

  // Check health parameters on interval
  useEffect(() => {
    const fetchHealth = async () => {
      const start = Date.now();
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const latency = Date.now() - start;
        if (data.status === 'green') {
          setHealthStatus({
            database: data.services.database,
            server: data.services.server,
            latency,
          });
        }
      } catch (err) {
        setHealthStatus({ database: 'offline', server: 'degraded', latency: Date.now() - start });
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Sync profile details if authenticated
  useEffect(() => {
    if (token && tenantDomain) {
      const fetchProfile = async () => {
        try {
          const res = await fetch('/api/v1/auth/me', {
            headers: {
              'x-tenant-domain': tenantDomain,
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await res.json();
          if (res.ok && data.success) {
            setUser(data.data.user);
            setActiveSchema(`tenant_${tenantDomain.replace(/-/g, '_')}`);
            setCurrentView('dashboard');
          } else {
            // Token expired or invalid
            handleLogout();
          }
        } catch (err) {
          setErrorMsg('Failed to sync authentication profile with server');
        }
      };
      fetchProfile();
    } else {
      setCurrentView('register');
    }
  }, [token, tenantDomain]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tenant_domain');
    setToken(null);
    setTenantDomain(null);
    setUser(null);
    setActiveSchema('public');
    setCurrentView('login');
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          domain: domain.toLowerCase(),
          ownerName,
          ownerEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Provisioning failed');
      }

      setSuccessMsg('Workspace successfully provisioned! Logging you in...');
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('tenant_domain', data.data.tenant.domain);
      
      // Delay transition for pleasant feedback
      setTimeout(() => {
        setToken(data.data.token);
        setTenantDomain(data.data.tenant.domain);
        setUser(data.data.user);
        setIsLoading(false);
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Server connection error during onboarding');
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-domain': loginDomain.toLowerCase(),
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Invalid credentials');
      }

      localStorage.setItem('token', data.data.token);
      localStorage.setItem('tenant_domain', loginDomain.toLowerCase());
      
      setToken(data.data.token);
      setTenantDomain(loginDomain.toLowerCase());
      setIsLoading(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Workspace connection failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2C2925] flex flex-col font-sans selection:bg-[#EBE5DA] selection:text-[#1A1816]">
      {/* Dynamic Header */}
      <header className="border-b border-[#EBE5DA] px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#2C2925] text-[#FDFBF7] flex items-center justify-center font-bold text-xl tracking-tight">
            BS
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Business Suite</h1>
            <p className="text-xs text-[#7F7569] font-medium uppercase tracking-wider">Enterprise Multi-Tenant SaaS Platform</p>
          </div>
        </div>

        {/* Global Latency / Health Indicator */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs bg-[#F4F1EA] px-3 py-1.5 rounded-full border border-[#EBE5DA]">
            <Activity className="w-3.5 h-3.5 text-[#51794A]" />
            <span className="text-[#4C453F] font-semibold">Server: Connected</span>
            {healthStatus && (
              <span className="text-[#7F7569]">({healthStatus.latency}ms)</span>
            )}
          </div>
          {user && (
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs text-[#A82B2B] hover:bg-[#FDF3F3] px-3 py-1.5 rounded-full border border-[#F5E1E1] transition-all duration-200 font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-7xl w-full mx-auto">
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-lg mb-6 bg-[#FAF3F3] border border-[#F5DCDC] text-[#A82B2B] px-4 py-3 rounded-lg flex items-start space-x-2.5 text-sm font-medium shadow-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-lg mb-6 bg-[#EDF7ED] border border-[#D3ECD3] text-[#2E7D32] px-4 py-3 rounded-lg flex items-start space-x-2.5 text-sm font-medium shadow-sm"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* REGISTER VIEW */}
          {currentView === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl bg-white border border-[#EBE5DA] rounded-xl p-8 shadow-xl"
            >
              <div className="text-center mb-8">
                <span className="text-xs bg-[#EBE5DA] text-[#2C2925] px-3 py-1 rounded-full font-bold uppercase tracking-widest">Workspace Setup</span>
                <h2 className="text-2xl font-extrabold mt-3 tracking-tight">Provision Enterprise Tenant</h2>
                <p className="text-sm text-[#7F7569] mt-1">Deploy an isolated schema-level container workspace</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Company Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                      <input 
                        type="text" 
                        required
                        placeholder="Acme Corp"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Workspace Subdomain</label>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                      <input 
                        type="text" 
                        required
                        placeholder="acme-group"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                        className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Administrator Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="text" 
                      required
                      placeholder="Jane Doe"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Administrator Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="email" 
                      required
                      placeholder="jane@acme.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Security Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#2C2925] hover:bg-[#1A1816] text-[#FDFBF7] font-bold py-3.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Deploy Core ERP Container</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-[#EBE5DA] mt-6 pt-4 text-center">
                <button 
                  onClick={() => setCurrentView('login')} 
                  className="text-sm font-bold text-[#2C2925] hover:underline"
                >
                  Already registered? Sign in to Workspace
                </button>
              </div>
            </motion.div>
          )}

          {/* LOGIN VIEW */}
          {currentView === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md bg-white border border-[#EBE5DA] rounded-xl p-8 shadow-xl"
            >
              <div className="text-center mb-8">
                <span className="text-xs bg-[#EBE5DA] text-[#2C2925] px-3 py-1 rounded-full font-bold uppercase tracking-widest">Access Domain</span>
                <h2 className="text-2xl font-extrabold mt-3 tracking-tight">Connect Workspace</h2>
                <p className="text-sm text-[#7F7569] mt-1">Authenticate into your company's database schema</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Workspace Domain ID</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="text" 
                      required
                      placeholder="acme-group"
                      value={loginDomain}
                      onChange={(e) => setLoginDomain(e.target.value.toLowerCase())}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Corporate Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="email" 
                      required
                      placeholder="jane@acme.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#7F7569]">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#A19588]" />
                    <input 
                      type="password" 
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-[#FDFBF7] border border-[#EBE5DA] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#2C2925] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#2C2925] hover:bg-[#1A1816] text-[#FDFBF7] font-bold py-3.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Open Tenant Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-[#EBE5DA] mt-6 pt-4 text-center">
                <button 
                  onClick={() => setCurrentView('register')} 
                  className="text-sm font-bold text-[#2C2925] hover:underline"
                >
                  Need a new workspace? Setup Tenant
                </button>
              </div>
            </motion.div>
          )}

          {/* DASHBOARD VIEW */}
          {currentView === 'dashboard' && user && token && tenantDomain && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <ErpSuite token={token} tenantDomain={tenantDomain} user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer information */}
      <footer className="border-t border-[#EBE5DA] py-6 text-center text-xs text-[#7F7569] font-medium bg-[#F9F7F3]">
        <p>Business Suite Onboarding Platform &copy; 2026. Built with React 19, Express 4, Drizzle, and PostgreSQL.</p>
      </footer>
    </div>
  );
}
