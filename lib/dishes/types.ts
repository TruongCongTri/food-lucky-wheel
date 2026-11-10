export type Dish = {
  id: string;
  name: { vi: string; en: string };
  emoji: string;
  /** Keyword used when searching Google Maps. Defaults to the Vietnamese name. */
  searchKeyword: string;
  /** Real photo (Wikimedia Commons by default). Null → the emoji is used. */
  image?: string | null;
  /** Source page for attribution. */
  imagePage?: string | null;
  active: boolean;
  createdAt: string;
};

export type NewDishInput = {
  nameVi: string;
  nameEn?: string;
  emoji?: string;
  /** Optional manual photo URL; otherwise one is looked up automatically. */
  imageUrl?: string;
};
