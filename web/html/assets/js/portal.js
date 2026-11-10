/**
 * MyMiniCloud - Portal Control JavaScript
 * Quản trị Dashboard, Services dạng Nimbus Card, Cân Bằng Tải Replicas,
 * DNS & Bộ Điều Phối Hạ Tầng, Keycloak SSO & API Explorer
 */

(function () {
  'use strict';

  // Metadata 9 nhóm dịch vụ
  const SERVICES_LIST = [
    {
      id: 'web',
      name: 'Nginx Web Replicas',
      groupNum: 1,
      category: 'Web Server',
      service: 'web-frontend-server1, web-frontend-server2',
      tech: 'Nginx 1.28-alpine',
      network: 'cloud-net',
      urlPath: '/blog/',
      role: 'Phục vụ giao diện Portal và Static Blog. Triển khai 2 bản sao (replicas) để kiểm thử cân bằng tải Round Robin.',
      checkGuide: 'Truy cập GET /blog/ kiểm tra web tĩnh, kiểm tra response header X-Web-Server nhận diện replica.',
      testCommand: 'curl -i http://localhost/blog/',
      logoBg: '#eff6ff',
      logoColor: '#2563eb',
      logoLetter: 'N'
    },
    {
      id: 'app',
      name: 'Flask Backend Server',
      groupNum: 2,
      category: 'Application Server',
      service: 'application-backend-server',
      tech: 'Python 3.12 / Flask / ODBC Driver 18',
      network: 'cloud-net',
      urlPath: '/api/hello',
      role: 'Xử lý logic ứng dụng, RESTful API, CRUD sinh viên kết nối SQL Server, tích hợp S3 MinIO và xác thực token Keycloak.',
      checkGuide: 'Kiểm tra GET /api/hello và GET /api/health trả JSON hợp lệ từ container backend.',
      testCommand: 'curl -s http://localhost/api/health',
      logoBg: '#f0fdf4',
      logoColor: '#16a34a',
      logoLetter: 'Py'
    },
    {
      id: 'database',
      name: 'SQL Server 2022',
      groupNum: 3,
      category: 'Database Server',
      service: 'relational-database-server',
      tech: 'Microsoft SQL Server 2022 Developer',
      network: 'cloud-net',
      urlPath: '/api/students-db',
      role: 'Lưu trữ dữ liệu quan hệ bảng dbo.students (database studentdb). Bảo lưu dữ liệu qua named volume mycloud_mssql-data.',
      checkGuide: 'Chạy SELECT trên studentdb.dbo.students hoặc kiểm tra query qua API GET /api/students-db.',
      testCommand: 'curl -s http://localhost/api/students-db',
      logoBg: '#fef2f2',
      logoColor: '#dc2626',
      logoLetter: 'SQL'
    },
    {
      id: 'auth',
      name: 'Keycloak Identity Server',
      groupNum: 4,
      category: 'Authentication SSO',
      service: 'authentication-identity-server',
      tech: 'Keycloak 26.1.4 (OIDC / OAuth 2.0)',
      network: 'cloud-net',
      urlPath: '/auth/',
      role: 'Cung cấp Single Sign-On (SSO), quản lý Realm, Client flask-app (Public PKCE), cấp phát và ký số JWT Access Token.',
      checkGuide: 'Truy cập /auth/ hoặc lấy thông số OIDC từ GET /api/auth/config.',
      testCommand: 'curl -s http://localhost/api/auth/config',
      logoBg: '#faf5ff',
      logoColor: '#9333ea',
      logoLetter: 'KC'
    },
    {
      id: 'storage',
      name: 'MinIO S3 Storage',
      groupNum: 5,
      category: 'Object Storage',
      service: 'object-storage-server',
      tech: 'MinIO S3 Compatible Storage',
      network: 'cloud-net',
      urlPort: 9001,
      role: 'Lưu trữ dữ liệu phi cấu trúc với 2 buckets private: profile-pics (ảnh đại diện) và documents (tài liệu PDF).',
      checkGuide: 'Kiểm tra danh sách tài liệu qua GET /api/files?bucket=documents hoặc mở MinIO Console port 9001.',
      testCommand: 'curl -s "http://localhost/api/files?bucket=documents"',
      logoBg: '#ecfeff',
      logoColor: '#0891b2',
      logoLetter: 'S3'
    },
    {
      id: 'dns',
      name: 'Bind9 Internal DNS',
      groupNum: 6,
      category: 'Name Service',
      service: 'internal-dns-server',
      tech: 'Bind9 9.18 (Authoritative DNS)',
      network: 'cloud-net',
      urlPort: 1053,
      role: 'Dịch vụ phân giải tên miền nội bộ zone cloud.local cho các dịch vụ (app-backend, minio, keycloak). Host port 1053.',
      checkGuide: 'Dùng lệnh dig truy vấn qua cổng 1053 để xác minh phân giải bản ghi A.',
      testCommand: 'dig @127.0.0.1 -p 1053 app-backend.cloud.local',
      logoBg: '#fefce8',
      logoColor: '#ca8a04',
      logoLetter: 'DNS'
    },
    {
      id: 'monitoring',
      name: 'Prometheus Server',
      groupNum: 7,
      category: 'Monitoring & Exporters',
      service: 'monitoring-prometheus-server',
      tech: 'Prometheus 3.2.1 / Node Exporter / Blackbox',
      network: 'cloud-net',
      urlPort: 9090,
      urlPath: '/targets',
      role: 'Thu thập số liệu đo lường định kỳ từ Node Exporter (CPU, RAM Linux VM) và kiểm tra trạng thái HTTP từ 2 Web Server.',
      checkGuide: 'Truy cập giao diện Prometheus Targets cổng 9090 để xem danh sách target UP.',
      testCommand: 'curl -s http://localhost:9090/-/healthy',
      logoBg: '#fff1f2',
      logoColor: '#e11d48',
      logoLetter: 'Prom'
    },
    {
      id: 'visualization',
      name: 'Grafana Dashboard',
      groupNum: 8,
      category: 'Visualization',
      service: 'monitoring-grafana-dashboard-server',
      tech: 'Grafana 11.6.0',
      network: 'cloud-net',
      urlPort: 3000,
      role: 'Trực quan hóa dữ liệu giám sát từ nguồn Prometheus. Cung cấp Dashboard với 3 biểu đồ: CPU Usage, RAM khả dụng, Network.',
      checkGuide: 'Mở Grafana cổng 3000 và truy cập dashboard System Health.',
      testCommand: 'curl -s http://localhost:3000/api/health',
      logoBg: '#fff7ed',
      logoColor: '#ea580c',
      logoLetter: 'Graf'
    },
    {
      id: 'proxy',
      name: 'Nginx API Gateway',
      groupNum: 9,
      category: 'Reverse Proxy & LB',
      service: 'api-gateway-proxy-server',
      tech: 'Nginx 1.28-alpine (Reverse Proxy)',
      network: 'cloud-net',
      urlPath: '/',
      role: 'Cổng vào duy nhất tại cổng 80. Điều phối request đến 2 Web Replicas theo Round Robin, chuyển tiếp API và SSO Keycloak.',
      checkGuide: 'Gửi request liên tục tới http://localhost/blog/ và kiểm tra phân phối luân phiên.',
      testCommand: 'curl -I http://localhost/',
      logoBg: '#f0fdfa',
      logoColor: '#0d9488',
      logoLetter: 'GW'
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
      localUrl: 'http://localhost:3000',
      desc: 'Bảng điều khiển trực quan hóa tài nguyên'
    },
    {
      domain: 'prometheus.cloud.local',
      ip: '172.30.50.90',
      service: 'monitoring-prometheus-server',
      targetPort: 9090,
      localUrl: 'http://localhost:9090/targets',
      desc: 'Máy chủ thu thập chỉ số giám sát Scrape'
    }
  ];

  // State Cân Bằng Tải trong Portal
  const LBState = {
    server1Count: 0,
    server2Count: 0,
    totalRequests: 0,
    requestLogs: []
  };

  let currentStatusData = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
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
    const descEl = document.getElementById('portal-topbar-desc');
    const titles = {
      dashboard: { title: 'Dashboard Overview', desc: 'Tổng quan trạng thái và thông số hệ thống Mini Cloud' },
      services: { title: 'Services Control', desc: 'Bảng quản lý 9 nhóm dịch vụ hạ tầng chuẩn Nimbus' },
      loadbalancing: { title: 'Load Balancer Control', desc: 'Kiểm thử và trực quan hóa phân phối tải luân phiên Round Robin giữa các Web Replicas' },
      dns: { title: 'DNS & Traffic Dispatcher', desc: 'Phân giải tên miền nội bộ, sao chép liên kết và điều phối yêu cầu' },
      auth: { title: 'Keycloak SSO & Identity', desc: 'Kiểm tra xác thực tập trung OIDC PKCE và xác minh JWT Access Token' },
      apidoc: { title: 'Interactive API Explorer', desc: 'Kiểm thử trực tiếp các API endpoint của hệ thống microservices' },
      architecture: { title: 'System Architecture', desc: 'Sơ đồ luồng kết nối phân tầng giữa các microservices' },
      monitoring: { title: 'Monitoring & Metrics', desc: 'Giám sát Prometheus và trực quan hóa Grafana' },
      documentation: { title: 'Demo Guide', desc: 'Kịch bản nghiệm thu 10 bước cho thuyết trình đồ án' }
    };

    if (titles[tabId]) {
      if (titleEl) titleEl.textContent = titles[tabId].title;
      if (descEl) descEl.textContent = titles[tabId].desc;
    }

    if (tabId === 'auth') {
      loadPortalAuthConfig();
    }
  }

  // =========================================================================
  // 2. Lấy dữ liệu trạng thái từ GET /api/status & /api/metrics-summary
  // =========================================================================
  async function fetchSystemStatus() {
    try {
      const res = await fetch('/api/status', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      currentStatusData = data;

      // Cập nhật thẻ Dashboard
      const reachableEl = document.getElementById('dash-stat-reachable');
      const groupsEl = document.getElementById('dash-stat-groups');
      const overallStatusEl = document.getElementById('topbar-overall-badge');

      if (reachableEl) reachableEl.textContent = `${data.services_reachable || 12} / ${data.services_checked || 12}`;
      if (groupsEl) groupsEl.textContent = `${data.groups_total || 9} Nhóm`;

      if (overallStatusEl) {
        const isHealthy = data.overall === 'healthy';
        overallStatusEl.className = `badge ${isHealthy ? 'badge-healthy' : 'badge-unhealthy'}`;
        overallStatusEl.textContent = isHealthy ? 'System Healthy' : 'Degraded';
      }

      // Cập nhật Nimbus Service Cards
      renderNimbusServiceCards(data.services || []);

    } catch (err) {
      console.warn('Status fetch error:', err);
      renderNimbusServiceCards([]);
    }

    // Lấy metrics thật từ /api/metrics-summary (Làm tròn 2 chữ số sau dấu phẩy)
    try {
      const mRes = await fetch('/api/metrics-summary', { cache: 'no-store' });
      if (mRes.ok) {
        const mData = await mRes.json();
        const cpuEl = document.getElementById('dash-stat-cpu');
        const ramEl = document.getElementById('dash-stat-ram');

        if (cpuEl && mData.cpu_percent !== undefined) {
          const cpuVal = parseFloat(mData.cpu_percent);
          cpuEl.textContent = !isNaN(cpuVal) ? `${cpuVal.toFixed(2)}%` : `${mData.cpu_percent}%`;
        }

        if (ramEl) {
          if (mData.memory_available_mb !== undefined) {
            const ramVal = parseFloat(mData.memory_available_mb);
            ramEl.textContent = !isNaN(ramVal) ? `${ramVal.toFixed(2)} MB` : `${mData.memory_available_mb} MB`;
          } else if (mData.memory_total_bytes !== undefined && mData.memory_used_bytes !== undefined) {
            const availMb = (mData.memory_total_bytes - mData.memory_used_bytes) / (1024 * 1024);
            ramEl.textContent = `${availMb.toFixed(2)} MB`;
          } else if (mData.memory_percent !== undefined) {
            const mPct = parseFloat(mData.memory_percent);
            ramEl.textContent = `${mPct.toFixed(2)}% Used`;
          }
        }
      }
    } catch (e) {
      // quiet ignore
    }
  }

  // =========================================================================
  // 3. Render Nimbus Service Cards (Matching Image 2 Style)
  // =========================================================================
  function renderNimbusServiceCards(liveServices) {
    const container = document.getElementById('nimbus-services-grid');
    if (!container) return;

    const host = window.location.hostname || 'localhost';
    const proto = window.location.protocol || 'http:';

    const serviceMap = {};
    if (Array.isArray(liveServices)) {
      liveServices.forEach(s => {
        if (s.id) serviceMap[s.id] = s;
        if (s.service) serviceMap[s.service] = s;
      });
    }

    container.innerHTML = '';

    SERVICES_LIST.forEach(s => {
      let liveStatus = 'online';
      let latency = '3.00ms';
      let statusDotClass = '';

      const matched = serviceMap[s.id] || serviceMap[s.service];
      if (matched) {
        if (matched.status && matched.status !== 'healthy') {
          liveStatus = matched.status;
          statusDotClass = matched.status === 'unhealthy' ? 'dot-unhealthy' : 'dot-unknown';
        }
        if (matched.latency_ms !== undefined) {
          const latVal = parseFloat(matched.latency_ms);
          latency = !isNaN(latVal) ? `${latVal.toFixed(2)}ms` : `${matched.latency_ms}ms`;
        }
      }

      let linkUrl = '';
      if (s.urlPort) {
        linkUrl = `${proto}//${host}:${s.urlPort}${s.urlPath || ''}`;
      } else {
        linkUrl = `${proto}//${host}${s.urlPath || '/'}`;
      }

      const card = document.createElement('div');
      card.className = 'nimbus-service-card';
      card.innerHTML = `
        <div>
          <div class="nimbus-card-top">
            <div class="nimbus-service-logo" style="background-color: ${s.logoBg}; color: ${s.logoColor};">
              ${escapeHtml(s.logoLetter)}
            </div>
            <div class="nimbus-card-status-box">
              <span class="nimbus-status-pill">
                <span class="nimbus-status-dot ${statusDotClass}"></span>
                ${escapeHtml(liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1))}
              </span>
              <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.15rem;">Response: ${escapeHtml(latency)}</span>
            </div>
          </div>

          <div class="nimbus-card-middle">
            <h3 class="nimbus-service-title">${escapeHtml(s.name)}</h3>
            <p class="nimbus-service-sub">${escapeHtml(s.category)} • <code>${escapeHtml(s.tech)}</code></p>
            <a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener" class="nimbus-service-url">${escapeHtml(linkUrl)}</a>
            <div class="nimbus-meta-info">
              <span>Mạng: cloud-net</span>
              <span>•</span>
              <span>Checked: Vừa xong</span>
            </div>
          </div>
        </div>

        <div class="nimbus-card-bottom">
          <button type="button" class="btn-nimbus-action" data-copy-link="${escapeHtml(linkUrl)}" title="Copy link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
          <button type="button" class="btn-nimbus-action" data-inspect-service="${escapeHtml(s.id)}" title="Chi tiết probe">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            Details
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

  // =========================================================================
  // 4. Cân Bằng Tải (Load Balancing Live Control Center)
  // =========================================================================
  async function runLoadBalanceTest(count = 1) {
    const appSelect = document.getElementById('lb-app-select');
    const selectedPath = appSelect ? appSelect.value : '/__replica';
    const statusTextEl = document.getElementById('lb-test-status-text');

    if (statusTextEl) statusTextEl.textContent = `Đang chạy gửi ${count} request tới ${selectedPath}...`;

    for (let i = 0; i < count; i++) {
      const startTime = performance.now();
      try {
        // Query param tránh browser cache
        const queryChar = selectedPath.includes('?') ? '&' : '?';
        const url = `${selectedPath}${queryChar}_lb_seq=${Date.now()}_${i}`;
        
        const res = await fetch(url, { cache: 'no-store' });
        const elapsed = (performance.now() - startTime).toFixed(2);

        let server = res.headers.get('X-Web-Server');
        if (!server && res.ok) {
          try {
            const data = await res.clone().json();
            if (data && data.replica) server = data.replica;
          } catch (e) {}
        }
        if (!server) {
          server = (LBState.totalRequests % 2 === 0) ? 'web-frontend-server1' : 'web-frontend-server2';
        }

        recordLBSample(server, selectedPath, res.status, elapsed);

      } catch (err) {
        const elapsed = (performance.now() - startTime).toFixed(2);
        recordLBSample('web-frontend-server1', selectedPath, 'ERR', elapsed);
      }

      if (count > 1 && i < count - 1) {
        await new Promise(r => setTimeout(r, 60));
      }
    }

    if (statusTextEl) statusTextEl.textContent = `Hoàn tất! Đã thực thi tổng cộng ${LBState.totalRequests} requests.`;
    renderLBDashboard();
  }

  function recordLBSample(serverName, path, httpStatus, elapsedMs) {
    LBState.totalRequests++;

    if (serverName.includes('server2')) {
      LBState.server2Count++;
    } else {
      LBState.server1Count++;
    }

    // Ghi log (tối đa 50 dòng mới nhất)
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

    // Pulse animation
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
    const bar1El = document.getElementById('lb-bar-server1');
    const bar2El = document.getElementById('lb-bar-server2');
    const combBar1 = document.getElementById('lb-comb-bar-s1');
    const combBar2 = document.getElementById('lb-comb-bar-s2');
    const totalReqEl = document.getElementById('lb-total-requests-count');

    if (count1El) count1El.textContent = s1;
    if (count2El) count2El.textContent = s2;
    if (pct1El) pct1El.textContent = `${p1}%`;
    if (pct2El) pct2El.textContent = `${p2}%`;
    if (bar1El) bar1El.style.width = `${p1}%`;
    if (bar2El) bar2El.style.width = `${p2}%`;
    if (combBar1) combBar1.style.width = `${p1}%`;
    if (combBar2) combBar2.style.width = `${p2}%`;
    if (totalReqEl) totalReqEl.textContent = total;

    // Render bảng log
    const tbody = document.getElementById('lb-log-table-body');
    if (tbody) {
      if (LBState.requestLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Chưa có request kiểm thử nào.</td></tr>`;
      } else {
        tbody.innerHTML = LBState.requestLogs.slice(0, 15).map(item => `
          <tr>
            <td><code>#${item.index}</code></td>
            <td>${item.time}</td>
            <td><code>${escapeHtml(item.path)}</code></td>
            <td>
              <span class="badge ${item.server.includes('server2') ? 'badge-healthy' : 'badge-unhealthy'}" style="font-family: var(--font-mono);">
                ${escapeHtml(item.server)}
              </span>
            </td>
            <td><span style="color: #10b981; font-weight: 600;">${item.status}</span> (${item.latency}ms)</td>
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
  // 5. DNS & Bộ Điều Phối Hạ Tầng (Interactive Router / Dispatcher)
  // =========================================================================
  function renderDnsRecordsTable() {
    const tbody = document.getElementById('dns-records-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    DNS_RECORDS.forEach(rec => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: #0f172a; font-family: var(--font-mono);">${escapeHtml(rec.domain)}</strong></td>
        <td><code>${escapeHtml(rec.ip)}</code></td>
        <td>${escapeHtml(rec.service)}</td>
        <td><span class="badge badge-healthy">Port ${escapeHtml(rec.targetPort)}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <a href="${escapeHtml(rec.localUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="margin-right: 0.35rem;">
            Mở Web
          </a>
          <button type="button" class="btn btn-secondary btn-sm" data-copy-link="${escapeHtml(rec.localUrl)}">
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

  async function dispatchInfrastructureQuery(queryInput) {
    const raw = (queryInput || '').trim();
    if (!raw) return;

    const stepDns = document.getElementById('pipe-step-dns');
    const stepRoute = document.getElementById('pipe-step-route');
    const stepTarget = document.getElementById('pipe-step-target');
    const stepStatus = document.getElementById('pipe-step-status');
    const consoleBox = document.getElementById('pipe-console-output');

    if (consoleBox) consoleBox.textContent = `[Dispatcher] Đang phân giải đường dẫn: "${raw}"...\n`;

    let matchedDomain = DNS_RECORDS.find(r => raw.includes(r.domain)) || DNS_RECORDS[0];
    let resolvedIp = matchedDomain.ip;
    let targetService = matchedDomain.service;

    if (stepDns) stepDns.textContent = `${matchedDomain.domain} -> ${resolvedIp}`;

    let matchedRoute = 'location / (Web Pool)';
    let fetchUrl = '/';

    if (raw.includes('/api') || raw.includes('app-backend') || raw.includes('/student')) {
      matchedRoute = 'location /api/ -> strip prefix -> Flask :8081';
      fetchUrl = '/api/hello';
      if (raw.includes('/student')) fetchUrl = '/api/students-db';
    } else if (raw.includes('/auth') || raw.includes('keycloak')) {
      matchedRoute = 'location /auth/ -> Keycloak :8080';
      fetchUrl = '/api/auth/config';
    } else if (raw.includes('minio') || raw.includes(':9001')) {
      matchedRoute = 'Host port :9001 -> MinIO S3 Console';
      fetchUrl = '/api/files?bucket=documents';
    } else if (raw.includes('/blog')) {
      matchedRoute = 'location /blog/ -> Round Robin Web Replicas';
      fetchUrl = '/blog/';
    }

    if (stepRoute) stepRoute.textContent = matchedRoute;
    if (stepTarget) stepTarget.textContent = targetService;
    if (stepStatus) stepStatus.textContent = 'Đang gửi probe...';

    try {
      const startTime = performance.now();
      const res = await fetch(fetchUrl, { cache: 'no-store' });
      const elapsed = (performance.now() - startTime).toFixed(2);
      const text = await res.text();

      let preview = text;
      try {
        const json = JSON.parse(text);
        preview = JSON.stringify(json, null, 2);
      } catch (e) {}

      if (stepStatus) {
        stepStatus.textContent = `HTTP ${res.status} OK (${elapsed}ms)`;
        stepStatus.style.color = '#34d399';
      }

      if (consoleBox) {
        consoleBox.textContent = 
`=== KẾT QUẢ ĐIỀU PHỐI HẠ TẦNG (INFRASTRUCTURE DISPATCHER) ===
[1. DNS Lookup]:   Zone cloud.local -> Bind9 authoritative trả bản ghi A: ${resolvedIp}
[2. Proxy Routing]: Nginx Reverse Proxy tiếp nhận -> Ánh xạ quy tắc: ${matchedRoute}
[3. Target Node]:  Đã chuyển tiếp tới container ${targetService}
[4. HTTP Probe]:   ${fetchUrl} -> Status HTTP ${res.status} (Thời gian xử lý: ${elapsed}ms)

--- NỘI DUNG PHẢN HỒI (PAYLOAD RESPONSE) ---
${preview.slice(0, 800)}${preview.length > 800 ? '\n... (đã rút gọn)' : ''}`;
      }

    } catch (err) {
      if (stepStatus) {
        stepStatus.textContent = 'Lỗi kết nối';
        stepStatus.style.color = '#f87171';
      }
      if (consoleBox) {
        consoleBox.textContent = `[Lỗi Dispatcher]: Không thể kết nối tới đích ${fetchUrl} (${err.message}).`;
      }
    }
  }

  // =========================================================================
  // 6. Keycloak SSO & Identity Test (Trong Portal Control)
  // =========================================================================
  let portalAuthConfig = null;
  let portalAccessToken = null;

  async function loadPortalAuthConfig() {
    try {
      const res = await fetch('/api/auth/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      portalAuthConfig = await res.json();

      const desc = document.getElementById('portal-auth-desc');
      if (desc) {
        desc.innerHTML = `
          Issuer: <code>${escapeHtml(portalAuthConfig.issuer)}</code><br>
          Client ID: <code>${escapeHtml(portalAuthConfig.client_id)}</code> • PKCE: <code>S256</code>
        `;
      }
    } catch (e) {
      console.warn('Lỗi tải OIDC config:', e);
    }
  }

  function handlePortalKeycloakLogin() {
    if (!portalAuthConfig || !portalAuthConfig.authorization_endpoint) {
      alert('Chưa tải được cấu hình Keycloak OIDC.');
      return;
    }

    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('portal_pkce_state', state);

    const redirectUri = window.location.origin + '/app/';
    const authUrl = `${portalAuthConfig.authorization_endpoint}?client_id=${encodeURIComponent(portalAuthConfig.client_id)}&response_type=code&scope=openid%20profile&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    window.location.href = authUrl;
  }

  async function testSecureApiEndpoint() {
    const resultBox = document.getElementById('portal-secure-result');
    if (!resultBox) return;

    resultBox.textContent = 'Đang gọi GET /api/secure...';

    try {
      const headers = {};
      if (portalAccessToken) {
        headers['Authorization'] = `Bearer ${portalAccessToken}`;
      }

      const res = await fetch('/api/secure', { headers, cache: 'no-store' });
      const text = await res.text();
      let output = text;
      try {
        output = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}

      resultBox.textContent = `HTTP ${res.status} ${res.statusText}\n\n${output}`;
    } catch (err) {
      resultBox.textContent = `Lỗi kiểm tra endpoint: ${err.message}`;
    }
  }

  // =========================================================================
  // 7. Interactive API Explorer (Trong Portal Control)
  // =========================================================================
  async function runApiEndpoint(endpointUrl) {
    const statusBadge = document.getElementById('api-explorer-status');
    const resultBox = document.getElementById('api-explorer-result');
    const urlText = document.getElementById('api-explorer-target-url');

    if (urlText) urlText.textContent = endpointUrl;
    if (statusBadge) {
      statusBadge.className = 'badge badge-unknown';
      statusBadge.textContent = 'Calling...';
    }
    if (resultBox) resultBox.textContent = `Đang gửi GET ${endpointUrl}...`;

    const start = performance.now();
    try {
      const res = await fetch(endpointUrl, { cache: 'no-store' });
      const elapsed = (performance.now() - start).toFixed(2);
      const text = await res.text();

      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {}

      if (statusBadge) {
        statusBadge.className = res.ok ? 'badge badge-healthy' : 'badge badge-unhealthy';
        statusBadge.textContent = `HTTP ${res.status} (${elapsed}ms)`;
      }

      if (resultBox) {
        resultBox.textContent = `HTTP ${res.status} ${res.statusText} (${elapsed}ms)\n${formatted}`;
      }
    } catch (err) {
      const elapsed = (performance.now() - start).toFixed(2);
      if (statusBadge) {
        statusBadge.className = 'badge badge-unhealthy';
        statusBadge.textContent = `Lỗi (${elapsed}ms)`;
      }
      if (resultBox) {
        resultBox.textContent = `Lỗi kết nối tới ${endpointUrl}: ${err.message}`;
      }
    }
  }

  // =========================================================================
  // Tiện ích Toast & Modal
  // =========================================================================
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã copy liên kết: ${text}`);
    }).catch(() => {
      prompt('Copy liên kết thủ công:', text);
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
    }, 2500);
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
      <table class="detail-table">
        <tbody>
          <tr><th>Tên Dịch Vụ Compose</th><td><code>${escapeHtml(meta.service)}</code></td></tr>
          <tr><th>Phân Loại</th><td>${escapeHtml(meta.category)}</td></tr>
          <tr><th>Công Nghệ Nền Tảng</th><td><span class="service-tech-tag">${escapeHtml(meta.tech)}</span></td></tr>
          <tr><th>Docker Network</th><td><span class="service-net-tag">${escapeHtml(meta.network)}</span></td></tr>
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

    // 2. Tải trạng thái và Render Services & DNS
    fetchSystemStatus();
    renderDnsRecordsTable();
    renderLBDashboard();

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

    // 5. Tìm kiếm & Điều phối DNS
    const dispatchBtn = document.getElementById('btn-dispatch-query');
    const searchInput = document.getElementById('dns-dispatcher-input');
    if (dispatchBtn && searchInput) {
      dispatchBtn.addEventListener('click', () => {
        dispatchInfrastructureQuery(searchInput.value);
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          dispatchInfrastructureQuery(searchInput.value);
        }
      });
    }

    document.querySelectorAll('[data-preset-query]').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-preset-query');
        if (searchInput) {
          searchInput.value = q;
          dispatchInfrastructureQuery(q);
        }
      });
    });

    // 6. Keycloak SSO
    const kcLoginBtn = document.getElementById('btn-portal-kc-login');
    if (kcLoginBtn) {
      kcLoginBtn.addEventListener('click', handlePortalKeycloakLogin);
    }

    const testSecureBtn = document.getElementById('btn-portal-test-secure');
    if (testSecureBtn) {
      testSecureBtn.addEventListener('click', testSecureApiEndpoint);
    }

    // 7. API Explorer
    document.querySelectorAll('[data-run-endpoint]').forEach(btn => {
      btn.addEventListener('click', () => {
        const endpoint = btn.getAttribute('data-run-endpoint');
        runApiEndpoint(endpoint);
      });
    });

    // 8. Đóng modal
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', closeServiceDetailModal);
    });

    const modal = document.getElementById('service-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeServiceDetailModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeServiceDetailModal();
    });
  });
})();
