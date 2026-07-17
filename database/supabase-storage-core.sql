-- Storage workspace core: traceable inventory, assets, kits, locations, and movements.
-- Run after supabase-access-control-foundation.sql and supabase-workspace-access.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.storage_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.storage_categories(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, name)
);

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  location_type text NOT NULL DEFAULT 'room' CHECK (location_type IN ('site','room','cabinet','shelf','bin','vehicle','temporary')),
  parent_id uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  is_restricted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE CHECK (length(btrim(sku)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  item_kind text NOT NULL CHECK (item_kind IN ('consumable','bulk','asset')),
  category_id uuid REFERENCES public.storage_categories(id) ON DELETE SET NULL,
  unit_name text NOT NULL DEFAULT 'item',
  reorder_level numeric(14,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  safety_status text NOT NULL DEFAULT 'clear' CHECK (safety_status IN ('clear','inspection_due','blocked','retired')),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.storage_inventory_items(id) ON DELETE RESTRICT,
  asset_tag text NOT NULL UNIQUE CHECK (length(btrim(asset_tag)) > 0),
  serial_number text UNIQUE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','issued','maintenance','damaged','missing','retired')),
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('new','good','fair','poor','damaged','unsafe')),
  acquired_on date,
  purchase_reference text,
  warranty_expires_on date,
  notes text NOT NULL DEFAULT '',
  retired_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_item_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.storage_inventory_items(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.storage_assets(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (identifier_type IN ('barcode','qr','external')),
  identifier_value text NOT NULL UNIQUE CHECK (length(btrim(identifier_value)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((item_id IS NOT NULL)::integer + (asset_id IS NOT NULL)::integer = 1)
);

CREATE TABLE IF NOT EXISTS public.storage_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(btrim(code)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storage_kit_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES public.storage_kits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.storage_inventory_items(id) ON DELETE RESTRICT,
  required_quantity numeric(14,3) NOT NULL CHECK (required_quantity > 0),
  is_optional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.storage_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text UNIQUE,
  item_id uuid NOT NULL REFERENCES public.storage_inventory_items(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES public.storage_assets(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt','issue','return','transfer','consume','adjustment_in','adjustment_out','write_off')),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  from_location_id uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  to_location_id uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  condition_before text,
  condition_after text,
  source_type text,
  source_id uuid,
  borrower_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  group_id text REFERENCES public.groups(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  idempotency_key text UNIQUE,
  reversal_of_id uuid REFERENCES public.storage_stock_movements(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_location_id IS DISTINCT FROM to_location_id),
  CHECK (
    (movement_type IN ('receipt','return','adjustment_in') AND to_location_id IS NOT NULL)
    OR (movement_type IN ('issue','consume','adjustment_out','write_off') AND from_location_id IS NOT NULL)
    OR (movement_type = 'transfer' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS storage_items_category_idx ON public.storage_inventory_items (category_id, is_active, name);
CREATE INDEX IF NOT EXISTS storage_assets_item_status_idx ON public.storage_assets (item_id, status);
CREATE INDEX IF NOT EXISTS storage_movements_item_created_idx ON public.storage_stock_movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storage_movements_asset_idx ON public.storage_stock_movements (asset_id, created_at DESC) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS storage_movements_source_idx ON public.storage_stock_movements (source_type, source_id);
CREATE INDEX IF NOT EXISTS storage_movements_from_idx ON public.storage_stock_movements (from_location_id, item_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS storage_movements_to_idx ON public.storage_stock_movements (to_location_id, item_id) WHERE to_location_id IS NOT NULL;

CREATE OR REPLACE VIEW public.storage_location_balances WITH (security_invoker = true) AS
WITH movement_effects AS (
  SELECT movement.item_id, movement.to_location_id AS location_id,
         CASE WHEN movement.status = 'posted' AND movement.movement_type IN ('receipt','return','transfer','adjustment_in') THEN movement.quantity ELSE 0 END AS quantity_change
  FROM public.storage_stock_movements movement WHERE movement.to_location_id IS NOT NULL
  UNION ALL
  SELECT movement.item_id, movement.from_location_id AS location_id,
         CASE WHEN movement.status = 'posted' AND movement.movement_type IN ('issue','transfer','consume','adjustment_out','write_off') THEN -movement.quantity ELSE 0 END AS quantity_change
  FROM public.storage_stock_movements movement WHERE movement.from_location_id IS NOT NULL
)
SELECT item_id, location_id, SUM(CASE WHEN quantity_change IS NULL THEN 0 ELSE quantity_change END)::numeric(14,3) AS available_quantity
FROM movement_effects GROUP BY item_id, location_id;

CREATE OR REPLACE VIEW public.storage_inventory_summary WITH (security_invoker = true) AS
SELECT item.id, item.sku, item.name, item.item_kind, item.category_id, item.unit_name,
       item.reorder_level, item.safety_status, item.is_active,
       COALESCE(SUM(balance.available_quantity), 0)::numeric(14,3) AS available_quantity,
       (COALESCE(SUM(balance.available_quantity), 0) <= item.reorder_level) AS below_reorder_level
FROM public.storage_inventory_items item
LEFT JOIN public.storage_location_balances balance ON balance.item_id = item.id
GROUP BY item.id;

CREATE OR REPLACE VIEW public.storage_asset_locations WITH (security_invoker = true) AS
SELECT DISTINCT ON (movement.asset_id) movement.asset_id,
       COALESCE(movement.to_location_id, movement.from_location_id) AS last_location_id,
       movement.created_at AS moved_at
FROM public.storage_stock_movements movement
WHERE movement.asset_id IS NOT NULL AND movement.status = 'posted'
ORDER BY movement.asset_id, movement.created_at DESC;

CREATE OR REPLACE FUNCTION public.record_storage_movement(
  target_item_id uuid,
  target_asset_id uuid,
  requested_movement_type text,
  requested_quantity numeric,
  requested_from_location_id uuid DEFAULT NULL,
  requested_to_location_id uuid DEFAULT NULL,
  requested_condition_after text DEFAULT NULL,
  requested_source_type text DEFAULT NULL,
  requested_source_id uuid DEFAULT NULL,
  requested_borrower_id uuid DEFAULT NULL,
  requested_notes text DEFAULT '',
  requested_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  item_record public.storage_inventory_items%ROWTYPE;
  asset_record public.storage_assets%ROWTYPE;
  available numeric(14,3) := 0;
  movement_id uuid;
  official_reference text;
BEGIN
  IF NOT public.has_permission('storage.movements.create') THEN
    RAISE EXCEPTION 'Storage movement creation is not permitted' USING ERRCODE = '42501';
  END IF;
  IF requested_quantity <= 0 OR requested_movement_type NOT IN ('receipt','issue','return','transfer','consume','adjustment_in','adjustment_out','write_off') THEN
    RAISE EXCEPTION 'Invalid storage movement' USING ERRCODE = '22023';
  END IF;

  IF requested_idempotency_key IS NOT NULL THEN
    SELECT id INTO movement_id FROM public.storage_stock_movements WHERE idempotency_key = requested_idempotency_key;
    IF movement_id IS NOT NULL THEN RETURN movement_id; END IF;
  END IF;

  SELECT * INTO item_record FROM public.storage_inventory_items WHERE id = target_item_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item is unavailable' USING ERRCODE = 'P0002'; END IF;

  IF target_asset_id IS NOT NULL THEN
    SELECT * INTO asset_record FROM public.storage_assets WHERE id = target_asset_id AND item_id = target_item_id FOR UPDATE;
    IF NOT FOUND OR asset_record.status = 'retired' THEN RAISE EXCEPTION 'Asset is unavailable' USING ERRCODE = 'P0002'; END IF;
    IF requested_quantity <> 1 THEN RAISE EXCEPTION 'Individual asset movements must have quantity one' USING ERRCODE = '23514'; END IF;
  ELSIF item_record.item_kind = 'asset' THEN
    RAISE EXCEPTION 'An individual asset must be selected' USING ERRCODE = '23514';
  END IF;

  IF requested_movement_type IN ('issue','transfer','consume') AND (
    item_record.safety_status IN ('blocked','retired') OR COALESCE(asset_record.condition, 'good') IN ('unsafe','damaged')
  ) THEN
    RAISE EXCEPTION 'This safety-blocked item cannot be issued' USING ERRCODE = '23514';
  END IF;

  IF requested_movement_type IN ('issue','transfer','consume','adjustment_out','write_off') THEN
    SELECT COALESCE(available_quantity, 0) INTO available
    FROM public.storage_location_balances
    WHERE item_id = target_item_id AND location_id = requested_from_location_id;
    IF available < requested_quantity THEN
      RAISE EXCEPTION 'Insufficient available stock' USING ERRCODE = '23514';
    END IF;
  END IF;

  official_reference := public.next_workspace_reference('STO-MOV', extract(year FROM current_date)::integer);
  INSERT INTO public.storage_stock_movements (
    reference_number, item_id, asset_id, movement_type, quantity, from_location_id, to_location_id,
    condition_before, condition_after, source_type, source_id, borrower_id, notes, idempotency_key, created_by
  ) VALUES (
    official_reference, target_item_id, target_asset_id, requested_movement_type, requested_quantity,
    requested_from_location_id, requested_to_location_id, asset_record.condition, requested_condition_after,
    requested_source_type, requested_source_id, requested_borrower_id, COALESCE(requested_notes,''),
    requested_idempotency_key, auth.uid()
  ) RETURNING id INTO movement_id;

  IF target_asset_id IS NOT NULL THEN
    UPDATE public.storage_assets SET
      status = CASE requested_movement_type
        WHEN 'issue' THEN 'issued' WHEN 'return' THEN 'available' WHEN 'write_off' THEN 'retired'
        ELSE status END,
      condition = COALESCE(requested_condition_after, condition),
      retired_at = CASE WHEN requested_movement_type = 'write_off' THEN now() ELSE retired_at END,
      updated_at = now()
    WHERE id = target_asset_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, module, resource_type, resource_id, outcome, metadata)
  VALUES (auth.uid(), 'storage.movement.recorded', 'storage_stock_movement', movement_id::text, 'storage', 'storage_stock_movement', movement_id::text, 'success',
          jsonb_build_object('reference', official_reference, 'itemId', target_item_id, 'quantity', requested_quantity, 'type', requested_movement_type));
  RETURN movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_storage_movement_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Posted storage movements are immutable' USING ERRCODE = '55000';
END;
$$;
DROP TRIGGER IF EXISTS protect_storage_movement_history ON public.storage_stock_movements;
CREATE TRIGGER protect_storage_movement_history BEFORE UPDATE OR DELETE ON public.storage_stock_movements
FOR EACH ROW EXECUTE FUNCTION public.protect_storage_movement_history();

ALTER TABLE public.storage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_item_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_kit_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage users read categories" ON public.storage_categories FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read locations" ON public.storage_locations FOR SELECT TO authenticated USING (
  public.has_permission('storage.inventory.view') AND (NOT is_restricted OR public.has_permission('storage.restricted_locations.view'))
);
CREATE POLICY "storage users read items" ON public.storage_inventory_items FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read assets" ON public.storage_assets FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read identifiers" ON public.storage_item_identifiers FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read kits" ON public.storage_kits FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read kit components" ON public.storage_kit_components FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));
CREATE POLICY "storage users read movements" ON public.storage_stock_movements FOR SELECT TO authenticated USING (public.has_permission('storage.inventory.view'));

REVOKE ALL ON TABLE public.storage_categories, public.storage_locations, public.storage_inventory_items,
  public.storage_assets, public.storage_item_identifiers, public.storage_kits, public.storage_kit_components,
  public.storage_stock_movements FROM PUBLIC;
REVOKE ALL ON TABLE public.storage_categories, public.storage_locations, public.storage_inventory_items,
  public.storage_assets, public.storage_item_identifiers, public.storage_kits, public.storage_kit_components,
  public.storage_stock_movements FROM anon;
REVOKE ALL ON TABLE public.storage_categories, public.storage_locations, public.storage_inventory_items,
  public.storage_assets, public.storage_item_identifiers, public.storage_kits, public.storage_kit_components,
  public.storage_stock_movements FROM authenticated;
GRANT SELECT ON TABLE public.storage_categories, public.storage_locations, public.storage_inventory_items,
  public.storage_assets, public.storage_item_identifiers, public.storage_kits, public.storage_kit_components,
  public.storage_stock_movements, public.storage_location_balances, public.storage_inventory_summary,
  public.storage_asset_locations TO authenticated;

REVOKE ALL ON FUNCTION public.record_storage_movement(uuid,uuid,text,numeric,uuid,uuid,text,text,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_storage_movement(uuid,uuid,text,numeric,uuid,uuid,text,text,uuid,uuid,text,text) TO authenticated;

COMMIT;
