DROP TRIGGER IF EXISTS on_auth_user_created_invited ON auth.users;

CREATE TRIGGER on_auth_user_created_invited
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_invited();