/**
 * MyMiniCloud - Portal JavaScript
 * Tương tác trạng thái API thực tế & Cửa sổ xem chi tiết 9 nhóm dịch vụ
 */

(function () {
  'use strict';

  // 9 Nhóm dịch vụ metadata tham chiếu kiến trúc MyMiniCloud
  const SERVICE_METADATA = {
    web: {
      groupNum: 1,
      name: 'Web Frontend Server',
      service: 'web-frontend-server1, web-frontend-server2',
      tech: 'Nginx 1.28-alpine',
      network: 'cloud-net',
      role: 'Phục vụ giao diện Portal và Static Blog. Triển khai 2 bản sao (replicas) để kiểm thử cân bằng tải Round Robin.',
      checkGuide: 'Truy cập GET /blog/ kiểm tra web tĩnh, kiểm tra response header nhận diện replica đang phục vụ request.',
      testCommand: 'curl -i http://localhost/blog/'
    },
    app: {
      groupNum: 2,
      name: 'Application Backend Server',
      service: 'application-backend-server',
      tech: 'Python 3.12 / Flask / ODBC Driver 18',
      network: 'cloud-net',
      role: 'Xử lý logic ứng dụng, RESTful API, CRUD sinh viên kết nối SQL Server, tích hợp S3 MinIO và xác thực token Keycloak.',
      checkGuide: 'Kiểm tra GET /api/hello và GET /api/health trả JSON hợp lệ từ container backend.',
      testCommand: 'curl -s http://localhost/api/health'
    },
    database: {
      groupNum: 3,
      name: 'Relational Database Server',
      service: 'relational-database-server',
      tech: 'Microsoft SQL Server 2022 Developer',
      network: 'cloud-net',
      role: 'Lưu trữ dữ liệu quan hệ bảng dbo.students (database studentdb). Lưu trữ lâu dài qua Docker named volume mycloud_mssql-data.',
      checkGuide: 'Chạy SELECT trên studentdb.dbo.students hoặc kiểm tra query qua API GET /api/students-db.',
      testCommand: 'curl -s http://localhost/api/students-db'
    },
    auth: {
      groupNum: 4,
      name: 'Authentication Identity Server',
      service: 'authentication-identity-server',
      tech: 'Keycloak 26.1.4 (OIDC / OAuth 2.0)',
      network: 'cloud-net',
      role: 'Cung cấp Single Sign-On (SSO), quản lý Realm, Client flask-app (Public PKCE), cấp phát và ký số JWT Access Token.',
      checkGuide: 'Truy cập /auth/ hoặc lấy thông số OIDC từ GET /api/auth/config.',
      testCommand: 'curl -s http://localhost/api/auth/config'
    },
    storage: {
      groupNum: 5,
      name: 'Object Storage Server',
      service: 'object-storage-server',
      tech: 'MinIO S3 Compatible Storage',
      network: 'cloud-net',
      role: 'Lưu trữ dữ liệu phi cấu trúc với 2 buckets riêng biệt: profile-pics (ảnh đại diện) và documents (tài liệu PDF). Buckets ở chế độ private, truy cập qua API backend.',
      checkGuide: 'Kiểm tra danh sách tài liệu qua GET /api/files?bucket=documents hoặc mở MinIO Console port 9001.',
      testCommand: 'curl -s "http://localhost/api/files?bucket=documents"'
    },
    dns: {
      groupNum: 6,
      name: 'Internal DNS Server',
      service: 'internal-dns-server',
      tech: 'Bind9 9.18 (Authoritative DNS)',
      network: 'cloud-net',
      role: 'Dịch vụ phân giải tên miền nội bộ zone cloud.local cho các dịch vụ (app-backend, minio, keycloak). Host port ánh xạ 1053 TCP/UDP.',
      checkGuide: 'Dùng lệnh dig truy vấn qua cổng 1053 để xác minh phân giải bản ghi A.',
      testCommand: 'dig @127.0.0.1 -p 1053 app-backend.cloud.local'
    },
    monitoring: {
      groupNum: 7,
      name: 'Monitoring Prometheus Server',
      service: 'monitoring-prometheus-server, monitoring-node-exporter, monitoring-http-exporter',
      tech: 'Prometheus 3.2.1 / Node Exporter / Blackbox Exporter',
      network: 'cloud-net',
      role: 'Chủ động thu thập (scrape) số liệu tài nguyên từ Node Exporter và kiểm tra trạng thái HTTP từ 2 Web Server qua Blackbox Exporter.',
      checkGuide: 'Truy cập giao diện Prometheus Targets cổng 9090 để xem danh sách target UP.',
      testCommand: 'curl -s http://localhost:9090/-/healthy'
    },
    visualization: {
      groupNum: 8,
      name: 'Logging & Visualization Dashboard',
      service: 'monitoring-grafana-dashboard-server',
      tech: 'Grafana 11.6.0',
      network: 'cloud-net',
      role: 'Trực quan hóa dữ liệu giám sát từ nguồn dữ liệu Prometheus. Cung cấp Dashboard với 3 biểu đồ: CPU Usage (%), Memory Usage, Network Traffic.',
      checkGuide: 'Mở Grafana cổng 3000 và truy cập dashboard System Health.',
      testCommand: 'curl -s http://localhost:3000/api/health'
    },
    proxy: {
      groupNum: 9,
      name: 'API Gateway & Load Balancer',
      service: 'api-gateway-proxy-server',
      tech: 'Nginx 1.28-alpine (Reverse Proxy)',
      network: 'cloud-net',
      role: 'Cổng vào duy nhất của hệ thống tại cổng 80. Định tuyến /blog/ đến 2 Web Replicas (Round Robin), /app/ đến Web, /api/ đến Flask và /auth/ đến Keycloak.',
      checkGuide: 'Gửi request liên tục tới http://localhost/blog/ và kiểm tra phân phối luân phiên.',
      testCommand: 'curl -I http://localhost/'
    }
  };

  // Trạng thái live thu được từ /api/status
  let currentStatusData = null;

  // Khởi tạo dynamic links cho các công cụ quản trị (sử dụng location.hostname thực tế)
  function setupDynamicAdminLinks() {
    const host = window.location.hostname || 'localhost';
    const proto = window.location.protocol || 'http:';

    const minioLink = document.getElementById('link-minio-console');
    if (minioLink) {
      minioLink.href = `${proto}//${host}:9001`;
    }

    const grafanaLink = document.getElementById('link-grafana-dash');
    if (grafanaLink) {
      grafanaLink.href = `${proto}//${host}:3000`;
    }

    const promLink = document.getElementById('link-prometheus-targets');
    if (promLink) {
      promLink.href = `${proto}//${host}:9090/targets`;
    }
  }

  // Lấy trạng thái hệ thống từ GET /api/status
  async function fetchSystemStatus() {
    const pulseDot = document.getElementById('status-pulse');
    const overallText = document.getElementById('status-overall-text');
    const overallSub = document.getElementById('status-overall-sub');
    const reachableEl = document.getElementById('stat-reachable');
    const groupsEl = document.getElementById('stat-groups');
    const runtimeEl = document.getElementById('stat-runtime');
    const checkedAtEl = document.getElementById('stat-checked-at');
    const alertBox = document.getElementById('status-alert');

    if (overallSub) overallSub.textContent = 'Đang kiểm tra kết nối tới /api/status...';

    try {
      const response = await fetch('/api/status', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      currentStatusData = data;

      // Cập nhật giao diện khi thành công
      if (pulseDot) {
        pulseDot.className = 'status-pulse-dot ' + (data.overall === 'healthy' ? 'healthy' : (data.overall === 'unhealthy' ? 'unhealthy' : 'unknown'));
      }
      if (overallText) {
        overallText.textContent = data.overall === 'healthy' ? 'Hệ thống hoạt động (Healthy)' :
                                  data.overall === 'unhealthy' ? 'Có dịch vụ lỗi (Unhealthy)' : 'Trạng thái Unknown';
      }
      if (overallSub) {
        overallSub.textContent = `Đã kiểm tra ${data.services_checked || 0} dịch vụ`;
      }
      if (reachableEl) {
        reachableEl.textContent = `${data.services_reachable || 0} / ${data.services_checked || 0}`;
      }
      if (groupsEl) {
        groupsEl.textContent = `${data.groups_total || 9} nhóm`;
      }
      if (runtimeEl) {
        // Hợp đồng quy định: container_runtime_count null phải hiển thị Unknown / Chưa đọc runtime, không đổi thành số container đang chạy
        runtimeEl.textContent = data.container_runtime_count !== null && data.container_runtime_count !== undefined
          ? `${data.container_runtime_count} containers`
          : 'Unknown';
      }
      if (checkedAtEl) {
        if (data.checked_at) {
          const d = new Date(data.checked_at);
          checkedAtEl.textContent = isNaN(d.getTime()) ? String(data.checked_at) : d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
        } else {
          checkedAtEl.textContent = 'Vừa xong';
        }
      }

      if (alertBox) {
        alertBox.style.display = 'none';
      }

      // Cập nhật badge cho từng card dịch vụ nếu có danh sách services
      updateServiceCardsStatus(data.services || []);

    } catch (err) {
      // Backend chưa chạy hoặc lỗi kết nối: Hiển thị chưa kết nối, KHÔNG bịa fake healthy!
      currentStatusData = null;
      if (pulseDot) {
        pulseDot.className = 'status-pulse-dot unknown';
      }
      if (overallText) {
        overallText.textContent = 'Chưa kết nối Backend (Unknown)';
      }
      if (overallSub) {
        overallSub.textContent = 'Không nhận được dữ liệu từ /api/status';
      }
      if (reachableEl) reachableEl.textContent = '-- / --';
      if (groupsEl) groupsEl.textContent = '9 nhóm';
      if (runtimeEl) runtimeEl.textContent = 'Unknown';
      if (checkedAtEl) checkedAtEl.textContent = 'Chưa kết nối';

      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert alert-warning';
        alertBox.textContent = `Thông báo: Chưa kết nối được tới GET /api/status (${err.message}). Khi các dịch vụ Docker và Backend khởi động, trạng thái sẽ tự động cập nhật.`;
      }

      resetServiceCardsStatus();
    }
  }

  // Cập nhật badge trạng thái của 9 nhóm dịch vụ dựa trên response API
  function updateServiceCardsStatus(servicesList) {
    const serviceMap = {};
    servicesList.forEach(s => {
      // Phân loại theo group hoặc id
      if (s.id) serviceMap[s.id] = s;
      if (s.group) serviceMap[s.group.toLowerCase()] = s;
      if (s.service) serviceMap[s.service] = s;
    });

    for (const [key] of Object.entries(SERVICE_METADATA)) {
      const badgeEl = document.getElementById(`badge-srv-${key}`);
      if (!badgeEl) continue;

      let matchedService = null;
      if (key === 'web') matchedService = serviceMap['web1'] || serviceMap['web-frontend-server1'];
      else if (key === 'app') matchedService = serviceMap['app'] || serviceMap['application-backend-server'];
      else if (key === 'database') matchedService = serviceMap['db'] || serviceMap['relational-database-server'];
      else if (key === 'auth') matchedService = serviceMap['auth'] || serviceMap['authentication-identity-server'];
      else if (key === 'storage') matchedService = serviceMap['storage'] || serviceMap['object-storage-server'];
      else if (key === 'dns') matchedService = serviceMap['dns'] || serviceMap['internal-dns-server'];
      else if (key === 'monitoring') matchedService = serviceMap['prometheus'] || serviceMap['monitoring-prometheus-server'];
      else if (key === 'visualization') matchedService = serviceMap['grafana'] || serviceMap['monitoring-grafana-dashboard-server'];
      else if (key === 'proxy') matchedService = serviceMap['proxy'] || serviceMap['api-gateway-proxy-server'];

      if (matchedService && matchedService.status) {
        const st = matchedService.status.toLowerCase();
        badgeEl.className = 'badge ' + (st === 'healthy' ? 'badge-healthy' : (st === 'unhealthy' ? 'badge-unhealthy' : 'badge-unknown'));
        badgeEl.textContent = st === 'healthy' ? 'Healthy' : (st === 'unhealthy' ? 'Unhealthy' : 'Unknown');
      } else {
        badgeEl.className = 'badge badge-unknown';
        badgeEl.textContent = 'Chưa probe';
      }
    }
  }

  function resetServiceCardsStatus() {
    for (const key of Object.keys(SERVICE_METADATA)) {
      const badgeEl = document.getElementById(`badge-srv-${key}`);
      if (badgeEl) {
        badgeEl.className = 'badge badge-unknown';
        badgeEl.textContent = 'Chưa kết nối';
      }
    }
  }

  // Modal chi tiết dịch vụ
  function openServiceModal(serviceKey) {
    const meta = SERVICE_METADATA[serviceKey];
    if (!meta) return;

    const modalBackdrop = document.getElementById('service-modal');
    const modalTitle = document.getElementById('modal-service-title');
    const modalContent = document.getElementById('modal-service-content');
    if (!modalBackdrop || !modalTitle || !modalContent) return;

    modalTitle.textContent = `Nhóm ${meta.groupNum}: ${meta.name}`;

    // Tìm thông tin probe thực tế nếu có
    let liveStatusText = 'Chưa có thông tin probe';
    let liveStatusClass = 'badge-unknown';
    let liveDetail = 'Backend chưa chạy hoặc service chưa được probe.';

    if (currentStatusData && Array.isArray(currentStatusData.services)) {
      const found = currentStatusData.services.find(s => 
        (s.id && s.id.toLowerCase().includes(serviceKey)) ||
        (s.service && s.service.toLowerCase().includes(serviceKey)) ||
        (s.group && s.group.toLowerCase().includes(meta.name.toLowerCase()))
      );
      if (found) {
        liveStatusText = found.status || 'unknown';
        liveStatusClass = liveStatusText === 'healthy' ? 'badge-healthy' : (liveStatusText === 'unhealthy' ? 'badge-unhealthy' : 'badge-unknown');
        liveDetail = found.detail || 'Không có mô tả chi tiết';
      }
    }

    // Xây dựng bảng chi tiết an toàn bằng DOM / safe strings
    modalContent.innerHTML = `
      <table class="detail-table">
        <tbody>
          <tr>
            <th>Tên dịch vụ Compose</th>
            <td><code>${escapeHtml(meta.service)}</code></td>
          </tr>
          <tr>
            <th>Công nghệ sử dụng</th>
            <td><span class="service-tech-tag">${escapeHtml(meta.tech)}</span></td>
          </tr>
          <tr>
            <th>Docker Network</th>
            <td><span class="service-net-tag">${escapeHtml(meta.network)}</span></td>
          </tr>
          <tr>
            <th>Trạng thái Probe thực tế</th>
            <td><span class="badge ${liveStatusClass}">${escapeHtml(liveStatusText)}</span></td>
          </tr>
          <tr>
            <th>Chi tiết Probe</th>
            <td>${escapeHtml(liveDetail)}</td>
          </tr>
          <tr>
            <th>Vai trò trong Mini Cloud</th>
            <td>${escapeHtml(meta.role)}</td>
          </tr>
          <tr>
            <th>Cách kiểm tra thực tế</th>
            <td>${escapeHtml(meta.checkGuide)}</td>
          </tr>
          <tr>
            <th>Lệnh kiểm tra đề xuất</th>
            <td><pre class="code-block">${escapeHtml(meta.testCommand)}</pre></td>
          </tr>
        </tbody>
      </table>
    `;

    modalBackdrop.classList.add('show');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    const closeBtn = modalBackdrop.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.focus();
  }

  function closeServiceModal() {
    const modalBackdrop = document.getElementById('service-modal');
    if (modalBackdrop) {
      modalBackdrop.classList.remove('show');
      modalBackdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Khởi chạy khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', () => {
    setupDynamicAdminLinks();
    fetchSystemStatus();

    // Nút làm mới trạng thái
    const refreshBtn = document.getElementById('btn-refresh-status');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        fetchSystemStatus();
      });
    }

    // Sự kiện mở modal cho 9 card dịch vụ
    document.querySelectorAll('[data-service-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-service-key');
        openServiceModal(key);
      });
    });

    // Đóng modal
    const closeButtons = document.querySelectorAll('[data-close-modal]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', closeServiceModal);
    });

    // Đóng khi click vào backdrop ngoài modal
    const modal = document.getElementById('service-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeServiceModal();
        }
      });
    }

    // Đóng modal bằng phím Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeServiceModal();
      }
    });
  });
})();
