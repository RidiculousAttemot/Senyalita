-- 0007_seed.sql
-- Optional seed data for the 26 FSL alphabet gestures. Idempotent.
-- Run with: psql -f 0007_seed.sql

insert into public.gestures (label, description, display_order, is_active)
values
  ('a', 'FSL letter A — closed fist with thumb at side', 1, true),
  ('b', 'FSL letter B — flat palm facing forward, fingers together', 2, true),
  ('c', 'FSL letter C — curved hand forming a C shape', 3, true),
  ('d', 'FSL letter D — index finger up, other fingers touch thumb', 4, true),
  ('e', 'FSL letter E — bent fingers touching thumb', 5, true),
  ('f', 'FSL letter F — index and thumb form a circle, other fingers up', 6, true),
  ('g', 'FSL letter G — index finger pointing sideways, thumb above', 7, true),
  ('h', 'FSL letter H — index and middle fingers extended sideways', 8, true),
  ('i', 'FSL letter I — pinky finger up, others closed', 9, true),
  ('j', 'FSL letter J — pinky up, draw a J motion', 10, true),
  ('k', 'FSL letter K — index up, middle out, thumb between', 11, true),
  ('l', 'FSL letter L — thumb and index form an L shape', 12, true),
  ('m', 'FSL letter M — three fingers over thumb', 13, true),
  ('n', 'FSL letter N — two fingers over thumb', 14, true),
  ('o', 'FSL letter O — fingertips meet thumb in a circle', 15, true),
  ('p', 'FSL letter P — like K but pointing down', 16, true),
  ('q', 'FSL letter Q — like G but pointing down', 17, true),
  ('r', 'FSL letter R — index and middle crossed', 18, true),
  ('s', 'FSL letter S — closed fist with thumb in front', 19, true),
  ('t', 'FSL letter T — thumb between index and middle', 20, true),
  ('u', 'FSL letter U — index and middle up together', 21, true),
  ('v', 'FSL letter V — index and middle up in a V', 22, true),
  ('w', 'FSL letter W — index, middle, and ring fingers up', 23, true),
  ('x', 'FSL letter X — index finger bent like a hook', 24, true),
  ('y', 'FSL letter Y — thumb and pinky out, others closed', 25, true),
  ('z', 'FSL letter Z — index draws a Z in the air', 26, true)
on conflict (label) do nothing;
