import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Filter, Plus, Search, X } from "lucide-react";
import { useRecipes } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { useIngredients } from "@/hooks/useIngredients";
import { buildSearchIndex } from "@/lib/search";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { TagChip } from "@/components/ui/TagChip";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { TAG_CATEGORIES } from "@/types/tag";

type SortOption = "newest" | "oldest" | "a-z" | "z-a" | "fastest" | "most-cooked";

export function RecipeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const t = searchParams.get("tag");
    return t ? [t] : [];
  });
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    () => searchParams.get("category") || undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTagCategory, setActiveTagCategory] = useState<string | null>(null);

  const tagFilter = useMemo(
    () => (selectedTags.length > 0 ? selectedTags : undefined),
    [selectedTags]
  );
  const { recipes, loading } = useRecipes(tagFilter, selectedCategory);
  const { tags } = useTags();
  const { categories } = useCategories();
  const { ingredients: masterIngredients } = useIngredients();

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const searchIndex = useMemo(
    () => buildSearchIndex(recipes, tags, categories, masterIngredients),
    [recipes, tags, categories, masterIngredients]
  );

  const filteredAndSorted = useMemo(() => {
    let result = recipes;

    if (searchQuery.trim()) {
      const hits = searchIndex.search(searchQuery.trim());
      const hitIds = new Set(hits.map((h) => h.item.id));
      result = result.filter((r) => hitIds.has(r.id));
    }

    const sorted = [...result];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case "a-z":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "z-a":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "fastest": {
        const totalTime = (r: (typeof recipes)[0]) =>
          (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0) || Infinity;
        sorted.sort((a, b) => totalTime(a) - totalTime(b));
        break;
      }
      case "most-cooked":
        sorted.sort((a, b) => b.cookedCount - a.cookedCount);
        break;
    }

    return sorted;
  }, [recipes, searchQuery, sortBy, searchIndex]);

  const activeCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeCategory && (
            <CategoryIcon icon={activeCategory.icon} size={22} className="text-brand-600" />
          )}
          <h1 className="text-2xl font-bold text-stone-800">
            {activeCategory ? activeCategory.name : "Recipes"}
          </h1>
        </div>
        <Link to="/recipes/new">
          <Button>
            <Plus size={18} />
            Add Recipe
          </Button>
        </Link>
      </div>
      {activeCategory?.description && (
        <p className="text-sm text-stone-500 -mt-3">{activeCategory.description}</p>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="a-z">A → Z</option>
          <option value="z-a">Z → A</option>
          <option value="fastest">Fastest first</option>
          <option value="most-cooked">Most cooked</option>
        </select>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Active filters + toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              filtersOpen
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50"
            }`}
          >
            <Filter size={14} />
            Filters
            {(selectedTags.length > 0 || selectedCategory) && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {selectedTags.length + (selectedCategory ? 1 : 0)}
              </span>
            )}
          </button>

          {activeCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              <CategoryIcon icon={activeCategory.icon} size={14} />
              {activeCategory.name}
              <button
                onClick={() => {
                  setSelectedCategory(undefined);
                  setSearchParams((prev) => {
                    prev.delete("category");
                    return prev;
                  });
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-brand-200 transition-colors"
                aria-label="Remove category filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {selectedTags.map((id) => {
            const tag = tags.find((t) => t.id === id);
            if (!tag) return null;
            return (
              <TagChip
                key={id}
                name={tag.name}
                color={tag.color}
                selected
                onRemove={() => toggleTag(id)}
              />
            );
          })}

          {(selectedTags.length > 0 || selectedCategory) && (
            <button
              onClick={() => {
                setSelectedTags([]);
                setSelectedCategory(undefined);
                setSearchParams((prev) => {
                  prev.delete("category");
                  return prev;
                });
              }}
              className="text-xs text-stone-500 hover:text-stone-700 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
            {/* Category dropdown */}
            {categories.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-500 uppercase tracking-wide w-16 flex-shrink-0">
                  Category
                </span>
                <select
                  value={selectedCategory ?? ""}
                  onChange={(e) => {
                    const next = e.target.value || undefined;
                    setSelectedCategory(next);
                    setSearchParams((prev) => {
                      if (next) prev.set("category", next);
                      else prev.delete("category");
                      return prev;
                    });
                  }}
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tag category tabs */}
            {tags.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {TAG_CATEGORIES.map((cat) => {
                    const catTags = tags.filter((t) => t.category === cat);
                    if (catTags.length === 0) return null;
                    const isActive = activeTagCategory === cat;
                    const count = catTags.filter((t) =>
                      selectedTags.includes(t.id)
                    ).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setActiveTagCategory(isActive ? null : cat)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {cat}
                        {count > 0 && (
                          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeTagCategory && (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3">
                    {tags
                      .filter((t) => t.category === activeTagCategory)
                      .map((tag) => (
                        <TagChip
                          key={tag.id}
                          name={tag.name}
                          color={tag.color}
                          selected={selectedTags.includes(tag.id)}
                          onClick={() => toggleTag(tag.id)}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredAndSorted.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} tags={tags} categories={categories} />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={48} />}
          title="No recipes yet"
          description="Start building your recipe collection by adding your first recipe."
          action={
            <Link to="/recipes/new">
              <Button>
                <Plus size={18} />
                Add Your First Recipe
              </Button>
            </Link>
          }
        />
      ) : (
        <EmptyState
          icon={<Search size={48} />}
          title="No results"
          description="Try adjusting your search or filters."
        />
      )}
    </div>
  );
}
