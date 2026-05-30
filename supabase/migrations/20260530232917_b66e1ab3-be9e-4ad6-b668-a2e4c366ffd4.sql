-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('paciente', 'medico', 'recepcionista', 'admin');
CREATE TYPE public.appointment_status AS ENUM ('pendiente', 'confirmado', 'cancelado', 'completado', 'ausente');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  document_number TEXT,
  birth_date DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ SPECIALTIES ============
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.specialties TO anon, authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

-- ============ DOCTORS ============
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE RESTRICT,
  license_number TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  slot_minutes INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon, authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- ============ DOCTOR SCHEDULES ============
CREATE TABLE public.doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT ON public.doctor_schedules TO anon, authenticated;
GRANT ALL ON public.doctor_schedules TO service_role;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

-- ============ APPOINTMENTS ============
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE RESTRICT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status appointment_status NOT NULL DEFAULT 'pendiente',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appointments_doctor_time ON public.appointments(doctor_id, scheduled_at) WHERE status <> 'cancelado';
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);

-- Prevent overlaps for same doctor (non-cancelled)
CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.doctor_id = NEW.doctor_id
      AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND a.status <> 'cancelado'
      AND tstzrange(a.scheduled_at, a.scheduled_at + (a.duration_minutes || ' minutes')::interval, '[)')
        && tstzrange(NEW.scheduled_at, NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval, '[)')
  ) THEN
    RAISE EXCEPTION 'El horario seleccionado ya está reservado para este profesional';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_no_overlap
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_appointment_overlap();

-- ============ GALLERY ============
CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gallery_images TO anon, authenticated;
GRANT ALL ON public.gallery_images TO service_role;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- Profiles
CREATE POLICY "view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'recepcionista') OR public.has_role(auth.uid(), 'medico'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles (read only via RLS; admin manages via service_role/server fn)
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Specialties
CREATE POLICY "anyone view specialties" ON public.specialties FOR SELECT TO anon, authenticated USING (true);

-- Doctors
CREATE POLICY "anyone view doctors" ON public.doctors FOR SELECT TO anon, authenticated USING (true);

-- Schedules
CREATE POLICY "anyone view schedules" ON public.doctor_schedules FOR SELECT TO anon, authenticated USING (true);

-- Appointments
CREATE POLICY "patient view own appts" ON public.appointments FOR SELECT TO authenticated
  USING (
    auth.uid() = patient_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'recepcionista')
    OR (public.has_role(auth.uid(), 'medico') AND EXISTS (
        SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.profile_id = auth.uid()
    ))
  );
CREATE POLICY "patient create own appts" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "update appts" ON public.appointments FOR UPDATE TO authenticated
  USING (
    auth.uid() = patient_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'recepcionista')
    OR (public.has_role(auth.uid(), 'medico') AND EXISTS (
        SELECT 1 FROM public.doctors d WHERE d.id = appointments.doctor_id AND d.profile_id = auth.uid()
    ))
  );

-- Gallery
CREATE POLICY "anyone view gallery" ON public.gallery_images FOR SELECT TO anon, authenticated USING (true);

-- Notifications
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ AUTO PROFILE + DEFAULT ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'paciente');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED ============
INSERT INTO public.specialties (name, description, icon, sort_order) VALUES
  ('Clínica Médica', 'Atención integral del adulto', 'Stethoscope', 1),
  ('Pediatría', 'Salud infantil y adolescente', 'Baby', 2),
  ('Cardiología', 'Salud del corazón y sistema circulatorio', 'Heart', 3),
  ('Dermatología', 'Salud de la piel', 'Sparkles', 4),
  ('Ginecología', 'Salud de la mujer', 'Flower2', 5),
  ('Traumatología', 'Huesos, articulaciones y músculos', 'Bone', 6),
  ('Neurología', 'Sistema nervioso', 'Brain', 7),
  ('Oftalmología', 'Salud visual', 'Eye', 8);
