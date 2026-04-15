import {
  Bean,
  Beef,
  Cake,
  Cherry,
  CookingPot,
  Cookie,
  CupSoda,
  Egg,
  Fish,
  Flame,
  Leaf,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  Wheat,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const iconMap: Record<string, ComponentType<LucideProps>> = {
  utensils: Utensils,
  salad: Salad,
  soup: Soup,
  beef: Beef,
  fish: Fish,
  wheat: Wheat,
  pizza: Pizza,
  sandwich: Sandwich,
  "cooking-pot": CookingPot,
  "egg-fried": Egg,
  cookie: Cookie,
  cake: Cake,
  "cup-soda": CupSoda,
  cherry: Cherry,
  leaf: Leaf,
  bean: Bean,
  flame: Flame,
};

export const CATEGORY_ICON_OPTIONS = Object.keys(iconMap);

interface CategoryIconProps extends LucideProps {
  icon: string;
}

export function CategoryIcon({ icon, ...props }: CategoryIconProps) {
  const Icon = iconMap[icon] ?? Utensils;
  return <Icon {...props} />;
}
