/* Tournoi CSV V7.3 — prévisualisation spectateur isolée.
   Données fictives en mémoire, jamais de lecture/écriture Firebase ni de stockage persistant. */
(function () {
  'use strict';
  window.CSV_V73_PREVIEW_BOOT_OK = false;
  window.CSV_V73_ISOLATED_PREVIEW = false;
  const fail = message => {
    window.CSV_V73_PREVIEW_ERROR = String(message || 'Initialisation impossible');
    console.error('Prévisualisation CSV bloquée :', window.CSV_V73_PREVIEW_ERROR);
  };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const sessionDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    if (!descriptor || !descriptor.configurable || !sessionDescriptor || !sessionDescriptor.configurable)
      throw new Error('Stockage navigateur non isolable');
    const content = new Map();
    const memoryStorage = Object.freeze({
      get length() { return content.size; },
      clear() { content.clear(); },
      key(index) { return Array.from(content.keys())[index] ?? null; },
      getItem(key) { return content.has(String(key)) ? content.get(String(key)) : null; },
      setItem(key, value) { content.set(String(key), String(value)); },
      removeItem(key) { content.delete(String(key)); }
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true, enumerable: true, get() { return memoryStorage; }
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true, enumerable: true, get() { return memoryStorage; }
    });
    if (window.localStorage !== memoryStorage || window.sessionStorage !== memoryStorage)
      throw new Error('Le stockage de test n’est pas actif');
    const set = (key, val) => memoryStorage.setItem(key, JSON.stringify(val));
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
    const fields = Array.from({length:4},(_,i)=>({id:'f'+(i+1),name:'Terrain '+(i+1)}));
    const catalog = [
      {id:'principal',category:'U10',title:'Prévisualisation U10 — fictive',date,published:true},
      {id:'u11_apercu',category:'U11',title:'Prévisualisation U11 — fictive',date,published:true}
    ];
    const pairs = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];
    const makeData = (id,category,pools,startHour) => {
      const letters = 'ABCDEFGH'.slice(0,pools).split('');
      const teams = [], matches = [];
      for(let gi=0;gi<pools;gi++){
        const group='Poule '+letters[gi], groupTeams=[];
        for(let ti=0;ti<4;ti++){
          const n=gi*4+ti+1;
          const team={id:id+'-t'+n,name:'Équipe fictive '+category+' '+n,group,color:['#dc2626','#eab308','#2563eb','#16a34a'][ti],players:[]};
          teams.push(team);groupTeams.push(team);
        }
        for(let mi=0;mi<pairs.length;mi++){
          const [a,b]=pairs[mi];
          const minutes=startHour*60+mi*20;
          const clock=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
          const finished=mi===0;
          matches.push({
            id:id+'-m'+gi+'-'+mi,group,stage:'Journée '+(Math.floor(mi/2)+1),
            team1Id:groupTeams[a].id,team2Id:groupTeams[b].id,
            score1:finished?2:null,score2:finished?1:null,
            pens1:null,pens2:null,status:finished?'finished':'pending',events:[],
            startTime:clock(minutes),endTime:clock(minutes+15),
            fieldId:'f'+(gi+1),fieldName:'Terrain '+(gi+1)
          });
        }
      }
      // Tableaux fictifs conformes au format CSV : seuls les emplacements sont
      // définis. Aucune qualification n'est calculée avant la fin des poules.
      const rank=(letter,place)=>({kind:'rank',group:'Poule '+letter,position:place-1});
      const winner=matchId=>({kind:'winner',matchId:id+'-'+matchId});
      const loser=matchId=>({kind:'loser',matchId:id+'-'+matchId});
      const phase=(key,stage,group,source1,source2)=>{
        const name=src=>src.kind==='rank'
          ?(src.position+1)+'e '+src.group
          :(src.kind==='winner'?'Vainqueur':'Perdant')+' du match précédent';
        matches.push({
          id:id+'-'+key,group,stage,source1,source2,
          team1Id:null,team2Id:null,
          placeholder1:name(source1),placeholder2:name(source2),
          score1:null,score2:null,pens1:null,pens2:null,
          status:'pending',events:[]
        });
      };
      if(pools===4){
        // Quarts croisés : A1-B2, B1-A2, C1-D2, D1-C2.
        phase('ko-q1','Quart de Finale 1','Phase Finale Principale',rank('A',1),rank('B',2));
        phase('ko-q2','Quart de Finale 2','Phase Finale Principale',rank('B',1),rank('A',2));
        phase('ko-q3','Quart de Finale 3','Phase Finale Principale',rank('C',1),rank('D',2));
        phase('ko-q4','Quart de Finale 4','Phase Finale Principale',rank('D',1),rank('C',2));
        phase('ko-semi-1','Demi-Finale 1','Phase Finale Principale',winner('ko-q1'),winner('ko-q3'));
        phase('ko-semi-2','Demi-Finale 2','Phase Finale Principale',winner('ko-q2'),winner('ko-q4'));
      } else {
        phase('ko-semi-1','Demi-Finale 1','Phase Finale Principale',rank('A',1),rank('B',2));
        phase('ko-semi-2','Demi-Finale 2','Phase Finale Principale',rank('B',1),rank('A',2));
      }
      phase('ko-final','Grande Finale','Phase Finale Principale',winner('ko-semi-1'),winner('ko-semi-2'));
      phase('ko-bronze','Match 3ème / 4ème place','Phase Finale Principale',loser('ko-semi-1'),loser('ko-semi-2'));
      // Pour les 3e et 4e de chaque poule : matchs de classement sans faux scores.
      for(const place of [3,4]){
        for(let gi=0;gi<pools;gi+=2){
          const a=letters[gi],b=letters[gi+1];
          phase('rank-'+place+'-'+a+b,'Classement '+place+'e de poule — '+a+' / '+b,
            'Tournoi Classement',rank(a,place),rank(b,place));
        }
      }
      const config={
        name:'Prévisualisation '+category+' (données fictives)',
        format:'groups_knockout',numberOfGroups:pools,
        customGroups:letters.map(x=>'Poule '+x),autoGroups:true,
        hasPlayoffs:true,hasConsolation:true,
        duration:15,breakDuration:5,startTime:String(startHour).padStart(2,'0')+':00',
        hasLunchBreak:false,pointsWin:3,pointsDraw:1,pointsLoss:0,qualifiersPerGroup:2
      };
      return {teams,matches,config};
    };
    set('cslv_multi_catalog_v1',catalog);
    set('cslv_shared_fields_v1',fields);
    memoryStorage.setItem('cslv_offline_trusted_v60','yes');
    set('cslv_last_tournament_v1','principal');
    for(const event of catalog){
      const data = makeData(event.id,event.category,event.id==='principal'?4:2,event.id==='principal'?9:13);
      const prefix=event.id==='principal'?'cslv_':'cslv_mt_'+event.id+'_';
      set(prefix+'config',data.config);
      set(prefix+'teams',data.teams);
      set(prefix+'matches',data.matches);
    }
    // Ce drapeau n'est activé qu'après isolation effective du stockage.
    window.CSV_V73_ISOLATED_PREVIEW = true;
    window.CSV_V73_PREVIEW_BOOT_OK = true;
    window.CSV_V73_PREVIEW_SUMMARY = Object.freeze({events:catalog.length,teams:24,matches:36,finalMatches:catalog.length===2?18:0,date,storage:'mémoire uniquement',firebase:false});
  } catch (error) {
    fail(error?.message || error);
  }
})();
