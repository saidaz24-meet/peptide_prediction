import { motion } from 'framer-motion';
import { Download, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResultsKpis } from '@/components/ResultsKpis';
import { ResultsCharts } from '@/components/ResultsCharts';
import { PeptideTable } from '@/components/PeptideTable';
import { Legend } from '@/components/Legend';
import { useDatasetStore } from '@/stores/datasetStore';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function Results() {
  const { peptides, stats } = useDatasetStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to upload if no data
    if (peptides.length === 0) {
      navigate('/upload');
    }
  }, [peptides.length, navigate]);

  if (peptides.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
              <p className="text-muted-foreground mt-1">
                Comprehensive peptide analysis and visualizations
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Legend />
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <ResultsKpis stats={stats} />

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview & Charts</TabsTrigger>
              <TabsTrigger value="data">Data Table</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <ResultsCharts peptides={peptides} />
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <Card className="shadow-medium">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Peptide Dataset</CardTitle>
                      <CardDescription>
                        Interactive table with filtering and sorting capabilities
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search peptides..."
                          className="pl-9 w-64"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PeptideTable peptides={peptides} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}