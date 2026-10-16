// REVIEW-ONLY Edge Function source; not deployed.
// POST /unlock { key_id, secret } -> { session_token, expires_at }
// POST /status { session_token } -> { valid, album_id, expires_at }
// Production requires private media gateway, admin authentication, rate limiting,
// privacy review and integration tests before enabling collector keys.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const origin = "https://hustlelegendrecords.com";
const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Vary": "Origin" };
const encoder = new TextEncoder();
function json(data: unknown, status=200) { return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer",...cors}}); }
function randomSecret() { const b=crypto.getRandomValues(new Uint8Array(32)); return Array.from(b,x=>x.toString(16).padStart(2,"0")).join(""); }
async function digest(value:string, pepper:string) {
 const key=await crypto.subtle.importKey("raw",encoder.encode(pepper),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
 return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 if(req.headers.get("origin")!==origin) return json({error:"Forbidden origin"},403);
 const pepper=Deno.env.get("LEGEND_KEY_PEPPER"), url=Deno.env.get("SUPABASE_URL"), role=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!pepper||!url||!role) return json({error:"Service unavailable"},503);
 const db=createClient(url,role,{auth:{persistSession:false,autoRefreshToken:false}});
 let payload:Record<string,unknown>;
 try { payload=await req.json(); } catch { return json({error:"Invalid request"},400); }
 const action=new URL(req.url).searchParams.get("action");
 if(action==="unlock"){
  const key_id=payload.key_id,secret=payload.secret;
  if(typeof key_id!=="string"||!/^[0-9a-f-]{36}$/i.test(key_id)||typeof secret!=="string"||secret.length<32||secret.length>256) return json({error:"Invalid key"},400);
  // Query by key id only; never log the submitted secret.
  const {data:key,error}=await db.from("legend_keys").select("id,album_id,key_digest,status").eq("id",key_id).maybeSingle();
  if(error) return json({error:"Service unavailable"},503);
  const incoming=await digest(key_id+":"+secret,pepper);
  if(!key||key.status!=="active"||incoming!==key.key_digest) return json({error:"Invalid or inactive key"},403);
  const session_token=randomSecret();
  const session_digest=await digest(session_token,pepper);
  const started=new Date(),expires=new Date(started.getTime()+4*60*60*1000);
  const {error:insertError}=await db.from("legend_sessions").insert({key_id:key.id,session_digest,started_at:started.toISOString(),expires_at:expires.toISOString()});
  if(insertError) return json({error:"Service unavailable"},503);
  return json({session_token,album_id:key.album_id,expires_at:expires.toISOString()});
 }
 if(action==="status"){
  const token=payload.session_token;
  if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token)) return json({valid:false},401);
  const session_digest=await digest(token,pepper);
  const {data:session,error}=await db.from("legend_sessions").select("key_id,expires_at,revoked_at,legend_keys!inner(album_id,status)").eq("session_digest",session_digest).maybeSingle();
  if(error||!session||session.revoked_at||new Date(session.expires_at).getTime()<=Date.now()) return json({valid:false},401);
  const key=session.legend_keys as unknown as {album_id:string,status:string};
  if(key.status!=="active") return json({valid:false},401);
  return json({valid:true,album_id:key.album_id,expires_at:session.expires_at});
 }
 return json({error:"Not found"},404);
});
