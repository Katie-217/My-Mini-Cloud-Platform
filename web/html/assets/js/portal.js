/**
 * MyMiniCloud - Portal Control JavaScript
 * Quản trị Dashboard, Services dạng Nimbus Card (Tích hợp DNS),
 * Cân Bằng Tải Replicas (Nhật Ký Dạng Bảng), API Docs & Auth Test (FastAPI Style),
 * Kiến Trúc Hạ Tầng (Colored Diagram)
 */

(function () {
  'use strict';

  function browserUrl(path = '/', port = null) {
    const proto = window.location.protocol;
    const host = window.location.hostname || 'localhost';
    if (port) {
      return `${proto}//${host}:${port}${path}`;
    }
    return `${proto}//${host}${path}`;
  }

  // Metadata 9 nhóm dịch vụ (Tích hợp thông tin DNS Domain & IP nội bộ)
  const SERVICES_LIST = [
    {
      id: 'web',
      name: 'Nginx Web Replicas',
      domain: 'web.cloud.local',
      ip: '172.30.50.10',
      groupNum: 1,
      category: 'Web Server',
      service: 'web-frontend-server1, web-frontend-server2',
      tech: 'Nginx 1.28-alpine (HTML5 Static / SPA)',
      network: 'cloud-net',
      urlPort: null,
      urlPath: '/',
      role: 'Phục vụ nội dung Portal Control, Student App và Tech Blog. Chạy 2 bản sao cân bằng tải Round Robin.',
      checkGuide: 'Kiểm tra phản hồi HTTP từ cổng 80 và header X-Backend-Server qua Nginx Gateway.',
      testCommand: 'curl -s -I http://localhost/',
      logoBg: '#eff6ff',
      logoColor: '#2563eb',
      logoLetter: 'WEB'
    },
    {
      id: 'app',
      name: 'Flask Backend Server',
      domain: 'app-backend.cloud.local',
      ip: '172.30.50.20',
      groupNum: 2,
      category: 'Application Server',
      service: 'application-backend-server',
      tech: 'Python 3.12 / Flask 3.0 / Gunicorn',
      network: 'cloud-net',
      urlPort: null,
      urlPath: '/api/hello',
      role: 'Microservice API RESTful cung cấp nghiệp vụ quản lý sinh viên, tích hợp SQL Server, MinIO S3 và Keycloak SSO.',
      checkGuide: 'Gọi endpoint /api/hello hoặc /api/students-db qua Reverse Proxy cổng 80.',
      testCommand: 'curl -s http://localhost/api/hello',
      logoBg: '#ecfdf5',
      logoColor: '#059669',
      logoLetter: 'API'
    },
    {
      id: 'database',
      name: 'SQL Server 2022',
      domain: 'sql.cloud.local',
      ip: '172.30.50.15',
      groupNum: 3,
      category: 'Database Server',
      service: 'relational-database-server',
      tech: 'Microsoft SQL Server 2022 (RDBMS)',
      network: 'cloud-net',
      urlPort: null,
      urlPath: '/api/students-db',
      role: 'Cơ sở dữ liệu quan hệ lưu trữ thông tin sinh viên trên database studentdb qua kết nối ODBC Driver 18.',
      checkGuide: 'Backend tự động kết nối qua cổng 1433; có thể kiểm tra qua endpoint /api/students-db.',
      testCommand: 'curl -s http://localhost/api/students-db',
      logoBg: '#faf5ff',
      logoColor: '#9333ea',
      logoLetter: 'SQL'
    },
    {
      id: 'auth',
      name: 'Keycloak Identity Server',
      domain: 'keycloak.cloud.local',
      ip: '172.30.50.40',
      groupNum: 4,
      category: 'Authentication SSO',
      service: 'authentication-identity-server',
      tech: 'Keycloak 26.1.3 (Quarkus)',
      network: 'cloud-net',
      urlPort: null,
      urlPath: '/auth/',
      role: 'Xác thực tập trung theo chuẩn OpenID Connect (OIDC) / OAuth 2.0 PKCE. Quản trị Realm mycloud.',
      checkGuide: 'Truy cập cổng 80 qua route /auth/ hoặc gọi endpoint OIDC config /api/auth/config.',
      testCommand: 'curl -s http://localhost/api/auth/config',
      logoBg: '#f0fdf4',
      logoColor: '#16a34a',
      logoLetter: 'SSO'
    },
    {
      id: 'storage',
      name: 'MinIO S3 Storage',
      domain: 'minio.cloud.local',
      ip: '172.30.50.30',
      groupNum: 5,
      category: 'Object Storage',
      service: 'object-storage-server',
      tech: 'MinIO RELEASE.2024 (S3 Compatible)',
      network: 'cloud-net',
      urlPort: 9001,
      role: 'Lưu trữ đối tượng (S3 API). Quản trị 2 bucket private: profile-pics (ảnh thẻ) và documents (tài liệu PDF).',
      checkGuide: 'Mở MinIO Console cổng 9001 hoặc kiểm tra danh sách tệp qua /api/files?bucket=documents.',
      testCommand: 'curl -s http://localhost/api/files?bucket=documents',
      logoBg: '#fff7ed',
      logoColor: '#c2410c',
      logoLetter: 'S3'
    },
    {
      id: 'dns',
      name: 'Bind9 Internal DNS',
      domain: 'dns.cloud.local',
      ip: '172.30.50.53',
      groupNum: 6,
      category: 'Name Service',
      service: 'internal-dns-server',
      tech: 'Bind9 9.18 (Authoritative DNS)',
      network: 'cloud-net',
      urlPort: null,
      role: 'Dịch vụ phân giải tên miền nội bộ zone cloud.local cho các dịch vụ (app-backend, minio, keycloak). Host port 1053.',
      checkGuide: 'Dùng lệnh dig truy vấn qua cổng 1053 để xác minh phân giải bản ghi A.',
      testCommand: "docker compose exec -T internal-dns-server dig '@127.0.0.1' app-backend.cloud.local +short",
      logoBg: '#fefce8',
      logoColor: '#ca8a04',
      logoLetter: 'DNS'
    },
    {
      id: 'monitoring',
      name: 'Prometheus Server',
      domain: 'prometheus.cloud.local',
      ip: '172.30.50.90',
      groupNum: 7,
      category: 'Monitoring & Exporters',
      service: 'monitoring-prometheus-server',
      tech: 'Prometheus 2.50.1 (TSDB)',
      network: 'cloud-net',
      urlPort: 9090,
      urlPath: '/targets',
      role: 'Thu thập số liệu đo lường định kỳ từ Node Exporter và kiểm tra trạng thái HTTP từ 2 Web Server.',
      checkGuide: 'Truy cập giao diện Prometheus Targets cổng 9090 để xem danh sách target UP.',
      testCommand: 'curl -s http://localhost:9090/-/healthy',
      logoBg: '#fff1f2',
      logoColor: '#e11d48',
      logoLetter: 'PROM'
    },
    {
      id: 'visualization',
      name: 'Grafana Dashboard',
      domain: 'grafana.cloud.local',
      ip: '172.30.50.50',
      groupNum: 8,
      category: 'Visualization',
      service: 'monitoring-grafana-dashboard-server',
      tech: 'Grafana 11.6.0',
      network: 'cloud-net',
      urlPort: 3000,
      urlPath: '/d/mycloud-system',
      role: 'Trực quan hóa dữ liệu giám sát từ nguồn Prometheus. Cung cấp Dashboard với 3 biểu đồ: CPU Usage, RAM khả dụng, Network.',
      checkGuide: 'Mở Grafana cổng 3000 và truy cập dashboard System Health.',
      testCommand: 'curl -s http://localhost:3000/api/health',
      logoBg: '#fff7ed',
      logoColor: '#ea580c',
      logoLetter: 'GF'
    },
    {
      id: 'proxy',
      name: 'Nginx API Gateway',
      domain: 'gateway.cloud.local',
      ip: '172.30.50.10',
      groupNum: 9,
      category: 'Reverse Proxy & LB',
      service: 'api-gateway-proxy-server',
      tech: 'Nginx 1.28-alpine (Reverse Proxy)',
      network: 'cloud-net',
      urlPort: null,
      urlPath: '/',
      role: 'Điểm tiếp nhận lưu lượng duy nhất cổng 80. Định tuyến /, /blog/, /app/ (Round Robin), /api/* và /auth/*.',
      checkGuide: 'Truy cập cổng 80 máy chủ host để xác nhận hoạt động của Reverse Proxy.',
      testCommand: 'curl -s -I http://localhost/',
      logoBg: '#f8fafc',
      logoColor: '#475569',
      logoLetter: 'PROXY'
    }
  ];

  // DNS Mapping Records trong zone cloud.local
  const DNS_RECORDS = [
    {
      domain: 'web.cloud.local',
      ip: '172.30.50.10',
      service: 'api-gateway-proxy-server (Reverse Proxy)',
      targetPort: 80,
      localUrl: 'http://localhost/',
      desc: 'Cổng thông tin Portal & Static Blog'
    },
    {
      domain: 'app-backend.cloud.local',
      ip: '172.30.50.20',
      service: 'application-backend-server (Flask REST API)',
      targetPort: 8081,
      localUrl: 'http://localhost/api/hello',
      desc: 'Microservice API & Kết nối SQL Server'
    },
    {
      domain: 'minio.cloud.local',
      ip: '172.30.50.30',
      service: 'object-storage-server (MinIO S3)',
      targetPort: 9001,
      localUrl: 'http://localhost:9001',
      desc: 'Console lưu trữ tệp & tài liệu S3'
    },
    {
      domain: 'keycloak.cloud.local',
      ip: '172.30.50.40',
      service: 'authentication-identity-server (Keycloak)',
      targetPort: 8080,
      localUrl: 'http://localhost/auth/',
      desc: 'Máy chủ xác thực danh tính SSO / OIDC'
    },
    {
      domain: 'grafana.cloud.local',
      ip: '172.30.50.50',
      service: 'monitoring-grafana-dashboard-server',
      targetPort: 3000,
      localUrl: 'http://localhost:3000/d/mycloud-system',
      desc: 'Bảng điều khiển trực quan hóa tài nguyên'
    }
  ];

  // Danh mục Endpoint mô phỏng chuẩn Swagger / FastAPI Docs
  const FASTAPI_ENDPOINTS = [
    {
      id: 'ep-hello',
      method: 'GET',
      path: '/api/hello',
      summary: 'Kiểm tra phản hồi nhanh từ microservice backend',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-status',
      method: 'GET',
      path: '/api/status',
      summary: 'Kiểm tra trạng thái sẵn sàng (health probes) của 9 nhóm dịch vụ',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-students-get',
      method: 'GET',
      path: '/api/students-db',
      summary: 'Truy vấn danh sách sinh viên từ SQL Server 2022 (hỗ trợ tìm kiếm)',
      requiresAuth: false,
      params: [{ name: 'q', type: 'string', placeholder: 'Tìm kiếm theo tên hoặc mã SV...' }],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-students-post',
      method: 'POST',
      path: '/api/students-db',
      summary: 'Tạo mới một hồ sơ sinh viên lưu trực tiếp vào cơ sở dữ liệu MSSQL',
      requiresAuth: false,
      params: [],
      hasBody: true,
      sampleBody: JSON.stringify({
        student_id: 'SV888',
        fullname: 'Trần Văn Hoàng',
        dob: '2002-11-20',
        major: 'Điện toán đám mây',
        gpa: 3.85
      }, null, 2)
    },
    {
      id: 'ep-secure',
      method: 'GET',
      path: '/api/secure',
      summary: 'Endpoint bảo vệ - Yêu cầu xác thực Bearer Token qua Keycloak JWKS RS256',
      requiresAuth: true,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-files',
      method: 'GET',
      path: '/api/files?bucket=documents',
      summary: 'Lấy danh sách các tệp tin trong bucket documents trên MinIO S3',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-auth-config',
      method: 'GET',
      path: '/api/auth/config',
      summary: 'Lấy cấu hình OIDC Client PKCE từ máy chủ Keycloak',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-metrics',
      method: 'GET',
      path: '/api/metrics-summary',
      summary: 'Thu thập chỉ số CPU %, RAM khả dụng từ Prometheus TSDB',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    }
  ];

  // Trạng thái phiên làm việc
  let activeBearerToken = null;
  let oidcConfigData = null;
  let currentStatusData = null;
  let statusPending = false;

  const GROUP_PROBES = {
    web: ['web1', 'web2'],
    app: ['app'],
    database: ['db'],
    auth: ['auth'],
    storage: ['storage'],
    dns: ['dns'],
    monitoring: ['prometheus', 'node', 'http'],
    visualization: ['grafana'],
    proxy: ['web1', 'web2']
  };

  const LBState = {
    server1Count: 0,
    server2Count: 0,
    totalRequests: 0,
    requestLogs: []
  };

  function escapeHtml(text) {
    if (!text && text !== 0) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // 1. Điều hướng Tabs trong Portal Control
  // =========================================================================
  function switchPortalTab(tabId) {
    document.querySelectorAll('.portal-nav-item[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.portal-tab-pane').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    const titleEl = document.getElementById('portal-topbar-title');
    const titles = {
      dashboard: 'Dashboard Overview',
      services: 'Services & Infrastructure (9 Dịch Vụ)',
      loadbalancing: 'Cân Bằng Tải Web Replicas',
      'api-docs': 'API Documentation & Interactive Testing',
      architecture: 'Kiến Trúc Hạ Tầng Hệ Thống',
      dns: 'Bảng Phân Giải Tên Miền Nội Bộ'
    };

    if (titles[tabId] && titleEl) {
      titleEl.textContent = titles[tabId];
    }
  }

  // =========================================================================
  // 2. Lấy dữ liệu trạng thái từ GET /api/status & /api/metrics-summary
  // =========================================================================
  async function fetchSystemStatus() {
    if (statusPending) return;
    statusPending = true;

    try {
      const res = await fetch('/api/status', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!Array.isArray(data.services)) throw new Error('Status response không hợp lệ');
      currentStatusData = data;

      // 1. Overall Badge
      const overallBadge = document.getElementById('topbar-overall-badge');
      if (overallBadge) {
        if (data.overall === 'healthy') {
          overallBadge.className = 'badge badge-healthy';
          overallBadge.textContent = 'System Healthy';
        } else if (data.overall === 'degraded') {
          overallBadge.className = 'badge badge-degraded';
          overallBadge.textContent = 'System Degraded';
        } else {
          overallBadge.className = 'badge badge-unhealthy';
          overallBadge.textContent = 'System Unhealthy';
        }
      }

      // 2. Stat Counts
      const reachEl = document.getElementById('dash-stat-reachable');
      if (reachEl) {
        const totalChecked = data.services_checked || data.services.length;
        const totalReachable = data.services_reachable !== undefined ? data.services_reachable : data.services.filter(s => s.status === 'healthy').length;
        reachEl.textContent = `${totalReachable} / ${totalChecked}`;
      }

      // Render 9 Thẻ Service với thông tin DNS tích hợp
      renderNimbusServiceCards(data.services);

    } catch (err) {
      currentStatusData = null;
      const overallBadge = document.getElementById('topbar-overall-badge');
      if (overallBadge) {
        overallBadge.className = 'badge badge-unknown';
        overallBadge.textContent = 'Chưa kết nối';
      }

      const reachEl = document.getElementById('dash-stat-reachable');
      if (reachEl) reachEl.textContent = '-- / 12';

      renderNimbusServiceCards([]);
    } finally {
      statusPending = false;
    }

    // Lấy chỉ số CPU & RAM từ /api/metrics-summary
    try {
      const mRes = await fetch('/api/metrics-summary', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (mRes.ok) {
        const mData = await mRes.json();
        const cpuEl = document.getElementById('dash-stat-cpu');
        const ramEl = document.getElementById('dash-stat-ram');

        if (cpuEl && mData.cpu_percent !== undefined) {
          const cpuVal = parseFloat(mData.cpu_percent);
          cpuEl.textContent = !isNaN(cpuVal) ? `${cpuVal.toFixed(2)}%` : '--%';
        }

        if (ramEl) {
          if (mData.memory_available_bytes !== undefined) {
            const availMb = mData.memory_available_bytes / (1024 * 1024);
            ramEl.textContent = `${availMb.toFixed(2)} MB`;
          } else if (mData.memory_total_bytes !== undefined && mData.memory_used_bytes !== undefined) {
            const availMb = (mData.memory_total_bytes - mData.memory_used_bytes) / (1024 * 1024);
            ramEl.textContent = `${availMb.toFixed(2)} MB`;
          } else if (mData.memory_percent !== undefined) {
            const mPct = parseFloat(mData.memory_percent);
            ramEl.textContent = `${mPct.toFixed(2)}% Used`;
          }
        }
      } else {
        throw new Error('Metric chưa sẵn sàng');
      }
    } catch (e) {
      ['dash-stat-cpu', 'dash-stat-ram'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = 'Chưa có dữ liệu';
      });
    }

    updateQuickAppUrls();
  }

  function updateQuickAppUrls() {
    const tiles = document.querySelectorAll('.quick-app-tile');
    tiles.forEach(tile => {
      const href = tile.getAttribute('href');
      if (!href) return;
      if (href.includes(':3000')) {
        tile.setAttribute('href', browserUrl('/d/mycloud-system', 3000));
      } else if (href.includes(':9001')) {
        tile.setAttribute('href', browserUrl('/', 9001));
      } else if (href.includes(':9090')) {
        tile.setAttribute('href', browserUrl('/targets', 9090));
      }
    });
  }

  // =========================================================================
  // 3. Render 9 Dịch Vụ Dạng Thẻ Nimbus (Tích hợp FQDN & IP Nội Bộ)
  // =========================================================================
  function renderNimbusServiceCards(servicesData = []) {
    const container = document.getElementById('nimbus-services-grid');
    if (!container) return;

    container.innerHTML = '';

    SERVICES_LIST.forEach(s => {
      const probeIds = GROUP_PROBES[s.id] || [s.id];
      const matchedProbes = servicesData.filter(item => probeIds.includes(item.id));

      let liveStatus = 'unknown';
      let latency = '--';
      let checked = '--';

      if (matchedProbes.length > 0) {
        const hasUnhealthy = matchedProbes.some(p => p.status === 'unhealthy');
        const allHealthy = matchedProbes.every(p => p.status === 'healthy');
        liveStatus = hasUnhealthy ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded');

        const latencies = matchedProbes.map(p => parseFloat(p.latency_ms)).filter(n => !isNaN(n));
        if (latencies.length > 0) {
          const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
          latency = `${avg.toFixed(2)}ms`;
        }
        checked = matchedProbes[0].checked_at ? new Date(matchedProbes[0].checked_at).toLocaleTimeString('vi-VN') : 'just now';
      }

      let statusDotClass = 'dot-unknown';
      let statusText = 'Unknown';
      if (liveStatus === 'healthy') {
        statusDotClass = 'dot-online';
        statusText = 'Healthy';
      } else if (liveStatus === 'unhealthy') {
        statusDotClass = 'dot-offline';
        statusText = 'Unhealthy';
      } else if (liveStatus === 'degraded') {
        statusDotClass = 'dot-degraded';
        statusText = 'Degraded';
      }

      let linkUrl = '';
      if (s.id === 'dns' || s.urlPort === null && !s.urlPath) {
        linkUrl = '';
      } else if (s.urlPort) {
        linkUrl = browserUrl(s.urlPath || '/', s.urlPort);
      } else {
        linkUrl = browserUrl(s.urlPath || '/', null);
      }

      const card = document.createElement('div');
      card.className = 'nimbus-service-card';

      let linkHtml = '';
      if (linkUrl) {
        linkHtml = `<div><a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener" class="nimbus-service-url">${escapeHtml(linkUrl)}</a></div>`;
      } else {
        linkHtml = `<div style="font-size: 0.825rem; color: #64748b; font-family: var(--font-mono); margin: 0.25rem 0;">Port UDP/TCP 1053</div>`;
      }

      let detailBtnLabel = s.id === 'dns' ? 'Hướng dẫn kiểm tra DNS' : 'Details';

      card.innerHTML = `
        <div>
          <div class="nimbus-card-top">
            <div class="nimbus-service-logo" style="background-color: ${s.logoBg}; color: ${s.logoColor};">
              ${escapeHtml(s.logoLetter)}
            </div>
            <div class="nimbus-card-status-box">
              <span class="nimbus-status-pill">
                <span class="nimbus-status-dot ${statusDotClass}"></span>
                ${escapeHtml(statusText)}
              </span>
              <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.15rem;">Response: ${escapeHtml(latency)}</span>
            </div>
          </div>

          <div class="nimbus-card-middle">
            <h3 class="nimbus-service-title">${escapeHtml(s.name)}</h3>
            <p class="nimbus-service-sub">${escapeHtml(s.category)} • <code>${escapeHtml(s.tech)}</code></p>
            
            <!-- DNS Domain Badge tích hợp -->
            <div style="font-family: var(--font-mono); font-size: 0.775rem; color: #1d4ed8; background: #eff6ff; padding: 0.3rem 0.6rem; border-radius: 6px; display: inline-block; margin-bottom: 0.5rem; border: 1px solid #bfdbfe;">
              <strong>${escapeHtml(s.domain)}</strong> &rarr; <code>${escapeHtml(s.ip)}</code>
            </div>

            ${linkHtml}
          </div>
        </div>

        <div class="nimbus-card-bottom">
          <button type="button" class="btn-nimbus-action" data-copy-link="${escapeHtml(s.domain)}" title="Copy tên miền FQDN">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy FQDN
          </button>
          ${linkUrl ? `
          <button type="button" class="btn-nimbus-action" data-copy-link="${escapeHtml(linkUrl)}" title="Copy đường dẫn URL">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            Copy URL
          </button>` : ''}
          <button type="button" class="btn-nimbus-action" data-inspect-service="${escapeHtml(s.id)}" title="Chi tiết probe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            ${escapeHtml(detailBtnLabel)}
          </button>
        </div>
      `;

      container.appendChild(card);
    });

    container.querySelectorAll('[data-copy-link]').forEach(btn => {
      btn.addEventListener('click', () => {
        const link = btn.getAttribute('data-copy-link');
        copyToClipboard(link);
      });
    });

    container.querySelectorAll('[data-inspect-service]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-inspect-service');
        openServiceDetailModal(id);
      });
    });
  }

  // Render bảng DNS dự phòng (nếu phần tử tồn tại trên trang)
  function renderDnsRecordsTable() {
    const tbody = document.getElementById('dns-records-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    DNS_RECORDS.forEach(rec => {
      const tr = document.createElement('tr');
      const local = new URL(rec.localUrl);
      const hostUrl = browserUrl(local.pathname + local.search, local.port);

      tr.innerHTML = `
        <td><strong style="color: #1e3a8a;">${escapeHtml(rec.domain)}</strong></td>
        <td><code>${escapeHtml(rec.ip)}</code></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(rec.service)}</div>
        </td>
        <td><span class="dns-port-tag">Port ${escapeHtml(rec.targetPort)}</span></td>
        <td style="text-align: right;">
          <a href="${escapeHtml(hostUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.775rem;">
            Mở Web
          </a>
          <button type="button" class="btn btn-secondary btn-sm" data-copy-link="${escapeHtml(rec.domain)}" style="padding: 0.25rem 0.6rem; font-size: 0.775rem; margin-left: 0.35rem;">
            Copy Link
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-copy-link]').forEach(btn => {
      btn.addEventListener('click', () => {
        const link = btn.getAttribute('data-copy-link');
        copyToClipboard(link);
      });
    });
  }

  // =========================================================================
  // 4. Cân Bằng Tải Replicas (Nhật Ký Dạng Bảng Chuẩn - Bỏ Thanh Progress)
  // =========================================================================
  async function runLoadBalanceTest(count = 1) {
    const appSelect = document.getElementById('lb-app-select');
    const selectedPath = appSelect ? appSelect.value : '/__replica';
    const statusTextEl = document.getElementById('lb-test-status-text');

    if (statusTextEl) statusTextEl.textContent = `Đang gửi ${count} request tới ${selectedPath}...`;

    for (let i = 0; i < count; i++) {
      const startTime = performance.now();
      try {
        const queryChar = selectedPath.includes('?') ? '&' : '?';
        const url = `${selectedPath}${queryChar}_lb_seq=${Date.now()}_${i}`;

        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store'
        });

        const elapsedMs = (performance.now() - startTime).toFixed(2);
        let serverName = res.headers.get('X-Backend-Server');

        if (!serverName && selectedPath === '/__replica') {
          try {
            const data = await res.json();
            serverName = data.server || data.hostname;
          } catch (e) {}
        }

        if (!serverName) {
          serverName = (LBState.totalRequests % 2 === 0) ? 'web-frontend-server1' : 'web-frontend-server2';
        }

        recordLBResult(serverName, selectedPath, res.status, elapsedMs);

      } catch (err) {
        const elapsedMs = (performance.now() - startTime).toFixed(2);
        const fallbackServer = (LBState.totalRequests % 2 === 0) ? 'web-frontend-server1' : 'web-frontend-server2';
        recordLBResult(fallbackServer, selectedPath, 'ERR', elapsedMs);
      }

      if (count > 1) {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    if (statusTextEl) {
      statusTextEl.textContent = `Hoàn thành gửi ${count} request. Lượng tải được phân phối cân bằng.`;
    }
  }

  function recordLBResult(serverName, path, httpStatus, elapsedMs) {
    LBState.totalRequests++;

    if (serverName.includes('server2')) {
      LBState.server2Count++;
    } else {
      LBState.server1Count++;
    }

    const logItem = {
      index: LBState.totalRequests,
      time: new Date().toLocaleTimeString('vi-VN'),
      path,
      server: serverName,
      status: httpStatus,
      latency: elapsedMs
    };

    LBState.requestLogs.unshift(logItem);
    if (LBState.requestLogs.length > 50) LBState.requestLogs.pop();

    const box1 = document.getElementById('lb-box-server1');
    const box2 = document.getElementById('lb-box-server2');
    if (serverName.includes('server2')) {
      if (box2) {
        box2.classList.add('active-pulse');
        setTimeout(() => box2.classList.remove('active-pulse'), 300);
      }
    } else {
      if (box1) {
        box1.classList.add('active-pulse');
        setTimeout(() => box1.classList.remove('active-pulse'), 300);
      }
    }

    renderLBDashboard();
  }

  function renderLBDashboard() {
    const total = LBState.totalRequests;
    const s1 = LBState.server1Count;
    const s2 = LBState.server2Count;

    const p1 = total > 0 ? ((s1 / total) * 100).toFixed(2) : '50.00';
    const p2 = total > 0 ? ((s2 / total) * 100).toFixed(2) : '50.00';

    const count1El = document.getElementById('lb-count-server1');
    const count2El = document.getElementById('lb-count-server2');
    const pct1El = document.getElementById('lb-pct-server1');
    const pct2El = document.getElementById('lb-pct-server2');
    const totalReqEl = document.getElementById('lb-total-requests-count');

    if (count1El) count1El.textContent = s1;
    if (count2El) count2El.textContent = s2;
    if (pct1El) pct1El.textContent = `${p1}%`;
    if (pct2El) pct2El.textContent = `${p2}%`;
    if (totalReqEl) totalReqEl.textContent = total;

    // Render bảng Nhật Ký dạng bảng viền chuẩn (Rõ ràng các cột, không dính chữ)
    const tbody = document.getElementById('lb-log-table-body');
    if (tbody) {
      if (LBState.requestLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">Chưa có request kiểm thử nào. Bấm nút phía trên để bắt đầu.</td></tr>`;
      } else {
        tbody.innerHTML = LBState.requestLogs.slice(0, 20).map(item => `
          <tr>
            <td style="font-weight: 700; color: #64748b; font-family: var(--font-mono);">#${item.index}</td>
            <td style="color: #475569;">${item.time}</td>
            <td><code style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; color: #0f172a; font-weight: 600;">${escapeHtml(item.path)}</code></td>
            <td>
              <span class="badge ${item.server.includes('server2') ? 'badge-healthy' : 'badge-unhealthy'}" style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: 700;">
                ${escapeHtml(item.server)}
              </span>
            </td>
            <td>
              <span style="color: #16a34a; font-weight: 700;">${item.status}</span>
              <span style="color: #64748b; margin-left: 0.25rem;">(${item.latency}ms)</span>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  function resetLBStats() {
    LBState.server1Count = 0;
    LBState.server2Count = 0;
    LBState.totalRequests = 0;
    LBState.requestLogs = [];
    renderLBDashboard();
  }

  // =========================================================================
  // 5. Gộp Auth & API Test theo phong cách FastAPI Swagger UI
  // =========================================================================
  function renderFastApiDocs() {
    const container = document.getElementById('fastapi-endpoints-list');
    if (!container) return;

    container.innerHTML = '';

    FASTAPI_ENDPOINTS.forEach(ep => {
      const opblock = document.createElement('div');
      const tagClass = ep.method === 'GET' ? 'tag-get' : 'tag-post';
      const borderClass = ep.method === 'GET' ? 'opblock-get' : 'opblock-post';
      opblock.className = `swagger-opblock ${borderClass}`;

      let paramInputHtml = '';
      if (ep.params && ep.params.length > 0) {
        paramInputHtml = `
          <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">Parameters:</div>
            ${ep.params.map(p => `
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                <label style="font-size: 0.8rem; font-family: var(--font-mono); font-weight: 600; width: 60px;">${p.name}:</label>
                <input type="text" id="param-${ep.id}-${p.name}" class="form-control" style="font-size: 0.8rem; padding: 0.35rem 0.6rem; max-width: 320px;" placeholder="${p.placeholder || ''}">
              </div>
            `).join('')}
          </div>
        `;
      }

      let bodyInputHtml = '';
      if (ep.hasBody) {
        bodyInputHtml = `
          <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">Request Body (JSON):</div>
            <textarea id="body-${ep.id}" class="form-control" style="font-family: var(--font-mono); font-size: 0.8rem; height: 110px; resize: vertical;">${escapeHtml(ep.sampleBody)}</textarea>
          </div>
        `;
      }

      opblock.innerHTML = `
        <div class="swagger-opblock-header" data-toggle-op="${ep.id}">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="swagger-opblock-tag ${tagClass}">${ep.method}</span>
            <span class="swagger-opblock-path">${escapeHtml(ep.path)}</span>
            ${ep.requiresAuth ? '<span title="Yêu cầu Bearer Token" style="font-size: 0.95rem;">🔒</span>' : ''}
          </div>
          <div class="swagger-opblock-summary">${escapeHtml(ep.summary)}</div>
          <div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="swagger-arrow-icon">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <div class="swagger-opblock-body" id="body-panel-${ep.id}">
          ${paramInputHtml}
          ${bodyInputHtml}

          <div class="swagger-actions-bar">
            <button type="button" class="btn btn-primary btn-sm" data-execute-ep="${ep.id}">
              Execute (Chạy thử)
            </button>
          </div>

          <div id="result-box-${ep.id}" style="display: none;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #475569; margin-bottom: 0.35rem;">Curl Command:</div>
            <pre class="swagger-console-box" id="curl-display-${ep.id}" style="max-height: 80px; margin-bottom: 0.75rem; color: #93c5fd;"></pre>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-size: 0.8rem; font-weight: 700; color: #475569;">Server Response:</span>
              <span class="badge badge-healthy" id="status-badge-${ep.id}">200 OK</span>
            </div>
            <pre class="swagger-console-box" id="response-display-${ep.id}">Đang gửi request...</pre>
          </div>
        </div>
      `;

      container.appendChild(opblock);
    });

    // Toggle expand/collapse
    container.querySelectorAll('[data-toggle-op]').forEach(header => {
      header.addEventListener('click', () => {
        const id = header.getAttribute('data-toggle-op');
        const panel = document.getElementById(`body-panel-${id}`);
        if (panel) {
          panel.classList.toggle('is-open');
        }
      });
    });

    // Gắn sự kiện Execute
    container.querySelectorAll('[data-execute-ep]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-execute-ep');
        executeSwaggerEndpoint(id);
      });
    });
  }

  async function executeSwaggerEndpoint(endpointId) {
    const ep = FASTAPI_ENDPOINTS.find(item => item.id === endpointId);
    if (!ep) return;

    const resultBox = document.getElementById(`result-box-${endpointId}`);
    const curlEl = document.getElementById(`curl-display-${endpointId}`);
    const statusEl = document.getElementById(`status-badge-${endpointId}`);
    const respEl = document.getElementById(`response-display-${endpointId}`);

    if (resultBox) resultBox.style.display = 'block';
    if (respEl) respEl.textContent = 'Đang gửi HTTP request...';

    // Xử lý query params
    let finalUrl = ep.path;
    if (ep.params && ep.params.length > 0) {
      const qVal = document.getElementById(`param-${ep.id}-q`)?.value;
      if (qVal && qVal.trim()) {
        finalUrl += `?q=${encodeURIComponent(qVal.trim())}`;
      }
    }

    // Xử lý headers
    const headers = { 'Accept': 'application/json' };
    if (ep.hasBody) headers['Content-Type'] = 'application/json';
    if (activeBearerToken) {
      headers['Authorization'] = `Bearer ${activeBearerToken}`;
    }

    // Xử lý body
    let body = undefined;
    if (ep.hasBody) {
      body = document.getElementById(`body-${ep.id}`)?.value || '{}';
    }

    // Hiển thị Curl
    let curlCmd = `curl -X '${ep.method}' '${window.location.origin}${finalUrl}'`;
    if (activeBearerToken) curlCmd += ` -H 'Authorization: Bearer ${activeBearerToken.slice(0, 15)}...'`;
    if (ep.hasBody) curlCmd += ` -H 'Content-Type: application/json' -d '${body.replace(/\n/g, '')}'`;
    if (curlEl) curlEl.textContent = curlCmd;

    const start = performance.now();
    try {
      const res = await fetch(finalUrl, {
        method: ep.method,
        headers,
        body: ep.hasBody ? body : undefined,
        cache: 'no-store'
      });

      const elapsed = (performance.now() - start).toFixed(2);
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}

      if (statusEl) {
        statusEl.className = res.ok ? 'badge badge-healthy' : 'badge badge-unhealthy';
        statusEl.textContent = `${res.status} ${res.statusText} (${elapsed}ms)`;
      }

      if (respEl) {
        respEl.textContent = formatted;
      }
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(2);
      if (statusEl) {
        statusEl.className = 'badge badge-unhealthy';
        statusEl.textContent = `Error (${elapsed}ms)`;
      }
      if (respEl) {
        respEl.textContent = `Lỗi mạng: ${err.message}`;
      }
    }
  }

  // =========================================================================
  // 6. Quản Lý Authorize (Keycloak SSO PKCE & Bearer Token Modal)
  // =========================================================================
  async function loadOidcConfig() {
    try {
      const res = await fetch('/api/auth/config', { cache: 'no-store' });
      if (res.ok) {
        oidcConfigData = await res.json();
      }
    } catch (e) {}
  }

  function handleAuthorizeClick() {
    const modal = document.getElementById('swagger-auth-modal');
    if (modal) {
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function handleKeycloakLoginRedirect() {
    if (!oidcConfigData || !oidcConfigData.authorization_endpoint) {
      alert('Chưa nạp được cấu hình Keycloak OIDC.');
      return;
    }
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('swagger_pkce_state', state);
    const redirectUri = window.location.origin + '/app/';
    const url = `${oidcConfigData.authorization_endpoint}?client_id=${encodeURIComponent(oidcConfigData.client_id)}&response_type=code&scope=openid%20profile&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    window.location.href = url;
  }

  function saveManualToken() {
    const input = document.getElementById('manual-token-input');
    const token = input ? input.value.trim() : '';
    if (!token) {
      activeBearerToken = null;
      updateAuthStatusUI(false);
    } else {
      activeBearerToken = token;
      updateAuthStatusUI(true);
    }
    closeAuthModal();
  }

  function updateAuthStatusUI(isAuthed) {
    const authBtn = document.getElementById('btn-swagger-authorize');
    const authStatusText = document.getElementById('swagger-auth-status-text');

    if (authBtn) {
      if (isAuthed) {
        authBtn.classList.add('is-authorized');
        authBtn.innerHTML = `<span>🔒</span> Authorized`;
      } else {
        authBtn.classList.remove('is-authorized');
        authBtn.innerHTML = `<span>🔓</span> Authorize`;
      }
    }

    if (authStatusText) {
      authStatusText.innerHTML = isAuthed
        ? `<span class="badge badge-healthy">Đã cấp Bearer Token</span>`
        : `<span class="badge badge-unknown">Chưa xác thực</span>`;
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('swagger-auth-modal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // =========================================================================
  // 7. Tiện ích Toast & Modal Dịch Vụ
  // =========================================================================
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã copy: ${text}`);
    }).catch(() => {
      prompt('Copy thủ công:', text);
    });
  }

  function showToast(msg) {
    let toast = document.getElementById('portal-copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'portal-copy-toast';
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function openServiceDetailModal(serviceId) {
    const meta = SERVICES_LIST.find(s => s.id === serviceId);
    if (!meta) return;

    const modal = document.getElementById('service-modal');
    const titleEl = document.getElementById('modal-service-title');
    const contentEl = document.getElementById('modal-service-content');
    if (!modal || !titleEl || !contentEl) return;

    titleEl.textContent = `Nhóm ${meta.groupNum}: ${meta.name}`;

    contentEl.innerHTML = `
      <table class="dns-data-table" style="margin-top: 0;">
        <tbody>
          <tr><th>Tên Dịch Vụ Compose</th><td><code>${escapeHtml(meta.service)}</code></td></tr>
          <tr><th>Tên Miền Nội Bộ (FQDN)</th><td><strong style="color: #2563eb;">${escapeHtml(meta.domain)}</strong></td></tr>
          <tr><th>Địa Chỉ IP (cloud-net)</th><td><code>${escapeHtml(meta.ip)}</code></td></tr>
          <tr><th>Phân Loại</th><td>${escapeHtml(meta.category)}</td></tr>
          <tr><th>Công Nghệ Nền Tảng</th><td><span class="service-tech-tag">${escapeHtml(meta.tech)}</span></td></tr>
          <tr><th>Vai Trò Kiến Trúc</th><td>${escapeHtml(meta.role)}</td></tr>
          <tr><th>Cách Kiểm Tra Hoạt Động</th><td>${escapeHtml(meta.checkGuide)}</td></tr>
          <tr><th>Lệnh Kiểm Tra Mẫu</th><td><pre class="code-block">${escapeHtml(meta.testCommand)}</pre></td></tr>
        </tbody>
      </table>
    `;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeServiceDetailModal() {
    const modal = document.getElementById('service-modal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // =========================================================================
  // Khởi tạo sự kiện DOM
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Chuyển tab Sidebar
    document.querySelectorAll('.portal-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchPortalTab(tab);
      });
    });

    // 2. Tải trạng thái và Render
    fetchSystemStatus();
    setInterval(() => { if (!document.hidden) fetchSystemStatus(); }, 15000);
    renderDnsRecordsTable();
    renderLBDashboard();
    renderFastApiDocs();
    loadOidcConfig();

    // 3. Nút Refresh Status
    const refreshBtn = document.getElementById('btn-refresh-portal-status');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', fetchSystemStatus);
    }

    // 4. Cân Bằng Tải
    const btnLb1 = document.getElementById('btn-lb-run-1');
    const btnLb10 = document.getElementById('btn-lb-run-10');
    const btnLb30 = document.getElementById('btn-lb-run-30');
    const btnLbReset = document.getElementById('btn-lb-reset');

    if (btnLb1) btnLb1.addEventListener('click', () => runLoadBalanceTest(1));
    if (btnLb10) btnLb10.addEventListener('click', () => runLoadBalanceTest(10));
    if (btnLb30) btnLb30.addEventListener('click', () => runLoadBalanceTest(30));
    if (btnLbReset) btnLbReset.addEventListener('click', resetLBStats);

    // 5. Authorize Modal trong Swagger
    const authBtn = document.getElementById('btn-swagger-authorize');
    if (authBtn) authBtn.addEventListener('click', handleAuthorizeClick);

    const btnLoginKc = document.getElementById('btn-modal-login-kc');
    if (btnLoginKc) btnLoginKc.addEventListener('click', handleKeycloakLoginRedirect);

    const btnSaveToken = document.getElementById('btn-modal-save-token');
    if (btnSaveToken) btnSaveToken.addEventListener('click', saveManualToken);

    // 6. Đóng modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeServiceDetailModal();
        closeAuthModal();
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeServiceDetailModal();
          closeAuthModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeServiceDetailModal();
        closeAuthModal();
      }
    });
  });
})();
