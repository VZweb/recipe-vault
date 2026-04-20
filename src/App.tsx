import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { RecipeListPage } from "@/pages/RecipeListPage";
import { RecipeDetailPage } from "@/pages/RecipeDetailPage";
import { RecipeEditorPage } from "@/pages/RecipeEditorPage";
import { OrganizePage } from "@/pages/OrganizePage";
import { PantryPage } from "@/pages/PantryPage";
import { IngredientsPage } from "@/pages/IngredientsPage";
import { SuggestionsPage } from "@/pages/SuggestionsPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="recipes" element={<RecipeListPage />} />
          <Route path="recipes/new" element={<RecipeEditorPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="recipes/:id/edit" element={<RecipeEditorPage />} />
          <Route path="organize" element={<OrganizePage />} />
          <Route path="categories" element={<Navigate to="/organize" replace />} />
          <Route path="tags" element={<Navigate to="/organize?tab=tags" replace />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="suggestions" element={<SuggestionsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
