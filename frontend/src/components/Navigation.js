import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Target, TrendingUp, LogOut } from 'lucide-react';

export default function Navigation({ onLogout }) {
  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50" style={{ width: 'fit-content' }}>
      <div className="glass rounded-full px-6 py-3 shadow-lg flex items-center gap-6">
        <Link
          to="/dashboard"
          data-testid="nav-dashboard"
          className="flex items-center gap-2 text-sage-700 hover:text-sage-900 transition-colors px-3 py-2 rounded-full hover:bg-sage-50"
        >
          <Home size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium font-body">Today</span>
        </Link>
        <Link
          to="/dump"
          data-testid="nav-dump"
          className="flex items-center gap-2 text-sage-700 hover:text-sage-900 transition-colors px-3 py-2 rounded-full hover:bg-sage-50"
        >
          <Target size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium font-body">Dump</span>
        </Link>
        <Link
          to="/plan"
          data-testid="nav-plan"
          className="flex items-center gap-2 text-sage-700 hover:text-sage-900 transition-colors px-3 py-2 rounded-full hover:bg-sage-50"
        >
          <TrendingUp size={18} strokeWidth={1.5} />
          <span className="text-sm font-medium font-body">Plan</span>
        </Link>
        <button
          onClick={onLogout}
          data-testid="nav-logout"
          className="flex items-center gap-2 text-sage-700 hover:text-sage-900 transition-colors px-3 py-2 rounded-full hover:bg-sage-50"
        >
          <LogOut size={18} strokeWidth={1.5} />
        </button>
      </div>
    </nav>
  );
}