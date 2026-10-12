import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const password = await bcrypt.hash('Demo123!', 12);
const accounts = [
  {name:'Camille Martin',email:'demo@pawfect.app',role:'owner'},
  {name:'Léa Dupont',email:'lea@pawfect.app',role:'sitter',headline:'Des câlins, des balades et beaucoup d’amour',bio:'Amoureuse des animaux depuis toujours. Je partage mon quotidien avec un petit teckel et j’adore les longues balades au parc.',city:'Paris',price:28,petTypes:['Chien','Chat'],emoji:'👩🏻'},
  {name:'Hugo Bernard',email:'hugo@pawfect.app',role:'sitter',headline:'Le meilleur copain de votre compagnon',bio:'Pet-sitter patient et fiable, disponible en semaine et le week-end. Jeux, photos et nouvelles tous les jours !',city:'Lyon',price:24,petTypes:['Chien'],emoji:'👨🏽'},
  {name:'Inès Moreau',email:'ines@pawfect.app',role:'sitter',headline:'Un cocon tout doux pour vos chats',bio:'Je garde vos petits félins dans une ambiance calme et rassurante. Avec moi, ronrons garantis !',city:'Paris',price:32,petTypes:['Chat'],emoji:'👩🏽'},
  {name:'Noah Petit',email:'noah@pawfect.app',role:'sitter',headline:'Des aventures à quatre pattes',bio:'Sportif, attentionné et toujours partant pour une promenade. Les chiens débordants d’énergie sont les bienvenus.',city:'Bordeaux',price:26,petTypes:['Chien','Chat'],emoji:'👨🏻'},
  {name:'Sarah Laurent',email:'sarah@pawfect.app',role:'sitter',headline:'Une seconde maison, pleine de tendresse',bio:'Expérience avec petits et grands animaux. Des nouvelles quotidiennes et une vraie attention aux habitudes de chacun.',city:'Marseille',price:35,petTypes:['Chien','Chat'],emoji:'👩🏾'},
  {name:'Jade Rousseau',email:'jade@pawfect.app',role:'sitter',headline:'La tata préférée des boules de poils',bio:'Votre compagnon sera accueilli comme un membre de ma famille. Disponibilités flexibles et jeux à volonté.',city:'Lille',price:22,petTypes:['Chien','Chat'],emoji:'👩🏼'}
] as const;

try {
  for (const a of accounts) {
    const { rows } = await pool.query<{id:string}>('INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name RETURNING id',[a.name,a.email,password,a.role]);
    if (a.role==='sitter') {
      await pool.query(`INSERT INTO sitter_profiles(user_id,headline,bio,city,price_daily,pet_types,emoji) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO NOTHING`,[rows[0].id,a.headline,a.bio,a.city,a.price,a.petTypes,a.emoji]);
    } else {
      await pool.query('INSERT INTO pets(owner_id,name,species,breed,emoji) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM pets WHERE owner_id=$1)',[rows[0].id,'Mochi','Chat','British Shorthair','🐈']);
    }
  }
  console.log('✓ Démo prête : demo@pawfect.app / Demo123!');
  console.log('✓ 6 profils de pet-sitters et Mochi ajoutés.');
} finally { await pool.end(); }
