import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[admissao] falha ao renderizar seção:', error);
    // Erros de DOM causados por extensões/tradução automática: tenta remontar a seção
    if (/removeChild|insertBefore|is not a child of this node|não é filho/i.test(error.message)) {
      setTimeout(() => this.setState({ error: null }), 50);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm font-medium">Não foi possível carregar esta seção.</p>
          <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
          <p className="text-xs text-muted-foreground">
            Se o navegador estiver traduzindo a página, desative a tradução automática e tente novamente.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
