import { DishError, setDishActive } from "@/lib/dishes/store";
import { isAuthorized } from "@/lib/admin";

/** PATCH { active: boolean } — "removing" a dish only sets it inactive. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/dishes/[id]">,
) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    active?: unknown;
  } | null;
  if (!body || typeof body.active !== "boolean") {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const dish = await setDishActive(id, body.active);
    return Response.json({ dish });
  } catch (err) {
    if (err instanceof DishError) {
      return Response.json({ error: err.code }, { status: 404 });
    }
    throw err;
  }
}
