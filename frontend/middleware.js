import { NextResponse } from "next/server";
export function middleware(request){ const publicPath=["/login","/cadastro","/recuperar-senha"].includes(request.nextUrl.pathname); const hasSession=request.cookies.has("financeiro_session"); if(!publicPath&&!hasSession&&process.env.NEXT_PUBLIC_DEMO_MODE!=="true") return NextResponse.redirect(new URL("/login",request.url)); if(publicPath&&hasSession)return NextResponse.redirect(new URL("/",request.url)); return NextResponse.next(); }
export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico).*)"]};
