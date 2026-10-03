import { NextResponse, type NextRequest } from "next/server";

// Puerta de entrada: si no hay cookie de sesión, se manda al login.
// La verificación real de la sesión se hace en cada página (src/lib/session.ts).
export function proxy(req: NextRequest) {
  const tieneSesion = req.cookies.has("bacoli_sesion");
  if (!tieneSesion && req.nextUrl.pathname !== "/login" && req.nextUrl.pathname !== "/api/salud") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
