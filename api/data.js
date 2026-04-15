// Vercel Serverless Function — serves dashboard data from Neon or hardcoded fallback

const FALLBACK = null; // Will be populated below if DB is unavailable

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const connectionString = process.env.DATABASE_URL;

  // If no DATABASE_URL, return fallback data so the site always works
  if (!connectionString) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(getFallbackData());
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(connectionString);

    const [countries, marketsData, newsData, flightsData, shipsData, conflictsData, signalsData] = await Promise.all([
      sql`SELECT name, cii_score, region FROM countries ORDER BY name`,
      sql`SELECT symbol, name, price, change_pct, type FROM markets ORDER BY id`,
      sql`SELECT category, label, title, region, time_ago FROM news ORDER BY id`,
      sql`SELECT callsign, origin, destination, lat, lng, altitude, type, heading FROM flights ORDER BY id`,
      sql`SELECT name, type, lat, lng, speed, destination FROM ships ORDER BY id`,
      sql`SELECT name, lat, lng, severity FROM conflict_zones ORDER BY id`,
      sql`SELECT trigger_event, chain, sector, impact, sentiment, time_ago FROM dubai_signals ORDER BY id`,
    ]);

    // If DB is empty (tables exist but no rows), return fallback
    if (!countries.length && !marketsData.length) {
      res.setHeader('Cache-Control', 's-maxage=60');
      return res.status(200).json(getFallbackData());
    }

    const ciiScores = {};
    const regionMap = {};
    countries.forEach(c => {
      if (c.cii_score !== null) ciiScores[c.name] = parseFloat(c.cii_score);
      if (c.region) regionMap[c.name] = c.region;
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      source: 'neon',
      ciiScores,
      regionMap,
      markets: marketsData.map(m => ({ sym: m.symbol, name: m.name, price: parseFloat(m.price), chg: parseFloat(m.change_pct), type: m.type })),
      news: newsData.map(n => ({ cat: n.category, lbl: n.label, title: n.title, region: n.region, time: n.time_ago })),
      flights: flightsData.map(f => ({ call: f.callsign, from: f.origin, to: f.destination, lat: parseFloat(f.lat), lng: parseFloat(f.lng), alt: f.altitude, type: f.type, hdg: f.heading })),
      ships: shipsData.map(s => ({ name: s.name, type: s.type, lat: parseFloat(s.lat), lng: parseFloat(s.lng), speed: s.speed, dest: s.destination })),
      confZones: conflictsData.map(c => ({ name: c.name, lat: parseFloat(c.lat), lng: parseFloat(c.lng), sev: c.severity })),
      dubaiSignals: signalsData.map(s => ({ trigger: s.trigger_event, chain: s.chain, sector: s.sector, impact: s.impact, sentiment: s.sentiment, time: s.time_ago })),
    });
  } catch (error) {
    console.error('Database error:', error.message);
    // Always return working data, never a broken response
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(200).json(getFallbackData());
  }
}

function getFallbackData() {
  return {
    source: 'fallback',
    ciiScores: {"Afghanistan":9.2,"Albania":3.1,"Algeria":5.8,"Andorra":1.0,"Angola":6.1,"Argentina":4.8,"Armenia":5.9,"Australia":1.4,"Austria":1.5,"Azerbaijan":6.2,"Bahamas":2.8,"Bahrain":4.9,"Bangladesh":5.6,"Belarus":7.1,"Belgium":2.3,"Belize":3.9,"Benin":4.2,"Bhutan":2.1,"Bolivia":4.5,"Bosnia and Herzegovina":5.2,"Botswana":2.4,"Brazil":5.1,"Brunei":1.8,"Bulgaria":2.7,"Burkina Faso":8.1,"Burundi":7.8,"Cambodia":4.3,"Cameroon":6.9,"Canada":1.3,"Central African Republic":9.0,"Chad":8.3,"Chile":3.2,"China":4.1,"Colombia":6.2,"Comoros":4.0,"Congo":6.8,"Costa Rica":1.9,"Croatia":1.8,"Cuba":5.5,"Cyprus":3.1,"Czechia":1.6,"Denmark":1.2,"Djibouti":4.4,"Dominican Republic":4.0,"Dem. Rep. Congo":9.1,"Ecuador":5.3,"Egypt":6.0,"El Salvador":5.9,"Equatorial Guinea":5.1,"Eritrea":7.2,"Estonia":1.7,"Eswatini":4.3,"Ethiopia":7.9,"Fiji":2.8,"Finland":1.1,"France":2.8,"Gabon":4.9,"Gambia":4.0,"Georgia":4.8,"Germany":1.6,"Ghana":3.4,"Greece":3.9,"Guatemala":5.8,"Guinea":6.1,"Guinea-Bissau":5.9,"Guyana":3.5,"Haiti":8.8,"Honduras":6.0,"Hungary":3.8,"Iceland":1.0,"India":4.9,"Indonesia":4.0,"Iran":7.3,"Iraq":7.6,"Ireland":1.4,"Israel":7.8,"Italy":2.9,"Jamaica":4.5,"Japan":1.7,"Jordan":4.2,"Kazakhstan":3.9,"Kenya":5.3,"Kosovo":3.8,"Kuwait":3.1,"Kyrgyzstan":4.9,"Laos":3.5,"Latvia":1.9,"Lebanon":8.2,"Lesotho":3.8,"Liberia":5.4,"Libya":8.0,"Liechtenstein":1.0,"Lithuania":2.0,"Luxembourg":1.1,"Madagascar":5.0,"Malawi":4.9,"Malaysia":3.3,"Maldives":2.9,"Mali":8.7,"Malta":1.5,"Mauritania":5.7,"Mauritius":1.8,"Mexico":6.0,"Moldova":4.9,"Mongolia":2.8,"Montenegro":2.9,"Morocco":4.3,"Mozambique":6.2,"Myanmar":9.0,"Namibia":2.7,"Nepal":4.1,"Netherlands":1.5,"New Zealand":1.1,"Nicaragua":5.8,"Niger":7.9,"Nigeria":7.4,"North Korea":7.9,"North Macedonia":2.8,"Norway":1.1,"Oman":2.8,"Pakistan":7.5,"Panama":3.1,"Papua New Guinea":5.6,"Paraguay":3.8,"Peru":4.7,"Philippines":4.9,"Poland":2.4,"Portugal":1.7,"Qatar":2.1,"Romania":2.5,"Russia":8.1,"Rwanda":3.9,"Saudi Arabia":4.4,"Senegal":3.9,"Serbia":3.4,"Sierra Leone":4.9,"Singapore":1.2,"Slovakia":1.7,"Slovenia":1.4,"Solomon Islands":3.8,"Somalia":9.4,"South Africa":5.8,"South Korea":2.3,"South Sudan":9.2,"Spain":2.6,"Sri Lanka":5.1,"Sudan":9.3,"Suriname":3.2,"Sweden":1.3,"Switzerland":1.1,"Syria":9.5,"Taiwan":4.9,"Tajikistan":5.4,"Tanzania":3.9,"Thailand":4.2,"Timor-Leste":3.2,"Togo":4.4,"Trinidad and Tobago":4.8,"Tunisia":5.1,"Turkey":5.8,"Turkmenistan":4.9,"Uganda":5.6,"Ukraine":9.8,"United Arab Emirates":2.1,"United Kingdom":2.4,"United States of America":3.0,"Uruguay":2.1,"Uzbekistan":4.1,"Venezuela":7.2,"Vietnam":3.0,"Yemen":9.1,"Zambia":4.2,"Zimbabwe":6.1},
    regionMap: {"Afghanistan":"Asia","Algeria":"Africa","Angola":"Africa","Argentina":"S. America","Armenia":"Caucasus","Australia":"Oceania","Austria":"Europe","Azerbaijan":"Caucasus","Bangladesh":"Asia","Belarus":"Europe","Belgium":"Europe","Bolivia":"S. America","Bosnia and Herzegovina":"Europe","Brazil":"S. America","Bulgaria":"Europe","Burkina Faso":"Africa","Burundi":"Africa","Cambodia":"Asia","Cameroon":"Africa","Canada":"N. America","Central African Republic":"Africa","Chad":"Africa","Chile":"S. America","China":"Asia","Colombia":"S. America","Dem. Rep. Congo":"Africa","Denmark":"Europe","Ecuador":"S. America","Egypt":"Africa","Ethiopia":"Africa","Finland":"Europe","France":"Europe","Germany":"Europe","Ghana":"Africa","Greece":"Europe","Guatemala":"C. America","Haiti":"Caribbean","Honduras":"C. America","Hungary":"Europe","India":"Asia","Indonesia":"Asia","Iran":"Middle East","Iraq":"Middle East","Ireland":"Europe","Israel":"Middle East","Italy":"Europe","Japan":"Asia","Jordan":"Middle East","Kazakhstan":"C. Asia","Kenya":"Africa","Lebanon":"Middle East","Libya":"Africa","Malaysia":"Asia","Mali":"Africa","Mexico":"N. America","Morocco":"Africa","Mozambique":"Africa","Myanmar":"Asia","Netherlands":"Europe","New Zealand":"Oceania","Niger":"Africa","Nigeria":"Africa","North Korea":"Asia","Norway":"Europe","Pakistan":"Asia","Peru":"S. America","Philippines":"Asia","Poland":"Europe","Portugal":"Europe","Qatar":"Middle East","Romania":"Europe","Russia":"Europe/Asia","Rwanda":"Africa","Saudi Arabia":"Middle East","Serbia":"Europe","Somalia":"Africa","South Africa":"Africa","South Korea":"Asia","South Sudan":"Africa","Spain":"Europe","Sri Lanka":"Asia","Sudan":"Africa","Sweden":"Europe","Switzerland":"Europe","Syria":"Middle East","Taiwan":"Asia","Tanzania":"Africa","Thailand":"Asia","Turkey":"Middle East","Ukraine":"Europe","United Arab Emirates":"Middle East","United Kingdom":"Europe","United States of America":"N. America","Venezuela":"S. America","Vietnam":"Asia","Yemen":"Middle East","Zimbabwe":"Africa"},
    markets: [
      {sym:"BTC",name:"Bitcoin",price:83420,chg:1.24,type:"crypto"},
      {sym:"ETH",name:"Ethereum",price:1612,chg:-0.87,type:"crypto"},
      {sym:"XAU",name:"Gold",price:3234,chg:0.43,type:"commodity"},
      {sym:"WTI",name:"Crude Oil",price:61.2,chg:-1.12,type:"commodity"},
      {sym:"DXY",name:"US Dollar Index",price:99.4,chg:-0.31,type:"index"},
      {sym:"SPX",name:"S&P 500",price:5282,chg:0.65,type:"index"},
      {sym:"FTSE",name:"FTSE 100",price:8247,chg:0.22,type:"index"},
      {sym:"NIKKEI",name:"Nikkei 225",price:34880,chg:-0.44,type:"index"},
    ],
    news: [
      {cat:"conflict",lbl:"Conflict",title:"Drone strikes reported near Khartoum — 3rd consecutive day of aerial activity",region:"Sudan",time:"4m"},
      {cat:"politics",lbl:"Politics",title:"EU foreign ministers convene emergency session on eastern border security",region:"Brussels",time:"11m"},
      {cat:"markets",lbl:"Markets",title:"Oil drops 1.1% as OPEC+ signals potential output increase at June meeting",region:"Global",time:"18m"},
      {cat:"conflict",lbl:"Conflict",title:"Ceasefire talks in Donbas stall — both sides report fresh artillery exchanges",region:"Ukraine",time:"25m"},
      {cat:"energy",lbl:"Energy",title:"Red Sea vessel diversions push LNG spot prices to 6-week high",region:"Middle East",time:"33m"},
      {cat:"politics",lbl:"Politics",title:"Taiwan Strait patrol frequency elevated after PLA naval drills conclude",region:"Taiwan",time:"41m"},
      {cat:"markets",lbl:"Markets",title:"Gold hits new 3-month high on USD weakness and safe-haven flows",region:"Global",time:"52m"},
      {cat:"conflict",lbl:"Conflict",title:"Pakistan-Afghanistan border clashes displace 4,000 civilians — UN reports",region:"S. Asia",time:"1h"},
      {cat:"energy",lbl:"Energy",title:"Saudi Aramco confirms Q1 output at 9.3mb/d — slightly below forecast",region:"Saudi Arabia",time:"1h"},
      {cat:"politics",lbl:"Politics",title:"Iran nuclear talks resume in Vienna — delegations describe constructive atmosphere",region:"Iran",time:"2h"},
      {cat:"conflict",lbl:"Conflict",title:"Myanmar junta forces advance in Shan State amid ceasefire collapse",region:"Myanmar",time:"2h"},
      {cat:"markets",lbl:"Markets",title:"Bitcoin surpasses $83,000 as institutional inflows accelerate",region:"Global",time:"3h"},
    ],
    flights: [
      {call:"EK201",from:"DXB",to:"LHR",lat:28.5,lng:40.2,alt:"37,000ft",type:"com",hdg:315},
      {call:"EK231",from:"DXB",to:"JFK",lat:32.1,lng:51.4,alt:"39,000ft",type:"com",hdg:320},
      {call:"QR007",from:"DOH",to:"LAX",lat:30.2,lng:62.1,alt:"38,000ft",type:"com",hdg:290},
      {call:"TK012",from:"IST",to:"NRT",lat:47.3,lng:70.2,alt:"36,000ft",type:"com",hdg:80},
      {call:"UA901",from:"ORD",to:"FRA",lat:52.4,lng:-10.2,alt:"35,000ft",type:"com",hdg:70},
      {call:"SQ321",from:"SIN",to:"LHR",lat:8.2,lng:76.1,alt:"40,000ft",type:"com",hdg:295},
      {call:"LH400",from:"FRA",to:"JFK",lat:53.1,lng:-5.3,alt:"36,000ft",type:"com",hdg:280},
      {call:"BA118",from:"LHR",to:"DXB",lat:44.2,lng:18.3,alt:"38,000ft",type:"com",hdg:130},
      {call:"AF073",from:"CDG",to:"SYD",lat:22.4,lng:98.3,alt:"37,000ft",type:"com",hdg:150},
      {call:"RC-135W",from:"RAF Mildenhall",to:"Baltic patrol",lat:54.8,lng:18.3,alt:"27,000ft",type:"mil",hdg:60},
      {call:"P-8A POSEIDON",from:"Rota NAS",to:"Med patrol",lat:36.2,lng:5.8,alt:"22,000ft",type:"mil",hdg:90},
      {call:"C-17A GLOBEMASTER",from:"Ramstein AB",to:"Incirlik",lat:44.1,lng:22.4,alt:"28,000ft",type:"mil",hdg:130},
      {call:"E-3 AWACS",from:"Geilenkirchen",to:"Poland sector",lat:51.2,lng:14.8,alt:"29,000ft",type:"mil",hdg:75},
      {call:"AF1",from:"Joint Base Andrews",to:"Brussels",lat:49.2,lng:-22.1,alt:"41,000ft",type:"mil",hdg:55},
      {call:"MQ-9 REAPER",from:"Sigonella NAS",to:"Libya recon",lat:34.1,lng:18.2,alt:"25,000ft",type:"mil",hdg:200},
    ],
    ships: [
      {name:"MSC Floriana",type:"cargo",lat:25.1,lng:57.3,speed:"14.2kn",dest:"Singapore"},
      {name:"Ocean Pioneer",type:"cargo",lat:22.8,lng:63.1,speed:"12.8kn",dest:"Rotterdam"},
      {name:"Nordic Hawk",type:"tanker",lat:26.4,lng:55.8,speed:"11.1kn",dest:"Fujairah"},
      {name:"Gulf Voyager",type:"tanker",lat:24.1,lng:53.4,speed:"9.4kn",dest:"Jebel Ali"},
      {name:"Ever Bright",type:"cargo",lat:12.3,lng:43.8,speed:"16.1kn",dest:"Colombo"},
      {name:"Arctic Sunrise",type:"cargo",lat:59.2,lng:4.1,speed:"13.0kn",dest:"Oslo"},
      {name:"BW Nanda",type:"tanker",lat:7.2,lng:79.3,speed:"10.2kn",dest:"Ras Tanura"},
      {name:"DARK VESSEL",type:"dark",lat:34.2,lng:36.8,speed:"—",dest:"Unknown (AIS off)"},
      {name:"Minerva Arethousa",type:"tanker",lat:37.2,lng:23.1,speed:"8.6kn",dest:"Piraeus"},
      {name:"CMA CGM Atlas",type:"cargo",lat:1.3,lng:104.2,speed:"17.1kn",dest:"Felixstowe"},
      {name:"Stena Impero",type:"tanker",lat:24.8,lng:58.9,speed:"7.2kn",dest:"Bandar Abbas"},
    ],
    confZones: [
      {lat:15.5,lng:32.5,name:"Sudan",sev:9},{lat:48.5,lng:35.0,name:"Ukraine",sev:10},
      {lat:15.9,lng:43.3,name:"Yemen",sev:8},{lat:33.8,lng:35.5,name:"Lebanon",sev:6},
      {lat:31.5,lng:34.5,name:"Gaza",sev:10},{lat:6.8,lng:25.2,name:"South Sudan",sev:7},
      {lat:13.5,lng:2.1,name:"Mali",sev:7},{lat:9.0,lng:8.7,name:"Nigeria",sev:6},
      {lat:34.3,lng:68.9,name:"Afghanistan",sev:8},{lat:7.6,lng:43.3,name:"Ethiopia",sev:7},
      {lat:2.0,lng:22.0,name:"DR Congo",sev:9},{lat:16.8,lng:-3.0,name:"Burkina Faso",sev:8},
      {lat:33.5,lng:36.3,name:"Syria",sev:9},{lat:5.5,lng:19.0,name:"Central African Republic",sev:9},
    ],
    dubaiSignals: [
      {trigger:"Red Sea Disruptions",chain:"Shipping reroutes via Cape → Logistics hub demand surge → Dubai South warehousing",sector:"Industrial & Logistics",impact:"+4.2%",sentiment:"bullish",time:"2h"},
      {trigger:"Gold All-Time High",chain:"Safe-haven capital inflow → DIFC wealth management expansion → Downtown premium office",sector:"Commercial Office",impact:"+2.8%",sentiment:"bullish",time:"4h"},
      {trigger:"Russia Capital Controls",chain:"HNW relocation wave → Dubai Marina & Palm demand → Ultra-luxury segment",sector:"Ultra-Luxury Residential",impact:"+6.1%",sentiment:"bullish",time:"6h"},
      {trigger:"OPEC+ Output Cut",chain:"Oil revenue boost → GCC sovereign spending → Abu Dhabi-Dubai corridor development",sector:"Mixed-Use Development",impact:"+3.5%",sentiment:"bullish",time:"8h"},
      {trigger:"CNY Depreciation",chain:"Chinese capital outflow → Dubai property as hedge → JVC & Business Bay mid-segment",sector:"Mid-Market Residential",impact:"+1.9%",sentiment:"bullish",time:"12h"},
      {trigger:"EU Energy Crisis",chain:"European business relocation → Free zone demand → DMCC & JAFZA office space",sector:"Free Zone Commercial",impact:"-0.4%",sentiment:"bearish",time:"1d"},
    ],
  };
}
