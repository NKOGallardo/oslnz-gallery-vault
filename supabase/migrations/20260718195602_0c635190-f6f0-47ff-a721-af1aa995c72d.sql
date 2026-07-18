
-- Photographers table
CREATE TABLE public.photographers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  secret_url text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.photographers TO service_role;
ALTER TABLE public.photographers ENABLE ROW LEVEL SECURITY;

-- Galleries table
CREATE TABLE public.galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  title text NOT NULL,
  client_name text NOT NULL,
  event_name text,
  event_date date,
  pin text NOT NULL UNIQUE,
  expires_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.galleries(photographer_id);
CREATE INDEX ON public.galleries(pin);
GRANT ALL ON public.galleries TO service_role;
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;

-- Gallery images table
CREATE TABLE public.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.gallery_images(gallery_id);
CREATE INDEX ON public.gallery_images(gallery_id, sort_order);
GRANT ALL ON public.gallery_images TO service_role;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

-- PIN attempts for rate limiting
CREATE TABLE public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);
CREATE INDEX ON public.pin_attempts(ip, attempted_at);
GRANT ALL ON public.pin_attempts TO service_role;
ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

-- Storage policies: private bucket, all access via service role only
CREATE POLICY "service_role_all_gallery_images"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'gallery-images')
  WITH CHECK (bucket_id = 'gallery-images');
