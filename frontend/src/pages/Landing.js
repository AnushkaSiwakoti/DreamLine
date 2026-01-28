import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFBF7' }}>
      {/* Hero Section */}
      <div className="container mx-auto px-6 py-24 max-w-6xl">
        <div className="text-center space-y-8 mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: '#E1EBE6' }}>
            <Sparkles size={16} className="text-sage-600" />
            <span className="text-sm font-medium text-sage-800 font-body">DreamLine</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold font-heading text-foreground tracking-tight leading-[1.1]">
            Dump your goals.
            <br />
            <span className="text-sage-500">Get a clear plan.</span>
          </h1>
          
          <p className="text-lg md:text-xl leading-relaxed text-sage-700 font-body max-w-2xl mx-auto">
            Turn vague aspirations into daily actions. No overwhelming lists, just gentle progress.
          </p>
          
          <Link
            to="/auth"
            data-testid="get-started-btn"
            className="inline-flex items-center gap-2 px-8 py-6 text-lg font-medium text-white rounded-full shadow-lg hover:-translate-y-1 transition-all"
            style={{
              backgroundColor: '#7E9C8F',
              boxShadow: '0 4px 14px 0 rgba(126, 156, 143, 0.39)'
            }}
          >
            Get Started
            <ArrowRight size={20} />
          </Link>
        </div>

        {/* How It Works */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <div className="glass rounded-[2rem] p-8 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E1EBE6' }}>
              <span className="text-2xl font-heading font-bold text-sage-700">1</span>
            </div>
            <h3 className="text-2xl font-heading font-semibold text-foreground">Dump</h3>
            <p className="text-base leading-relaxed text-sage-700 font-body">
              Paste your goals, vision board images, or messy thoughts. No structure needed.
            </p>
          </div>

          <div className="glass rounded-[2rem] p-8 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E1EBE6' }}>
              <span className="text-2xl font-heading font-bold text-sage-700">2</span>
            </div>
            <h3 className="text-2xl font-heading font-semibold text-foreground">Translate</h3>
            <p className="text-base leading-relaxed text-sage-700 font-body">
              AI extracts themes and creates your big picture plan with focus areas.
            </p>
          </div>

          <div className="glass rounded-[2rem] p-8 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E1EBE6' }}>
              <span className="text-2xl font-heading font-bold text-sage-700">3</span>
            </div>
            <h3 className="text-2xl font-heading font-semibold text-foreground">Progress</h3>
            <p className="text-base leading-relaxed text-sage-700 font-body">
              Get one small daily action. No guilt, just gentle check-ins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}