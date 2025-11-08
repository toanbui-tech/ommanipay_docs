# Yêu cầu chức năng

# Module: Core
| Service            | Mô tả              | Chức năng chính                                                                                     |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| **AuthService**    | Xác thực & bảo mật | - Đăng ký, đăng nhập, refresh token (JWT)<br>- Middleware xác thực API                              |
| **UserService**    | Quản lý người dùng | - CRUD profile<br>- Đổi mật khẩu, cập nhật thông tin<br>- Quản lý trạng thái user (active/inactive) |
| **AccountService** | Ví & số dư         | - Nạp tiền, trừ tiền<br>- Ghi log giao dịch nội bộ<br>- Xem lịch sử giao dịch                       |

---

## Module: Commerce
| Service             | Mô tả                | Chức năng chính                                                                   |
| ------------------- | -------------------- | --------------------------------------------------------------------------------- |
| **VoucherService**  | Mã giảm giá          | - Tạo / quản lý mã voucher<br>- Xác thực voucher hợp lệ<br>- Áp dụng cho đơn hàng |
| **CampaignService** | Chiến dịch marketing | - Gửi mã khuyến mãi hàng loạt<br>- Quản lý thời gian & điều kiện áp dụng          |

## Infrastructure
| Thành phần     | Vai trò               | Ghi chú                                                    |
| -------------- | --------------------- | ---------------------------------------------------------- |
| **PostgreSQL** | Lưu trữ dữ liệu chính | 1 DB – nhiều schema: core, commerce, voucher, logistics    |
| **Redis**      | Cache, session        | Lưu JWT, session, và cache tạm                             |
| **RabbitMQ**   | Message Queue         | Publish domain events (`OrderCreated`, `PaymentSucceeded`) |
| **Stripe API** | Cổng thanh toán       | Dùng để xử lý giao dịch thẻ quốc tế                        |
