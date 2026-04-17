import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}

const PdfToolCard = ({ icon: Icon, title, description, onClick, badge }: Props) => (
  <Card
    onClick={onClick}
    className="p-5 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
  >
    <div className="flex items-start gap-3">
      <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  </Card>
);

export default PdfToolCard;
