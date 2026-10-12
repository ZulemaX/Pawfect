export type Role = 'owner'|'sitter';
export type User = { id:string; name:string; email:string; role:Role };
export type Sitter = {id:string;name:string;headline:string;bio:string;city:string;price_daily:number;pet_types:string[];emoji:string;rating:number;review_count:number};
export type Pet = {id:string;name:string;species:'Chien'|'Chat'|'Autre';breed:string;emoji:string};
export type Booking = {id:string;owner_id:string;sitter_id:string;pet_id:string;start_date:string;end_date:string;total_price:number;status:'pending'|'accepted'|'declined'|'cancelled'|'completed';details:string;owner_name:string;sitter_name:string;pet_name:string;pet_emoji:string;sitter_emoji:string;city:string};
export type Message = {id:string;sender_id:string;sender_name:string;body:string;created_at:string};
export type Review = {id:string;author:string;rating:number;comment:string;created_at:string};
export async function api<T>(route:string,init:RequestInit={}):Promise<T>{
  let response:Response;
  try{
    response=await fetch('/api'+route,{credentials:'same-origin',headers:{'Content-Type':'application/json',...init.headers},...init});
  }catch{
    throw new Error('Impossible de contacter le serveur. Vérifie que npm run dev est lancé et que PostgreSQL fonctionne.');
  }
  let data:unknown={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw new Error((data as {error?:string}).error||'Une erreur est survenue.');
  return data as T;
}
