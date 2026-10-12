import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { pool } from './db.js';
import { inclusiveDays, sitterCanRespond, ownerCanCancel } from './logic.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));
app.use(cookieParser());

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET doit contenir au moins 32 caractères (voir .env.example).');
const jwtSecret: string = secret;
type Identity = {id:string;name:string;email:string;role:'owner'|'sitter'};
type Authed = Request & {user:Identity};
type Handler = (req:Request,res:Response,next:NextFunction)=>Promise<unknown> | unknown;
const asyncRoute = (fn:Handler) => (req:Request,res:Response,next:NextFunction) => Promise.resolve(fn(req,res,next)).catch(next);
const asAuthed = (req:Request) => req as Authed;
const error = (status:number,message:string) => Object.assign(new Error(message),{status});
function idCookie(res:Response, user:Identity) {
  const token = jwt.sign({sub:user.id},jwtSecret,{expiresIn:'7d'});
  res.cookie('pawfect_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:7*24*3600*1000,path:'/'});
}
const safeUser = (u:Identity) => ({id:u.id,name:u.name,email:u.email,role:u.role});
const uuid = z.string().uuid();

async function auth(req:Request,_res:Response,next:NextFunction) {
  try {
    const token=req.cookies?.pawfect_session;
    if (!token) throw error(401,'Connecte-toi pour continuer.');
    const payload=jwt.verify(token,jwtSecret) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') throw error(401,'Session invalide.');
    const {rows}=await pool.query<Identity>('SELECT id,name,email,role FROM users WHERE id=$1',[payload.sub]);
    if (!rows[0]) throw error(401,'Utilisateur introuvable.');
    asAuthed(req).user=rows[0]; next();
  } catch(e) { next(e instanceof jwt.JsonWebTokenError ? error(401,'Session expirée ou invalide.') : e); }
}

app.get('/api/health',asyncRoute(async(_req,res)=>{
  await pool.query('SELECT 1');res.json({ok:true,service:'pawfect-api'});
}));
const authLimiter = rateLimit({windowMs:15*60*1000,limit:25,standardHeaders:'draft-7',legacyHeaders:false});
const credentials=z.object({email:z.string().trim().email().max(160),password:z.string().min(8).max(72)});
app.post('/api/auth/register',authLimiter,asyncRoute(async(req,res)=>{
  const data=credentials.extend({name:z.string().trim().min(2).max(70),role:z.enum(['owner','sitter']).default('owner')}).parse(req.body);
  const hash=await bcrypt.hash(data.password,12);
  try {
    const {rows}=await pool.query<Identity>('INSERT INTO users (name,email,password_hash,role) VALUES ($1,lower($2),$3,$4) RETURNING id,name,email,role',[data.name,data.email,hash,data.role]);
    if(data.role==='sitter') await pool.query('INSERT INTO sitter_profiles(user_id,headline,bio,city,price_daily) VALUES($1,$2,$3,$4,$5)',[rows[0].id,'Un nouveau pet-sitter passionné','Bonjour ! Je prends soin de vos compagnons.','Paris',25]);
    idCookie(res,rows[0]);res.status(201).json({user:safeUser(rows[0])});
  }catch(e:any){if(e?.code==='23505') throw error(409,'Cette adresse e-mail est déjà utilisée.');throw e;}
}));
app.post('/api/auth/login',authLimiter,asyncRoute(async(req,res)=>{
  const data=credentials.parse(req.body);
  const {rows}=await pool.query<Identity & {password_hash:string}>('SELECT id,name,email,role,password_hash FROM users WHERE email=lower($1)',[data.email]);
  if(!rows[0] || !(await bcrypt.compare(data.password,rows[0].password_hash))) throw error(401,'E-mail ou mot de passe incorrect.');
  idCookie(res,rows[0]);res.json({user:safeUser(rows[0])});
}));
app.post('/api/auth/logout',(_req,res)=>{res.clearCookie('pawfect_session',{path:'/'});res.json({ok:true});});
app.get('/api/auth/me',auth,asyncRoute(async(req,res)=>res.json({user:asAuthed(req).user})));

const sitterSelect = `SELECT u.id,u.name,p.headline,p.bio,p.city,p.price_daily,p.pet_types,p.emoji,
 COALESCE(ROUND(AVG(r.rating)::numeric,1),0)::float AS rating,COUNT(r.id)::int AS review_count
 FROM users u JOIN sitter_profiles p ON p.user_id=u.id LEFT JOIN reviews r ON r.sitter_id=u.id`;
const sitterGroup=' GROUP BY u.id,p.user_id';
app.get('/api/sitters',asyncRoute(async(req,res)=>{
  const filter=z.object({city:z.string().trim().max(100).optional(),pet:z.enum(['Chien','Chat']).optional(),maxPrice:z.coerce.number().int().positive().max(1000).optional()}).parse(req.query);
  const values:unknown[]=[];const predicates:string[]=[];
  if(filter.city){values.push('%'+filter.city+'%');predicates.push(`p.city ILIKE $${values.length}`);}
  if(filter.pet){values.push(filter.pet);predicates.push(`$${values.length}=ANY(p.pet_types)`);}
  if(filter.maxPrice){values.push(filter.maxPrice);predicates.push(`p.price_daily <= $${values.length}`);}
  const sql=sitterSelect+(predicates.length?' WHERE '+predicates.join(' AND '):'')+sitterGroup+' ORDER BY review_count DESC,p.price_daily ASC LIMIT 50';
  const {rows}=await pool.query(sql,values);res.json({sitters:rows});
}));
app.get('/api/sitters/:id',asyncRoute(async(req,res)=>{
  const sitterId=uuid.parse(req.params.id);
  const {rows}=await pool.query(sitterSelect+' WHERE u.id=$1'+sitterGroup,[sitterId]);
  if(!rows[0])throw error(404,'Pet-sitter introuvable.');
  const reviews=await pool.query('SELECT r.id,r.rating,r.comment,r.created_at,u.name AS author FROM reviews r JOIN users u ON u.id=r.owner_id WHERE r.sitter_id=$1 ORDER BY r.created_at DESC LIMIT 12',[sitterId]);
  res.json({sitter:rows[0],reviews:reviews.rows});
}));
app.get('/api/pets',auth,asyncRoute(async(req,res)=>{
  const {rows}=await pool.query('SELECT id,name,species,breed,emoji FROM pets WHERE owner_id=$1 ORDER BY created_at DESC',[asAuthed(req).user.id]);res.json({pets:rows});
}));
app.post('/api/pets',auth,asyncRoute(async(req,res)=>{
  if(asAuthed(req).user.role!=='owner')throw error(403,'Compte propriétaire requis.');
  const d=z.object({name:z.string().trim().min(1).max(50),species:z.enum(['Chien','Chat','Autre']),breed:z.string().trim().max(80).default('')}).parse(req.body);
  const emoji=d.species==='Chat'?'🐱':d.species==='Chien'?'🐶':'🐾';
  const {rows}=await pool.query('INSERT INTO pets(owner_id,name,species,breed,emoji) VALUES($1,$2,$3,$4,$5) RETURNING id,name,species,breed,emoji',[asAuthed(req).user.id,d.name,d.species,d.breed,emoji]);res.status(201).json({pet:rows[0]});
}));
const bookingView=`SELECT b.id,b.owner_id,b.sitter_id,b.pet_id,b.start_date::text AS start_date,b.end_date::text AS end_date,b.total_price,b.status,b.details,b.created_at,
 o.name AS owner_name,s.name AS sitter_name,p.name AS pet_name,p.emoji AS pet_emoji,
 sp.emoji AS sitter_emoji,sp.city
 FROM bookings b JOIN users o ON o.id=b.owner_id JOIN users s ON s.id=b.sitter_id JOIN pets p ON p.id=b.pet_id JOIN sitter_profiles sp ON sp.user_id=b.sitter_id`;
app.get('/api/bookings',auth,asyncRoute(async(req,res)=>{
  const u=asAuthed(req).user;
  const {rows}=await pool.query(bookingView+` WHERE b.${u.role==='owner'?'owner_id':'sitter_id'}=$1 ORDER BY b.created_at DESC`,[u.id]);res.json({bookings:rows});
}));
app.post('/api/bookings',auth,asyncRoute(async(req,res)=>{
  const u=asAuthed(req).user;
  if(u.role!=='owner')throw error(403,'Compte propriétaire requis.');
  const d=z.object({sitterId:uuid,petId:uuid,startDate:z.string().date(),endDate:z.string().date(),details:z.string().trim().max(700).default('')}).parse(req.body);
  if(d.startDate<new Date().toISOString().slice(0,10))throw error(400,'Choisis une date dans le futur.');
  const days=inclusiveDays(d.startDate,d.endDate);
  if(days<1||days>30)throw error(400,'Une réservation dure entre 1 et 30 jours.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const pet=await client.query('SELECT id FROM pets WHERE id=$1 AND owner_id=$2',[d.petId,u.id]);
    if(!pet.rowCount)throw error(404,'Cet animal ne fait pas partie de ton profil.');
    const sitter=await client.query<{price_daily:number}>('SELECT price_daily FROM sitter_profiles WHERE user_id=$1',[d.sitterId]);
    if(!sitter.rows[0])throw error(404,'Pet-sitter introuvable.');
    const {rows}=await client.query('INSERT INTO bookings(owner_id,sitter_id,pet_id,start_date,end_date,total_price,details) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[u.id,d.sitterId,d.petId,d.startDate,d.endDate,sitter.rows[0].price_daily*days,d.details]);
    await client.query('COMMIT');res.status(201).json({id:rows[0].id});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
app.patch('/api/bookings/:id/status',auth,asyncRoute(async(req,res)=>{
  const id=uuid.parse(req.params.id);const d=z.object({status:z.enum(['accepted','declined','cancelled','completed'])}).parse(req.body);
  const u=asAuthed(req).user;
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query<{id:string;owner_id:string;sitter_id:string;status:string;start_date:string;end_date:string}>('SELECT id,owner_id,sitter_id,status,start_date::text,end_date::text FROM bookings WHERE id=$1 FOR UPDATE',[id]);
    const b=rows[0];if(!b)throw error(404,'Réservation introuvable.');
    if(b.owner_id!==u.id&&b.sitter_id!==u.id)throw error(403,'Accès interdit.');
    if(d.status==='cancelled'){
      if(b.owner_id!==u.id||!ownerCanCancel(b.status))throw error(409,'Annulation impossible.');
    }else if(['accepted','declined'].includes(d.status)){
      if(b.sitter_id!==u.id||!sitterCanRespond(b.status))throw error(409,'Cette demande ne peut pas être traitée.');
      if(d.status==='accepted'){
        // Serialize acceptance per sitter to prevent race conditions.
        await client.query('SELECT user_id FROM sitter_profiles WHERE user_id=$1 FOR UPDATE',[b.sitter_id]);
        const conflict=await client.query("SELECT id FROM bookings WHERE sitter_id=$1 AND id<>$2 AND status='accepted' AND daterange(start_date,end_date,'[]') && daterange($3::date,$4::date,'[]') LIMIT 1",[b.sitter_id,id,b.start_date,b.end_date]);
        if(conflict.rowCount)throw error(409,'Ce pet-sitter a déjà une réservation acceptée à ces dates.');
      }
    }else{
      if(b.status!=='accepted'||b.end_date>=new Date().toISOString().slice(0,10))throw error(409,'La garde doit être terminée pour être clôturée.');
    }
    await client.query('UPDATE bookings SET status=$1 WHERE id=$2',[d.status,id]);
    await client.query('COMMIT');res.json({ok:true,status:d.status});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
async function bookingParticipant(bookingId:string,userId:string){
  const {rows}=await pool.query('SELECT id,owner_id,sitter_id,status FROM bookings WHERE id=$1 AND (owner_id=$2 OR sitter_id=$2)',[bookingId,userId]);
  if(!rows[0])throw error(404,'Conversation introuvable.');return rows[0];
}
app.get('/api/bookings/:id/messages',auth,asyncRoute(async(req,res)=>{
  const id=uuid.parse(req.params.id);await bookingParticipant(id,asAuthed(req).user.id);
  const {rows}=await pool.query('SELECT m.id,m.sender_id,m.body,m.created_at,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.booking_id=$1 ORDER BY m.created_at ASC',[id]);res.json({messages:rows});
}));
app.post('/api/bookings/:id/messages',auth,asyncRoute(async(req,res)=>{
  const id=uuid.parse(req.params.id);const d=z.object({body:z.string().trim().min(1).max(1000)}).parse(req.body);
  const b=await bookingParticipant(id,asAuthed(req).user.id);
  if(['declined','cancelled'].includes(b.status))throw error(409,'Conversation fermée pour cette réservation.');
  const {rows}=await pool.query('INSERT INTO messages(booking_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at',[id,asAuthed(req).user.id,d.body]);res.status(201).json({message:rows[0]});
}));
app.post('/api/bookings/:id/review',auth,asyncRoute(async(req,res)=>{
  const id=uuid.parse(req.params.id);const d=z.object({rating:z.number().int().min(1).max(5),comment:z.string().trim().min(4).max(500)}).parse(req.body);
  const u=asAuthed(req).user;
  const {rows}=await pool.query('SELECT owner_id,sitter_id,status FROM bookings WHERE id=$1',[id]);
  const b=rows[0];if(!b)throw error(404,'Réservation introuvable.');
  if(b.owner_id!==u.id||b.status!=='completed')throw error(403,'Avis autorisé seulement après une garde terminée.');
  try{const r=await pool.query('INSERT INTO reviews(booking_id,owner_id,sitter_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING id',[id,u.id,b.sitter_id,d.rating,d.comment]);res.status(201).json({id:r.rows[0].id});}
  catch(e:any){if(e?.code==='23505')throw error(409,'Tu as déjà laissé un avis.');throw e;}
}));
app.patch('/api/sitter/profile',auth,asyncRoute(async(req,res)=>{
  const u=asAuthed(req).user;if(u.role!=='sitter')throw error(403,'Compte pet-sitter requis.');
  const d=z.object({headline:z.string().trim().min(8).max(120),bio:z.string().trim().min(20).max(1000),city:z.string().trim().min(2).max(80),priceDaily:z.number().int().min(5).max(500),petTypes:z.array(z.enum(['Chien','Chat'])).min(1).max(2)}).parse(req.body);
  await pool.query('UPDATE sitter_profiles SET headline=$1,bio=$2,city=$3,price_daily=$4,pet_types=$5,updated_at=now() WHERE user_id=$6',[d.headline,d.bio,d.city,d.priceDaily,d.petTypes,u.id]);res.json({ok:true});
}));
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
  if(err instanceof ZodError){res.status(400).json({error:err.issues[0]?.message??'Données invalides.'});return;}
  const e=err as Error & {status?:number};
  if(e?.status){res.status(e.status).json({error:e.message});return;}
  console.error(e);res.status(500).json({error:'Une erreur interne est survenue.'});
});
const port=Number(process.env.PORT||4000);
app.listen(port,()=>console.log(`🐾 Pawfect API : http://localhost:${port}`));
