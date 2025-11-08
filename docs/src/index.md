---
layout: home

hero:
  name: "OmmaniPay"
  text: "End-to-end Banking Solutions"
  tagline: "Ommanipay Technical Docs"
  image:
    src: ./logo.png
    alt: OMMANIPAY
  actions:
    - theme: brand
      text: Bắt đầu ngay
      link: /phase1/customer

features:
  - icon: ''
    title: Quản lý tài khoản người dùng
    details: Tạo, cấu hình và quản lý các tài khoản.
    link: /user-guide/users/users

  - icon: ''
    title: Quản lý Kho
    details: Tạo, cấu hình và quản lý kho.
    link: /user-guide/inventories/inventory


---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(120deg, #2563eb 30%, #06b6d4);
  --vp-home-hero-image-background-image: linear-gradient(120deg, #e0f2fe 30%, #dbeafe);
  --vp-home-hero-image-filter: blur(60px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(80px);
  }
}

.VPFeature {
  transition: all 0.3s ease;
}

.VPFeature:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}
</style>
