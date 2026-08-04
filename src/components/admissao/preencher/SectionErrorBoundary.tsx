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
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center space-y-3">
          <AlertTriangle className="w-6 h-6 mx-auto text-destructive" />
          <p className="text-sm font-medium">Não foi possível carregar esta seção.</p>
          <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Recarregar página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SectionErrorBoundary;
