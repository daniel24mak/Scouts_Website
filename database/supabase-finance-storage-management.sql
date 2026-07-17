-- Trusted management API for Finance and Storage catalogue records.
-- Run after the Finance and Storage core/workflow migrations.

BEGIN;

-- Keep legacy and normalized audit columns populated on upgraded databases.
CREATE OR REPLACE FUNCTION public.normalize_workspace_audit_compatibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.entity_type := COALESCE(NULLIF(NEW.entity_type, ''), NULLIF(NEW.resource_type, ''), NULLIF(NEW.module, ''), 'workspace_record');
  NEW.entity_id := COALESCE(NULLIF(NEW.entity_id, ''), NULLIF(NEW.resource_id, ''), gen_random_uuid()::text);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS normalize_workspace_audit_compatibility ON public.audit_logs;
CREATE TRIGGER normalize_workspace_audit_compatibility BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.normalize_workspace_audit_compatibility();

CREATE OR REPLACE FUNCTION public.manage_finance_record(target_entity text, requested_action text, target_id uuid DEFAULT NULL, payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE saved jsonb; ledger_id uuid; line jsonb; actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication is required' USING ERRCODE='42501'; END IF;
  IF target_entity = 'collection' THEN
    IF NOT public.is_admin() AND NOT public.has_permission('finance.collections.manage') THEN RAISE EXCEPTION 'Collection management is not permitted' USING ERRCODE='42501'; END IF;
    IF requested_action = 'update' THEN
      UPDATE public.finance_collections SET title=btrim(payload->>'title'), expected_amount=(payload->>'expected_amount')::numeric, due_on=NULLIF(payload->>'due_on','')::date, description=COALESCE(payload->>'description',description), updated_at=now()
      WHERE id=target_id AND status='draft' RETURNING to_jsonb(finance_collections.*) INTO saved;
    ELSIF requested_action = 'delete' THEN
      DELETE FROM public.finance_collections WHERE id=target_id AND status='draft' AND journal_entry_id IS NULL RETURNING to_jsonb(finance_collections.*) INTO saved;
    ELSIF requested_action = 'transition' AND payload->>'status' IN ('open','cancelled') THEN
      UPDATE public.finance_collections SET status=payload->>'status', updated_at=now() WHERE id=target_id AND status IN ('draft','open','partially_collected') RETURNING to_jsonb(finance_collections.*) INTO saved;
    ELSE RAISE EXCEPTION 'Unsupported collection action' USING ERRCODE='22023'; END IF;
  ELSIF target_entity = 'transaction' THEN
    IF NOT public.is_admin() AND NOT public.has_permission('finance.transactions.create') THEN RAISE EXCEPTION 'Transaction management is not permitted' USING ERRCODE='42501'; END IF;
    IF requested_action = 'update' THEN
      IF jsonb_typeof(payload->'lines') <> 'array' OR jsonb_array_length(payload->'lines') < 2 THEN RAISE EXCEPTION 'At least two journal lines are required' USING ERRCODE='22023'; END IF;
      UPDATE public.finance_journal_entries SET entry_type=payload->>'entry_type',entry_date=(payload->>'entry_date')::date,description=btrim(payload->>'description'),updated_at=now() WHERE id=target_id AND status='draft' RETURNING to_jsonb(finance_journal_entries.*) INTO saved;
      IF saved IS NOT NULL THEN
        DELETE FROM public.finance_journal_lines WHERE journal_entry_id=target_id;
        FOR line IN SELECT value FROM jsonb_array_elements(payload->'lines') LOOP
          INSERT INTO public.finance_journal_lines(journal_entry_id,ledger_account_id,direction,amount,currency,memo) VALUES(target_id,(line->>'ledgerAccountId')::uuid,line->>'direction',(line->>'amount')::numeric,COALESCE(NULLIF(line->>'currency',''),'AED'),COALESCE(line->>'memo',''));
        END LOOP;
      END IF;
    ELSIF requested_action = 'delete' THEN
      DELETE FROM public.finance_journal_entries WHERE id=target_id AND status='draft' RETURNING to_jsonb(finance_journal_entries.*) INTO saved;
    ELSE RAISE EXCEPTION 'Unsupported transaction action' USING ERRCODE='22023'; END IF;
  ELSE
    IF NOT public.is_admin() AND NOT public.has_permission('finance.settings.manage') THEN RAISE EXCEPTION 'Finance catalogue management is not permitted' USING ERRCODE='42501'; END IF;
    IF target_entity = 'fund' THEN
      IF requested_action = 'create' THEN INSERT INTO public.finance_funds(code,name,description,is_restricted,created_by) VALUES(upper(btrim(payload->>'code')),btrim(payload->>'name'),COALESCE(payload->>'description',''),COALESCE((payload->>'is_restricted')::boolean,false),actor) RETURNING to_jsonb(finance_funds.*) INTO saved;
      ELSIF requested_action = 'update' THEN UPDATE public.finance_funds SET code=upper(btrim(payload->>'code')),name=btrim(payload->>'name'),description=COALESCE(payload->>'description',''),is_restricted=COALESCE((payload->>'is_restricted')::boolean,false),updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_funds.*) INTO saved;
      ELSIF requested_action IN ('archive','restore') THEN UPDATE public.finance_funds SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_funds.*) INTO saved;
      END IF;
    ELSIF target_entity = 'account' THEN
      IF requested_action = 'create' THEN
        INSERT INTO public.finance_ledger_accounts(code,name,account_class,created_by) VALUES(upper(btrim(payload->>'code')),btrim(payload->>'name'),'asset',actor) RETURNING id INTO ledger_id;
        INSERT INTO public.finance_accounts(ledger_account_id,name,account_type,currency,description,created_by) VALUES(ledger_id,btrim(payload->>'name'),payload->>'account_type',COALESCE(NULLIF(upper(payload->>'currency'),''),'AED'),COALESCE(payload->>'description',''),actor) RETURNING to_jsonb(finance_accounts.*) INTO saved;
      ELSIF requested_action = 'update' THEN UPDATE public.finance_accounts SET name=btrim(payload->>'name'),account_type=payload->>'account_type',currency=COALESCE(NULLIF(upper(payload->>'currency'),''),'AED'),description=COALESCE(payload->>'description',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_accounts.*) INTO saved;
      ELSIF requested_action IN ('archive','restore') THEN UPDATE public.finance_accounts SET is_active=(requested_action='restore'),archived_at=CASE WHEN requested_action='archive' THEN now() ELSE NULL END,updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_accounts.*) INTO saved;
      END IF;
    ELSIF target_entity = 'period' THEN
      IF requested_action = 'create' THEN INSERT INTO public.finance_accounting_periods(name,starts_on,ends_on,created_by) VALUES(btrim(payload->>'name'),(payload->>'starts_on')::date,(payload->>'ends_on')::date,actor) RETURNING to_jsonb(finance_accounting_periods.*) INTO saved;
      ELSIF requested_action = 'update' THEN UPDATE public.finance_accounting_periods SET name=btrim(payload->>'name'),starts_on=(payload->>'starts_on')::date,ends_on=(payload->>'ends_on')::date,updated_at=now() WHERE id=target_id AND status IN ('open','reopened') RETURNING to_jsonb(finance_accounting_periods.*) INTO saved;
      ELSIF requested_action = 'archive' THEN UPDATE public.finance_accounting_periods SET status='closed',closed_by=actor,closed_at=now(),updated_at=now() WHERE id=target_id AND status<>'closed' RETURNING to_jsonb(finance_accounting_periods.*) INTO saved;
      ELSIF requested_action = 'restore' THEN UPDATE public.finance_accounting_periods SET status='reopened',closed_by=NULL,closed_at=NULL,updated_at=now() WHERE id=target_id AND status='closed' RETURNING to_jsonb(finance_accounting_periods.*) INTO saved;
      END IF;
    ELSIF target_entity = 'category' THEN
      IF requested_action = 'create' THEN INSERT INTO public.finance_categories(code,name,category_type) VALUES(upper(btrim(payload->>'code')),btrim(payload->>'name'),payload->>'category_type') RETURNING to_jsonb(finance_categories.*) INTO saved;
      ELSIF requested_action = 'update' THEN UPDATE public.finance_categories SET code=upper(btrim(payload->>'code')),name=btrim(payload->>'name'),category_type=payload->>'category_type',updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_categories.*) INTO saved;
      ELSIF requested_action IN ('archive','restore') THEN UPDATE public.finance_categories SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(finance_categories.*) INTO saved;
      END IF;
    END IF;
  END IF;
  IF saved IS NULL THEN RAISE EXCEPTION 'Record was not changed; check its current status and values' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,module,resource_type,resource_id,outcome,metadata)
  VALUES(actor,'finance.record.'||requested_action,target_entity,COALESCE(target_id::text,saved->>'id'),'finance',target_entity,COALESCE(target_id::text,saved->>'id'),'success',jsonb_build_object('action',requested_action));
  RETURN saved;
END; $$;

CREATE OR REPLACE FUNCTION public.manage_storage_record(target_entity text, requested_action text, target_id uuid DEFAULT NULL, payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE saved jsonb; actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication is required' USING ERRCODE='42501'; END IF;
  IF NOT public.is_admin() AND NOT public.has_permission(CASE WHEN requested_action='create' THEN 'storage.create_item' ELSE 'storage.update_item' END) AND NOT public.has_permission('storage.settings.manage') THEN RAISE EXCEPTION 'Storage catalogue management is not permitted' USING ERRCODE='42501'; END IF;
  IF target_entity = 'item' THEN
    IF requested_action='create' THEN INSERT INTO public.storage_inventory_items(sku,name,item_kind,unit_name,reorder_level,safety_status,description,created_by) VALUES(upper(btrim(payload->>'sku')),btrim(payload->>'name'),payload->>'item_kind',COALESCE(NULLIF(payload->>'unit_name',''),'item'),COALESCE((payload->>'reorder_level')::numeric,0),COALESCE(NULLIF(payload->>'safety_status',''),'clear'),COALESCE(payload->>'description',''),actor) RETURNING to_jsonb(storage_inventory_items.*) INTO saved;
    ELSIF requested_action='update' THEN UPDATE public.storage_inventory_items SET sku=upper(btrim(payload->>'sku')),name=btrim(payload->>'name'),item_kind=payload->>'item_kind',unit_name=COALESCE(NULLIF(payload->>'unit_name',''),'item'),reorder_level=COALESCE((payload->>'reorder_level')::numeric,0),safety_status=COALESCE(NULLIF(payload->>'safety_status',''),'clear'),description=COALESCE(payload->>'description',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_inventory_items.*) INTO saved;
    ELSIF requested_action IN ('archive','restore') THEN UPDATE public.storage_inventory_items SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_inventory_items.*) INTO saved; END IF;
  ELSIF target_entity='asset' THEN
    IF requested_action='create' THEN INSERT INTO public.storage_assets(item_id,asset_tag,serial_number,status,condition,notes,created_by) VALUES((payload->>'item_id')::uuid,upper(btrim(payload->>'asset_tag')),NULLIF(payload->>'serial_number',''),COALESCE(NULLIF(payload->>'status',''),'available'),COALESCE(NULLIF(payload->>'condition',''),'good'),COALESCE(payload->>'notes',''),actor) RETURNING to_jsonb(storage_assets.*) INTO saved;
    ELSIF requested_action='update' THEN UPDATE public.storage_assets SET item_id=(payload->>'item_id')::uuid,asset_tag=upper(btrim(payload->>'asset_tag')),serial_number=NULLIF(payload->>'serial_number',''),status=payload->>'status',condition=payload->>'condition',notes=COALESCE(payload->>'notes',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_assets.*) INTO saved;
    ELSIF requested_action='archive' THEN UPDATE public.storage_assets SET status='retired',retired_at=now(),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_assets.*) INTO saved;
    ELSIF requested_action='restore' THEN UPDATE public.storage_assets SET status='available',retired_at=NULL,updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_assets.*) INTO saved; END IF;
  ELSIF target_entity='kit' THEN
    IF requested_action='create' THEN INSERT INTO public.storage_kits(code,name,description,created_by) VALUES(upper(btrim(payload->>'code')),btrim(payload->>'name'),COALESCE(payload->>'description',''),actor) RETURNING to_jsonb(storage_kits.*) INTO saved;
    ELSIF requested_action='update' THEN UPDATE public.storage_kits SET code=upper(btrim(payload->>'code')),name=btrim(payload->>'name'),description=COALESCE(payload->>'description',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_kits.*) INTO saved;
    ELSIF requested_action IN ('archive','restore') THEN UPDATE public.storage_kits SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_kits.*) INTO saved; END IF;
  ELSIF target_entity='location' THEN
    IF requested_action='create' THEN INSERT INTO public.storage_locations(code,name,location_type,is_restricted,description,created_by) VALUES(upper(btrim(payload->>'code')),btrim(payload->>'name'),COALESCE(NULLIF(payload->>'location_type',''),'room'),COALESCE((payload->>'is_restricted')::boolean,false),COALESCE(payload->>'description',''),actor) RETURNING to_jsonb(storage_locations.*) INTO saved;
    ELSIF requested_action='update' THEN UPDATE public.storage_locations SET code=upper(btrim(payload->>'code')),name=btrim(payload->>'name'),location_type=payload->>'location_type',is_restricted=COALESCE((payload->>'is_restricted')::boolean,false),description=COALESCE(payload->>'description',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_locations.*) INTO saved;
    ELSIF requested_action IN ('archive','restore') THEN UPDATE public.storage_locations SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_locations.*) INTO saved; END IF;
  ELSIF target_entity='category' THEN
    IF requested_action='create' THEN INSERT INTO public.storage_categories(name,description,created_by) VALUES(btrim(payload->>'name'),COALESCE(payload->>'description',''),actor) RETURNING to_jsonb(storage_categories.*) INTO saved;
    ELSIF requested_action='update' THEN UPDATE public.storage_categories SET name=btrim(payload->>'name'),description=COALESCE(payload->>'description',''),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_categories.*) INTO saved;
    ELSIF requested_action IN ('archive','restore') THEN UPDATE public.storage_categories SET is_active=(requested_action='restore'),updated_at=now() WHERE id=target_id RETURNING to_jsonb(storage_categories.*) INTO saved; END IF;
  END IF;
  IF saved IS NULL THEN RAISE EXCEPTION 'Record was not changed; check its current status and values' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,module,resource_type,resource_id,outcome,metadata)
  VALUES(actor,'storage.record.'||requested_action,target_entity,COALESCE(target_id::text,saved->>'id'),'storage',target_entity,COALESCE(target_id::text,saved->>'id'),'success',jsonb_build_object('action',requested_action));
  RETURN saved;
END; $$;

REVOKE ALL ON FUNCTION public.manage_finance_record(text,text,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_storage_record(text,text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_finance_record(text,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_storage_record(text,text,uuid,jsonb) TO authenticated;

COMMIT;
