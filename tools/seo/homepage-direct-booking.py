#!/usr/bin/env python3
"""Point the home page at guests and at direct bookings.

Why (Search Console + SERP checks, 20.09.2026):
  * The business goal is direct bookings, but the loudest call to action on the page was
    "List your property" - an offer aimed at villa owners, not guests. There was no booking or
    enquiry form at all, and the words "book direct", "no fees" and "no commission" appeared
    zero times on the page.
  * The title sold "Smart Villa Search", a feature name nobody searches for, and competed on the
    head term "Bali Villa Rental" where the site is not in the top 20.
  * Every top query in Search Console contains the same phrase - "canggu private pool villa",
    "villa private pool canggu bali", "villas in sanur with private pool" - so "private pool
    villas" is the wording this audience actually types, and it was not in the title.
  * Sanur holds 11 of the 20 villas but barely registers, while the impressions the site does get
    are for Canggu, where it has 2. The copy now leads with Sanur.

Run from the repo root:  python3 tools/seo/homepage-direct-booking.py [--dry]
Idempotent: every replacement checks for the new wording first.
"""
import os, re, sys

DRY = '--dry' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)
F = 'index.html'
h = open(F, encoding='utf-8').read()
orig = h
done, skipped = [], []

def swap(old, new, label):
    global h
    if new in h:
        skipped.append(label); return
    if old not in h:
        print('  ! не найдено:', label); return
    h = h.replace(old, new, 1); done.append(label)

TITLE = 'The Host Bali — Private Pool Villas in Bali, Booked Direct'
DESC = ('11 private pool villas in Sanur, plus Canggu, Umalas and Ungasan — run by our own team in Bali. '
        'Book direct: no platform fee, same-day reply.')

swap('<title>Bali Villa Rental — Smart Villa Search | The Host Bali</title>',
     '<title>%s</title>' % TITLE, 'title')
swap('<meta name="description" content="20 private pool villas in Bali, managed by our own team — Sanur, '
     'Canggu, Umalas and Ungasan. Daily, monthly and long stays, booked direct.">',
     '<meta name="description" content="%s">' % DESC, 'description')
swap('<meta property="og:title" content="Bali Villa Rental — Smart Villa Search | The Host Bali">',
     '<meta property="og:title" content="%s">' % TITLE, 'og:title')

# H1: keep the two-line rhythm and the italic second line, but say what the offer is
swap('Find your perfect<br> <span class="italic font-light">Bali villa.</span>',
     'Your perfect Bali villa,<br> <span class="italic font-light">booked direct.</span>', 'H1')

# the sub-line spoke to owners ("hand your villa over"); guests need the reason to book here
swap('Rent, buy — or hand your villa over to the team that runs every home on this site.',
     'Every villa on this site is run by our own team in Bali. Book straight with us: no platform '
     'fee on top, and a real person answers the same day.', 'подзаголовок')

# header: the primary button now serves guests; owners keep a link in the nav
swap('<a href="/villa-management/" class="btn-primary mobile-menu-link hidden sm:inline-flex items-center gap-2"> List your property ',
     '<a href="/property-rental/" class="btn-primary mobile-menu-link hidden sm:inline-flex items-center gap-2"> Browse villas ',
     'кнопка в шапке')

if done:
    print('изменено: ' + ', '.join(done))
if skipped:
    print('уже было: ' + ', '.join(skipped))
if h != orig and not DRY:
    open(F, 'w', encoding='utf-8').write(h)
print('title:', TITLE, '(%d симв.)' % len(TITLE))
print('description: %d симв.' % len(DESC))
