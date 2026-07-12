-- Bobby Billiards — demo seed for the Stockton → San Jose corridor.
-- Mirrors lib/demo-data.ts so the app behaves the same with or without a
-- live Supabase project.

insert into public.venues
  (id, name, phone, hours, rating, coordinates, cloth_quality, pocket_widths, cue_spacing, is_verified, table_specifications)
values
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0001', 'Delta Rail Billiards', '+1 (209) 555-0134',
   '{"mon-thu": "12pm-12am", "fri-sat": "12pm-2am", "sun": "12pm-10pm"}', 4.7,
   st_geogfromtext('SRID=4326;POINT(-121.2908 37.9577)'),
   'simonis_860', '4.5in_pro_cut', 'full_clearance', true,
   '[{"label": "Verified 9ft Diamond Tables", "brand": "Diamond", "size": "9ft", "count": 8},
     {"label": "7ft Bar Boxes", "brand": "Diamond", "size": "7ft", "count": 4}]'),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0002', 'Manteca Cue Club', '+1 (209) 555-0177',
   '{"daily": "2pm-11pm"}', 4.1,
   st_geogfromtext('SRID=4326;POINT(-121.2160 37.7974)'),
   'standard_felt', '5in_bar_box', 'comfortable', false, null),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0003', 'Tracy Corner Pocket', '+1 (209) 555-0158',
   '{"daily": "11am-1am"}', 3.9,
   st_geogfromtext('SRID=4326;POINT(-121.4252 37.7397)'),
   'worn_felt', 'oversized', 'tight_walls', false, null),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0004', 'Livermore Slate House', '+1 (925) 555-0142',
   '{"mon-sun": "10am-12am"}', 4.5,
   st_geogfromtext('SRID=4326;POINT(-121.7680 37.6819)'),
   'simonis_760', '4.75in_standard', 'full_clearance', true,
   '[{"label": "Verified 9ft Brunswick Gold Crowns", "brand": "Brunswick", "size": "9ft", "count": 6}]'),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0005', 'Fremont Bank Shot Lounge', '+1 (510) 555-0168',
   '{"daily": "4pm-2am"}', 4.2,
   st_geogfromtext('SRID=4326;POINT(-121.9886 37.5485)'),
   'championship_tour', '4.75in_standard', 'comfortable', false, null),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0006', 'San Jose Golden Break', '+1 (408) 555-0191',
   '{"mon-thu": "11am-1am", "fri-sun": "11am-3am"}', 4.8,
   st_geogfromtext('SRID=4326;POINT(-121.8863 37.3382)'),
   'simonis_860', '4.5in_pro_cut', 'full_clearance', true,
   '[{"label": "Verified 9ft Diamond Tables", "brand": "Diamond", "size": "9ft", "count": 12},
     {"label": "10ft Snooker", "brand": "Rasson", "size": "10ft", "count": 2}]'),
  ('6f1f7a3e-9c1a-4c5a-8f31-0d2b6f1a0007', 'Sacramento Rack Room', '+1 (916) 555-0122',
   '{"daily": "12pm-12am"}', 4.0,
   st_geogfromtext('SRID=4326;POINT(-121.4944 38.5816)'),
   'standard_felt', '4.75in_standard', 'comfortable', false, null)
on conflict (id) do nothing;

insert into public.venue_analytics (venue_id, page_views, engagement_events, travel_log_additions)
select id, 1200 + (random() * 4000)::bigint, 300 + (random() * 900)::bigint, 40 + (random() * 200)::bigint
from public.venues
on conflict (venue_id) do nothing;
