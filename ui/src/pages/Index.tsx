import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Upload, BarChart3, Beaker, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center space-y-12"
        >
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-center w-20 h-20 mx-auto bg-primary/10 rounded-2xl">
              <Beaker className="w-10 h-10 text-primary" />
            </div>
            
            <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Peptide Visual Lab
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your peptide datasets into comprehensive visualizations and insights. 
              Upload CSV files and instantly generate publication-ready analysis.
            </p>
            
            <Link to="/upload">
              <Button size="lg" className="text-lg px-8 py-6">
                <Upload className="w-5 h-5 mr-2" />
                Upload Dataset
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card className="shadow-medium">
              <CardHeader>
                <Upload className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Easy Upload</CardTitle>
                <CardDescription>
                  Support for CSV and Excel files with smart column mapping
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <BarChart3 className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Rich Visualizations</CardTitle>
                <CardDescription>
                  Scatter plots, distributions, radar charts, and more
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <Beaker className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Scientific Analysis</CardTitle>
                <CardDescription>
                  Hydrophobicity, charge, helix content, and SSW predictions
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
