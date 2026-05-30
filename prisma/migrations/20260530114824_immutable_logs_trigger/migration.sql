CREATE OR REPLACE FUNCTION prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_activity_logs
BEFORE UPDATE ON "ActivityLog"
FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();

CREATE TRIGGER no_delete_activity_logs
BEFORE DELETE ON "ActivityLog"
FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();
