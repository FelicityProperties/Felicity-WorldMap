-- ═══════════════════════════════════════════════════════════
-- Felicity WorldMap — Seed Data
-- Run after schema.sql to populate all tables
-- ═══════════════════════════════════════════════════════════

-- ── Countries ──
INSERT INTO countries (name, cii_score, region) VALUES
('Afghanistan',9.2,'Asia'),('Albania',3.1,NULL),('Algeria',5.8,'Africa'),('Andorra',1.0,NULL),('Angola',6.1,'Africa'),
('Argentina',4.8,'S. America'),('Armenia',5.9,'Caucasus'),('Australia',1.4,'Oceania'),('Austria',1.5,'Europe'),('Azerbaijan',6.2,'Caucasus'),
('Bahamas',2.8,NULL),('Bahrain',4.9,NULL),('Bangladesh',5.6,'Asia'),('Belarus',7.1,'Europe'),('Belgium',2.3,'Europe'),
('Belize',3.9,NULL),('Benin',4.2,NULL),('Bhutan',2.1,NULL),('Bolivia',4.5,'S. America'),('Bosnia and Herzegovina',5.2,'Europe'),
('Botswana',2.4,NULL),('Brazil',5.1,'S. America'),('Brunei',1.8,NULL),('Bulgaria',2.7,'Europe'),
('Burkina Faso',8.1,'Africa'),('Burundi',7.8,'Africa'),('Cambodia',4.3,'Asia'),('Cameroon',6.9,'Africa'),('Canada',1.3,'N. America'),
('Central African Republic',9.0,'Africa'),('Chad',8.3,'Africa'),('Chile',3.2,'S. America'),('China',4.1,'Asia'),('Colombia',6.2,'S. America'),
('Comoros',4.0,NULL),('Congo',6.8,NULL),('Costa Rica',1.9,NULL),('Croatia',1.8,NULL),('Cuba',5.5,NULL),
('Cyprus',3.1,NULL),('Czechia',1.6,NULL),('Denmark',1.2,'Europe'),('Djibouti',4.4,NULL),
('Dominican Republic',4.0,NULL),('Dem. Rep. Congo',9.1,'Africa'),('Ecuador',5.3,'S. America'),
('Egypt',6.0,'Africa'),('El Salvador',5.9,NULL),('Equatorial Guinea',5.1,NULL),('Eritrea',7.2,NULL),('Estonia',1.7,NULL),
('Eswatini',4.3,NULL),('Ethiopia',7.9,'Africa'),('Fiji',2.8,NULL),('Finland',1.1,'Europe'),('France',2.8,'Europe'),
('Gabon',4.9,NULL),('Gambia',4.0,NULL),('Georgia',4.8,NULL),('Germany',1.6,'Europe'),('Ghana',3.4,'Africa'),
('Greece',3.9,'Europe'),('Guatemala',5.8,'C. America'),('Guinea',6.1,NULL),('Guinea-Bissau',5.9,NULL),('Guyana',3.5,NULL),
('Haiti',8.8,'Caribbean'),('Honduras',6.0,'C. America'),('Hungary',3.8,'Europe'),('Iceland',1.0,NULL),('India',4.9,'Asia'),
('Indonesia',4.0,'Asia'),('Iran',7.3,'Middle East'),('Iraq',7.6,'Middle East'),('Ireland',1.4,'Europe'),('Israel',7.8,'Middle East'),
('Italy',2.9,'Europe'),('Jamaica',4.5,NULL),('Japan',1.7,'Asia'),
('Jordan',4.2,'Middle East'),('Kazakhstan',3.9,'C. Asia'),('Kenya',5.3,'Africa'),('Kosovo',3.8,NULL),('Kuwait',3.1,NULL),
('Kyrgyzstan',4.9,NULL),('Laos',3.5,NULL),('Latvia',1.9,NULL),('Lebanon',8.2,'Middle East'),('Lesotho',3.8,NULL),
('Liberia',5.4,NULL),('Libya',8.0,'Africa'),('Liechtenstein',1.0,NULL),('Lithuania',2.0,NULL),('Luxembourg',1.1,NULL),
('Madagascar',5.0,NULL),('Malawi',4.9,NULL),('Malaysia',3.3,'Asia'),('Maldives',2.9,NULL),('Mali',8.7,'Africa'),
('Malta',1.5,NULL),('Mauritania',5.7,NULL),('Mauritius',1.8,NULL),('Mexico',6.0,'N. America'),('Moldova',4.9,NULL),
('Mongolia',2.8,NULL),('Montenegro',2.9,NULL),('Morocco',4.3,'Africa'),('Mozambique',6.2,'Africa'),('Myanmar',9.0,'Asia'),
('Namibia',2.7,NULL),('Nepal',4.1,NULL),('Netherlands',1.5,'Europe'),('New Zealand',1.1,'Oceania'),('Nicaragua',5.8,NULL),
('Niger',7.9,'Africa'),('Nigeria',7.4,'Africa'),('North Korea',7.9,'Asia'),('North Macedonia',2.8,NULL),('Norway',1.1,'Europe'),
('Oman',2.8,NULL),('Pakistan',7.5,'Asia'),('Panama',3.1,NULL),('Papua New Guinea',5.6,NULL),('Paraguay',3.8,NULL),
('Peru',4.7,'S. America'),('Philippines',4.9,'Asia'),('Poland',2.4,'Europe'),('Portugal',1.7,'Europe'),('Qatar',2.1,'Middle East'),
('Romania',2.5,'Europe'),('Russia',8.1,'Europe/Asia'),('Rwanda',3.9,'Africa'),('Saudi Arabia',4.4,'Middle East'),('Senegal',3.9,NULL),
('Serbia',3.4,'Europe'),('Sierra Leone',4.9,NULL),('Singapore',1.2,NULL),('Slovakia',1.7,NULL),('Slovenia',1.4,NULL),
('Solomon Islands',3.8,NULL),('Somalia',9.4,'Africa'),('South Africa',5.8,'Africa'),('South Korea',2.3,'Asia'),
('South Sudan',9.2,'Africa'),('Spain',2.6,'Europe'),('Sri Lanka',5.1,'Asia'),('Sudan',9.3,'Africa'),
('Suriname',3.2,NULL),('Sweden',1.3,'Europe'),('Switzerland',1.1,'Europe'),('Syria',9.5,'Middle East'),('Taiwan',4.9,'Asia'),
('Tajikistan',5.4,NULL),('Tanzania',3.9,'Africa'),('Thailand',4.2,'Asia'),('Timor-Leste',3.2,NULL),('Togo',4.4,NULL),
('Trinidad and Tobago',4.8,NULL),('Tunisia',5.1,NULL),('Turkey',5.8,'Middle East'),('Turkmenistan',4.9,NULL),
('Uganda',5.6,NULL),('Ukraine',9.8,'Europe'),('United Arab Emirates',2.1,'Middle East'),('United Kingdom',2.4,'Europe'),
('United States of America',3.0,'N. America'),('Uruguay',2.1,NULL),('Uzbekistan',4.1,NULL),
('Venezuela',7.2,'S. America'),('Vietnam',3.0,'Asia'),('Yemen',9.1,'Middle East'),('Zambia',4.2,NULL),('Zimbabwe',6.1,'Africa')
ON CONFLICT (name) DO NOTHING;

-- ── Markets ──
INSERT INTO markets (symbol, name, price, change_pct, type) VALUES
('BTC','Bitcoin',83420,1.24,'crypto'),
('ETH','Ethereum',1612,-0.87,'crypto'),
('XAU','Gold',3234,0.43,'commodity'),
('WTI','Crude Oil',61.20,-1.12,'commodity'),
('DXY','US Dollar Index',99.40,-0.31,'index'),
('SPX','S&P 500',5282,0.65,'index'),
('FTSE','FTSE 100',8247,0.22,'index'),
('NIKKEI','Nikkei 225',34880,-0.44,'index')
ON CONFLICT (symbol) DO NOTHING;

-- ── News ──
INSERT INTO news (category, label, title, region, time_ago) VALUES
('conflict','Conflict','Drone strikes reported near Khartoum — 3rd consecutive day of aerial activity','Sudan','4m'),
('politics','Politics','EU foreign ministers convene emergency session on eastern border security','Brussels','11m'),
('markets','Markets','Oil drops 1.1% as OPEC+ signals potential output increase at June meeting','Global','18m'),
('conflict','Conflict','Ceasefire talks in Donbas stall — both sides report fresh artillery exchanges','Ukraine','25m'),
('energy','Energy','Red Sea vessel diversions push LNG spot prices to 6-week high','Middle East','33m'),
('politics','Politics','Taiwan Strait patrol frequency elevated after PLA naval drills conclude','Taiwan','41m'),
('markets','Markets','Gold hits new 3-month high on USD weakness and safe-haven flows','Global','52m'),
('conflict','Conflict','Pakistan-Afghanistan border clashes displace 4,000 civilians — UN reports','S. Asia','1h'),
('energy','Energy','Saudi Aramco confirms Q1 output at 9.3mb/d — slightly below forecast','Saudi Arabia','1h'),
('politics','Politics','Iran nuclear talks resume in Vienna — delegations describe constructive atmosphere','Iran','2h'),
('conflict','Conflict','Myanmar junta forces advance in Shan State amid ceasefire collapse','Myanmar','2h'),
('markets','Markets','Bitcoin surpasses $83,000 as institutional inflows accelerate','Global','3h');

-- ── Flights ──
INSERT INTO flights (callsign, origin, destination, lat, lng, altitude, type, heading) VALUES
('EK201','DXB','LHR',28.50,40.20,'37,000ft','com',315),
('EK231','DXB','JFK',32.10,51.40,'39,000ft','com',320),
('QR007','DOH','LAX',30.20,62.10,'38,000ft','com',290),
('TK012','IST','NRT',47.30,70.20,'36,000ft','com',80),
('UA901','ORD','FRA',52.40,-10.20,'35,000ft','com',70),
('SQ321','SIN','LHR',8.20,76.10,'40,000ft','com',295),
('LH400','FRA','JFK',53.10,-5.30,'36,000ft','com',280),
('BA118','LHR','DXB',44.20,18.30,'38,000ft','com',130),
('AF073','CDG','SYD',22.40,98.30,'37,000ft','com',150),
('RC-135W','RAF Mildenhall','Baltic patrol',54.80,18.30,'27,000ft','mil',60),
('P-8A POSEIDON','Rota NAS','Med patrol',36.20,5.80,'22,000ft','mil',90),
('C-17A GLOBEMASTER','Ramstein AB','Incirlik',44.10,22.40,'28,000ft','mil',130),
('E-3 AWACS','Geilenkirchen','Poland sector',51.20,14.80,'29,000ft','mil',75),
('AF1','Joint Base Andrews','Brussels',49.20,-22.10,'41,000ft','mil',55),
('MQ-9 REAPER','Sigonella NAS','Libya recon',34.10,18.20,'25,000ft','mil',200);

-- ── Ships ──
INSERT INTO ships (name, type, lat, lng, speed, destination) VALUES
('MSC Floriana','cargo',25.10,57.30,'14.2kn','Singapore'),
('Ocean Pioneer','cargo',22.80,63.10,'12.8kn','Rotterdam'),
('Nordic Hawk','tanker',26.40,55.80,'11.1kn','Fujairah'),
('Gulf Voyager','tanker',24.10,53.40,'9.4kn','Jebel Ali'),
('Ever Bright','cargo',12.30,43.80,'16.1kn','Colombo'),
('Arctic Sunrise','cargo',59.20,4.10,'13.0kn','Oslo'),
('BW Nanda','tanker',7.20,79.30,'10.2kn','Ras Tanura'),
('DARK VESSEL','dark',34.20,36.80,'—','Unknown (AIS off)'),
('Minerva Arethousa','tanker',37.20,23.10,'8.6kn','Piraeus'),
('CMA CGM Atlas','cargo',1.30,104.20,'17.1kn','Felixstowe'),
('Stena Impero','tanker',24.80,58.90,'7.2kn','Bandar Abbas');

-- ── Conflict Zones ──
INSERT INTO conflict_zones (name, lat, lng, severity) VALUES
('Sudan',15.50,32.50,9),
('Ukraine',48.50,35.00,10),
('Yemen',15.90,43.30,8),
('Lebanon',33.80,35.50,6),
('Gaza',31.50,34.50,10),
('South Sudan',6.80,25.20,7),
('Mali',13.50,2.10,7),
('Nigeria',9.00,8.70,6),
('Afghanistan',34.30,68.90,8),
('Ethiopia',7.60,43.30,7),
('DR Congo',2.00,22.00,9),
('Burkina Faso',16.80,-3.00,8),
('Syria',33.50,36.30,9),
('Central African Republic',5.50,19.00,9);

-- ── Dubai RE Signals ──
INSERT INTO dubai_signals (trigger_event, chain, sector, impact, sentiment, time_ago) VALUES
('Red Sea Disruptions','Shipping reroutes via Cape → Logistics hub demand surge → Dubai South warehousing','Industrial & Logistics','+4.2%','bullish','2h'),
('Gold All-Time High','Safe-haven capital inflow → DIFC wealth management expansion → Downtown premium office','Commercial Office','+2.8%','bullish','4h'),
('Russia Capital Controls','HNW relocation wave → Dubai Marina & Palm demand → Ultra-luxury segment','Ultra-Luxury Residential','+6.1%','bullish','6h'),
('OPEC+ Output Cut','Oil revenue boost → GCC sovereign spending → Abu Dhabi-Dubai corridor development','Mixed-Use Development','+3.5%','bullish','8h'),
('CNY Depreciation','Chinese capital outflow → Dubai property as hedge → JVC & Business Bay mid-segment','Mid-Market Residential','+1.9%','bullish','12h'),
('EU Energy Crisis','European business relocation → Free zone demand → DMCC & JAFZA office space','Free Zone Commercial','-0.4%','bearish','1d');
