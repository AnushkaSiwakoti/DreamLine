import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Circle, Sparkles, ArrowRight, Flame, RotateCcw, Trash2 } from "lucide-react";

import WeeklySummary from "../components/WeeklySummary";
import { api } from "../api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [actions, setActions] = useState([]);
  const [streak, setStreak] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      await Promise.all([checkForPlan(), fetchStreak(), fetchTodayActions()]);
    } finally {
      setLoading(false);
    }
  };

  const checkForPlan = async () => {
    try {
      const response = await api.get("/plans/current");
      setHasPlan(!!response.data);
    } catch (error) {
      console.error("Error checking plan:", error);
      setHasPlan(false);
    }
  };

  const fetchStreak = async () => {
    try {
      const response = await api.get("/streak");
      setStreak(response.data);
    } catch (error) {
      console.error("Error fetching streak:", error);
    }
  };

  const fetchTodayActions = async () => {
    try {
      const response = await api.get("/daily/today");
      const sorted = [...response.data].sort((a, b) => {
        if (a.completed === b.completed) return 0;
        return a.completed ? 1 : -1;
      });
      setActions(sorted);
    } catch (error) {
      toast.error("Failed to load today's actions");
      setActions([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTodayActions();
      await fetchStreak();
      toast.success("Updated ✨");
    } catch (e) {
      // fetchTodayActions already toasts on error
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckIn = async (actionId, completed) => {
    try {
      await api.post("/daily/check-in", {
        action_id: actionId,
        completed: completed,
      });

      const updatedActions = actions
        .map((action) => (action.id === actionId ? { ...action, completed } : action))
        .sort((a, b) => {
          if (a.completed === b.completed) return 0;
          return a.completed ? 1 : -1;
        });

      setActions(updatedActions);

      if (completed) {
        toast.success("Great work! 🌟");
        fetchStreak();
      } else {
        toast("That's okay! It'll be here tomorrow", {
          description: "No pressure, just gentle progress",
        });
      }
    } catch (error) {
      toast.error("Failed to update action");
    }
  };

  
  

  const hasAnyActions = actions.length > 0;

  const pendingCount = useMemo(() => actions.filter((a) => !a.completed).length, [actions]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-4xl">
          <div className="text-center text-sage-600 font-body">Loading...</div>
        </div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-8">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ backgroundColor: "#E1EBE6" }}
            >
              <Sparkles size={16} className="text-sage-600" />
              <span className="text-sm font-medium text-sage-800 font-body">Let's get started</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">
              Ready to make it happen?
            </h1>

            <p className="text-lg text-sage-700 font-body max-w-xl mx-auto">
              Start by dumping your goals, dreams, and vision. We'll turn them into a clear plan.
            </p>

            <Link
              to="/dump"
              data-testid="start-dump-btn"
              className="inline-flex items-center gap-2 px-8 py-6 text-lg font-medium text-white rounded-full shadow-lg hover:-translate-y-1 transition-all"
              style={{
                backgroundColor: "#7E9C8F",
                boxShadow: "0 4px 14px 0 rgba(126, 156, 143, 0.39)",
              }}
            >
              Dump Your Goals
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 px-6 pb-20" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="container mx-auto max-w-4xl space-y-12">
        {streak && (
          <div className="glass rounded-[2rem] p-8" data-testid="streak-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#E1EBE6" }}
                >
                  <Flame size={28} className="text-sage-600" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-3xl font-heading font-bold text-foreground">
                    {streak.current_streak} {streak.current_streak === 1 ? "day" : "days"}
                  </div>
                  <div className="text-sm text-sage-700 font-body mt-1">{streak.message}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-sage-600 font-body uppercase tracking-wide">Longest</div>
                <div className="text-2xl font-heading font-bold text-sage-700">{streak.longest_streak}</div>
              </div>
            </div>
          </div>
        )}

        

        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">Today</h1>
          <p className="text-lg text-sage-700 font-body">
            Small steps toward your goals {hasAnyActions ? `• ${pendingCount} left` : ""}
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-body font-medium transition-all hover:-translate-y-[1px] disabled:opacity-60"
              style={{
                backgroundColor: "#E1EBE6",
                color: "#2D3748",
              }}
              data-testid="refresh-today-btn"
              title="Refresh today's actions"
            >
              <RotateCcw size={18} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            
          </div>
        </div>

        {!hasAnyActions ? (
          <div className="glass rounded-[2rem] p-12 text-center">
            <p className="text-lg text-sage-700 font-body">
              No actions loaded for today yet.
            </p>
            <p className="text-sm text-sage-600 font-body mt-3">
              Try <span className="font-medium">Refresh</span>. (If it’s very early, your new actions may appear after the daily roll-over.)
            </p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="daily-actions-list">
            {actions.map((action) => (
              <div
                key={action.id}
                data-testid={`action-item-${action.id}`}
                className="glass rounded-[2rem] p-8 hover:bg-white/80 transition-all"
              >
                <div className="flex items-start gap-6">
                  <button
                    className="mt-1 flex-shrink-0 transition-all"
                    onClick={() => handleCheckIn(action.id, !action.completed)}
                    data-testid={`action-checkbox-${action.id}`}
                  >
                    {action.completed ? (
                      <CheckCircle2 size={32} className="text-sage-500 animate-bloom" strokeWidth={1.5} />
                    ) : (
                      <Circle
                        size={32}
                        className="text-sage-300 hover:text-sage-400 transition-colors"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="text-sm font-medium tracking-wide uppercase text-sage-600 font-body">
                        {action.focus_area}
                      </div>
                      <div
                        className={`text-xl font-accent font-medium transition-opacity mt-2 ${
                          action.completed ? "opacity-60" : "opacity-100"
                        }`}
                        style={{ color: "#2D3748" }}
                      >
                        {action.action}
                      </div>

                      {action.rescheduled_from && !action.completed && (
                        <div className="text-sm text-sage-500 font-body mt-2 italic">
                          Moved from yesterday - no pressure, just when you're ready 🌿
                        </div>
                      )}

                      {action.completed && (
                        <div className="text-sm text-sage-600 font-body mt-2">✓ Completed</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <WeeklySummary />

        <div className="text-center pt-8">
          <Link
            to="/plan"
            data-testid="view-plan-link"
            className="inline-flex items-center gap-2 text-sage-700 hover:text-sage-900 font-body font-medium transition-colors"
          >
            View your full plan
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
