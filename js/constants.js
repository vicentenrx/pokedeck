// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const COLORS    = ['#E3350D','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#64748B','#F97316'];
const TC        = { 'Pokémon':'#E3350D','Treinador':'#3B82F6','Energia':'#F59E0B' };
const TE        = { 'Pokémon':'🔴','Treinador':'🔵','Energia':'⚡' };
const PTCG      = 'https://api.pokemontcg.io/v2';
const PTCG_KEY  = 'c36319a5-b878-49e1-8cdd-288aa3804a48';
const STATE_KEY = 'pokedeck_v4';

// Projeto Supabase fixo do app — a chave "publishable" é segura pra ficar no
// client (equivalente à antiga anon key). A segurança real vem das políticas
// de RLS no banco, não do sigilo dessa chave.
const SB_URL       = 'https://izaeernhfzmrulztouvd.supabase.co';
const SB_ANON_KEY  = 'sb_publishable_P6r1fbSpZ-aYDTlT0yuXjg_6wodIp3A';
const SB_SESSION_K = 'pokedeck_sb_session';
