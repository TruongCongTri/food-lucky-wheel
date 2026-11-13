import { connection } from "next/server";
import { createDish, DishError, listDishes, storageFailure } from "@/lib/dishes/store";
import { isAuthorized } from "@/lib/admin";

export async function GET(request: Request) {
  await connection();
  const onlyActive = new URL(request.url).searchParams.get("active") === "1";
  const dishes = await listDishes();
  return Response.json(
    { dishes: onlyActive ? dishes.filter((d) => d.active) : dishes },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { nameVi?: unknown; nameEn?: unknown; emoji?: unknown; imageUrl?: unknown }
    | null;
  if (!body || typeof body.nameVi !== "string") {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }
  try {
    const dish = await createDish({
      nameVi: body.nameVi,
      nameEn: typeof body.nameEn === "string" ? body.nameEn : undefined,
      emoji: typeof body.emoji === "string" ? body.emoji : undefined,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
    });
    return Response.json({ dish }, { status: 201 });
  } catch (err) {
    if (err instanceof DishError) {
      return Response.json(
        { error: err.code },
        { status: err.code === "duplicate" ? 409 : 400 },
      );
    }
    return storageFailure(err);
  }
}
