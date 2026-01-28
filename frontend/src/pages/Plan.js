import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Target, Calendar, TrendingUp, ArrowRight } from "lucide-react";
import { api } from "../api";

export default function Plan() {
  const [plans, setPlans] = useState([]); // active plans only
  const [loading, setLoading] = useState(true);
  const [startingFresh, setStartingFresh] = useState(false);

  const navigate = useNavigate();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/plans");
      const all = Array.isArray(response.data) ? response.data : [];

      // ✅ Only show active plans
      const active = all.filter((p) => (p?.status || "active") === "active");

      setPlans(active);
    } catch (error) {
      console.error("Error loading plans:", error);
      toast.error("Failed to load plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ✅ Flatten focus areas across all active plans
  const allFocusAreas = useMemo(() => {
    const areas = [];
    for (const plan of plans) {
      const fa = Array.isArray(plan?.focus_areas) ? plan.focus_areas : [];
      for (const area of fa) {
        areas.push(area);
      }
    }
    return areas;
  }, [plans]);

  const handleStartFresh = useCallback(async () => {
    const ok = window.confirm(
      "Start fresh?\n\nThis will archive ALL your current plans and clear today’s tasks."
    );
    if (!ok) return;

    setStartingFresh(true);
    try {
      await api.post("/plans/start-fresh");
      toast.success("Fresh start 🌱");
      navigate("/dump");
    } catch (err) {
      console.error("Start fresh failed:", err);
      toast.error("Could not start fresh");
    } finally {
      setStartingFresh(false);
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-sage-600 font-body">Loading...</div>
        </div>
      </div>
    );
  }

  if (allFocusAreas.length === 0) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">
              No focus areas yet
            </h1>
            <p className="text-lg text-sage-700 font-body">
              Dump your goals to generate focus areas and daily actions.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                to="/dump"
                data-testid="create-first-plan-btn"
                className="inline-flex items-center gap-2 px-8 py-6 text-lg font-medium text-white rounded-full shadow-lg hover:-translate-y-1 transition-all"
                style={{
                  backgroundColor: "#7E9C8F",
                  boxShadow: "0 4px 14px 0 rgba(126, 156, 143, 0.39)",
                }}
              >
                Create Your Plan
                <ArrowRight size={20} />
              </Link>

              <button
                type="button"
                onClick={handleStartFresh}
                disabled={startingFresh}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-full text-sm font-medium font-body transition-all disabled:opacity-60"
                style={{ backgroundColor: "#F3E7E7", color: "#2D3748" }}
                data-testid="start-fresh-btn"
                title="Archive all plans and clear today"
              >
                {startingFresh ? "Starting fresh..." : "Start fresh"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 px-6 pb-20" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="container mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleStartFresh}
              disabled={startingFresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium font-body transition-all disabled:opacity-60"
              style={{ backgroundColor: "#F3E7E7", color: "#2D3748" }}
              title="Archive all plans and clear today"
              data-testid="start-fresh-btn"
            >
              {startingFresh ? "Starting fresh..." : "Start fresh"}
            </button>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">
            Your Focus Areas
          </h1>
          <p className="text-lg text-sage-700 font-body">All active plans combined</p>
        </div>

        {/* Focus areas grid */}
        <div className="grid md:grid-cols-2 gap-8" data-testid="focus-areas-grid">
          {allFocusAreas.map((area, index) => (
            <div
              key={`${area?.name || "area"}-${index}`}
              data-testid={`focus-area-${index}`}
              className="glass rounded-[2rem] p-8 space-y-6 hover:bg-white/80 hover:-translate-y-1 transition-all"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{ backgroundColor: "#E1EBE6" }}>
                  <Target size={14} className="text-sage-600" />
                  <span className="text-xs font-medium text-sage-800 font-body uppercase tracking-wide">
                    Focus Area
                  </span>
                </div>

                <h3 className="text-2xl md:text-3xl font-heading font-semibold text-foreground">
                  {area?.name || "Focus"}
                </h3>

                {area?.description && (
                  <p className="text-base text-sage-700 font-body leading-relaxed">{area.description}</p>
                )}
              </div>

              {area?.success_looks_like && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-sage-600 font-body uppercase tracking-wide">
                    Success looks like
                  </div>
                  <p className="text-base text-foreground font-body">{area.success_looks_like}</p>
                </div>
              )}

              {Array.isArray(area?.outcomes) && area.outcomes.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-sage-600 font-body uppercase tracking-wide">
                    Key Outcomes
                  </div>
                  <ul className="space-y-2">
                    {area.outcomes.map((outcome, i) => (
                      <li key={`${index}-outcome-${i}`} className="flex items-start gap-2">
                        <span className="text-sage-400 mt-1">•</span>
                        <span className="text-base text-foreground font-body flex-1">{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 border-t border-sage-200/50 space-y-4">
                {area?.monthly_direction && (
                  <div className="flex items-start gap-3">
                    <Calendar size={18} className="text-sage-500 mt-1 flex-shrink-0" strokeWidth={1.5} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-sage-700 font-body">This Month</div>
                      <p className="text-base text-foreground font-body">{area.monthly_direction}</p>
                    </div>
                  </div>
                )}

                {area?.weekly_focus && (
                  <div className="flex items-start gap-3">
                    <TrendingUp size={18} className="text-sage-500 mt-1 flex-shrink-0" strokeWidth={1.5} />
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-sage-700 font-body">This Week</div>
                      <p className="text-base text-foreground font-body">{area.weekly_focus}</p>
                    </div>
                  </div>
                )}

                {area?.daily_action && (
                  <div className="glass rounded-xl p-4" style={{ backgroundColor: "rgba(126, 156, 143, 0.1)" }}>
                    <div className="text-sm font-accent font-medium text-sage-700 mb-1">Today's action</div>
                    <p className="text-base font-accent font-medium text-foreground">{area.daily_action}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-8">
          <Link
            to="/dashboard"
            data-testid="back-to-today-link"
            className="inline-flex items-center gap-2 text-sage-700 hover:text-sage-900 font-body font-medium transition-colors"
          >
            <ArrowRight size={18} className="rotate-180" />
            Back to today
          </Link>
        </div>
      </div>
    </div>
  );
}
