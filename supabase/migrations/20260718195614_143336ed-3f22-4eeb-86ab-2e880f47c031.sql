
CREATE POLICY "deny_all" ON public.photographers FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON public.galleries FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON public.gallery_images FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all" ON public.pin_attempts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
