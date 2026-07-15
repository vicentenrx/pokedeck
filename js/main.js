// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
async function enterApp() {
  hideAuthGate();

  // Demo deck se for a primeira vez dessa conta
  if (!state.decks.length) {
    const id = uid();
    state.decks = [{ id, name:'Charizard ex', format:'Standard', color:'#E3350D', cards:[
      {id:uid(),name:'Charizard ex',       set:'OBF 125',qty:3,owned:2,type:'Pokémon',  img:'https://images.pokemontcg.io/sv3/125_hires.png'},
      {id:uid(),name:'Charmander',         set:'OBF 26', qty:4,owned:4,type:'Pokémon',  img:'https://images.pokemontcg.io/sv3/26.png'},
      {id:uid(),name:'Charmeleon',         set:'OBF 27', qty:2,owned:1,type:'Pokémon',  img:'https://images.pokemontcg.io/sv3/27.png'},
      {id:uid(),name:'Pidgeot ex',         set:'OBF 164',qty:2,owned:2,type:'Pokémon',  img:'https://images.pokemontcg.io/sv3/164_hires.png'},
      {id:uid(),name:'Pidgey',             set:'OBF 158',qty:4,owned:4,type:'Pokémon',  img:'https://images.pokemontcg.io/sv3/158.png'},
      {id:uid(),name:'Mew ex',             set:'MEW 232',qty:1,owned:0,type:'Pokémon',  img:''},
      {id:uid(),name:"Professor's Research",set:'SVI 189',qty:3,owned:3,type:'Treinador',img:'https://images.pokemontcg.io/sv1/189.png'},
      {id:uid(),name:"Boss's Orders",      set:'PAL 172',qty:2,owned:2,type:'Treinador',img:'https://images.pokemontcg.io/sv2/172.png'},
      {id:uid(),name:'Rare Candy',         set:'SVI 191',qty:4,owned:3,type:'Treinador',img:'https://images.pokemontcg.io/sv1/191.png'},
      {id:uid(),name:'Ultra Ball',         set:'SVI 196',qty:4,owned:4,type:'Treinador',img:'https://images.pokemontcg.io/sv1/196.png'},
      {id:uid(),name:'Nest Ball',          set:'SVI 181',qty:4,owned:4,type:'Treinador',img:'https://images.pokemontcg.io/sv1/181.png'},
      {id:uid(),name:'Arven',              set:'SVI 166',qty:3,owned:2,type:'Treinador',img:'https://images.pokemontcg.io/sv1/166.png'},
      {id:uid(),name:'Iono',               set:'PAL 185',qty:3,owned:1,type:'Treinador',img:'https://images.pokemontcg.io/sv2/185.png'},
      {id:uid(),name:'Counter Catcher',    set:'PAR 160',qty:2,owned:0,type:'Treinador',img:''},
      {id:uid(),name:'Fire Energy',        set:'SVE 2',  qty:8,owned:8,type:'Energia',  img:'https://images.pokemontcg.io/sve/2.png'},
    ]}];
    state.activeId = id;
    save();
  }

  renderAccountBar();
  loadSetsMap();
  renderAll();
}

async function init() {
  loadLocal();
  // Não confia cegamente em qualquer objeto salvo em "session" — só entra
  // direto se ele tiver o formato esperado E a sessão ainda for válida
  // (refreshSessionIfNeeded zera "session" se o token não puder ser renovado).
  if (session?.access_token && session?.user?.id) {
    await refreshSessionIfNeeded();
  } else {
    session = null;
  }
  if (session) {
    await loadSb();
    await enterApp();
  } else {
    showAuthGate();
  }
}

init();
