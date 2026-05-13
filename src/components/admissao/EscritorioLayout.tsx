import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, FileText, ClipboardList, ArrowLeft, Archive } from 'lucide-react';
import { useOfficeAuth } from '@/hooks/useOfficeAuth';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdmissaoRequests } from '@/hooks/useAdmissaoRequests';

const EscritorioLayout = () => {
  const { logout } = useOfficeAuth();
  const nav = useNavigate();
  const { requests } = useAdmissaoRequests();
  const untendedCount = requests.filter((r) => !r.responsible_name).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> App
          </Link>
          <h1 className="text-lg font-bold flex-1">Admissão — Escritório</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              toast.success('Sessão de escritório encerrada');
              nav('/admissao/escritorio/login');
            }}
          >
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>
      <nav className="border-b bg-card/50">
        <div className="container max-w-6xl mx-auto px-4 flex gap-1">
          <NavTab to="/admissao/escritorio" end icon={<ClipboardList className="w-4 h-4" />} label="Admissões" badge={untendedCount > 0 ? untendedCount : undefined} />
          <NavTab to="/admissao/escritorio/formularios" icon={<FileText className="w-4 h-4" />} label="Formulários" />
          <NavTab to="/admissao/escritorio/arquivo" icon={<Archive className="w-4 h-4" />} label="Arquivo" />
        </div>
      </nav>
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

const NavTab = ({ to, label, icon, end }: { to: string; label: string; icon: React.ReactNode; end?: boolean }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`
    }
  >
    {icon}{label}
  </NavLink>
);

export default EscritorioLayout;