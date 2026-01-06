-- Function to get a decrypted secret from the vault
-- Only accessible with service_role key (no RLS bypass for anon)

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;
  
  RETURN secret_value;
END;
$$;

-- Only allow service_role to execute this function
REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;

-- Function to get multiple secrets at once
CREATE OR REPLACE FUNCTION public.get_secrets(secret_names text[])
RETURNS TABLE(name text, secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.name, ds.decrypted_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = ANY(secret_names);
END;
$$;

-- Only allow service_role to execute this function
REVOKE ALL ON FUNCTION public.get_secrets(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secrets(text[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_secrets(text[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_secrets(text[]) TO service_role;

