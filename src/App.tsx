import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { RecipeListPage } from "@/pages/RecipeListPage";
import { RecipeDetailPage } from "@/pages/RecipeDetailPage";
import { RecipeEditorPage } from "@/pages/RecipeEditorPage";
import { TagsPage } from "@/pages/TagsPage";
import { PantryPage } from "@/pages/PantryPage";
import { SuggestionsPage } from "@/pages/SuggestionsPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="recipes" element={<RecipeListPage />} />
        <Route path="recipes/new" element={<RecipeEditorPage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route path="recipes/:id/edit" element={<RecipeEditorPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="suggestions" element={<SuggestionsPage />} />
      </Route>
    </Routes>
  );
}
