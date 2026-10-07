import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
export const db=createClient('https://frkzkgmmcfexudikcdef.supabase.co','sb_publishable_UlEz_-eBThXUgesLl036RQ_J_-Edto9');
export async function staffSession(){const {data:{session},error}=await db.auth.getSession();if(error)throw error;if(!session)return null;const {data,error:err}=await db.from('staff_profiles').select('user_id,display_name,role,active').eq('user_id',session.user.id).maybeSingle();if(err)throw err;return data?.active?data:null}
export function text(tag,value,parent){const e=document.createElement(tag);e.textContent=value??'';parent.append(e);return e}
export function safeUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
