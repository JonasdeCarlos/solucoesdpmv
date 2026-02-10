import { NavLink, Outlet } from 'react-router-dom';
import logoMonteVerde from '@/assets/logo-monte-verde.png';
import { Calculator, Users, FileText, Receipt } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Calculadora', icon: Calculator, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/verbas', label: 'Verbas', icon: FileText },
  { to: '/recibo', label: 'Recibo Avulso', icon: Receipt },
];

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container max-w-5xl mx-auto px-4 py-4 md:py-5 flex items-center gap-3">
          <img src={logoMonteVerde} alt="Monte Verde Contabilidade" className="h-10 md:h-14 w-auto" />
          <div>
            <h1 className="text-lg md:text-2xl font-bold leading-tight">Monte Verde Contabilidade</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Sistema Trabalhista — Cálculo estimativo</p>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="border-b bg-card/50">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="container max-w-5xl mx-auto px-4 py-6 md:py-10 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <p className="text-xs text-muted-foreground text-center">
            ⚠️ Cálculo estimativo. Pode variar conforme CCT, médias, adicionais, descontos legais e particularidades do contrato. Consulte um profissional.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
