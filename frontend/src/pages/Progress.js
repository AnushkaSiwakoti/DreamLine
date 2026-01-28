import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, CheckCircle2, Circle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "../api";

export default function Progress() {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await api.get("/progress");
      setProgress(response.data);
    } catch (error) {
      toast.error("Failed to load progress");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-sage-600 font-body">Loading...</div>
        </div>
      </div>
    );
  }

  if (!progress || progress.total_actions === 0) {
    return (
      <div className="min-h-screen pt-32 px-6" style={{ backgroundColor: "#FDFBF7" }}>
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">No progress yet</h1>
            <p className="text-lg text-sage-700 font-body">Start completing your daily actions to see your progress!</p>
          </div>
        </div>
      </div>
    );
  }

  const actionsByDate = progress.actions.reduce((acc, action) => {
    const date = action.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(action);
    return acc;
  }, {});

  const dates = Object.keys(actionsByDate).sort().reverse();

  return (
    <div className="min-h-screen pt-32 px-6 pb-20" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="container mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">Your Progress</h1>
          <p className="text-lg text-sage-700 font-body">Every step counts</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6" data-testid="progress-stats">
          <div className="glass rounded-[2rem] p-8 text-center space-y-2">
            <div className="text-4xl font-heading font-bold text-sage-600">{progress.completion_rate}%</div>
            <div className="text-sm font-medium text-sage-700 font-body uppercase tracking-wide">Completion Rate</div>
          </div>

          <div className="glass rounded-[2rem] p-8 text-center space-y-2">
            <div className="text-4xl font-heading font-bold text-sage-600">{progress.completed_actions}</div>
            <div className="text-sm font-medium text-sage-700 font-body uppercase tracking-wide">Completed</div>
          </div>

          <div className="glass rounded-[2rem] p-8 text-center space-y-2">
            <div className="text-4xl font-heading font-bold text-sage-600">{progress.total_actions}</div>
            <div className="text-sm font-medium text-sage-700 font-body uppercase tracking-wide">Total Actions</div>
          </div>
        </div>

        <div className="space-y-6" data-testid="progress-history">
          <h2 className="text-2xl font-heading font-semibold text-foreground">Recent Activity</h2>

          {dates.map((date) => {
            const dayActions = actionsByDate[date];
            const completed = dayActions.filter((a) => a.completed).length;
            const total = dayActions.length;

            return (
              <div key={date} className="glass rounded-[2rem] p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-heading font-semibold text-foreground">
                      {format(parseISO(date), "EEEE, MMMM d")}
                    </h3>
                    <p className="text-sm text-sage-600 font-body mt-1">
                      {completed} of {total} completed
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E1EBE6" }}>
                      <span className="text-lg font-heading font-bold text-sage-700">
                        {Math.round((completed / total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {dayActions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center gap-4 p-4 rounded-xl"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                    >
                      {action.completed ? (
                        <CheckCircle2 size={20} className="text-sage-500 flex-shrink-0" strokeWidth={1.5} />
                      ) : (
                        <Circle size={20} className="text-sage-300 flex-shrink-0" strokeWidth={1.5} />
                      )}

                      <div className="flex-1">
                        <div className="text-xs font-medium text-sage-600 font-body uppercase tracking-wide">
                          {action.focus_area}
                        </div>
                        <div className={`text-base font-body ${action.completed ? "opacity-60" : "opacity-100"}`} style={{ color: "#2D3748" }}>
                          {action.action}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
