import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, Sparkles, Image as ImageIcon, X, Calendar } from "lucide-react";
import { api } from "../api";

const TIMELINE_OPTIONS = [
  { value: "1_month", label: "1 Month", desc: "Quick sprint" },
  { value: "3_months", label: "3 Months", desc: "Sustainable build" },
  { value: "6_months", label: "6 Months", desc: "Gradual growth" },
  { value: "new_year", label: "New Year's", desc: "Fresh start" },
  { value: "1_year", label: "1 Year", desc: "Long-term vision" },
];

export default function Dump() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [timeline, setTimeline] = useState("3_months");
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload only image files");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target.result || "";
        const base64 = String(result).split(",")[1];
        if (!base64) return;
        setImages((prev) => [...prev, { file: file.name, base64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!text.trim()) {
      toast.error("Please enter your goals");
      return;
    }

    setLoading(true);

    try {
      await api.post("/goals/dump", {
        text,
        images: images.map((img) => img.base64),
        timeline,
      });

      toast.success("Your plan is ready! 🎉");
      navigate("/plan");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 px-6 pb-20" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="container mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: "#E1EBE6" }}>
            <Sparkles size={16} className="text-sage-600" />
            <span className="text-sm font-medium text-sage-800 font-body">Step 1</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold font-heading text-foreground tracking-tight">Dump it all here</h1>

          <p className="text-lg text-sage-700 font-body max-w-xl mx-auto">
            Goals, dreams, screenshots, vision boards. No structure needed—just let it flow.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" data-testid="dump-form">
          <div className="space-y-4">
            <label className="text-sm font-medium text-sage-800 font-body block flex items-center gap-2">
              <Calendar size={16} className="text-sage-600" />
              By when would you like to achieve this?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {TIMELINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTimeline(option.value)}
                  data-testid={`timeline-${option.value}`}
                  className={`glass rounded-2xl p-4 text-center transition-all hover:bg-white/80 ${
                    timeline === option.value ? "ring-2 ring-sage-400 bg-white/80" : ""
                  }`}
                >
                  <div className="text-base font-heading font-semibold text-foreground">{option.label}</div>
                  <div className="text-xs text-sage-600 font-body mt-1">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-sage-800 font-body block">Your goals & aspirations</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="goal-text-input"
              placeholder="I want to get in shape, travel more, grow my career, learn trading..."
              rows={12}
              className="w-full px-6 py-4 rounded-2xl text-lg font-body focus:outline-none focus:ring-4 transition-all resize-none"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.5)",
                border: "none",
                boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
                color: "#2D3748",
              }}
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-sage-800 font-body block">Vision board images (optional)</label>

            <label
              htmlFor="image-upload"
              data-testid="image-upload-label"
              className="glass rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-white/80 transition-all"
            >
              <Upload size={32} className="text-sage-400 mb-3" strokeWidth={1.5} />
              <span className="text-sage-700 font-body">Click to upload images</span>
              <span className="text-sm text-sage-500 font-body mt-1">PNG, JPG, WEBP</span>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                data-testid="image-upload-input"
              />
            </label>

            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="uploaded-images-list">
                {images.map((img, index) => (
                  <div key={index} className="relative glass rounded-2xl p-4 group">
                    <div className="flex items-center gap-3">
                      <ImageIcon size={20} className="text-sage-500" />
                      <span className="text-sm text-sage-700 font-body truncate flex-1">{img.file}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      data-testid={`remove-image-${index}`}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sage-100 hover:bg-sage-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} className="text-sage-700" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="create-plan-btn"
            className="w-full px-8 py-6 text-lg font-medium text-white rounded-full shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#7E9C8F",
              boxShadow: "0 4px 14px 0 rgba(126, 156, 143, 0.39)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Sparkles size={20} className="animate-pulse" />
                Creating your plan...
              </span>
            ) : (
              "Create My Plan"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
