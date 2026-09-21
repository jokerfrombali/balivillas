# -*- coding: utf-8 -*-
"""What is around each villa. Shown behind "Learn more about the area".

Times are approximate and written as such: Bali traffic makes any exact figure a
lie, and an owner-run site should not invent precision it cannot hold to.
"""

AREAS = {
 'sanur': dict(
  name='Sanur',
  lead='Sanur is the calm, residential side of Bali — the east coast, reef-protected water, '
       'and an eight-kilometre beachfront promenade that is flat, shaded and closed to cars. '
       'It is the area long-stay guests and families keep coming back to.',
  near=[
   ('Sanur beach and the promenade', 'walking distance from most of our villas — the path runs from Mertasari in the south to Matahari Terbit in the north'),
   ('Jalan Danau Tamblingan', 'the main street for cafés, warungs, yoga studios and massage places, a few minutes by scooter'),
   ('Sindhu morning market', 'fresh produce and warung breakfasts, about 5 minutes'),
   ('Supermarkets and pharmacies', 'Hardys and Coco Mart, plus Guardian and Kimia Farma, all within about 5 minutes'),
   ('Medical care', 'BIMC and Sanglah — Bali&rsquo;s main hospitals are on this side of the island, roughly 10–20 minutes'),
   ('Fast boat harbour', 'departures to Nusa Penida, Lembongan and the Gilis, about 5–10 minutes'),
   ('Ngurah Rai airport', 'roughly 30 minutes by car outside peak hours'),
   ('Ubud', 'about an hour by car if you want the rice terraces for a day'),
  ],
  good='Sanur suits people who want to walk and cycle, families with small children — the water '
       'is shallow and calm — and anyone staying long enough to care about supermarkets, clinics '
       'and a short airport run. It is not the place for surf or nightlife.',
  link=('/villas/sanur/', 'All our villas in Sanur'),
  monthly=('/monthly-rental/sanur/', 'Monthly rentals in Sanur'),
 ),
 'canggu': dict(
  name='Canggu',
  lead='Canggu is the busy, social side of Bali: surf breaks, beach clubs, coworking spaces and '
       'the densest run of cafés and gyms on the island. Pererenan, one ridge north, is the '
       'quieter version of the same thing.',
  near=[
   ('Batu Bolong and Echo Beach', 'the main surf and sunset beaches, usually 5–10 minutes by scooter'),
   ('Pererenan beach', 'calmer and less crowded, a few minutes further north'),
   ('Cafés, gyms and coworking', 'Jalan Pantai Batu Bolong and Jalan Pantai Berawa — minutes away, but slow at peak hours'),
   ('Beach clubs', 'Finns, Atlas and La Brisa, about 10 minutes'),
   ('Supermarkets', 'Pepito and Zest within about 5–10 minutes'),
   ('Medical care', 'Canggu clinics nearby; the larger hospitals are in Denpasar, roughly 45 minutes'),
   ('Seminyak', 'about 25–35 minutes depending on traffic'),
   ('Ngurah Rai airport', 'roughly 45–75 minutes — leave more time than the map suggests'),
  ],
  good='Canggu suits surfers, remote workers and anyone who wants their social life within '
       'scooter range. The trade-off is traffic and noise; if that matters, look at Pererenan '
       'or Umalas instead.',
  link=('/villas/canggu/', 'All our villas in Canggu'),
  monthly=('/monthly-rental/canggu/', 'Monthly rentals in Canggu'),
 ),
 'umalas': dict(
  name='Umalas',
  lead='Umalas sits between Canggu and Seminyak with rice fields still in the middle of it — '
       'a residential area rather than a tourist strip, with quiet lanes and far less '
       'through-traffic than the coast.',
  near=[
   ('Berawa beach', 'about 10 minutes by scooter'),
   ('Seminyak', 'about 15 minutes, for restaurants and shopping'),
   ('Canggu', 'about 10–15 minutes to Batu Bolong'),
   ('Bakeries, cafés and gyms', 'Jalan Umalas and Jalan Bumbak — a few minutes, and quieter than the beach roads'),
   ('Supermarkets', 'Pepito and Bintang Supermarket within about 10 minutes'),
   ('Schools and stables', 'international schools and riding stables are in this area — one reason families base here'),
   ('Ngurah Rai airport', 'roughly 40–60 minutes'),
  ],
  good='Umalas suits families and anyone working from home during the day who still wants the '
       'beach in the evening. You will use a car or scooter more than in Canggu, and pay less '
       'for the same villa.',
  link=('/villas/umalas/', 'All our villas in Umalas'),
  monthly=('/monthly-rental/umalas/', 'Monthly rentals in Umalas'),
 ),
 'ungasan': dict(
  name='Ungasan',
  lead='Ungasan is on the Bukit, the limestone peninsula at the southern tip of Bali: dry, open '
       'and clifftop, with the island&rsquo;s best beaches a short ride away and none of the '
       'congestion of the west coast.',
  near=[
   ('Melasti beach', 'white sand under the cliffs, about 10 minutes by scooter'),
   ('Uluwatu and the surf breaks', 'Padang Padang, Bingin and Uluwatu itself, roughly 15–20 minutes'),
   ('Uluwatu temple and the kecak sunset', 'about 20 minutes'),
   ('Karma and Nyang Nyang beaches', 'quieter alternatives, 15–25 minutes'),
   ('Warungs and cafés', 'along Jalan Melasti and the Ungasan main road, a few minutes'),
   ('Supermarkets', 'Pepito Ungasan and local shops within about 5–10 minutes'),
   ('Ngurah Rai airport', 'about 30 minutes — the closest of all our areas'),
  ],
  good='Ungasan suits surfers, couples and anyone who wants a genuinely quiet month with the '
       'best beaches in Bali nearby. You will ride to most things; there is no walkable café '
       'strip here.',
  link=('/villas/ungasan/', 'All our villas in Ungasan'),
  monthly=('/monthly-rental/ungasan/', 'Monthly rentals in Ungasan'),
 ),
}

# --- Italiano -----------------------------------------------------------------
# Le stesse informazioni per /it/. I tempi restano approssimativi.
AREAS_IT = {
 'sanur': dict(
  name='Sanur',
  lead='Sanur è il lato tranquillo e residenziale di Bali: costa est, acqua protetta dalla '
       'barriera e una passeggiata sul mare di otto chilometri, piana, ombreggiata e chiusa alle auto.',
  near=[
   ('La spiaggia e la passeggiata di Sanur', 'a piedi dalla maggior parte delle nostre ville'),
   ('Jalan Danau Tamblingan', 'la via principale di caffè, warung, yoga e massaggi, pochi minuti in scooter'),
   ('Mercato mattutino di Sindhu', 'frutta, verdura e colazione al warung, circa 5 minuti'),
   ('Supermercati e farmacie', 'Hardys e Coco Mart, Guardian e Kimia Farma, entro circa 5 minuti'),
   ('Assistenza medica', 'BIMC e Sanglah, i principali ospedali di Bali, circa 10–20 minuti'),
   ('Porto dei fast boat', 'per Nusa Penida, Lembongan e le Gili, circa 5–10 minuti'),
   ('Aeroporto Ngurah Rai', 'circa 30 minuti in auto fuori dalle ore di punta'),
   ('Ubud', 'circa un&rsquo;ora in auto'),
  ],
  good='Sanur è adatta a chi vuole camminare e andare in bicicletta, alle famiglie con bambini '
       'piccoli — l&rsquo;acqua è bassa e calma — e a chi si ferma abbastanza da tenere ai '
       'supermercati, alle cliniche e a un tragitto breve verso l&rsquo;aeroporto. Non è il '
       'posto per il surf o la vita notturna.',
  link=('/it/villas/sanur/', 'Tutte le nostre ville a Sanur'),
  monthly=('/monthly-rental/sanur/', 'Affitti mensili a Sanur'),
 ),
 'canggu': dict(
  name='Canggu',
  lead='Canggu è il lato vivace e sociale di Bali: onde da surf, beach club, spazi di coworking '
       'e la maggiore concentrazione di caffè e palestre dell&rsquo;isola. Pererenan, poco più a '
       'nord, ne è la versione tranquilla.',
  near=[
   ('Batu Bolong ed Echo Beach', 'le spiagge principali per surf e tramonto, di solito 5–10 minuti in scooter'),
   ('Spiaggia di Pererenan', 'più calma e meno affollata, qualche minuto più a nord'),
   ('Caffè, palestre e coworking', 'Jalan Pantai Batu Bolong e Jalan Pantai Berawa, a pochi minuti ma lenti nelle ore di punta'),
   ('Beach club', 'Finns, Atlas e La Brisa, circa 10 minuti'),
   ('Supermercati', 'Pepito e Zest entro circa 5–10 minuti'),
   ('Assistenza medica', 'cliniche a Canggu; gli ospedali maggiori sono a Denpasar, circa 45 minuti'),
   ('Seminyak', 'circa 25–35 minuti secondo il traffico'),
   ('Aeroporto Ngurah Rai', 'circa 45–75 minuti: conviene calcolare più tempo di quanto indichi la mappa'),
  ],
  good='Canggu è adatta a surfisti, lavoratori da remoto e a chi vuole la vita sociale a portata '
       'di scooter. In cambio ci sono traffico e rumore: se contano, guardate Pererenan o Umalas.',
  link=('/it/villas/canggu/', 'Tutte le nostre ville a Canggu'),
  monthly=('/monthly-rental/canggu/', 'Affitti mensili a Canggu'),
 ),
 'umalas': dict(
  name='Umalas',
  lead='Umalas si trova tra Canggu e Seminyak, con le risaie ancora nel mezzo: una zona '
       'residenziale più che turistica, con stradine tranquille e molto meno traffico di passaggio '
       'rispetto alla costa.',
  near=[
   ('Spiaggia di Berawa', 'circa 10 minuti in scooter'),
   ('Seminyak', 'circa 15 minuti, per ristoranti e shopping'),
   ('Canggu', 'circa 10–15 minuti fino a Batu Bolong'),
   ('Panetterie, caffè e palestre', 'Jalan Umalas e Jalan Bumbak, a pochi minuti e più tranquilli delle strade sul mare'),
   ('Supermercati', 'Pepito e Bintang Supermarket entro circa 10 minuti'),
   ('Scuole e maneggi', 'in questa zona ci sono scuole internazionali e maneggi: un motivo per cui le famiglie scelgono Umalas'),
   ('Aeroporto Ngurah Rai', 'circa 40–60 minuti'),
  ],
  good='Umalas è adatta alle famiglie e a chi lavora da casa di giorno ma vuole il mare la sera. '
       'Userete l&rsquo;auto o lo scooter più che a Canggu, e pagherete meno per la stessa villa.',
  link=('/it/villas/umalas/', 'Tutte le nostre ville a Umalas'),
  monthly=('/monthly-rental/umalas/', 'Affitti mensili a Umalas'),
 ),
 'ungasan': dict(
  name='Ungasan',
  lead='Ungasan si trova sul Bukit, la penisola calcarea all&rsquo;estremità meridionale di Bali: '
       'asciutta, aperta, a picco sul mare, con le spiagge migliori dell&rsquo;isola a pochi minuti '
       'e senza la congestione della costa ovest.',
  near=[
   ('Spiaggia di Melasti', 'sabbia bianca sotto le falesie, circa 10 minuti in scooter'),
   ('Uluwatu e i suoi spot da surf', 'Padang Padang, Bingin e Uluwatu, circa 15–20 minuti'),
   ('Tempio di Uluwatu e il kecak al tramonto', 'circa 20 minuti'),
   ('Spiagge di Karma e Nyang Nyang', 'alternative più tranquille, 15–25 minuti'),
   ('Warung e caffè', 'lungo Jalan Melasti e la strada principale di Ungasan, a pochi minuti'),
   ('Supermercati', 'Pepito Ungasan e negozi locali entro circa 5–10 minuti'),
   ('Aeroporto Ngurah Rai', 'circa 30 minuti: il più vicino fra le nostre zone'),
  ],
  good='Ungasan è adatta a surfisti, coppie e a chi vuole un mese davvero tranquillo con le '
       'spiagge migliori di Bali vicine. Quasi tutto si raggiunge in scooter: qui non c&rsquo;è '
       'una via di caffè percorribile a piedi.',
  link=('/it/villas/ungasan/', 'Tutte le nostre ville a Ungasan'),
  monthly=('/monthly-rental/ungasan/', 'Affitti mensili a Ungasan'),
 ),
}
