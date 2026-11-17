-- ==============================================================================
-- CƠ SỞ DỮ LIỆU MỚI CHO HỆ THỐNG QUẢN LÝ PHÒNG HÁT KARAOKE
-- Chạy toàn bộ file này trong Supabase SQL Editor của dự án MỚI.
-- Hoàn toàn độc lập, KHÔNG ảnh hưởng hay sử dụng dữ liệu của bản cũ.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. CÁC BẢNG QUẢN LÝ PHÒNG & GIÁ
CREATE TABLE IF NOT EXISTS room_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    block_minutes INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    group_id UUID REFERENCES room_groups(id) ON DELETE SET NULL,
    sort_order INT DEFAULT 0,
    block_minutes INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CÁC BẢNG QUẢN LÝ LOẠI MÓN & MÓN ĂN
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    unit_multiplier INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    sort_order INT DEFAULT 0,
    custom_quantity BOOLEAN DEFAULT false,
    shorthand TEXT,
    import_shorthand TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_group_id UUID NOT NULL REFERENCES room_groups(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    custom_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_group_id, item_id)
);

-- 5. CÁC BẢNG HÓA ĐƠN & THANH TOÁN
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL,
    room_price NUMERIC NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    duration INT NOT NULL,
    total_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'paid', -- 'paid', 'debt', 'partial'
    customer_name TEXT,
    staff_name TEXT,
    discount_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed'
    discount_value NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_price NUMERIC NOT NULL,
    quantity NUMERIC NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. KHÁCH HÀNG & GHI NỢ
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT now(),
    note TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. CHI PHÍ (EXPENSES)
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_product_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_product_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    group_id UUID NOT NULL REFERENCES expense_product_groups(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    category TEXT NOT NULL,
    user_id UUID,
    product_category TEXT,
    product_name TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. KIỂM KHO (INVENTORY CHECKS)
CREATE TABLE IF NOT EXISTS inventory_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_mode TEXT NOT NULL, -- 'daily', 'period'
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_check_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES inventory_checks(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_check_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id UUID NOT NULL REFERENCES inventory_checks(id) ON DELETE CASCADE,
    item_id UUID,
    item_name TEXT NOT NULL,
    opening_stock NUMERIC DEFAULT 0,
    imported NUMERIC DEFAULT 0,
    sold NUMERIC DEFAULT 0,
    theoretical_stock NUMERIC DEFAULT 0,
    actual_stock NUMERIC DEFAULT 0,
    difference NUMERIC DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CẤU HÌNH HỆ THỐNG & IN ẤN
CREATE TABLE IF NOT EXISTS operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time TEXT NOT NULL DEFAULT '23:59',
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS print_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    template_name TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. PHÂN QUYỀN & NGƯỜI DÙNG
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    username TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    role app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    can_view_history BOOLEAN DEFAULT true,
    can_delete_history BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_view_inventory BOOLEAN DEFAULT false,
    can_view_config BOOLEAN DEFAULT false,
    can_view_logs BOOLEAN DEFAULT false,
    can_delete_logs BOOLEAN DEFAULT false,
    can_view_expenses BOOLEAN DEFAULT false,
    can_view_customers BOOLEAN DEFAULT false,
    edit_invoice_minutes INT DEFAULT 60,
    can_config_rooms BOOLEAN DEFAULT true,
    can_config_items BOOLEAN DEFAULT true,
    can_config_pricelist BOOLEAN DEFAULT false,
    can_config_layout BOOLEAN DEFAULT false,
    can_config_print BOOLEAN DEFAULT false,
    lock_screen_enabled BOOLEAN DEFAULT false,
    lock_screen_minutes INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, preference_key)
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. HÀM KIỂM TRA QUYỀN & TRIGGER TỰ ĐỘNG
CREATE OR REPLACE FUNCTION has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid() AND role::text = role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_permission(perm_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
    has_perm BOOLEAN;
BEGIN
    SELECT (role = 'admin') INTO is_admin FROM user_roles WHERE user_id = auth.uid();
    IF is_admin THEN
        RETURN true;
    END IF;

    EXECUTE format('SELECT %I FROM user_permissions WHERE user_id = $1', perm_name)
    INTO has_perm
    USING auth.uid();

    RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Tự động cấp quyền Admin cho người dùng đầu tiên đăng ký trong CSDL mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_count INT;
    chosen_role app_role;
    username_val TEXT;
BEGIN
    SELECT count(*) INTO user_count FROM profiles;
    IF user_count = 0 THEN
        chosen_role := 'admin';
    ELSE
        chosen_role := 'staff';
    END IF;

    username_val := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));

    INSERT INTO public.profiles (user_id, username, display_name)
    VALUES (NEW.id, username_val, username_val)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, chosen_role)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_permissions (
        user_id,
        can_view_history,
        can_delete_history,
        can_view_reports,
        can_view_inventory,
        can_view_config,
        can_view_logs,
        can_delete_logs,
        can_view_expenses,
        can_view_customers,
        edit_invoice_minutes,
        can_config_rooms,
        can_config_items,
        can_config_pricelist,
        can_config_layout,
        can_config_print
    ) VALUES (
        NEW.id,
        true,
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        CASE WHEN chosen_role = 'admin' THEN 0 ELSE 60 END,
        true,
        true,
        (chosen_role = 'admin'),
        (chosen_role = 'admin'),
        (chosen_role = 'admin')
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE room_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_product_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_check_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép người dùng đã xác thực (authenticated) truy cập và quản lý dữ liệu quán
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON room_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON price_list_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON debt_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON expense_product_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON expense_product_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON inventory_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON inventory_check_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON inventory_check_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON operating_hours FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON print_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON global_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON user_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON user_preferences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cho phép thao tác đầy đủ cho user đăng nhập" ON activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cho phép đọc công khai (anon) một số cấu hình cơ bản nếu cần
CREATE POLICY "Cho phép đọc anon profiles" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Cho phép đọc anon rooms" ON rooms FOR SELECT TO anon USING (true);
CREATE POLICY "Cho phép đọc anon categories" ON categories FOR SELECT TO anon USING (true);
CREATE POLICY "Cho phép đọc anon items" ON items FOR SELECT TO anon USING (true);

-- 13. KHỞI TẠO DỮ LIỆU BAN ĐẦU SẠCH SẼ (SEED DATA)
INSERT INTO room_groups (id, name, sort_order, block_minutes) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Phòng thường', 1, 5),
    ('22222222-2222-2222-2222-222222222222', 'Phòng VIP', 2, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, name, price, group_id, sort_order, block_minutes) VALUES
    ('33333333-3333-3333-3333-333333333331', 'Phòng 101', 120000, '11111111-1111-1111-1111-111111111111', 1, 5),
    ('33333333-3333-3333-3333-333333333332', 'Phòng 102', 120000, '11111111-1111-1111-1111-111111111111', 2, 5),
    ('33333333-3333-3333-3333-333333333333', 'Phòng 103', 120000, '11111111-1111-1111-1111-111111111111', 3, 5),
    ('33333333-3333-3333-3333-333333333334', 'Phòng VIP 01', 180000, '22222222-2222-2222-2222-222222222222', 4, 5),
    ('33333333-3333-3333-3333-333333333335', 'Phòng VIP 02', 200000, '22222222-2222-2222-2222-222222222222', 5, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, sort_order, unit_multiplier) VALUES
    ('44444444-4444-4444-4444-444444444441', 'Bia & Rượu', 1, 1),
    ('44444444-4444-4444-4444-444444444442', 'Nước giải khát', 2, 1),
    ('44444444-4444-4444-4444-444444444443', 'Đồ ăn vặt', 3, 1),
    ('44444444-4444-4444-4444-444444444444', 'Trái cây', 4, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (name, price, category_id, sort_order, shorthand) VALUES
    ('Bia Tiger Bạc lon', 25000, '44444444-4444-4444-4444-444444444441', 1, 'tg'),
    ('Bia Heineken lon', 28000, '44444444-4444-4444-4444-444444444441', 2, 'ken'),
    ('Bia Sài Gòn Special', 20000, '44444444-4444-4444-4444-444444444441', 3, 'sg'),
    ('Nước suối Aquafina', 12000, '44444444-4444-4444-4444-444444444442', 4, 'ns'),
    ('Coca Cola lon', 15000, '44444444-4444-4444-4444-444444444442', 5, 'coca'),
    ('Bò húc Redbull', 20000, '44444444-4444-4444-4444-444444444442', 6, 'bh'),
    ('Khăn lạnh', 3000, '44444444-4444-4444-4444-444444444443', 7, 'kl'),
    ('Khô bò xé sợi', 60000, '44444444-4444-4444-4444-444444444443', 8, 'kb'),
    ('Đậu phộng tỏi ớt', 25000, '44444444-4444-4444-4444-444444444443', 9, 'dp'),
    ('Đĩa trái cây thập cẩm', 120000, '44444444-4444-4444-4444-444444444444', 10, 'tc')
ON CONFLICT DO NOTHING;

INSERT INTO expense_categories (name, sort_order) VALUES
    ('Nhập hàng nước/bia', 1),
    ('Mua đồ dùng & vệ sinh', 2),
    ('Tiền điện & nước', 3),
    ('Bảo trì thiết bị âm thanh', 4),
    ('Lương nhân viên', 5),
    ('Chi phí khác', 6)
ON CONFLICT DO NOTHING;

INSERT INTO operating_hours (start_time, end_time) VALUES
    ('08:00', '23:59')
ON CONFLICT DO NOTHING;
