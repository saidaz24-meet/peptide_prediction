import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function Legend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="w-4 h-4 mr-2" />
          Legend
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div>
            <h4 className="font-semibold text-sm mb-3">Color Conventions</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Chameleon Positive</span>
                <Badge className="bg-chameleon-positive text-white">
                  Positive
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chameleon Negative</span>
                <Badge variant="secondary">
                  Negative
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Chameleon Not Available</span>
                <Badge variant="outline">
                  Not available
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Helix Segments</span>
                <div className="w-4 h-4 rounded bg-helix"></div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-semibold text-sm mb-3">Metric Ranges</h4>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div>Hydrophobicity: -2.0 to +2.0</div>
              <div>Hydrophobic Moment: 0.0 to 1.0</div>
              <div>FF-Helix: 0% to 100%</div>
              <div>Charge: Positive/Negative values</div>
            </div>
          </div>
          
          <Separator />
          
          <div className="text-xs text-muted-foreground">
            <p>Click any data point or table row to view detailed analysis</p>
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}