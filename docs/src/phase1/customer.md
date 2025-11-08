# Tổng quan
## 1. Giới thiệu
- Dự án: **Ommanipay — Nền tảng thanh toán tổng hợp**
- Mục tiêu: Xây dựng một hệ thống thanh toán có thể mở rộng, bắt đầu từ **kiến trúc monolith modular**.

---

## 2. Mục tiêu hệ thống
- Cung cấp API cho Web và Mobile.
- Hỗ trợ các tính năng: đăng nhập, nạp/rút ví, mua hàng, thanh toán Stripe, sử dụng voucher, và theo dõi đơn hàng.
- Thiết kế có thể tách thành microservices ở Phase 2.

---

## 3. Phạm vi hệ thống
Hệ thống chạy trong 1 Spring Boot App với nhiều module:
- Core (Auth, User, Account)
- Commerce (Product, Order, Payment)
- Voucher (Promotion, Campaign)
- Logistics (Shipping, Tracking)

Cấu trúc này được mô tả trong sơ đồ sau:

```mermaid
graph TB
    subgraph "PHASE 1: MONOLITH MODULAR ARCHITECTURE"
        Client1[Web/Mobile Client]
        
        subgraph "ommanipay-monolith (Spring Boot App)"
            Gateway1[API Gateway Layer<br/>@RestController]
            
            subgraph "Module: Core"
                AuthService[AuthService<br/>JWT + Security]
                UserService[UserService<br/>CRUD + Profile]
                AccountService[AccountService<br/>Wallet + Balance]
            end
            
            subgraph "Module: Commerce"
                ProductService[ProductService<br/>Catalog]
                OrderService[OrderService<br/>Order Management]
                PaymentService[PaymentService<br/>Payment Processing]
            end
            
            subgraph "Module: Voucher"
                VoucherService[VoucherService<br/>Promo Code]
                CampaignService[CampaignService<br/>Marketing]
            end
            
            subgraph "Module: Logistics"
                ShippingService[ShippingService<br/>Delivery]
                TrackingService[TrackingService<br/>Status Update]
            end
            
            EventPublisher[Event Publisher<br/>Domain Events]
        end
        
        subgraph "Infrastructure"
            DB1[(PostgreSQL<br/>Single Database<br/>with Schemas)]
            Cache1[(Redis<br/>Session + Cache)]
            Queue1[RabbitMQ<br/>Async Events]
            Stripe1[Stripe API<br/>Payment Gateway]
        end
        
        Client1 -->|HTTP/REST| Gateway1
        Gateway1 --> AuthService
        Gateway1 --> UserService
        Gateway1 --> OrderService
        Gateway1 --> PaymentService
        Gateway1 --> VoucherService
        Gateway1 --> ShippingService
        
        OrderService --> PaymentService
        PaymentService --> AccountService
        OrderService --> VoucherService
        OrderService --> ShippingService
        
        AuthService --> Cache1
        UserService --> DB1
        AccountService --> DB1
        ProductService --> DB1
        OrderService --> DB1
        PaymentService --> DB1
        VoucherService --> DB1
        ShippingService --> DB1
        
        PaymentService --> Stripe1
        OrderService --> EventPublisher
        PaymentService --> EventPublisher
        EventPublisher --> Queue1
    end
    
    style Gateway1 fill:#e1f5ff
    style DB1 fill:#fff3e0
    style Queue1 fill:#f3e5f5
```