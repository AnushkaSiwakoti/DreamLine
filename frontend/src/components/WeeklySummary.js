import React, { useEffect, useState } from "react";
import { Calendar, Sparkles } from "lucide-react";
import { api } from "../api";

export default function WeeklySummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetchWeeklySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWeeklySummary = async () => {
    try {
      const res = await api.get("/weekly-summary"); // token attached by interceptor
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching weekly summary:", err?.response?.data || err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) return null;
  if (!summary.total_actions || summary.total_actions === 0) return null;

  const wins = Array.isArray(summary.wins) ? summary.wins : [];
  const focusAreas = Array.isArray(summary.focus_areas_progress)
    ? summary.focus_areas_progress
    : [];

  return (
    <div className="glass rounded-2xl p-6 space-y-4" data-testid="weekly-summary">
      {/* Header */}
      <div>
        <div
          className="inline-flex items-center gap-2 px-2 py-1 rounded-full mb-2"
          style={{ backgroundColor: "#E1EBE6" }}
        >
          <Calendar size={12} className="text-sage-600" />
          <span className="text-xs font-medium text-sage-800 font-body uppercase tracking-wide">
            This Week
          </span>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            Progress
          </h3>

          <div className="text-right">
            <div className="text-2xl font-heading font-bold text-sage-600">
              {summary.completion_rate}%
            </div>
            <div className="text-xs text-sage-600 font-body">
              {summary.completed_actions}/{summary.total_actions}
            </div>
          </div>
        </div>
      </div>

      {/* Momentum Message */}
      {summary.momentum_message && (
        <div
          className="p-3 rounded-xl"
          style={{ backgroundColor: "rgba(126, 156, 143, 0.1)" }}
        >
          <p className="text-sm font-body text-foreground">
            {summary.momentum_message}
          </p>
        </div>
      )}

      {/* Recent Wins */}
      {wins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-sage-600" />
            <div className="text-xs font-medium text-sage-700 font-body uppercase tracking-wide">
              This Week&apos;s Steps
            </div>
          </div>

          <div className="space-y-1">
            {wins.slice(0, 3).map((win, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm text-sage-700 font-body"
              >
                <span className="text-sage-400 mt-0.5">✓</span>
                <span className="line-clamp-1">{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Areas Progress */}
      {focusAreas.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-sage-200/30">
          <div className="text-xs font-medium text-sage-700 font-body uppercase tracking-wide">
            By Focus Area
          </div>

          <div className="space-y-2">
            {focusAreas.map((area, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-foreground">
                    {area.name}
                  </span>
                  <span className="text-xs text-sage-600 font-body">
                    {area.completed}/{area.total}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-sage-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage-400 transition-all"
                    style={{ width: `${area.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
