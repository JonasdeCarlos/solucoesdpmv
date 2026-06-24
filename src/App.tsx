import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import Index from "./pages/Index";
import ClientesPage from "./pages/ClientesPage";
import RescisaoPdfPage from "./pages/RescisaoPdfPage";
import VerbasPage from "./pages/VerbasPage";
import ReciboPage from "./pages/ReciboPage";
import PontoPage from "./pages/PontoPage";
import CustoMensalPage from "./pages/CustoMensalPage";
import EncargosPage from "./pages/EncargosPage";
import CprbPage from "./pages/CprbPage";
import JornadaPage from "./pages/JornadaPage";
import PdfToolsPage from "./pages/PdfToolsPage";
import ProvisoesDsrPage from "./pages/ProvisoesDsrPage";
import NotFound from "./pages/NotFound";
import EscritorioLoginPage from "./pages/admissao/EscritorioLoginPage";
import EscritorioLayout from "./components/admissao/EscritorioLayout";
import OfficeGuard from "./components/admissao/OfficeGuard";
import EscritorioDashboardPage from "./pages/admissao/EscritorioDashboardPage";
import FormulariosListPage from "./pages/admissao/FormulariosListPage";
import FormularioEditorPage from "./pages/admissao/FormularioEditorPage";
import AdmissaoNovaPage from "./pages/admissao/AdmissaoNovaPage";
import AdmissaoDetalhePage from "./pages/admissao/AdmissaoDetalhePage";
import PreencherPage from "./pages/admissao/PreencherPage";
import PublicoNovaPage from "./pages/admissao/PublicoNovaPage";
import ArquivoPage from "./pages/admissao/ArquivoPage";
import AvisosListPage from "./pages/avisos/AvisosListPage";
import AvisosImportPage from "./pages/avisos/AvisosImportPage";
import AvisoEmpresasPage from "./pages/avisos/AvisoEmpresasPage";
import AvisoDetailPage from "./pages/avisos/AvisoDetailPage";
import MensageriaPage from "./pages/avisos/MensageriaPage";
import UsuariosPage from "./pages/UsuariosPage";
import BhLayout from "./components/bancohoras/BhLayout";
import BhDashboardPage from "./pages/bancoHoras/BhDashboardPage";
import BhImportPage from "./pages/bancoHoras/BhImportPage";
import BhEmployeesPage from "./pages/bancoHoras/BhEmployeesPage";
import BhParametrosPage from "./pages/bancoHoras/BhParametrosPage";
import BhAuditoriaPage from "./pages/bancoHoras/BhAuditoriaPage";
import FeriadosComunicadosPage from "./pages/FeriadosComunicadosPage";
import SucessoClienteListPage from "./pages/sucessoCliente/SucessoClienteListPage";
import SucessoClienteProfilePage from "./pages/sucessoCliente/SucessoClienteProfilePage";
import SucessoClienteReportsPage from "./pages/sucessoCliente/SucessoClienteReportsPage";
import GestaoCctPage from "./pages/sucessoCliente/GestaoCctPage";
import FeedbackPublicPage from "./pages/sucessoCliente/FeedbackPublicPage";
import EmpresaFeedbackPage from "./pages/sucessoCliente/EmpresaFeedbackPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            {/* Admissão — público (cliente preenchendo) */}
            <Route path="/admissao/preencher/:token" element={<PreencherPage />} />
            {/* Link aberto por formulário (cria a admissão automaticamente) */}
            <Route path="/admissao/publico/:templateId" element={<PublicoNovaPage />} />
            {/* Feedback — link público compartilhável */}
            <Route path="/feedback/:token" element={<FeedbackPublicPage />} />
            {/* Ferramenta de Feedback — link público por empresa */}
            <Route path="/empresa/:token/feedback" element={<EmpresaFeedbackPage />} />
            {/* Admissão — escritório (senha) */}
            <Route path="/admissao/escritorio/login" element={<EscritorioLoginPage />} />
            <Route element={<OfficeGuard />}>
              <Route element={<EscritorioLayout />}>
                <Route path="/admissao/escritorio" element={<EscritorioDashboardPage />} />
                <Route path="/admissao/escritorio/formularios" element={<FormulariosListPage />} />
                <Route path="/admissao/escritorio/formularios/:id" element={<FormularioEditorPage />} />
                <Route path="/admissao/escritorio/admissoes/nova" element={<AdmissaoNovaPage />} />
                <Route path="/admissao/escritorio/admissoes/:id" element={<AdmissaoDetalhePage />} />
                <Route path="/admissao/escritorio/arquivo" element={<ArquivoPage />} />
              </Route>
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Index />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/verbas" element={<VerbasPage />} />
              <Route path="/recibo" element={<ReciboPage />} />
              <Route path="/ponto" element={<PontoPage />} />
              <Route path="/custo-mensal" element={<CustoMensalPage />} />
              <Route path="/encargos" element={<EncargosPage />} />
              <Route path="/cprb" element={<CprbPage />} />
              <Route path="/rescisao-pdf" element={<RescisaoPdfPage />} />
              <Route path="/jornada" element={<JornadaPage />} />
              <Route path="/pdf-tools" element={<PdfToolsPage />} />
              <Route path="/avisos" element={<AvisosListPage />} />
              <Route path="/avisos/import" element={<AvisosImportPage />} />
              <Route path="/avisos/empresas" element={<AvisoEmpresasPage />} />
              <Route path="/avisos/mensageria" element={<MensageriaPage />} />
              <Route path="/avisos/:id" element={<AvisoDetailPage />} />
              <Route path="/provisoes-dsr" element={<ProvisoesDsrPage />} />
              <Route path="/feriados-comunicados" element={<FeriadosComunicadosPage />} />
              <Route path="/sucesso-cliente" element={<SucessoClienteListPage />} />
              <Route path="/sucesso-cliente/relatorios" element={<SucessoClienteReportsPage />} />
             <Route path="/sucesso-cliente/gestao-cct" element={<GestaoCctPage />} />
              <Route path="/sucesso-cliente/:id" element={<SucessoClienteProfilePage />} />
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/banco-horas" element={<BhLayout />}>
                <Route index element={<BhDashboardPage />} />
                <Route path="importar" element={<BhImportPage />} />
                <Route path="colaboradores" element={<BhEmployeesPage />} />
                <Route path="parametros" element={<BhParametrosPage />} />
                <Route path="auditoria" element={<BhAuditoriaPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
