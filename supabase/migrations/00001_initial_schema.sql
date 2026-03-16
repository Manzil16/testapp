-- ============================================================
-- VehicleGrid — Supabase Schema Migration
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text not null default 'VehicleGrid User',
  role text not null default 'driver' check (role in ('driver', 'host', 'admin')),
  phone text,
  avatar_url text,
  preferred_reserve_percent integer not null default 12,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── CHARGERS ────────────────────────────────────────────────
create table public.chargers (
  id uuid default uuid_generate_v4() primary key,
  host_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  address text not null,
  suburb text not null default '',
  state text not null default '',
  latitude double precision not null,
  longitude double precision not null,
  max_power_kw integer not null default 0,
  price_per_kwh numeric(6,4) not null default 0,
  connectors jsonb not null default '[]'::jsonb,
  amenities text[] not null default '{}',
  availability_note text not null default '',
  availability_window jsonb,
  images text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verification_score integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── BOOKINGS ────────────────────────────────────────────────
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  charger_id uuid references public.chargers(id) on delete cascade not null,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  host_id uuid references public.profiles(id) on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  estimated_kwh numeric(8,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  platform_fee numeric(10,2) not null default 0,
  note text not null default '',
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined', 'in_progress', 'completed', 'cancelled')),
  arrival_signal text not null default 'en_route' check (arrival_signal in ('en_route', 'arrived', 'charging', 'departed')),
  expires_at timestamptz,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── REVIEWS ─────────────────────────────────────────────────
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  charger_id uuid references public.chargers(id) on delete cascade not null,
  driver_id uuid references public.profiles(id) on delete cascade not null,
  host_id uuid references public.profiles(id) on delete cascade not null,
  rating numeric(2,1) not null check (rating >= 0 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- ─── VEHICLES ────────────────────────────────────────────────
create table public.vehicles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  make text not null,
  model text not null,
  year integer not null,
  battery_capacity_kwh numeric(6,1) not null,
  max_range_km numeric(6,1) not null,
  efficiency_kwh_per_100km numeric(5,2) not null,
  default_reserve_percent integer not null default 12,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── TRIPS ───────────────────────────────────────────────────
create table public.trips (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  origin jsonb not null,
  destination jsonb not null,
  current_battery_percent numeric(5,2) not null,
  vehicle_max_range_km numeric(6,1) not null,
  distance_km numeric(8,2) not null,
  duration_minutes numeric(6,1) not null,
  route_polyline text not null default '',
  projected_arrival_percent numeric(5,2) not null,
  recommended_charger_id uuid references public.chargers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────
create table public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null default 'system' check (type in ('booking', 'verification', 'trip', 'system')),
  is_read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ─── VERIFICATION REQUESTS ───────────────────────────────────
create table public.verification_requests (
  id uuid default uuid_generate_v4() primary key,
  charger_id uuid references public.chargers(id) on delete cascade not null,
  host_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  note text not null default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────
create index idx_chargers_host_id on public.chargers(host_id);
create index idx_chargers_status on public.chargers(status);
create index idx_bookings_driver_id on public.bookings(driver_id);
create index idx_bookings_host_id on public.bookings(host_id);
create index idx_bookings_charger_id on public.bookings(charger_id);
create index idx_reviews_charger_id on public.reviews(charger_id);
create index idx_vehicles_user_id on public.vehicles(user_id);
create index idx_trips_user_id on public.trips(user_id);
create index idx_notifications_user_id on public.notifications(user_id);
create index idx_verification_requests_status on public.verification_requests(status);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.chargers
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.vehicles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.trips
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.verification_requests
  for each row execute function public.handle_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', 'VehicleGrid User')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.chargers enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;

-- Profiles: users can read any profile, insert/update only their own
create policy "Anyone can view profiles" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Chargers: anyone can read approved, hosts manage their own, admins manage all
create policy "Anyone can view approved chargers" on public.chargers
  for select using (status = 'approved' or host_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
create policy "Hosts can insert chargers" on public.chargers
  for insert with check (host_id = auth.uid());
create policy "Hosts can update own chargers" on public.chargers
  for update using (host_id = auth.uid());
create policy "Admins can update any charger" on public.chargers
  for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
create policy "Hosts can delete own chargers" on public.chargers
  for delete using (host_id = auth.uid());

-- Bookings: drivers/hosts see their own bookings
create policy "Users can view own bookings" on public.bookings
  for select using (driver_id = auth.uid() or host_id = auth.uid());
create policy "Drivers can create bookings" on public.bookings
  for insert with check (driver_id = auth.uid());
create policy "Booking parties can update" on public.bookings
  for update using (driver_id = auth.uid() or host_id = auth.uid());

-- Reviews: anyone can read, drivers can create for their bookings
create policy "Anyone can view reviews" on public.reviews for select using (true);
create policy "Drivers can create reviews" on public.reviews
  for insert with check (driver_id = auth.uid());

-- Vehicles: users manage their own
create policy "Users can view own vehicles" on public.vehicles
  for select using (user_id = auth.uid());
create policy "Users can insert vehicles" on public.vehicles
  for insert with check (user_id = auth.uid());
create policy "Users can update own vehicles" on public.vehicles
  for update using (user_id = auth.uid());
create policy "Users can delete own vehicles" on public.vehicles
  for delete using (user_id = auth.uid());

-- Trips: users manage their own
create policy "Users can view own trips" on public.trips
  for select using (user_id = auth.uid());
create policy "Users can insert trips" on public.trips
  for insert with check (user_id = auth.uid());

-- Notifications: users see their own
create policy "Users can view own notifications" on public.notifications
  for select using (user_id = auth.uid());
create policy "Users can update own notifications" on public.notifications
  for update using (user_id = auth.uid());

-- Verification requests: hosts see their own, admins see all pending
create policy "Hosts can view own verifications" on public.verification_requests
  for select using (host_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));
create policy "Hosts can create verifications" on public.verification_requests
  for insert with check (host_id = auth.uid());
create policy "Admins can update verifications" on public.verification_requests
  for update using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ─── STORAGE ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('charger-images', 'charger-images', true)
  on conflict (id) do nothing;

create policy "Anyone can view charger images" on storage.objects
  for select using (bucket_id = 'charger-images');
create policy "Authenticated users can upload charger images" on storage.objects
  for insert with check (bucket_id = 'charger-images' and auth.role() = 'authenticated');
create policy "Users can delete own charger images" on storage.objects
  for delete using (bucket_id = 'charger-images' and auth.uid()::text = (storage.foldername(name))[1]);
