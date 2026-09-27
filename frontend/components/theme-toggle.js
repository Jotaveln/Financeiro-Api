"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
export function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme(); const [ready,setReady]=useState(false); useEffect(()=>setReady(true),[]); if(!ready)return <span className="h-10 w-10"/>; const dark=resolvedTheme==="dark"; return <button className="btn btn-secondary !p-2.5" aria-label={dark?"Ativar tema claro":"Ativar tema escuro"} onClick={()=>setTheme(dark?"light":"dark")}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>}
