# Kế hoạch triển khai

## 1. Cơ sở dữ liệu (migration)
- Thêm cột `customer_name TEXT` vào `invoices`.
- Tạo bảng `debt_payments` (invoice_id, amount, paid_at, note, created_by) + RLS + GRANT.
- Thêm cột `can_view_customers BOOLEAN DEFAULT false` vào `user_permissions`.
- Cập nhật hàm `has_permission` để hỗ trợ `can_view_customers`.

## 2. Tab "Khách hàng" mới
- File `src/components/karaoke/CustomersTab.tsx`:
  - Bộ lọc khoảng thời gian (giống ReportsTab).
  - Bảng hoá đơn có `payment_status IN ('debt','partial')`: cột tên KH, phòng, tổng tiền, đã trả, còn nợ, ngày tạo, số ngày nợ, hành động.
  - Dialog "Cập nhật thanh toán": nhập số tiền trả → ghi vào `debt_payments`, cập nhật `paid_amount` + `payment_status`.
  - Xem lịch sử thanh toán của một hoá đơn.
  - 3 biểu đồ (bar/pie): phân loại nợ theo tuổi nợ: <15 ngày, 15–30, >30 ngày (số hoá đơn + tổng nợ).
- Thêm tab vào `Index.tsx`, gate bằng `permissions.can_view_customers` hoặc admin.
- Thêm switch quyền trong `UserManagement.tsx`.

## 3. Tên khách hàng ở hoá đơn
- Trong `InvoiceDisplay`: khi trạng thái là "debt" hoặc "partial", hiện input "Tên khách hàng" với autocomplete không dấu từ danh sách `customer_name` đã lưu (fetch distinct).
- Khi cập nhật / in hoá đơn: lưu `customer_name` vào `invoices`.

## 4. LockScreen & Idle timeout
- `UserManagement`: đã có `lock_screen_minutes`; đảm bảo user tự chỉnh được thời gian trong tài khoản của mình (thêm nhanh trong header menu hoặc tab cấu hình cá nhân — sẽ dùng lại UserManagement, cộng thêm dropdown ở header cho phép mọi user tự chỉnh).
- `LockScreen.tsx`: xác thực bằng `signInWithPassword` với **email hiện tại**; nếu sai hiển thị `Alert` đỏ rõ ràng "Mật khẩu không đúng, vui lòng thử lại". Xử lý cả trường hợp không có kết nối.
- Đảm bảo không sign-out user hiện tại khi verify sai (dùng client tạm hoặc chỉ verify, không thay session).

## 5. Bộ lọc chi phí theo nhóm sản phẩm
- Trong `ExpensesTab.tsx`: thêm `Select` "Lọc theo nhóm sản phẩm" (bao gồm "Tất cả"). Áp dụng lên bảng danh sách chi phí và tổng.

## 6. Cột "Thanh toán" ở báo cáo chi tiết hoá đơn
- `ReportsTab`: thêm checkbox "Thanh toán" trong danh sách cột hiển thị & xuất Excel.
- Giá trị: `payment_status === 'paid'` → `total_amount`; ngược lại → `paid_amount` (0 nếu null).

## 7. Sửa lỗi mất session phòng khác khi in / huỷ chỉnh sửa hoá đơn cũ
- Trong `Index.tsx` chỗ vào chế độ chỉnh sửa hoá đơn: hiện đang overwrite `roomSessions` / `activeItems` của phòng đang chọn. Cần **snapshot toàn bộ state phòng hiện tại** trước khi vào edit mode và **khôi phục** khi:
  - In hoá đơn cũ xong.
  - Bấm huỷ chỉnh sửa.
- Cụ thể: lưu `previousSessionSnapshot` (roomSessions + currentRoom + items + time), khi thoát edit mode → restore.

## 8. Single-tab lock
- Tạo hook `useSingleTab.ts` dùng `BroadcastChannel('app-tabs')` + `localStorage` heartbeat:
  - Khi mount → broadcast "hello", nghe phản hồi. Nếu có tab khác trả lời "here" → tab **mới** này khoá.
  - Khi tab mới đến sau, tab cũ nhận "hello" → tự khoá & hiện overlay: "Vui lòng đóng cửa sổ này & đảm bảo chỉ mở duy nhất một màn hình".
  - Fallback bằng localStorage timestamp cho trình duyệt không có BroadcastChannel.
- Tạo `SingleTabGate.tsx` component overlay full-screen, disable toàn bộ app khi bị khoá.
- Gắn vào `App.tsx` bọc quanh routes.

## Thứ tự thực hiện
1. Migration DB (bước 1) — chờ duyệt.
2. Các thay đổi UI/hook (2–8).
3. Kiểm tra build & test luồng chính (đăng nhập, khoá màn hình sai/đúng, mở 2 tab, tạo hoá đơn nợ với tên KH, cập nhật trả nợ, xem biểu đồ tuổi nợ, chỉnh sửa hoá đơn cũ rồi huỷ).

## Chi tiết kỹ thuật ngắn
- Autocomplete không dấu: dùng hàm `normalize` (NFD + strip diacritics + `đ→d`) đã có trong `ItemsSection`; trích ra `src/lib/normalize.ts` để tái sử dụng.
- Tuổi nợ = `floor((now - created_at)/86400_000)`.
- `debt_payments` policies: authenticated có thể select/insert; chỉ admin xoá.
