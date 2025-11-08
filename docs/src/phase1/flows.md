# Luồng nghiệp vụ
## Luồng Đặt hàng
Client → Gateway → OrderService
→ PaymentService (Stripe hoặc Wallet)
→ AccountService (nếu dùng ví)
→ RabbitMQ (publish PaymentSucceeded)
→ ShippingService (subscribe và tạo shipment)
→ TrackingService (update trạng thái)
→ Client nhận thông báo hoàn tất.

## Luồng Nạp tiền ví
Client → Gateway → AccountService
→ PaymentService (Stripe)
→ AccountService cập nhật số dư
→ Publish "BalanceUpdated" event
→ Client cập nhật UI.
