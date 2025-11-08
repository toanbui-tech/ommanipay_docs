# Yêu cầu phi chức năng
| Yêu cầu                               | Mô tả                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| **Hiệu năng**                         | API response < 300ms với 90% request.                                                |
| **Bảo mật**                           | JWT + HTTPS bắt buộc, password hashing (BCrypt).                                     |
| **Khả năng mở rộng**                  | Code module hoá (module-core, module-commerce, …) để dễ tách thành microservice sau. |
| **Độ tin cậy**                        | Message Queue đảm bảo sự kiện không mất khi thanh toán.                              |
| **Khả năng quan sát (Observability)** | Logging bằng SLF4J + ELK, metrics Prometheus.                                        |
| **Triển khai (Deployment)**           | Docker-based, có môi trường dev/staging/prod.                                        |
