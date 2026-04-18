import { Link, useNavigate } from "react-router-dom";
import { ChefHat, Clock, Users } from "lucide-react";
import type { Recipe } from "@/types/recipe";
import type { Tag } from "@/types/tag";
import type { Category } from "@/types/category";
import { TagChip } from "@/components/ui/TagChip";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

interface RecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  categories?: Category[];
}

export function RecipeCard({ recipe, tags, categories = [] }: RecipeCardProps) {
  const navigate = useNavigate();
  const totalTime =
    (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0) || null;

  const recipeTags = tags.filter((t) => recipe.tags.includes(t.id));
  const category = categories.find((c) => c.id === recipe.categoryId);

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-stone-300"
    >
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-stone-100">
        {recipe.imageUrls.length > 0 ? (
          <img
            src={recipe.imageUrls[0]}
            alt={recipe.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <svg
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="text-sm sm:text-base font-semibold text-stone-900 group-hover:text-brand-700 transition-colors line-clamp-2 sm:line-clamp-1">
          {recipe.title}
        </h3>
        {recipe.description && (
          <p className="mt-1 text-xs sm:text-sm text-stone-500 line-clamp-1 hidden sm:block">
            {recipe.description}
          </p>
        )}

        {/* Category + Tags */}
        {(category || recipeTags.length > 0) && (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5">
            {category && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/recipes?category=${category.id}`);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors"
              >
                <CategoryIcon icon={category.icon} size={12} />
                <span className="hidden sm:inline">{category.name}</span>
              </button>
            )}
            {recipeTags.slice(0, 2).map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
            <span className="hidden sm:contents">
              {recipeTags.slice(2, 3).map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </span>
            {recipeTags.length > 3 && (
              <span className="text-xs text-stone-400">
                +{recipeTags.length - 3}
              </span>
            )}
            {recipeTags.length === 3 && (
              <span className="sm:hidden text-xs text-stone-400">
                +1
              </span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="mt-auto flex items-center gap-2 sm:gap-4 pt-2 sm:pt-3 text-[11px] sm:text-xs text-stone-400">
          {totalTime && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {totalTime} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users size={14} />
              {recipe.servings}
            </span>
          )}
          {recipe.cookedCount > 0 && (
            <span className="flex items-center gap-1 text-brand-600 font-medium">
              <ChefHat size={14} />
              {recipe.cookedCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
