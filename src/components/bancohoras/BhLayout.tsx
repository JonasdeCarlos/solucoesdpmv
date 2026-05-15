import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Upload, Users, Settings, History } from 'lucide-react';

const TABS = [
  { to: '/banco-horas', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/banco-horas/importar', label: 'Importar PDF', icon: Upload, end: false },
  { to: '/banco-horas/colaboradores', label: 'Colaboradores', icon: Users, end: false },
  { to: '/banco-horas/parametros', label: 'Parâmetros', icon: Settings, end: false },
  { to: '/banco-horas/auditoria', label: 'Auditoria', icon: History, end: false },
];

export default function BhLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Banco de Horas</h1>
        <p className="text-sm text-muted-foreground">
          Importe os PDFs de cartão ponto, acompanhe saldos e tendências por colaborador.
        </p>
      </div>
      <div className="border-b flex gap-1 overflow-x-auto -mb-px">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`
            }
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
