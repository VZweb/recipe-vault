import { useSearchParams } from "react-router-dom";
import { FolderOpen, Tags } from "lucide-react";
import { CategoriesPage } from "./CategoriesPage";
import { TagsPage } from "./TagsPage";

const tabs = [
  { key: "categories", label: "Categories", icon: FolderOpen },
  { key: "tags", label: "Tags", icon: Tags },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function OrganizePage() {
  const [params, setParams] = useSearchParams();
  const activeTab = (tabs.find((t) => t.key === params.get("tab"))?.key ??
    "categories") as TabKey;

  const switchTab = (key: TabKey) => {
    setParams(key === "categories" ? {} : { tab: key }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Organize</h1>

      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-white text-brand-700 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "categories" ? <CategoriesPage embedded /> : <TagsPage embedded />}
    </div>
  );
}
