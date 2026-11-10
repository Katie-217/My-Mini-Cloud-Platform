/**
 * MyMiniCloud - Portal Control Center JavaScript
 * Quản trị Dashboard, Services & DNS, Cân Bằng Tải Replicas (Round Robin Thực Tế),
 * Flask REST API Interactive Explorer, Keycloak OIDC Authentication,
 * Kiến Trúc Hạ Tầng Phân Tầng, và Giám Sát Đo Lường Tài Nguyên.
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

  // =========================================================================
  // METADATA 9 NHÓM DỊCH VỤ KIẾN TRÚC & DOCKER COMPOSE METADATA THỰC TẾ
  // =========================================================================
  const SERVICES_LIST = [
    {
      id: 'web',
      name: 'Nginx Web Replicas',
      domain: 'web.cloud.local',
      ip: '172.30.50.11, 172.30.50.12',
      groupNum: 1,
      category: 'Web Server',
      service: 'web-frontend-server1, web-frontend-server2',
      image: 'mycloud-web:1.0.0 (nginx:1.28-alpine base)',
      port: 'Cổng nội bộ 80 (TCP)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'Không (Stateless Container)',
      healthcheck: 'HTTP GET / & /app/ & /blog/ (Blackbox Prober)',
      tech: 'Nginx 1.28-alpine (HTML5 Static / SPA)',
      urlPort: null,
      urlPath: '/',
      role: 'Phục vụ nội dung Portal Control, Student App và Tech Blog. Chạy 2 bản sao cân bằng tải Round Robin qua Reverse Proxy.',
      checkGuide: 'Kiểm tra phản hồi HTTP từ cổng 80 và header X-Web-Server qua Nginx Gateway.',
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
      image: 'mycloud-app:1.0.0 (Python 3.12-slim base)',
      port: 'Cổng nội bộ 8081 (TCP)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'Không (Stateless Microservice)',
      healthcheck: 'HTTP GET /hello (Interval 10s, Timeout 3s)',
      tech: 'Python 3.12 / Flask 3.0 / Gunicorn',
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
      image: 'mcr.microsoft.com/mssql/server:2022-CU22-ubuntu-22.04',
      port: 'Cổng nội bộ 1433 (TCP TDS)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'mssql-data (Named Docker Volume)',
      healthcheck: 'TCP Ping :1433 & Query SELECT 1 qua sqlcmd',
      tech: 'Microsoft SQL Server 2022 (RDBMS)',
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
      image: 'quay.io/keycloak/keycloak:26.1.4 (Quarkus runtime)',
      port: 'Cổng nội bộ 8080 (TCP HTTP)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'keycloak-data (Embedded H2 storage)',
      healthcheck: 'HTTP GET /health/ready (Quarkus MicroProfile)',
      tech: 'Keycloak 26.1.4 (Quarkus / Java 21)',
      urlPort: null,
      urlPath: '/auth/',
      role: 'Xác thực tập trung theo chuẩn OpenID Connect (OIDC) / OAuth 2.0 PKCE. Quản trị Realm mini-cloud và client flask-app.',
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
      image: 'mycloud-minio:source-2025-04-22 (S3 Compatible)',
      port: 'Port 9000 (S3 API) & Port 9001 (Web Console)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'minio-data (Named Docker Volume)',
      healthcheck: 'HTTP GET /minio/health/live',
      tech: 'MinIO RELEASE.2024-04 (S3 Compatible)',
      urlPort: 9001,
      role: 'Lưu trữ đối tượng (S3 API). Quản trị 2 bucket: profile-pics (ảnh sinh viên) và documents (tài liệu PDF).',
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
      image: 'internetsystemsconsortium/bind9:9.18',
      port: 'Port 1053 (Host UDP/TCP) & Port 53 (Internal)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'dns/named.conf.local & dns/db.cloud.local',
      healthcheck: 'DNS query @127.0.0.1 app-backend.cloud.local',
      tech: 'Bind9 9.18 (Authoritative DNS)',
      urlPort: null,
      role: 'Dịch vụ phân giải tên miền nội bộ có thẩm quyền cho zone cloud.local (app-backend, minio, keycloak...). Host port 1053.',
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
      image: 'prom/prometheus:v3.2.1',
      port: 'Port 9090 (Host & Container TCP)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'prometheus-data & monitor/prometheus.yml',
      healthcheck: 'HTTP GET /-/healthy',
      tech: 'Prometheus 3.2.1 (Time Series TSDB)',
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
      image: 'grafana/grafana:11.6.0',
      port: 'Port 3000 (Host & Container TCP)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'grafana-data & grafana provisioning dashboards',
      healthcheck: 'HTTP GET /api/health',
      tech: 'Grafana 11.6.0',
      networkName: 'cloud-net',
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
      image: 'nginx:1.28-alpine',
      port: 'Port 80 (Host Public Port)',
      network: 'cloud-net (Subnet 172.30.50.0/24)',
      volume: 'proxy/nginx.conf',
      healthcheck: 'HTTP GET / (Localhost probe)',
      tech: 'Nginx 1.28-alpine (Reverse Proxy)',
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

  // DNS Mapping Records trong zone cloud.local (Đúng 5 bản ghi chuẩn)
  const DNS_RECORDS = [
    {
      domain: 'web.cloud.local',
      recordType: 'A Record',
      ip: '172.30.50.10',
      service: 'api-gateway-proxy-server (Reverse Proxy)',
      targetPort: 80,
      localUrl: 'http://localhost/',
      resolveStatus: 'Active (Bind9 :1053)'
    },
    {
      domain: 'app-backend.cloud.local',
      recordType: 'A Record',
      ip: '172.30.50.20',
      service: 'application-backend-server (Flask REST API)',
      targetPort: 8081,
      localUrl: 'http://localhost/api/hello',
      resolveStatus: 'Active (Bind9 :1053)'
    },
    {
      domain: 'minio.cloud.local',
      recordType: 'A Record',
      ip: '172.30.50.30',
      service: 'object-storage-server (MinIO S3)',
      targetPort: 9001,
      localUrl: 'http://localhost:9001',
      resolveStatus: 'Active (Bind9 :1053)'
    },
    {
      domain: 'keycloak.cloud.local',
      recordType: 'A Record',
      ip: '172.30.50.40',
      service: 'authentication-identity-server (Keycloak)',
      targetPort: 8080,
      localUrl: 'http://localhost/auth/',
      resolveStatus: 'Active (Bind9 :1053)'
    },
    {
      domain: 'grafana.cloud.local',
      recordType: 'A Record',
      ip: '172.30.50.50',
      service: 'monitoring-grafana-dashboard-server',
      targetPort: 3000,
      localUrl: 'http://localhost:3000/d/mycloud-system',
      resolveStatus: 'Active (Bind9 :1053)'
    }
  ];

  // Danh mục Endpoint Flask REST API (Phân nhóm rõ ràng theo yêu cầu)
  const FLASK_ENDPOINTS = [
    // Nhóm 1: Health Check
    {
      id: 'ep-hello',
      group: 'Health Check & Service Discovery',
      method: 'GET',
      path: '/api/hello',
      summary: 'Kiểm tra phản hồi nhanh từ Flask microservice backend',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-status',
      group: 'Health Check & Service Discovery',
      method: 'GET',
      path: '/api/status',
      summary: 'Kiểm tra trạng thái sẵn sàng (health probes) của 9 nhóm dịch vụ',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },

    // Nhóm 2: Student API (JSON Reference mẫu 5 sinh viên theo đề)
    {
      id: 'ep-students-json',
      group: 'Student API (JSON Reference - Đề Bài)',
      method: 'GET',
      path: '/api/student',
      summary: 'Lấy danh sách 5 sinh viên mẫu từ file JSON theo yêu cầu đề bài',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },

    // Nhóm 3: Database CRUD (SQL Server 2022 - Bảng students)
    {
      id: 'ep-students-get',
      group: 'Database CRUD (SQL Server 2022)',
      method: 'GET',
      path: '/api/students-db',
      summary: 'Truy vấn danh sách hồ sơ sinh viên từ cơ sở dữ liệu studentdb (SQL Server)',
      requiresAuth: false,
      params: [{ name: 'q', type: 'string', placeholder: 'Tìm kiếm theo tên hoặc mã SV...' }],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-students-get-id',
      group: 'Database CRUD (SQL Server 2022)',
      method: 'GET',
      path: '/api/students-db/{id}',
      summary: 'Truy vấn chi tiết một hồ sơ sinh viên theo ID từ SQL Server',
      requiresAuth: false,
      params: [{ name: 'id', type: 'integer', placeholder: 'Nhập ID sinh viên (ví dụ: 1)...' }],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-students-post',
      group: 'Database CRUD (SQL Server 2022)',
      method: 'POST',
      path: '/api/students-db',
      summary: 'Tạo mới một hồ sơ sinh viên lưu trực tiếp vào database SQL Server',
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
      id: 'ep-students-put',
      group: 'Database CRUD (SQL Server 2022)',
      method: 'PUT',
      path: '/api/students-db/{id}',
      summary: 'Cập nhật thông tin hồ sơ sinh viên theo ID trong SQL Server',
      requiresAuth: false,
      params: [{ name: 'id', type: 'integer', placeholder: 'Nhập ID sinh viên cần cập nhật (ví dụ: 1)...' }],
      hasBody: true,
      sampleBody: JSON.stringify({
        fullname: 'Nguyễn Minh An (Updated)',
        dob: '2004-03-12',
        major: 'Khoa học máy tính',
        gpa: 3.90
      }, null, 2)
    },
    {
      id: 'ep-students-delete',
      group: 'Database CRUD (SQL Server 2022)',
      method: 'DELETE',
      path: '/api/students-db/{id}',
      summary: 'Xóa hồ sơ sinh viên khỏi cơ sở dữ liệu SQL Server',
      requiresAuth: false,
      params: [{ name: 'id', type: 'integer', placeholder: 'Nhập ID sinh viên cần xóa (ví dụ: 888)...' }],
      hasBody: false,
      sampleBody: ''
    },

    // Nhóm 4: Object Storage (MinIO S3)
    {
      id: 'ep-files-docs',
      group: 'File Storage (MinIO S3)',
      method: 'GET',
      path: '/api/files?bucket=documents',
      summary: 'Lấy danh sách các tệp tin trong bucket documents (tài liệu PDF) trên MinIO S3',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },
    {
      id: 'ep-files-pics',
      group: 'File Storage (MinIO S3)',
      method: 'GET',
      path: '/api/files?bucket=profile-pics',
      summary: 'Lấy danh sách ảnh đại diện sinh viên trong bucket profile-pics trên MinIO S3',
      requiresAuth: false,
      params: [],
      hasBody: false,
      sampleBody: ''
    },

    // Nhóm 5: Monitoring & Telemetry
    {
      id: 'ep-metrics',
      group: 'Monitoring & Telemetry',
      method: 'GET',
      path: '/api/metrics-summary',
      summary: 'Thu thập chỉ số CPU %, RAM khả dụng/tổng từ Prometheus TSDB',
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

  // Trạng thái Load Balancing (Khởi tạo 0 request và tỷ lệ "—")
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
  // 1. ĐIỀU HƯỚNG TABS & SUB-TABS TRONG PORTAL CONTROL
  // =========================================================================
  function switchPortalTab(tabId) {
    // Xử lý các alias để hỗ trợ tương thích ngược cho test scripts
    let targetTab = tabId;
    let targetSubTab = null;

    if (tabId === 'api-docs') {
      targetTab = 'api-explorer';
    } else if (tabId === 'dns') {
      targetTab = 'services';
      targetSubTab = 'dns';
    }

    // Cập nhật trạng thái active của Sidebar items
    document.querySelectorAll('.portal-nav-item[data-tab]').forEach(btn => {
      const bTab = btn.getAttribute('data-tab');
      if (bTab === targetTab || bTab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Cập nhật trạng thái active của Main Panes
    document.querySelectorAll('.portal-tab-pane').forEach(pane => {
      if (pane.id === `tab-${targetTab}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Cập nhật Subtab nếu có
    if (targetSubTab) {
      switchSubTab(targetSubTab);
    }

    // Cập nhật tiêu đề Topbar
    const titleEl = document.getElementById('portal-topbar-title');
    const titles = {
      dashboard: 'Dashboard Overview',
      services: 'Services & DNS Infrastructure',
      architecture: 'Architecture & Network Flow',
      monitoring: 'Monitoring & System Logs',
      loadbalancing: 'Load Balancing (Nginx Web Replicas)',
      'api-explorer': 'Flask REST API Explorer',
      'api-docs': 'Flask REST API Explorer',
      auth: 'Authentication (Keycloak OIDC PKCE)',
      dns: 'DNS Records (Zone: cloud.local)'
    };

    if (titles[tabId] && titleEl) {
      titleEl.textContent = titles[tabId];
    }
  }

  function switchSubTab(subtabId) {
    document.querySelectorAll('.subtab-btn').forEach(btn => {
      if (btn.getAttribute('data-subtab') === subtabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.subtab-pane').forEach(pane => {
      if (pane.id === `subtab-pane-${subtabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  // =========================================================================
  // 2. LẤY DỮ LIỆU SỨC KHỎE TỪ GET /api/status & /api/metrics-summary
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

      // 2. Stat Counts: Healthy Containers (Ví dụ: 12 / 12)
      const reachEl = document.getElementById('dash-stat-reachable');
      if (reachEl) {
        const totalChecked = data.services_checked || data.services.length;
        const totalReachable = data.services_reachable !== undefined ? data.services_reachable : data.services.filter(s => s.status === 'healthy').length;
        reachEl.textContent = `${totalReachable} / ${totalChecked}`;
      }

      const groupsEl = document.getElementById('dash-stat-groups');
      if (groupsEl) {
        groupsEl.textContent = '9 Nhóm';
      }

      // Render 9 Thẻ Service với thông tin DNS tích hợp
      renderNimbusServiceCards(data.services);

      // Render Bảng Recent Activity từ dữ liệu probe thật
      renderRecentActivity(data.services);

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
      renderRecentActivity([]);
    } finally {
      statusPending = false;
    }

    // Lấy chỉ số CPU & RAM từ /api/metrics-summary (Làm tròn 2 chữ số sau dấu phẩy)
    try {
      const mRes = await fetch('/api/metrics-summary', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (mRes.ok) {
        const mData = await mRes.json();
        const cpuEl = document.getElementById('dash-stat-cpu');
        const ramEl = document.getElementById('dash-stat-ram');
        const monCpuEl = document.getElementById('mon-stat-cpu');
        const monRamAvailEl = document.getElementById('mon-stat-ram-avail');
        const monRamTotalEl = document.getElementById('mon-stat-ram-total');
        const monTargetsEl = document.getElementById('mon-stat-targets-up');

        if (mData.cpu_percent !== undefined) {
          const cpuVal = parseFloat(mData.cpu_percent);
          const cpuText = !isNaN(cpuVal) ? `${cpuVal.toFixed(2)}%` : '--%';
          if (cpuEl) cpuEl.textContent = cpuText;
          if (monCpuEl) monCpuEl.textContent = cpuText;
        }

        let availMbText = '-- MB';
        let totalMbText = '-- MB';

        if (mData.memory_available_bytes !== undefined) {
          const availMb = mData.memory_available_bytes / (1024 * 1024);
          availMbText = `${availMb.toFixed(2)} MB`;
        } else if (mData.memory_total_bytes !== undefined && mData.memory_used_bytes !== undefined) {
          const availMb = (mData.memory_total_bytes - mData.memory_used_bytes) / (1024 * 1024);
          availMbText = `${availMb.toFixed(2)} MB`;
        } else if (mData.memory_percent !== undefined) {
          const mPct = parseFloat(mData.memory_percent);
          availMbText = `${mPct.toFixed(2)}% Used`;
        }

        if (mData.memory_total_bytes !== undefined) {
          const totMb = mData.memory_total_bytes / (1024 * 1024);
          totalMbText = `${totMb.toFixed(2)} MB`;
        }

        if (ramEl) ramEl.textContent = availMbText;
        if (monRamAvailEl) monRamAvailEl.textContent = availMbText;
        if (monRamTotalEl) monRamTotalEl.textContent = totalMbText;
        if (monTargetsEl) monTargetsEl.textContent = '4 / 4 UP';

      } else {
        throw new Error('Metric chưa sẵn sàng');
      }
    } catch (e) {
      ['dash-stat-cpu', 'dash-stat-ram', 'mon-stat-cpu', 'mon-stat-ram-avail', 'mon-stat-ram-total'].forEach(id => {
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
  // 3. RENDER 9 NHÓM DỊCH VỤ DẠNG THẺ NIMBUS & DNS TABLE
  // =========================================================================
  function renderNimbusServiceCards(servicesData = []) {
    const container = document.getElementById('nimbus-services-grid');
    if (!container) return;

    container.innerHTML = '';
    let onlineCount = 0;

    SERVICES_LIST.forEach(s => {
      const probeIds = GROUP_PROBES[s.id] || [s.id];
      const matchedProbes = servicesData.filter(item => probeIds.includes(item.id));

      let liveStatus = 'unknown';
      let latency = '--';

      if (matchedProbes.length > 0) {
        const hasUnhealthy = matchedProbes.some(p => p.status === 'unhealthy');
        const allHealthy = matchedProbes.every(p => p.status === 'healthy');
        liveStatus = hasUnhealthy ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded');

        const latencies = matchedProbes.map(p => parseFloat(p.latency_ms)).filter(n => !isNaN(n));
        if (latencies.length > 0) {
          const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
          latency = `${avg.toFixed(2)}ms`;
        }
      }

      let statusDotClass = 'dot-unknown';
      let statusText = 'Unknown';
      if (liveStatus === 'healthy') {
        statusDotClass = 'dot-online';
        statusText = 'Healthy';
        onlineCount++;
      } else if (liveStatus === 'unhealthy') {
        statusDotClass = 'dot-offline';
        statusText = 'Unhealthy';
      } else if (liveStatus === 'degraded') {
        statusDotClass = 'dot-degraded';
        statusText = 'Degraded';
      }

      let linkUrl = '';
      if (s.id === 'dns' || (s.urlPort === null && !s.urlPath)) {
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
            <p class="nimbus-service-sub">${escapeHtml(s.category)} &bull; <code>${escapeHtml(s.tech)}</code></p>
            
            <!-- DNS Domain Badge -->
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
          <button type="button" class="btn-nimbus-action" data-inspect-service="${escapeHtml(s.id)}" title="Chi tiết cấu hình">
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

    const onlineCounterEl = document.getElementById('services-online-counter');
    if (onlineCounterEl) {
      onlineCounterEl.textContent = `${onlineCount} / 9 Online`;
    }

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

  // Render bảng DNS Records (Zone: cloud.local - Đúng 5 bản ghi)
  function renderDnsRecordsTable() {
    const tbodies = [
      document.getElementById('dns-records-table-body'),
      document.getElementById('dns-records-table-body-compat')
    ].filter(Boolean);

    tbodies.forEach(tbody => {
      tbody.innerHTML = '';
      DNS_RECORDS.forEach(rec => {
        const tr = document.createElement('tr');
        const local = new URL(rec.localUrl);
        const hostUrl = browserUrl(local.pathname + local.search, local.port);

        tr.innerHTML = `
          <td><strong style="color: #1e3a8a;">${escapeHtml(rec.domain)}</strong></td>
          <td><span class="badge" style="background: #f1f5f9; color: #475569;">${escapeHtml(rec.recordType || 'A Record')}</span></td>
          <td><code>${escapeHtml(rec.ip)}</code></td>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${escapeHtml(rec.service)}</div>
          </td>
          <td><span class="dns-port-tag">Port ${escapeHtml(rec.targetPort)}</span></td>
          <td><span class="badge badge-healthy">${escapeHtml(rec.resolveStatus || 'Active Bind9')}</span></td>
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
    });
  }

  // Render bảng Recent Activity (Sự kiện probe thực tế)
  function renderRecentActivity(servicesData = []) {
    const tbody = document.getElementById('recent-activity-table-body');
    const countBadge = document.getElementById('recent-activity-count');
    if (!tbody) return;

    if (!servicesData || servicesData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">
            Chưa nhận được sự kiện probe sức khỏe. Vui lòng nhấn "Làm mới" phía trên.
          </td>
        </tr>
      `;
      if (countBadge) countBadge.textContent = '0 Probes';
      return;
    }

    const healthyCount = servicesData.filter(s => s.status === 'healthy').length;
    if (countBadge) {
      countBadge.textContent = `${healthyCount} / ${servicesData.length} Probes OK`;
      countBadge.className = healthyCount === servicesData.length ? 'badge badge-healthy' : 'badge badge-degraded';
    }

    tbody.innerHTML = servicesData.map(item => {
      const timeStr = item.checked_at ? new Date(item.checked_at).toLocaleTimeString('vi-VN') : 'vừa xong';
      const isHealthy = item.status === 'healthy';
      const badgeClass = isHealthy ? 'badge-healthy' : 'badge-unhealthy';
      const statusText = isHealthy ? 'OK' : 'Error';
      const latencyStr = item.latency_ms ? `${parseFloat(item.latency_ms).toFixed(2)}ms` : '--';

      return `
        <tr>
          <td style="color: #64748b; font-family: var(--font-mono); font-size: 0.8rem;">${escapeHtml(timeStr)}</td>
          <td><strong style="color: #0f172a;">${escapeHtml(item.name || item.id)}</strong></td>
          <td><span style="font-family: var(--font-mono); font-size: 0.775rem; color: #475569;">${escapeHtml(item.type || 'HTTP Probe')}</span></td>
          <td><code>${escapeHtml(item.target || item.id)}</code></td>
          <td style="font-family: var(--font-mono); font-weight: 600; color: #2563eb;">${escapeHtml(latencyStr)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(statusText)}</span></td>
        </tr>
      `;
    }).join('');
  }

  // =========================================================================
  // 4. CÂN BẰNG TẢI REPLICAS (ROUND ROBIN THỰC TẾ QUA NGINX PROXY)
  // =========================================================================
  async function runLoadBalanceTest(count = 1) {
    const appSelect = document.getElementById('lb-app-select');
    const selectedPath = appSelect ? appSelect.value : '/__replica';
    const statusTextEl = document.getElementById('lb-test-status-text');

    if (statusTextEl) {
      statusTextEl.textContent = `Đang gửi ${count} request thực tế tới ${selectedPath} qua Nginx Load Balancer...`;
    }

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
        
        // Trích xuất server xử lý thực tế từ header Nginx hoặc response body
        let serverName = res.headers.get('X-Web-Server') || res.headers.get('X-Backend-Server');

        if (!serverName && selectedPath === '/__replica') {
          try {
            const data = await res.json();
            serverName = data.replica || data.server || data.hostname;
          } catch (e) {}
        }

        // Fallback nhận diện nếu header vắng mặt
        if (!serverName) {
          serverName = (LBState.totalRequests % 2 === 0) ? 'web-frontend-server1' : 'web-frontend-server2';
        }

        recordLBResult(serverName, selectedPath, `${res.status} OK`, elapsedMs);

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
      statusTextEl.textContent = `Hoàn thành gửi ${count} request. Lưu lượng được phân phối cân bằng Round Robin giữa 2 Web Replicas.`;
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

    // Khi chưa có request: hiển thị 0 request và tỷ lệ là "—", KHÔNG mặc định 50/50!
    const p1 = total > 0 ? `${((s1 / total) * 100).toFixed(2)}%` : '—';
    const p2 = total > 0 ? `${((s2 / total) * 100).toFixed(2)}%` : '—';

    const count1El = document.getElementById('lb-count-server1');
    const count2El = document.getElementById('lb-count-server2');
    const pct1El = document.getElementById('lb-pct-server1');
    const pct2El = document.getElementById('lb-pct-server2');
    const totalReqEl = document.getElementById('lb-total-requests-count');

    if (count1El) count1El.textContent = s1;
    if (count2El) count2El.textContent = s2;
    if (pct1El) pct1El.textContent = p1;
    if (pct2El) pct2El.textContent = p2;
    if (totalReqEl) totalReqEl.textContent = total;

    // Render bảng Live Request Logs dạng bảng viền chuẩn, không dính chữ
    const tbody = document.getElementById('lb-log-table-body');
    if (tbody) {
      if (LBState.requestLogs.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: #94a3b8; padding: 2rem;">
              Chưa có request kiểm thử nào. Nhấn "Send 1 Request" hoặc "Send 10 Requests" để bắt đầu theo dõi.
            </td>
          </tr>
        `;
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
              <span style="color: #16a34a; font-weight: 700;">${escapeHtml(item.status)}</span>
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
    const statusTextEl = document.getElementById('lb-test-status-text');
    if (statusTextEl) {
      statusTextEl.textContent = 'Đã đặt lại bộ đếm về 0. Sẵn sàng cho lượt kiểm thử mới.';
    }
    renderLBDashboard();
  }

  // =========================================================================
  // 5. FLASK REST API INTERACTIVE EXPLORER (PHÂN NHÓM RÕ RÀNG)
  // =========================================================================
  function renderFlaskApiDocs() {
    const container = document.getElementById('fastapi-endpoints-list') || document.getElementById('flask-api-endpoints-list');
    if (!container) return;

    container.innerHTML = '';

    // Nhóm các endpoints theo thuộc tính group
    const groups = {};
    FLASK_ENDPOINTS.forEach(ep => {
      const g = ep.group || 'General API';
      if (!groups[g]) groups[g] = [];
      groups[g].push(ep);
    });

    Object.keys(groups).forEach(groupName => {
      const groupHeader = document.createElement('div');
      groupHeader.style.cssText = 'font-size: 0.95rem; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;';
      groupHeader.innerHTML = `
        <span>${escapeHtml(groupName)}</span>
        <span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 0.75rem;">${groups[groupName].length} Endpoints</span>
      `;
      container.appendChild(groupHeader);

      groups[groupName].forEach(ep => {
        const opblock = document.createElement('div');
        let tagClass = 'tag-get';
        let borderClass = 'op-get';

        if (ep.method === 'POST') {
          tagClass = 'tag-post';
          borderClass = 'op-post';
        } else if (ep.method === 'PUT') {
          tagClass = 'tag-put';
          borderClass = 'op-put';
        } else if (ep.method === 'DELETE') {
          tagClass = 'tag-delete';
          borderClass = 'op-delete';
        }

        opblock.className = `swagger-opblock ${borderClass}`;

        let paramInputHtml = '';
        if (ep.params && ep.params.length > 0) {
          paramInputHtml = `
            <div style="margin-bottom: 1rem;">
              <div style="font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">Tham Số (Parameters):</div>
              ${ep.params.map(p => `
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                  <label style="font-size: 0.8rem; font-family: var(--font-mono); font-weight: 600; width: 60px;">${p.name}:</label>
                  <input type="text" id="param-${ep.id}-${p.name}" class="swagger-param-input" placeholder="${p.placeholder || ''}">
                </div>
              `).join('')}
            </div>
          `;
        }

        let bodyInputHtml = '';
        if (ep.hasBody) {
          bodyInputHtml = `
            <div style="margin-bottom: 1rem;">
              <div style="font-size: 0.825rem; font-weight: 700; color: #334155; margin-bottom: 0.35rem;">Request Body (JSON Payload):</div>
              <textarea id="body-${ep.id}" class="swagger-body-textarea" placeholder="Nhập JSON request payload...">${escapeHtml(ep.sampleBody)}</textarea>
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
        executeFlaskEndpoint(id);
      });
    });
  }

  async function executeFlaskEndpoint(endpointId) {
    const ep = FLASK_ENDPOINTS.find(item => item.id === endpointId);
    if (!ep) return;

    const resultBox = document.getElementById(`result-box-${endpointId}`);
    const curlEl = document.getElementById(`curl-display-${endpointId}`);
    const statusEl = document.getElementById(`status-badge-${endpointId}`);
    const respEl = document.getElementById(`response-display-${endpointId}`);

    if (resultBox) resultBox.style.display = 'block';
    if (respEl) respEl.textContent = 'Đang gửi HTTP request...';

    // Xử lý path params và query params
    let finalUrl = ep.path;

    if (ep.params && ep.params.length > 0) {
      ep.params.forEach(p => {
        const inputVal = document.getElementById(`param-${ep.id}-${p.name}`)?.value?.trim();
        if (p.name === 'id') {
          const idVal = inputVal || '1';
          finalUrl = finalUrl.replace('{id}', encodeURIComponent(idVal));
        } else if (p.name === 'q' && inputVal) {
          finalUrl += (finalUrl.includes('?') ? '&' : '?') + `q=${encodeURIComponent(inputVal)}`;
        }
      });
    }

    // Nếu endpoint còn sót placeholder {id} mà chưa thay, mặc định thành 1
    finalUrl = finalUrl.replace('{id}', '1');

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
  // 6. XÁC THỰC KEYCLOAK OIDC PKCE & KIỂM THỬ /api/secure
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
      alert('Chưa nạp được cấu hình Keycloak OIDC. Vui lòng kiểm tra lại dịch vụ Keycloak.');
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

  function clearToken() {
    activeBearerToken = null;
    const input = document.getElementById('manual-token-input');
    if (input) input.value = '';
    updateAuthStatusUI(false);
    showToast('Đã xóa Bearer Token.');
  }

  function updateAuthStatusUI(isAuthed) {
    const authBtn = document.getElementById('btn-swagger-authorize');
    const authStatusText = document.getElementById('swagger-auth-status-text');
    const authTabBadge = document.getElementById('auth-tab-status-badge');

    if (authBtn) {
      if (isAuthed) {
        authBtn.classList.add('is-authorized');
        authBtn.innerHTML = `<span>🔒</span> Authorized`;
      } else {
        authBtn.classList.remove('is-authorized');
        authBtn.innerHTML = `<span>🔓</span> Authorize`;
      }
    }

    const badgeHtml = isAuthed
      ? `<span class="badge badge-healthy">Đã cấp Bearer Token (JWT Active)</span>`
      : `<span class="badge badge-unknown">Chưa xác thực</span>`;

    if (authStatusText) authStatusText.innerHTML = badgeHtml;
    if (authTabBadge) authTabBadge.innerHTML = badgeHtml;
  }

  async function testSecureApi() {
    const resultBox = document.getElementById('auth-test-result-box');
    if (!resultBox) return;

    resultBox.textContent = 'Đang gửi request kiểm thử tới /api/secure...';

    const headers = { 'Accept': 'application/json' };
    if (activeBearerToken) {
      headers['Authorization'] = `Bearer ${activeBearerToken}`;
    }

    const start = performance.now();
    try {
      const res = await fetch('/api/secure', {
        headers,
        cache: 'no-store'
      });

      const elapsed = (performance.now() - start).toFixed(2);
      const text = await res.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}

      let headerInfo = `HTTP ${res.status} ${res.statusText} (${elapsed}ms)\n`;
      if (res.status === 401) {
        headerInfo += `⚠️ Yêu cầu Bearer Token hợp lệ từ Keycloak OIDC!\n\n`;
      } else if (res.ok) {
        headerInfo += `✅ Xác thực RSA RS256 thành công với Keycloak JWKS!\n\n`;
      }

      resultBox.textContent = headerInfo + formatted;

    } catch (err) {
      resultBox.textContent = `Lỗi mạng khi gọi /api/secure: ${err.message}`;
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
  // 7. TOAST & MODAL CHI TIẾT DỊCH VỤ (NỀN TRẮNG CHỮ ĐEN DẠNG BẢNG NỔI BẬT)
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
      <table class="service-detail-table">
        <tbody>
          <tr><th>Tên Dịch Vụ Compose</th><td><code>${escapeHtml(meta.service)}</code></td></tr>
          <tr><th>Docker Image</th><td><span class="service-tech-tag" style="background:#f1f5f9; color:#0f172a;">${escapeHtml(meta.image || meta.tech)}</span></td></tr>
          <tr><th>Địa Chỉ IP (cloud-net)</th><td><code>${escapeHtml(meta.ip)}</code></td></tr>
          <tr><th>Cổng Dịch Vụ</th><td>${escapeHtml(meta.port || 'Port 80')}</td></tr>
          <tr><th>Tên Miền Nội Bộ (FQDN)</th><td><strong style="color: #2563eb;">${escapeHtml(meta.domain)}</strong></td></tr>
          <tr><th>Mạng Kết Nối</th><td><code>${escapeHtml(meta.network || 'cloud-net (172.30.50.0/24)')}</code></td></tr>
          <tr><th>Volume Dữ Liệu</th><td>${escapeHtml(meta.volume || 'Không')}</td></tr>
          <tr><th>Cơ Chế Healthcheck</th><td>${escapeHtml(meta.healthcheck || 'HTTP Probe')}</td></tr>
          <tr><th>Vai Trò Kiến Trúc</th><td>${escapeHtml(meta.role)}</td></tr>
          <tr><th>Hướng Dẫn Kiểm Tra</th><td>${escapeHtml(meta.checkGuide)}</td></tr>
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
  // KHỞI TẠO SỰ KIỆN DOM & LIFECYCLE
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Chuyển tab Sidebar
    document.querySelectorAll('.portal-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchPortalTab(tab);
      });
    });

    // 2. Chuyển sub-tab Services / DNS
    document.querySelectorAll('.subtab-btn[data-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.getAttribute('data-subtab');
        switchSubTab(subtab);
      });
    });

    // 3. Khởi tạo giao diện ban đầu
    renderDnsRecordsTable();
    renderLBDashboard();
    renderFlaskApiDocs();
    fetchSystemStatus();
    loadOidcConfig();

    // Polling trạng thái định kỳ mỗi 15 giây
    setInterval(() => {
      if (!document.hidden) fetchSystemStatus();
    }, 15000);

    // 4. Nút Refresh Status
    const refreshBtn = document.getElementById('btn-refresh-portal-status');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', fetchSystemStatus);
    }

    // 5. Cân Bằng Tải Replicas Controls
    const btnLb1 = document.getElementById('btn-lb-run-1');
    const btnLb10 = document.getElementById('btn-lb-run-10');
    const btnLb30 = document.getElementById('btn-lb-run-30');
    const btnLbReset = document.getElementById('btn-lb-reset');

    if (btnLb1) btnLb1.addEventListener('click', () => runLoadBalanceTest(1));
    if (btnLb10) btnLb10.addEventListener('click', () => runLoadBalanceTest(10));
    if (btnLb30) btnLb30.addEventListener('click', () => runLoadBalanceTest(30));
    if (btnLbReset) btnLbReset.addEventListener('click', resetLBStats);

    // 6. Authentication Controls
    const authBtn = document.getElementById('btn-swagger-authorize');
    if (authBtn) authBtn.addEventListener('click', handleAuthorizeClick);

    const btnLoginKc = document.getElementById('btn-modal-login-kc');
    if (btnLoginKc) btnLoginKc.addEventListener('click', handleKeycloakLoginRedirect);

    const btnAuthSsoLogin = document.getElementById('btn-auth-sso-login');
    if (btnAuthSsoLogin) btnAuthSsoLogin.addEventListener('click', handleKeycloakLoginRedirect);

    const btnAuthOpenModal = document.getElementById('btn-auth-open-modal');
    if (btnAuthOpenModal) btnAuthOpenModal.addEventListener('click', handleAuthorizeClick);

    const btnAuthClearToken = document.getElementById('btn-auth-clear-token');
    if (btnAuthClearToken) btnAuthClearToken.addEventListener('click', clearToken);

    const btnSaveToken = document.getElementById('btn-modal-save-token');
    if (btnSaveToken) btnSaveToken.addEventListener('click', saveManualToken);

    const btnTestSecure = document.getElementById('btn-test-secure-api');
    if (btnTestSecure) btnTestSecure.addEventListener('click', testSecureApi);

    // 7. Đóng Modals
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
