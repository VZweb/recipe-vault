import { Link } from "react-router-dom";
import { BookOpen, ChefHat, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useRecipes } from "@/hooks/useRecipes";
import { useTags } from "@/hooks/useTags";
import { useCategories } from "@/hooks/useCategories";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Spinner } from "@/components/ui/Spinner";

export function HomePage() {
  const { recipes, loading } = useRecipes();
  const { tags } = useTags();
  const { categories } = useCategories();

  const recentRecipes = recipes.slice(0, 4);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white">
        <h1 className="font-heading text-3xl font-bold">Recipe Vault</h1>
        <p className="mt-2 text-brand-100 max-w-lg">
          Your personal recipe collection. Store, search, and discover what to
          cook with what you have.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/recipes/new">
            <Button
              variant="secondary"
              className="!bg-white !text-brand-700 hover:!bg-brand-50"
            >
              <Plus size={18} />
              Add Recipe
            </Button>
          </Link>
          <Link to="/suggestions">
            <Button
              variant="ghost"
              className="!text-white/90 hover:!bg-white/10 hover:!text-white"
            >
              <ChefHat size={18} />
              What Can I Cook?
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/recipes"
          className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow"
        >
          <BookOpen size={24} className="text-brand-600" />
          <span className="text-sm font-medium text-stone-700">
            {recipes.length} {recipes.length === 1 ? "Recipe" : "Recipes"}
          </span>
        </Link>
        <Link
          to="/suggestions"
          className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow"
        >
          <ChefHat size={24} className="text-orange-500" />
          <span className="text-sm font-medium text-stone-700">
            Suggestions
          </span>
        </Link>
        <Link
          to="/pantry"
          className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow"
        >
          <Package size={24} className="text-sky-500" />
          <span className="text-sm font-medium text-stone-700">
            My Pantry
          </span>
        </Link>
      </div>

      {/* Recent recipes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-semibold text-stone-800">
            Recent Recipes
          </h2>
          {recipes.length > 4 && (
            <Link
              to="/recipes"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : recentRecipes.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {recentRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} tags={tags} categories={categories} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-stone-200 p-12 text-center">
            <p className="text-stone-500">No recipes yet. Add your first one!</p>
            <Link to="/recipes/new" className="mt-4 inline-block">
              <Button>
                <Plus size={18} />
                Add Recipe
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
