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
              <Route path="/provisoes-dsr" element={<ProvisoesDsrPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
